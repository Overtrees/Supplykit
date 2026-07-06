"""采购入库 / 出库调拨 记录"""
from fastapi import APIRouter
from app.core.database import get_db
from datetime import datetime

router = APIRouter(prefix="/api/records", tags=["records"])


@router.get('/inbound')
def list_inbound(db = get_db(), sku: str = '', days: int = 0):
    q = db.table("inbound_records").select("*").order("id", desc=True)
    if sku: q = q.eq("sku", sku)
    return q.execute().data or []


@router.delete('/inbound/{iid}')
def delete_inbound(iid: int, db = get_db()):
    db.table("inbound_records").delete().eq("id", iid).execute()
    return {"ok": True}


@router.delete('/inbound')
def clear_inbound(db = get_db()):
    for r in db.table("inbound_records").select("id").execute().data or []:
        db.table("inbound_records").delete().eq("id", r["id"]).execute()
    return {"ok": True, "deleted": "all"}


@router.post('/inbound')
def create_inbound(body: dict, db = get_db()):
    db.table("inbound_records").insert({
        "sku": body.get("sku", ""),
        "product_name": body.get("product_name", ""),
        "quantity": int(body.get("quantity", 0)),
        "supplier": body.get("supplier", ""),
        "inbound_date": body.get("inbound_date", ""),
    }).execute()
    return {"ok": True}


@router.get('/outbound')
def list_outbound(db = get_db(), sku: str = '', days: int = 0):
    q = db.table("outbound_records").select("*").order("id", desc=True)
    if sku: q = q.eq("sku", sku)
    return q.execute().data or []


@router.delete('/outbound/{iid}')
def delete_outbound(iid: int, db = get_db()):
    db.table("outbound_records").delete().eq("id", iid).execute()
    return {"ok": True}


@router.delete('/outbound')
def clear_outbound(db = get_db()):
    for r in db.table("outbound_records").select("id").execute().data or []:
        db.table("outbound_records").delete().eq("id", r["id"]).execute()
    return {"ok": True, "deleted": "all"}


@router.post('/outbound')
def create_outbound(body: dict, db = get_db()):
    db.table("outbound_records").insert({
        "sku": body.get("sku", ""),
        "product_name": body.get("product_name", ""),
        "quantity": int(body.get("quantity", 0)),
        "target_warehouse": body.get("target_warehouse", ""),
        "outbound_date": body.get("outbound_date", ""),
    }).execute()
    return {"ok": True}