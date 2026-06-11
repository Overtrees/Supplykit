"""In-memory dashboard cache, rebuilt on demand or invalidated by events."""

import time
from collections import defaultdict
from app.core.supabase_client import get_supabase

_cache = None
_cache_ts = 0
_cache_dirty = True
_CACHE_TTL = 5  # minimum seconds between rebuilds


def _rebuild():
    """Full rebuild of dashboard data from database."""
    supabase = get_supabase()
    orders = supabase.table("orders").select("*").execute().data or []
    inv = supabase.table("inventory").select("*").execute().data or []
    products = supabase.table("products").select("*").execute().data or []
    suppliers = supabase.table("suppliers").select("*").execute().data or []
    alerts = supabase.table("alerts").select("*").eq("status", "active").execute().data or []

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

    # Per-store aggregation (include warehouse)
    store_names = sorted(set(x.get("store") for x in orders if x.get("store")))
    warehouse_names = sorted(set(x.get("warehouse") for x in orders if x.get("warehouse")))
    all_locations = store_names + [f"📦{w}" for w in warehouse_names]

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
