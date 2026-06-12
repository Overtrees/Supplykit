"""In-memory dashboard cache, rebuilt on demand or invalidated by events."""

import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from app.core.database import get_db

_cache = None
_cache_ts = 0
_cache_dirty = True
_CACHE_TTL = 5


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

        if d >= now - timedelta(days=7):
            periods["week"]["gmv"] += gmv
            periods["week"]["orders"] += 1
            period_trend["week"].append((str(d), gmv, 1))

        if d >= now - timedelta(days=30):
            periods["month"]["gmv"] += gmv
            periods["month"]["orders"] += 1
            period_trend["month"].append((str(d), gmv, 1))

    # Build daily trend lines for each period
    for key, days in [("week", 7), ("month", 30)]:
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
    # Conversion rate between consecutive stages
    result = []
    for i, (name, count, pct) in enumerate(stages):
        prev_count = stages[i - 1][1] if i > 0 else total
        conv = round(count / prev_count * 100, 1) if prev_count else 0
        result.append({"name": name, "value": count, "percentage": pct, "conversion": conv})
    return result


def _compute_health(inv):
    """Inventory health index."""
    total = len(inv)
    healthy = sum(1 for x in inv if int(x.get("available_qty") or 0) >= int(x.get("safety_qty") or 0))
    warning = sum(1 for x in inv if 0 < int(x.get("available_qty") or 0) < int(x.get("safety_qty") or 0))
    out_of_stock = sum(1 for x in inv if int(x.get("available_qty") or 0) == 0)
    score = round(healthy / total * 100, 0) if total else 100
    return {
        "score": score,
        "healthy": healthy,
        "warning": warning,
        "out_of_stock": out_of_stock,
        "total": total,
        "level": "good" if score >= 70 else ("warning" if score >= 40 else "danger"),
    }


def _rebuild():
    """Full rebuild of dashboard data from database."""
    db = get_db()
    orders = db.table("orders").select("*").execute().data or []
    inv = db.table("inventory").select("*").execute().data or []
    products = db.table("products").select("*").execute().data or []
    suppliers = db.table("suppliers").select("*").execute().data or []
    alerts = db.table("alerts").select("*").eq("status", "active").execute().data or []

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
    warehouse_names = sorted(set(x.get("warehouse") for x in orders if x.get("warehouse")))
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
    for w in warehouse_names:
        wo = [x for x in orders if x.get("warehouse") == w]
        wi = [x for x in inv if x.get("warehouse") == w]
        store_rows.append({
            "name": f"📦{w}",
            "gmv": sum(float(x.get("total_amount") or 0) for x in wo if x.get("order_status") == "已完成"),
            "orders": len(wo),
            "low_stock": len([x for x in wi if int(x.get("available_qty") or 0) < int(x.get("safety_qty") or 0)]),
        })

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
        "status_distribution": [{"name": k, "value": v} for k, v in sorted(status_dist.items())],
        "category_distribution": [{"name": k, "value": v} for k, v in sorted(cat_dist.items(), key=lambda x: -x[1])],
        # ① 总览新增
        "periods": _compute_periods(orders),
        "funnel": _compute_funnel(orders),
        "health_index": _compute_health(inv),
    }


def get_dashboard():
    """Return cached dashboard data, rebuilding if dirty or expired."""
    global _cache, _cache_ts, _cache_dirty
    now = time.time()
    if _cache is None or _cache_dirty or (now - _cache_ts) > _CACHE_TTL:
        _cache = _rebuild()
        _cache_ts = now
        _cache_dirty = False
    return _cache


def invalidate():
    """Mark cache as dirty. Called by event handlers."""
    global _cache_dirty
    _cache_dirty = True
