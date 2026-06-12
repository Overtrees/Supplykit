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


@router.post('/import')
async def import_orders(file: UploadFile = File(...), db = get_db()):
    content = await file.read()
    rows = rows_from_upload(file.filename, content)
    if not rows:
        return {'ok': False, 'success': 0, 'failed': 0, 'error': '文件为空'}

    headers = list(rows[0].keys())
    doc_type = detect_type(headers)
    field_map = FIELD_MAPS.get(doc_type, FIELD_MAPS['sales_order'])

    success = 0
    failed = 0
    quality_logs = []
    orders_to_insert = []

    for imported_no, row in enumerate(rows, 1):
        order_no = field_map['order_no'](row, imported_no)
        sku = field_map['sku'](row, imported_no)

        if doc_type == 'sales_order' and not order_no:
            failed += 1
            quality_logs.append({
                'entity_type': 'order', 'entity_id': sku or None,
                'field_name': 'order_no', 'log_type': 'missing_key',
                'message': '缺少订单编号', 'level': 'error',
            })
            continue

        exist = db.table("orders").select("id").eq("order_no", order_no).execute().data
        if exist:
            continue

        item = {
            'order_no': order_no,
            'parent_order_no': field_map.get('parent_order_no', lambda r, i: None)(row, imported_no),
            'store': field_map['store'](row, imported_no),
            'sku': sku,
            'product_name': field_map['product_name'](row, imported_no),
            'quantity': field_map['quantity'](row, imported_no),
            'unit_price': field_map['unit_price'](row, imported_no),
            'total_amount': field_map['total_amount'](row, imported_no),
            'order_status': field_map['order_status'](row, imported_no),
            'ordered_at': field_map['ordered_at'](row, imported_no),
            'platform': field_map['platform'](row, imported_no),
            'source': field_map.get('source', lambda r, i: 'import_file')(row, imported_no),
            'raw_data': json.dumps(row, ensure_ascii=False, default=str),
        }
        orders_to_insert.append(item)
        success += 1

    if orders_to_insert:
        db.table("orders").insert(orders_to_insert).execute()
    if quality_logs:
        db.table("quality_logs").insert(quality_logs).execute()

    task = {
        'task_type': 'import_orders', 'platform': 'manual_import', 'status': 'success',
        'started_at': datetime.utcnow().isoformat(), 'finished_at': datetime.utcnow().isoformat(),
        'success_count': success, 'failed_count': failed,
        'message': f'导入 {success} 条（{doc_type}），异常 {failed} 条',
    }
    db.table("sync_tasks").insert(task).execute()

    from app.core.events import bus
    bus.emit('order.created', {
        'event_type': 'orders.imported',
        'entity_type': 'order',
        'entity_id': None,
        'title': '订单导入完成',
        'payload': {'success': success, 'failed': failed, 'file': file.filename or '', 'type': doc_type},
        'items': orders_to_insert if success > 0 else [],
        'order_type': doc_type,
        'ws_message': {
            'type': 'orders.imported',
            'payload': {'success': success, 'failed': failed, 'file': file.filename or '', 'type': doc_type}
        }
    })

    return {'ok': True, 'success': success, 'failed': failed, 'file': file.filename or '', 'type': doc_type}
