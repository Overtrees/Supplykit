from fastapi import APIRouter, Depends
from supabase import Client
from app.core.supabase_client import get_supabase

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

@router.get("/summary")
def dashboard_summary(supabase: Client = Depends(get_supabase)):
    orders = supabase.table("orders").select("*").execute().data
    inv = supabase.table("inventory").select("*").execute().data
    products = supabase.table("products").select("*").execute().data
    suppliers = supabase.table("suppliers").select("*").execute().data
    alerts = supabase.table("alerts").select("*").eq("status", "active").execute().data

    gmv = sum(float(x.get("total_amount") or 0) for x in orders if x.get("order_status") == "已完成")
    pending = len([x for x in orders if x.get("order_status") == "待发货"])
    refund = len([x for x in orders if x.get("order_status") == "申请退款"])
    low_stock = len([x for x in inv if int(x.get("available_qty") or 0) < int(x.get("safety_qty") or 0)])

    from collections import defaultdict
    by_date = defaultdict(lambda: {"订单数": 0, "GMV": 0})
    for x in orders:
        date = str(x.get("ordered_at") or "")[5:] or "未知"
        by_date[date]["订单数"] += 1
        if x.get("order_status") == "已完成":
            by_date[date]["GMV"] += float(x.get("total_amount") or 0)
    trend = [{"日期": k, **v} for k, v in sorted(by_date.items())]

    stores = sorted(set([x.get("store") for x in orders if x.get("store")]))
    store_rows = []
    for s in stores:
        so = [x for x in orders if x.get("store") == s]
        si = [x for x in inv if x.get("store") == s]
        store_rows.append({
            "name": s,
            "gmv": sum(float(x.get("total_amount") or 0) for x in so if x.get("order_status") == "已完成"),
            "orders": len(so),
            "low_stock": len([x for x in si if int(x.get("available_qty") or 0) < int(x.get("safety_qty") or 0)])
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
