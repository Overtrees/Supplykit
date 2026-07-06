"""采购入库 / 出库调拨 记录"""
from fastapi import APIRouter
from app.core.database import get_db
from datetime import datetime

router = APIRouter(prefix="/api/records", tags=["records"])


@router.get('/inbound')
def list_inbound(db = get_db(), sku: str = '', days: int = 0):
    q = db.table("inbound_records").select("*").order("id", desc=True)
    if sku: q = q.eq("sku", sku)
    if days > 0:
        cutoff = (datetime.utcnow().strftime('%Y-%m-%d'))  # simplified
    return q.execute().data or []


@router.get('/outbound')
def list_outbound(db = get_db(), sku: str = '', days: int = 0):
    q = db.table("outbound_records").select("*").order("id", desc=True)
    if sku: q = q.eq("sku", sku)
    return q.execute().data or []