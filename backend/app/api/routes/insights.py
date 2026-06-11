from fastapi import APIRouter, Depends
from supabase import Client
from app.core.supabase_client import get_supabase

router = APIRouter(prefix="/api/insights", tags=["insights"])


@router.get('/replenishment')
def get_replenishment_suggestions(supabase: Client = Depends(get_supabase)):
    items = supabase.table("inventory").select("*").execute().data
    products = {p["sku"]: p for p in supabase.table("products").select("*").execute().data}
    suggestions = []

    for inv in items:
        avail = int(inv.get("available_qty") or 0)
        safety = int(inv.get("safety_qty") or 0)
        transit = int(inv.get("in_transit_qty") or 0)

        if avail >= safety:
            continue

        suggested = max(safety * 2 - avail - transit, safety - avail)
        p = products.get(inv.get("sku") or "")

        suggestions.append({
            "sku": inv.get("sku"),
            "product_name": inv.get("product_name") or (p["product_name"] if p else ""),
            "store": inv.get("store"),
            "category": p["category"] if p else "",
            "available_qty": avail,
            "safety_qty": safety,
            "in_transit_qty": transit,
            "suggested_qty": suggested,
            "urgency": "紧急" if avail <= safety * 0.3 else ("关注" if avail <= safety * 0.6 else "预警"),
        })

    suggestions.sort(key=lambda x: (x["urgency"] != "紧急", x["urgency"] != "关注", x["available_qty"]))
    return suggestions


@router.get('/purchase')
def get_purchase_suggestions(supabase: Client = Depends(get_supabase)):
    replen = get_replenishment_suggestions(supabase)
    suppliers = supabase.table("suppliers").select("*").eq("status", "active").execute().data
    if not suppliers:
        return {"suggestions": replen, "suppliers": []}

    result = []
    for item in replen:
        best = None
        for s in suppliers:
            if item.get("category") and item["category"] in (s.get("supplier_name") or ""):
                best = s
                break
        if not best and suppliers:
            best = max(suppliers, key=lambda x: x.get("score") or 0)

        result.append({
            **item,
            "supplier_code": best["supplier_code"] if best else "",
            "supplier_name": best["supplier_name"] if best else "",
            "supplier_score": best["score"] if best else 0,
        })

    return {"suggestions": result, "suppliers": len(suppliers)}


@router.get('/slow-moving')
def get_slow_moving_products(supabase: Client = Depends(get_supabase)):
    from datetime import datetime, timedelta

    orders = supabase.table("orders").select("*").execute().data
    products_map = {p["sku"]: p for p in supabase.table("products").select("*").execute().data}
    inventory_map = {i["sku"]: i for i in supabase.table("inventory").select("*").execute().data}

    last_order = {}
    for o in orders:
        sku = o.get("sku")
        if not sku:
            continue
        date_str = str(o.get("ordered_at") or "")
        d = date_str[:10]
        if sku not in last_order or d > last_order[sku]:
            last_order[sku] = d

    now = datetime.utcnow()
    result = []

    all_skus = set()
    for p in products_map:
        all_skus.add(p)
    for o in orders:
        if o.get("sku"):
            all_skus.add(o["sku"])
    for i in inventory_map:
        all_skus.add(i)

    for sku in all_skus:
        p = products_map.get(sku)
        inv = inventory_map.get(sku)

        last_date = last_order.get(sku, "")
        days = 999
        if last_date:
            try:
                dt = datetime.strptime(last_date[:10], "%Y-%m-%d")
                days = (now - dt).days
            except Exception:
                days = 999

        if days >= 90:
            level = "滞销"
        elif days >= 30:
            level = "冷淡"
        elif days >= 14:
            level = "观望"
        else:
            level = "正常"

        order_name = ""
        for o in orders:
            if o.get("sku") == sku and o.get("product_name"):
                order_name = o["product_name"]
                break

        result.append({
            "sku": sku,
            "product_name": (p["product_name"] if p else inv["product_name"] if inv else order_name),
            "store": (p["store"] if p else inv["store"] if inv else ""),
            "category": p["category"] if p else "",
            "last_order_date": last_date[:10] if last_date else "从未下单",
            "days_since_last_order": days,
            "level": level,
            "available_qty": inv["available_qty"] if inv else 0,
        })

    result.sort(key=lambda x: (x["level"] != "滞销", x["level"] != "冷淡", -x["days_since_last_order"]))
    return result


@router.get('/summary')
def get_insight_summary(supabase: Client = Depends(get_supabase)):
    inv = supabase.table("inventory").select("*").execute().data
    total = len(inv)
    low_stock = len([x for x in inv if int(x.get("available_qty") or 0) < int(x.get("safety_qty") or 0)])
    out_of_stock = len([x for x in inv if int(x.get("available_qty") or 0) == 0])

    replen = get_replenishment_suggestions(supabase)
    urgent = len([x for x in replen if x["urgency"] == "紧急"])

    slow = get_slow_moving_products(supabase)
    slow_count = len([x for x in slow if x["level"] == "滞销"])
    cold_count = len([x for x in slow if x["level"] == "冷淡"])

    return {
        "total_products": total,
        "low_stock": low_stock,
        "out_of_stock": out_of_stock,
        "urgent_replenish": urgent,
        "suggestions_count": len(replen),
        "slow_moving": slow_count,
        "cold_count": cold_count,
    }


def auto_adjust_inventory(order_data: dict, order_type: str, supabase: Client):
    sku = order_data.get("sku", "")
    qty = int(float(order_data.get("quantity", 0)))
    if not sku or qty <= 0:
        return

    inv_list = supabase.table("inventory").select("*").eq("sku", sku).execute().data
    if inv_list:
        inv = inv_list[0]
        avail = int(inv.get("available_qty") or 0)
        if order_type in ("jd_purchase", "cleansing_purchase"):
            supabase.table("inventory").update({"available_qty": avail + qty}).eq("id", inv["id"]).execute()
        elif order_type in ("sales", "jd_sales", "cleansing"):
            supabase.table("inventory").update({"available_qty": max(0, avail - qty)}).eq("id", inv["id"]).execute()
    else:
        supabase.table("inventory").insert({
            "sku": sku,
            "product_name": order_data.get("product_name", ""),
            "store": order_data.get("store", ""),
            "available_qty": qty if order_type in ("jd_purchase", "cleansing_purchase") else 0,
            "locked_qty": 0,
            "in_transit_qty": 0,
            "safety_qty": 10,
            "source": "auto_created",
        }).execute()
