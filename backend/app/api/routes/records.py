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