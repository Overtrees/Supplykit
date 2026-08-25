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
_rebuilding = set()  # 正在异步重建的 channel（防并发重复重建）

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
    from datetime import timedelta, UTC
    from concurrent.futures import ThreadPoolExecutor
    _today = datetime.now(UTC).date()
    _cut90 = (_today - timedelta(days=90)).isoformat()
    bj_now = datetime.now(UTC) + timedelta(hours=8)
    bj_date = bj_now.date()
    _month_cut = (bj_date - timedelta(days=29)).isoformat()
    
    # 并行 2 查询（走 idx_orders_ch_ordered_at / idx_orders_cdate 索引）
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
    
    # 一遍遍历 rows 同时聚合：agg + trend + status_dist + 30天周期数据（替代 _agg/_pstore/_pfunnel）
    gmv = pending = refund = total_orders = 0
    by_date = {}
    _status_agg = {}
    _ps_agg = {}
    _pf_agg = {}
    for r in rows:
        _d = r[0] or ''
        _st = r[1] or '未知'
        _g = r[2] or 0
        _cnt = r[3] or 0
        total_orders += _cnt
        if _st == '已完成': gmv += _g
        elif _st == '待发货': pending += _cnt
        elif _st == '申请退款': refund += _cnt
        _key = _d[5:] if len(_d) >= 10 else _d
        if _key not in by_date: by_date[_key] = {"订单数": 0, "GMV": 0}
        by_date[_key]["订单数"] += _cnt
        if _st == '已完成': by_date[_key]["GMV"] += _g
        _status_agg[_st] = _status_agg.get(_st, 0) + _cnt
        # 30 天周期数据（漏斗/店铺 GMV 需要 store 维度，此处只算漏斗；店铺靠 _q_stores 的 period 过滤）
        if _d >= _month_cut:
            _pf_agg[(_d, _st)] = _pf_agg.get((_d, _st), 0) + _cnt
    trend = [{"日期": k, **v} for k, v in sorted(by_date.items())]
    status_dist = [{"name": k, "value": v} for k, v in _status_agg.items()]
    
    stores = [{"name": r[0], "orders": r[1], "gmv": r[2]} for r in store_rows]
    
    # ── 周期店铺 GMV（从 stores 的 30 天子集 —— 但 _q_stores 是 90 天全量，需 30 天单独算）
    # 为减少查询，周期店铺 GMV 从 StoreRows 的 90 天数据用 Python 过滤？不精确（按 store 维度无日期）。
    # 保留 30 天独立查询（仅 30 天，扫描量是 90 天的 1/3，快）
    _pstore_rows = conn.execute("SELECT substr(ordered_at,1,10) as d, store, SUM(CASE WHEN order_status='已完成' THEN total_amount ELSE 0 END) FROM orders WHERE channel=? AND ordered_at>=? AND (deleted_at IS NULL OR deleted_at='') GROUP BY d, store", (ch, _month_cut)).fetchall()
    _ps_agg = {}
    for r in _pstore_rows:
        _ps_agg[(r[0], r[1])] = _ps_agg.get((r[0], r[1]), 0) + (r[2] or 0)
    
    inv_list = [{"sku":r[0],"product_name":r[1],"warehouse":r[2],"warehouse_type":r[3],"available_qty":r[4],"safety_qty":r[5],"store":r[6]} for r in inv]
    
    # 聚合循环中定期让出 GIL
    low_stock = 0; store_low = {}
    for idx, x in enumerate(inv_list):
        if idx % 2000 == 0: time.sleep(0.001)
        is_low = int(x.get('available_qty') or 0) < int(x.get('safety_qty') or 0)
        if is_low: low_stock += 1
        _s = x.get('store') or ''
        store_low[_s] = store_low.get(_s, 0) + (1 if is_low else 0)
    for s in stores:
        s['low_stock'] = store_low.get(s['name'], 0)
    
    product_count = conn.execute("SELECT COUNT(*) FROM products WHERE channel=?", (ch,)).fetchone()[0]
    supplier_count = conn.execute("SELECT COUNT(*) FROM suppliers").fetchone()[0]
    alert_count = conn.execute("SELECT COUNT(*) FROM alerts WHERE channel=? AND status='active'", (ch,)).fetchone()[0]
    cat_rows = conn.execute("SELECT category, COUNT(*) FROM products WHERE channel=? GROUP BY category", (ch,)).fetchall()
    cat_dist = [{"name": r[0] or '未分类', "value": r[1]} for r in cat_rows]
    health = _compute_health(inv_list)
    
    # ── 周期聚合：店铺 + 漏斗（纯 Python，30 天数据已收集）
    period_stores = {}
    period_funnel = {}
    for pname, pdays in [('today', 1), ('week', 7), ('month', 30)]:
        cutoff = bj_date - timedelta(days=pdays - 1)
        cutoff_str = cutoff.isoformat()
        _store_gmv = {}
        for (d, s), g in _ps_agg.items():
            if d >= cutoff_str: _store_gmv[s] = _store_gmv.get(s, 0) + g
        period_stores[pname] = [{"name": k, "gmv": v} for k, v in sorted(_store_gmv.items())]
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
        # 有旧缓存：一律异步重建，本次返回旧缓存（不阻塞请求，避免单 worker 排队卡死其他接口）
        try:
            import threading
            def _rebuild_async():
                global _cache_dirty
                try:
                    _cache_by_channel[channel] = {'data': _rebuild(channel), 'ts': time.time()}
                    _cache_dirty = False
                    # 异步重建完成 → 广播通知前端可拉取新数据
                    try:
                        import app.core.events as _ev
                        _ev.bus.emit('dashboard.updated', {'channel': channel})
                    except Exception:
                        pass
                except Exception as e:
                    import logging; logging.warning(f"[dash-cache] async rebuild: {e}")
                finally:
                    _rebuilding.discard(channel)
            # 同一 channel 防并发重复重建
            if channel not in _rebuilding:
                _rebuilding.add(channel)
                threading.Thread(target=_rebuild_async, daemon=True).start()
            return cached['data']
        except Exception:
            pass
        # 异步启动失败（极端情况）：同步重建
        data = _rebuild(channel)
        _cache_by_channel[channel] = {'data': data, 'ts': now}
        _cache_dirty = False
    return _cache_by_channel[channel]['data']


def get_dashboard_sync(channel):
    """强制同步重建并返回新数据（填充/导入/重置完成后前端主动触发）

    数据精度优先：不返回旧值，清缓存 → 递增版本号 → 同步重建（阻塞几秒可接受，
    因为用户刚完成关键操作，明确预期等待）。
    """
    global _cache_dirty, _cache_by_channel, _cache_version
    _cache_by_channel.pop(channel, None)
    _cache_dirty = True
    _cache_version += 1
    try:
        conn = get_conn()
        conn.execute("INSERT OR REPLACE INTO replenishment_config(key,value) VALUES('_cache_version',?)", (str(_cache_version),))
        conn.commit()
    except Exception as e:
        import logging; logging.warning(f"[dash-cache] persist version: {e}")
    data = _rebuild(channel)
    _cache_by_channel[channel] = {'data': data, 'ts': time.time()}
    _cache_dirty = False
    return data

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
    # 关键：不再 clear _cache_by_channel —— 保留旧缓存，
    # 下次请求经 stale 检测走异步重建并降级返回旧值（单 worker 不阻塞）
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