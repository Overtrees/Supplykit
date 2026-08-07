"""采购入库 / 出库调拨 记录"""
from fastapi import APIRouter
from app.core.database import get_db
from app.core.response import ok, fail
from app.core.schemas import InboundRecord, OutboundRecord
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
    return ok({})


@router.delete('/inbound')
def clear_inbound(db = get_db()):
    for r in db.table("inbound_records").select("id").execute().data or []:
        db.table("inbound_records").delete().eq("id", r["id"]).execute()
    return ok({"deleted": "all"})


@router.post('/inbound')
def create_inbound(body: InboundRecord, db = get_db()):
    db.table("inbound_records").insert({
        "sku": body.sku,
        "product_name": body.product_name,
        "quantity": body.quantity,
        "supplier": body.supplier,
        "inbound_date": body.inbound_date,
    }).execute()
    return ok({})


@router.get('/outbound')
def list_outbound(db = get_db(), sku: str = '', days: int = 0):
    q = db.table("outbound_records").select("*").order("id", desc=True)
    if sku: q = q.eq("sku", sku)
    return q.execute().data or []


@router.delete('/outbound/{iid}')
def delete_outbound(iid: int, db = get_db()):
    db.table("outbound_records").delete().eq("id", iid).execute()
    return ok({})


@router.delete('/outbound')
def clear_outbound(db = get_db()):
    for r in db.table("outbound_records").select("id").execute().data or []:
        db.table("outbound_records").delete().eq("id", r["id"]).execute()
    return ok({"deleted": "all"})


@router.post('/outbound')
def create_outbound(body: OutboundRecord, db = get_db()):
    db.table("outbound_records").insert({
        "sku": body.sku,
        "product_name": body.product_name,
        "quantity": body.quantity,
        "target_warehouse": body.target_warehouse,
        "outbound_date": body.outbound_date,
    }).execute()
    return ok({})