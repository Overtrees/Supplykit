from fastapi import APIRouter, Depends, UploadFile, File
from datetime import datetime
import json
import csv
import io
from openpyxl import load_workbook
from app.core.database import get_db

router = APIRouter(prefix="/api/orders", tags=["orders"])

@router.get("")
def list_orders(db = get_db(), page: int = 1, page_size: int = 50, search: str = '', status: str = '', store: str = '', sort_by: str = 'id', sort_order: str = 'desc'):
    all_rows = db.table("orders").select("*").execute().data
    filtered = []
    for row in all_rows:
        if search:
            s = search.lower()
            if s not in (row.get('order_no','') or '').lower() and s not in (row.get('product_name','') or '').lower() and s not in (row.get('sku','') or '').lower():
                continue
        if status and row.get('order_status') != status: continue
        if store and row.get('store') != store: continue
        filtered.append(row)
    total = len(filtered)
    desc = sort_order == 'desc'
    filtered.sort(key=lambda r: (r.get(sort_by) or 0) if isinstance(r.get(sort_by), (int,float)) else str(r.get(sort_by,'')), reverse=desc)
    start = (page - 1) * page_size
    items = filtered[start:start + page_size]
    return {'total': total, 'page': page, 'page_size': page_size, 'total_pages': max(1, (total + page_size - 1) // page_size), 'items': items}

@router.post('/batch-delete')
def batch_delete_orders(ids: str = '', db = get_db()):
    if not ids or ids == 'auto':
        data = db.table("orders").delete().ilike("order_no", "AUTO-%").execute().data
        deleted = len(data)
    else:
        id_list = [int(x.strip()) for x in ids.split(',') if x.strip().isdigit()]
        data = db.table("orders").delete().in_("id", id_list).execute().data
        deleted = len(data)
    return {'ok': True, 'deleted': deleted}


@router.delete('/{oid}')
def delete_order(oid: int, db = get_db()):
    db.table("orders").delete().eq("id", oid).execute()
    return {'ok': True}


