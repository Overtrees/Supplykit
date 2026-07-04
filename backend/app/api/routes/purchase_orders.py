"""采购记录（补货/采购"已下单"标记）持久化"""
from fastapi import APIRouter
from app.core.database import get_db

router = APIRouter(prefix="/api/purchase-orders", tags=["purchase_orders"])


@router.get("")
def list_purchase_orders(db = get_db()):
    """获取所有已标记的采购记录"""
    items = db.table("purchase_orders").select("*").order("id", desc=True).execute().data or []
    return items


@router.post("")
def create_purchase_order(sku: str, store: str = '', product_name: str = '', suggested_qty: int = 0, db = get_db()):
    """标记某个 SKU+店铺 为已下单"""
    try:
        db.table("purchase_orders").upsert({
            "sku": sku,
            "store": store,
            "product_name": product_name[:200],
            "suggested_qty": suggested_qty,
            "status": "pending",
        })
        return {"ok": True, "sku": sku, "store": store}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@router.delete("")
def delete_purchase_order(sku: str, store: str = '', db = get_db()):
    """取消已下单标记"""
    try:
        db.table("purchase_orders").delete().eq("sku", sku).eq("store", store).execute()
        return {"ok": True, "sku": sku, "store": store}
    except Exception as e:
        return {"ok": False, "error": str(e)}
