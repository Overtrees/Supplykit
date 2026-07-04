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


@router.post('/import')
def import_orders(file: UploadFile = File(...), db = get_db()):
    import openpyxl
    content = file.file.read()
    if file.filename.endswith('.csv'):
        text = content.decode('utf-8-sig')
        reader = csv.DictReader(io.StringIO(text))
        rows = list(reader)
    else:
        wb = load_workbook(io.BytesIO(content), read_only=True)
        ws = wb.active
        headers = [c.value for c in next(ws.iter_rows(min_row=1, max_row=1))]
        rows = []
        for row in ws.iter_rows(min_row=2, values_only=True):
            rows.append({headers[i]: row[i] for i in range(len(headers)) if row[i] is not None})
    ALIAS = {
        '订单号': 'order_no','商品编号': 'sku','商品名称': 'product_name',
        '数量': 'quantity','单价': 'unit_price','金额': 'total_amount',
        '店铺': 'store','仓库': 'warehouse','状态': 'order_status',
        '日期': 'ordered_at','平台': 'platform','供应商': 'supplier','备注': 'remark',
    }
    inserted = 0
    imported_items = []
    for row in rows:
        mapped = {}
        for k, v in row.items():
            target = ALIAS.get(k.strip(), k.strip())
            mapped[target] = str(v).strip() if v else ''
        if not mapped.get('order_no'):
            continue
        mapped['quantity'] = int(float(mapped.get('quantity') or 0))
        mapped['unit_price'] = float(mapped.get('unit_price') or 0)
        mapped['total_amount'] = float(mapped.get('total_amount') or 0)
        mapped['data_source'] = 'import'
        db.table("orders").upsert(mapped, conflict_columns=['order_no', 'sku']).execute()
        inserted += 1
        imported_items.append(mapped)
    from app.core.events import bus
    bus.emit('order.imported', {'count': inserted})
    if imported_items:
        bus.emit('order.created', {'items': imported_items, 'order_type': 'import'})
    return {'ok': True, 'imported': inserted, 'from_file': file.filename}


