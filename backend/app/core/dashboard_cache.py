"""In-memory dashboard cache, rebuilt on demand or invalidated by events."""
import time, os, sqlite3
from collections import defaultdict
from datetime import datetime, timedelta, timezone, UTC
from app.core.database import get_db, DB_PATH, get_conn

_cache = None
_cache_ts = 0
_cache_dirty = True
_CACHE_TTL = 180

_cache_by_channel = {}
_stock_risk_cache = {}
_cache_version = 0

def _compute_funnel(orders):
    """Order conversion funnel."""
    total = len(orders)
    statuses = {"待确认": 0, "待发货": 0, "已发货": 0, "已完成": 0, "申请退款": 0}
    for x in orders:
        s = x.get("order_status") or "未知"
        if s in statuses: statuses[s] += 1
        else: statuses["未知"] = statuses.get("未知", 0) + 1
    stages = [("总订单", total, 100.0)]
    for name in ["待确认", "待发货", "已发货", "已完成"]:
        v = statuses.get(name, 0)
        stages.append((name, v, round(v / total * 100, 1) if total else 0))
    result = []
    for i, (name, count, pct) in enumerate(stages):
        prev = stages[i - 1][1] if i > 0 else total
        conv = round(min(count / prev * 100, 100), 1) if prev else 0
        result.append({"name": name, "value": count, "percentage": pct, "conversion": conv})
    return result

def _compute_period_trends(conn, ch, today):
    """Compute period trends (today/week/month) using SQL."""
    from datetime import timedelta, UTC
    periods = {}
    for pname, pdays in [('today', 1), ('week', 7), ('month', 30)]:
        cutoff = (today - timedelta(days=pdays - 1)).isoformat()
        rows = conn.execute("SELECT ordered_at, SUM(total_amount) as g, COUNT(*) as cnt FROM orders WHERE channel=? AND ordered_at>=? AND order_status='已完成' AND (deleted_at IS NULL OR deleted_at='') GROUP BY ordered_at", (ch, cutoff)).fetchall()
        daily = {}
        for r in rows:
            date_str = r[0][5:] if r[0] else '未知'
            if date_str not in daily: daily[date_str] = {"gmv": 0, "orders": 0}
            daily[date_str]["gmv"] += r[1]
            daily[date_str]["orders"] += r[2]
        periods[pname] = {"gmv": sum(v["gmv"] for v in daily.values()), "orders": sum(v["orders"] for v in daily.values())}
        periods[pname + "_trend"] = [{"日期": k, "GMV": round(v["gmv"], 2), "订单数": v["orders"]} for k, v in sorted(daily.items())]
    return periods

def _compute_health(inv):
    """Inventory health index."""
    def _score(items):
        total = len(items)
        healthy = sum(1 for x in items if int(x.get("available_qty") or 0) >= int(x.get("safety_qty") or 0))
        warning = sum(1 for x in items if 0 < int(x.get("available_qty") or 0) < int(x.get("safety_qty") or 0))
        out_of_stock = sum(1 for x in items if int(x.get("available_qty") or 0) == 0)
        score = round(healthy / total * 100, 0) if total else 100
        return {"score": score, "healthy": healthy, "warning": warning, "out_of_stock": out_of_stock,
                "total": total, "level": "good" if score >= 85 else ("warning" if score >= 60 else "danger")}
    own = [x for x in inv if x.get('warehouse_type') == 'own']
    plat = [x for x in inv if x.get('warehouse_type') == 'platform']
    platformB = [x for x in inv if x.get('warehouse_type') == 'platform_b']
    bc = plat + platformB
    return {"own": _score(own), "platform": _score(plat), "platform_b": _score(platformB), "bc": _score(bc),
            "score": _score(inv)["score"], "level": _score(inv)["level"]}

from app.core.database import DB_PATH as _DB_PATH

def _rebuild(channel='jd'):
    """Full rebuild of dashboard data from database using SQL aggregation."""
    conn = get_conn()
    ch = channel
    # 90 天窗口：只聚合最近 90 天订单（配合数据归档策略）
    from datetime import timedelta, UTC
    from concurrent.futures import ThreadPoolExecutor
    _today = datetime.now(UTC).date()
    _cut90 = (_today - timedelta(days=90)).isoformat()
    
    # 注：dashboard GMV 只统计"已完成"订单，daily_stats 聚合的是全部订单（口径不一致）
    # 因此 dashboard 仍从 orders 聚合（已加 90 天窗口 + idx_orders_ch_status 索引提速）
    # 合并 4 个独立聚合为 1 次查询（COUNT CASE WHEN 替代多个 COUNT/SUM）
    _agg = conn.execute("""
        SELECT 
            COALESCE(SUM(CASE WHEN order_status='已完成' THEN total_amount ELSE 0 END), 0),
            COUNT(CASE WHEN order_status='待发货' THEN 1 END),
            COUNT(CASE WHEN order_status='申请退款' THEN 1 END),
            COUNT(*)
        FROM orders WHERE channel=? AND ordered_at>=? AND (deleted_at IS NULL OR deleted_at='')
    """, (ch, _cut90)).fetchone()
    gmv, pending, refund, total_orders = _agg[0], _agg[1], _agg[2], _agg[3]
    
    # 并行执行 3 个独立大查询（独立连接，互不阻塞）
    def _q_rows():
        import sqlite3
        _c = sqlite3.connect(_DB_PATH)
        _c.row_factory = sqlite3.Row
        _c.execute("PRAGMA busy_timeout=30000")
        return _c.execute("SELECT substr(ordered_at,1,10) as d, order_status, SUM(total_amount) as g, COUNT(*) as cnt FROM orders WHERE channel=? AND ordered_at>=? AND (deleted_at IS NULL OR deleted_at='') GROUP BY d, order_status", (ch, _cut90)).fetchall()
    def _q_stores():
        import sqlite3
        _c = sqlite3.connect(_DB_PATH)
        _c.row_factory = sqlite3.Row
        _c.execute("PRAGMA busy_timeout=30000")
        return _c.execute("SELECT store, COUNT(*) as cnt, SUM(CASE WHEN order_status='已完成' THEN total_amount ELSE 0 END) as g FROM orders WHERE channel=? AND ordered_at>=? AND (deleted_at IS NULL OR deleted_at='') GROUP BY store ORDER BY store", (ch, _cut90)).fetchall()
    def _q_inv():
        import sqlite3
        _c = sqlite3.connect(_DB_PATH)
        _c.row_factory = sqlite3.Row
        _c.execute("PRAGMA busy_timeout=30000")
        return _c.execute("SELECT sku, product_name, warehouse, warehouse_type, available_qty, safety_qty, store FROM inventory WHERE channel=?", (ch,)).fetchall()
    with ThreadPoolExecutor(max_workers=3) as _ex:
        _f_rows = _ex.submit(_q_rows)
        _f_stores = _ex.submit(_q_stores)
        _f_inv = _ex.submit(_q_inv)
        rows = _f_rows.result()
        store_rows = _f_stores.result()
        inv = _f_inv.result()
    by_date = {}
    for r in rows:
        key = r[0][5:] if r[0] else '未知'
        if key not in by_date: by_date[key] = {"订单数": 0, "GMV": 0}
        by_date[key]["订单数"] += r[3]
        if r[1] == '已完成': by_date[key]["GMV"] += r[2]
    trend = [{"日期": k, **v} for k, v in sorted(by_date.items())]
    
    stores = [{"name": r[0], "orders": r[1], "gmv": r[2]} for r in store_rows]
    
    # 从 trend 原始数据聚合状态分布（避免独立 GROUP BY 查询）
    _status_agg = {}
    for r in rows:
        _st = r[1] or '未知'
        _status_agg[_st] = _status_agg.get(_st, 0) + r[3]
    status_dist = [{"name": k, "value": v} for k, v in _status_agg.items()]
    
    inv_list = [{"sku":r[0],"product_name":r[1],"warehouse":r[2],"warehouse_type":r[3],"available_qty":r[4],"safety_qty":r[5],"store":r[6]} for r in inv]
    
    low_stock = len([x for x in inv_list if int(x.get('available_qty') or 0) < int(x.get('safety_qty') or 0)])
    store_low = {}
    for x in inv_list:
        s = x.get('store') or ''
        store_low[s] = store_low.get(s, 0) + (1 if int(x.get('available_qty') or 0) < int(x.get('safety_qty') or 0) else 0)
    for s in stores:
        s['low_stock'] = store_low.get(s['name'], 0)
    
    product_count = conn.execute("SELECT COUNT(*) FROM products WHERE channel=?", (ch,)).fetchone()[0]
    supplier_count = conn.execute("SELECT COUNT(*) FROM suppliers").fetchone()[0]
    alert_count = conn.execute("SELECT COUNT(*) FROM alerts WHERE channel=? AND status='active'", (ch,)).fetchone()[0]
    
    cat_rows = conn.execute("SELECT category, COUNT(*) FROM products WHERE channel=? GROUP BY category", (ch,)).fetchall()
    cat_dist = [{"name": r[0] or '未分类', "value": r[1]} for r in cat_rows]
    
    health = _compute_health(inv_list)
    
    from datetime import timedelta, UTC
    # 使用北京时间（UTC+8）确保 today 周期与订单日期一致
    bj_now = datetime.now(UTC) + timedelta(hours=8)
    bj_date = bj_now.date()
    today_str = bj_date.isoformat()
    period_stores = {}
    period_funnel = {}
    # 单次查询 30 天数据，Python 按周期分组（替代 6 次独立 GROUP BY）
    _month_cut = (bj_date - timedelta(days=29)).isoformat()
    _pstore_rows = conn.execute("SELECT substr(ordered_at,1,10) as d, store, SUM(CASE WHEN order_status='已完成' THEN total_amount ELSE 0 END) FROM orders WHERE channel=? AND ordered_at>=? AND (deleted_at IS NULL OR deleted_at='') GROUP BY d, store", (ch, _month_cut)).fetchall()
    _pfunnel_rows = conn.execute("SELECT substr(ordered_at,1,10) as d, order_status, COUNT(*) FROM orders WHERE channel=? AND ordered_at>=? AND (deleted_at IS NULL OR deleted_at='') GROUP BY d, order_status", (ch, _month_cut)).fetchall()
    _ps_agg = {}
    for r in _pstore_rows:
        key = (r[0], r[1])
        _ps_agg[key] = _ps_agg.get(key, 0) + (r[2] or 0)
    _pf_agg = {}
    for r in _pfunnel_rows:
        key = (r[0], r[1])
        _pf_agg[key] = _pf_agg.get(key, 0) + r[2]
    for pname, pdays in [('today', 1), ('week', 7), ('month', 30)]:
        cutoff = bj_date - timedelta(days=pdays - 1)
        cutoff_str = cutoff.isoformat()
        _store_gmv = {}
        for (d, s), g in _ps_agg.items():
            if d >= cutoff_str: _store_gmv[s] = _store_gmv.get(s, 0) + g
        period_stores[pname] = [{"name": k, "gmv": v} for k, v in _store_gmv.items()]
        _st_cnt = {}
        for (d, st), c in _pf_agg.items():
            if d >= cutoff_str: _st_cnt[st] = _st_cnt.get(st, 0) + c
        ptotal = sum(_st_cnt.values())
        stages = [("总订单", ptotal, 100.0)]
        for name in ["待确认", "待发货", "已发货", "已完成"]:
            v = _st_cnt.get(name, 0)
            stages.append((name, v, round(v / ptotal * 100, 1) if ptotal else 0))
        result = []
        for i, (name, count, pct) in enumerate(stages):
            prev = stages[i - 1][1] if i > 0 else ptotal
            conv = round(min(count / prev * 100, 100), 1) if prev else 0
            result.append({"name": name, "value": count, "percentage": pct, "conversion": conv})
        period_funnel[pname] = result
    
    periods = _compute_period_trends(conn, ch, bj_date)
    
    return {
        "summary": {
            "gmv": round(gmv, 2), "pending_count": pending, "refund_count": refund,
            "low_stock_count": low_stock, "total_orders": total_orders,
            "total_products": product_count, "total_suppliers": supplier_count, "active_alerts": alert_count,
        },
        "periods": periods,
        "trend": trend, "stores": stores, "period_stores": period_stores,
        "period_funnel": period_funnel,
        "status_distribution": status_dist, "category_distribution": cat_dist,
        "health_index": health,
    }

def get_cached_dashboard(channel):
    global _cache_by_channel, _cache_version, _cache_dirty
    now = time.time()
    stale = check_db_version()
    cached = _cache_by_channel.get(channel)
    if cached is None:
        # 首次无缓存，同步重建
        data = _rebuild(channel)
        _cache_by_channel[channel] = {'data': data, 'ts': now}
        _cache_dirty = False
        return data
    if _cache_dirty or stale or (now - cached['ts']) > _CACHE_TTL:
        # 有旧缓存且刚过期(<30s)：异步重建，本次返回旧缓存（降级，不阻塞请求）
        if now - cached['ts'] < 30:
            try:
                import threading
                def _rebuild_async():
                    global _cache_dirty
                    try:
                        _cache_by_channel[channel] = {'data': _rebuild(channel), 'ts': time.time()}
                        _cache_dirty = False
                    except Exception as e:
                        import logging; logging.warning(f"[dash-cache] async rebuild: {e}")
                threading.Thread(target=_rebuild_async, daemon=True).start()
                return cached['data']
            except Exception:
                pass
        # 缓存较旧或异步失败：同步重建
        data = _rebuild(channel)
        _cache_by_channel[channel] = {'data': data, 'ts': now}
        _cache_dirty = False
    return _cache_by_channel[channel]['data']

def check_db_version():
    try:
        conn = get_conn()
        v = conn.execute("SELECT value FROM replenishment_config WHERE key='_cache_version'").fetchone()
        return int(v[0]) if v else 0
    except Exception as e:
        import logging; logging.warning(f"[dash-cache] check version: {e}")
        return 0

def invalidate():
    global _cache_dirty, _cache_by_channel, _cache_version, _stock_risk_cache
    _cache_dirty = True
    _cache_by_channel.clear()
    _stock_risk_cache.clear()
    _cache_version += 1
    try:
        conn = get_conn()
        conn.execute("INSERT OR REPLACE INTO replenishment_config(key,value) VALUES('_cache_version',?)", (str(_cache_version),))
        conn.commit()
    except Exception as e:
        import logging; logging.warning(f"[dash-cache] persist version: {e}")

def get_stock_risk(channel='jd'):
    global _stock_risk_cache
    now = time.time()
    cached = _stock_risk_cache.get(channel)
    if cached is None or (now - cached['ts']) > 300:
        conn = get_conn()
        inv = conn.execute("SELECT sku, product_name, available_qty, safety_qty, warehouse_type FROM inventory WHERE channel=? AND warehouse_type!='platform_b'", (channel,)).fetchall()
        items = []
        for r in inv:
            q = int(r[2] or 0)
            s = int(r[3] or 0)
            if 0 < q <= s:
                items.append({"sku": r[0], "product_name": r[1], "available_qty": q, "safety_qty": s, "warehouse_type": r[4]})
        items.sort(key=lambda x: x['available_qty'] / max(x['safety_qty'], 1))
        _stock_risk_cache[channel] = {'data': items[:10], 'ts': now}
    return _stock_risk_cache[channel]['data']