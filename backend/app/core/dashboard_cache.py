"""In-memory dashboard cache, rebuilt on demand or invalidated by events."""

import time, os, sqlite3
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from app.core.database import get_db, DB_PATH

_cache = None
_cache_ts = 0
_cache_dirty = True
_CACHE_TTL = 300


def _parse_date(s):
    """Parse ordered_at string to date, return None on failure."""
    if not s:
        return None
    try:
        return datetime.strptime(str(s)[:10], "%Y-%m-%d").date()
    except (ValueError, IndexError):
        return None


def _compute_periods(orders):
    """Group GMV/orders by today, this_week (7d), this_month (30d)."""
    now = datetime.now(timezone.utc).date()
    today_str = str(now)
    periods = {
        "today": {"gmv": 0.0, "orders": 0, "date": today_str},
        "week": {"gmv": 0.0, "orders": 0, "date": str(now - timedelta(days=7))},
        "month": {"gmv": 0.0, "orders": 0, "date": str(now - timedelta(days=30))},
    }
    period_trend = {"today": [], "week": [], "month": []}

    for x in orders:
        d = _parse_date(x.get("ordered_at"))
        if not d:
            continue
        gmv = float(x.get("total_amount") or 0) if x.get("order_status") == "已完成" else 0

        if d == now:
            periods["today"]["gmv"] += gmv
            periods["today"]["orders"] += 1
            period_trend["today"].append((str(d), gmv, 1))

        if d >= now - timedelta(days=7):
            periods["week"]["gmv"] += gmv
            periods["week"]["orders"] += 1
            period_trend["week"].append((str(d), gmv, 1))

        if d >= now - timedelta(days=30):
            periods["month"]["gmv"] += gmv
            periods["month"]["orders"] += 1
            period_trend["month"].append((str(d), gmv, 1))

    # Build daily trend lines for each period
    for key, days in [("today", 1), ("week", 7), ("month", 30)]:
        daily = defaultdict(lambda: {"gmv": 0.0, "orders": 0})
        for date_str, g, cnt in period_trend[key]:
            daily[date_str[-5:]]["gmv"] += g
            daily[date_str[-5:]]["orders"] += cnt
        periods[f"{key}_trend"] = [
            {"日期": k, "GMV": round(v["gmv"], 2), "订单数": v["orders"]}
            for k, v in sorted(daily.items())
        ]

    return periods


def _compute_funnel(orders):
    """Order conversion funnel: total → confirmed → shipped → completed."""
    total = len(orders)
    statuses = {"待确认": 0, "待发货": 0, "已发货": 0, "已完成": 0, "申请退款": 0}
    for x in orders:
        s = x.get("order_status") or "未知"
        if s in statuses:
            statuses[s] += 1
        else:
            statuses["未知"] = statuses.get("未知", 0) + 1

    # Funnel stages in order
    stages = [
        ("总订单", total, 100.0),
        ("待确认", statuses["待确认"], round(statuses["待确认"] / total * 100, 1) if total else 0),
        ("待发货", statuses["待发货"], round(statuses["待发货"] / total * 100, 1) if total else 0),
        ("已发货", statuses["已发货"], round(statuses["已发货"] / total * 100, 1) if total else 0),
        ("已完成", statuses["已完成"], round(statuses["已完成"] / total * 100, 1) if total else 0),
    ]
    # Conversion rate between consecutive stages (capped at 100%)
    result = []
    for i, (name, count, pct) in enumerate(stages):
        prev_count = stages[i - 1][1] if i > 0 else total
        conv = round(min(count / prev_count * 100, 100), 1) if prev_count else 0
        result.append({"name": name, "value": count, "percentage": pct, "conversion": conv})
    return result


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


def _rebuild(channel='jd'):
    """Full rebuild of dashboard data from database."""
    db = get_db()
    orders = db.table("orders").select("*").execute().data or []
    # 渠道过滤：jd → 京东订单, other → 非京东订单
    if channel == 'jd':
        orders = [o for o in orders if o.get('platform') in ('京东', '', None)]
    else:
        orders = [o for o in orders if o.get('platform') not in ('京东', '', None)]
    
    inv = db.table("inventory").select("*").eq("channel", channel).execute().data or []
    products = db.table("products").select("*").eq("channel", channel).execute().data or []
    suppliers = db.table("suppliers").select("*").execute().data or []
    alerts = db.table("alerts").select("*").eq("status", "active").eq("channel", channel).execute().data or []

    gmv = sum(float(x.get("total_amount") or 0) for x in orders if x.get("order_status") == "已完成")
    pending = len([x for x in orders if x.get("order_status") == "待发货"])
    refund = len([x for x in orders if x.get("order_status") == "申请退款"])
    low_stock = len([x for x in inv if int(x.get("available_qty") or 0) < int(x.get("safety_qty") or 0)])

    # Trend by date
    by_date = defaultdict(lambda: {"订单数": 0, "GMV": 0})
    for x in orders:
        date = str(x.get("ordered_at") or "")[5:] or "未知"
        by_date[date]["订单数"] += 1
        if x.get("order_status") == "已完成":
            by_date[date]["GMV"] += float(x.get("total_amount") or 0)
    trend = [{"日期": k, **v} for k, v in sorted(by_date.items())]

    # Per-store aggregation
    store_names = sorted(set(x.get("store") for x in orders if x.get("store")))
    store_rows = []
    for s in store_names:
        so = [x for x in orders if x.get("store") == s]
        si = [x for x in inv if x.get("store") == s]
        store_rows.append({
            "name": s,
            "gmv": sum(float(x.get("total_amount") or 0) for x in so if x.get("order_status") == "已完成"),
            "orders": len(so),
            "low_stock": len([x for x in si if int(x.get("available_qty") or 0) < int(x.get("safety_qty") or 0)]),
        })

    # 周期维度 stores（今日/本周/本月）
    from datetime import timedelta
    today = datetime.utcnow().date()
    period_stores = {}
    period_funnel = {}
    for pname, pdays in [('today', 1), ('week', 7), ('month', 30)]:
        cutoff = today - timedelta(days=pdays - 1)
        porders = [o for o in orders if o.get('ordered_at') and datetime.strptime(str(o['ordered_at'])[:10], '%Y-%m-%d').date() >= cutoff]
        # stores
        period_stores[pname] = []
        for s in store_names:
            so = [x for x in porders if x.get("store") == s]
            period_stores[pname].append({
                "name": s,
                "gmv": sum(float(x.get("total_amount") or 0) for x in so if x.get("order_status") == "已完成"),
            })
        # funnel
        period_funnel[pname] = _compute_funnel(porders)
    
    status_dist = defaultdict(int)
    for x in orders:
        status_dist[x.get("order_status") or "未知"] += 1

    cat_dist = defaultdict(int)
    for p in products:
        cat_dist[p.get("category") or "未分类"] += 1

    return {
        "summary": {
            "gmv": gmv,
            "pending_count": pending,
            "refund_count": refund,
            "low_stock_count": low_stock,
            "total_orders": len(orders),
            "total_products": len(products),
            "total_suppliers": len(suppliers),
            "active_alerts": len(alerts),
        },
        "trend": trend,
        "stores": store_rows,
        "period_stores": period_stores,
        "period_funnel": period_funnel,
        "status_distribution": [{"name": k, "value": v} for k, v in sorted(status_dist.items())],
        "category_distribution": [{"name": k, "value": v} for k, v in sorted(cat_dist.items(), key=lambda x: -x[1])],
        # ① 总览新增
        "periods": _compute_periods(orders),
        "funnel": _compute_funnel(orders),
        "health_index": _compute_health(inv),
    }
    # 滞销识别
    try:
        from datetime import timedelta
        co = (datetime.utcnow() - timedelta(days=14)).strftime('%Y-%m-%d')
        for p in products:
            sk = p.get('sku','')
            if not sk: continue
            rc = [o for o in orders if o.get('sku')==sk and (o.get('ordered_at','')[:10] or '') >= co]
            if not rc:
                is_ = sum(int(i.get('available_qty',0) or 0) for i in inv if i.get('sku')==sk)
                if is_ > 0:
                    ex = db.table("alerts").select("id").eq("alert_type","slow_moving").eq("related_sku",sk).eq("status","active").execute().data
                    if not ex:
                        db.table("alerts").insert({"alert_type":"slow_moving","title":f"滞销: {p.get('product_name',sk)}","description":"超过14天无销售","severity":"warning","source":"event_bus","status":"active","related_sku":sk}).execute()
    except: pass


_cache_by_channel = {}
_cache_version = 0

def _check_db_version():
    """检查数据库持久化版本号，不一致则强制失效"""
    global _cache_version
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.execute("SELECT value FROM replenishment_config WHERE key='_cache_version' AND channel='jd'")
        row = cur.fetchone()
        db_ver = int(row[0]) if row else 0
        conn.close()
        if db_ver != _cache_version:
            _cache_version = db_ver
            return True
    except:
        pass
    return False

def get_dashboard(channel='jd'):
    """Return cached dashboard data, rebuilding if dirty or expired."""
    global _cache, _cache_ts, _cache_dirty, _cache_by_channel
    now = time.time()
    stale = _check_db_version()
    cached = _cache_by_channel.get(channel)
    if cached is None or _cache_dirty or stale or (now - cached['ts']) > _CACHE_TTL:
        data = _rebuild(channel)
        _cache_by_channel[channel] = {'data': data, 'ts': now}
        _cache_ts = now
        _cache_dirty = False
        return data
    return cached['data']


def invalidate():
    """Mark cache as dirty. Called by event handlers."""
    global _cache_dirty, _cache_by_channel, _cache_version, _stock_risk_cache
    _cache_dirty = True
    _cache_by_channel.clear()
    _stock_risk_cache.clear()
    # 同时刷新补货缓存
    try:
        from app.core.replenishment_cache import invalidate_cache
        db = get_db()
        invalidate_cache(db)
    except: pass
    _cache_by_channel = {}
    _stock_risk_cache = {}
    _cache_version += 1
    # 写入数据库持久化版本号（跨进程共享）
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute("INSERT OR REPLACE INTO replenishment_config (key,value,channel) VALUES ('_cache_version',?,'jd')", (str(_cache_version),))
        conn.commit()
        conn.close()
    except:
        pass
