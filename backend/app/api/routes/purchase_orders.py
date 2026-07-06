"""采购记录（补货/采购"已下单"标记）持久化"""
from fastapi import APIRouter
from app.core.database import get_db
from datetime import datetime

router = APIRouter(prefix="/api/purchase-orders", tags=["purchase_orders"])


@router.get("")
def list_purchase_orders(db = get_db()):
    items = db.table("purchase_orders").select("*").order("id", desc=True).execute().data or []
    return items


@router.post("")
def create_purchase_order(sku: str, store: str = '', product_name: str = '',
                          suggested_qty: int = 0, actual_qty: int = 0,
                          arrival_date: str = '', db = get_db()):
    try:
        db.table("purchase_orders").upsert({
            "sku": sku,
            "store": store,
            "product_name": product_name[:200],
            "suggested_qty": suggested_qty,
            "actual_qty": actual_qty,
            "arrival_date": arrival_date,
            "status": "pending",
        })
        return {"ok": True, "sku": sku, "store": store}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@router.put("/{iid}")
def update_purchase_order(iid: int, body: dict, db = get_db()):
    db.table("purchase_orders").update(body).eq("id", iid).execute()
    return {"ok": True}


@router.delete("")
def delete_purchase_order(sku: str, store: str = '', db = get_db()):
    try:
        db.table("purchase_orders").delete().eq("sku", sku).eq("store", store).execute()
        return {"ok": True, "sku": sku, "store": store}
    except Exception as e:
        return {"ok": False, "error": str(e)}
