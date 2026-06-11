from fastapi import APIRouter, Depends, UploadFile, File
from supabase import Client
from datetime import datetime
import json
import csv
import io
from openpyxl import load_workbook
from app.core.supabase_client import get_supabase

router = APIRouter(prefix="/api/orders", tags=["orders"])

@router.get("")
def list_orders(supabase: Client = Depends(get_supabase), page: int = 1, page_size: int = 50,
                search: str = '', status: str = '', store: str = '',
                sort_by: str = 'id', sort_order: str = 'desc'):
    q = supabase.table("orders").select("*", count="exact")
    if search:
        like = f"%{search}%"
        q = q.ilike("order_no", like) | q.ilike("product_name", like) | q.ilike("sku", like)
    if status:
        q = q.eq("order_status", status)
    if store:
        q = q.eq("store", store)
    total = q.execute().count

    q = supabase.table("orders").select("*")
    if search:
        like = f"%{search}%"
        q = q.ilike("order_no", like) | q.ilike("product_name", like) | q.ilike("sku", like)
    if status:
        q = q.eq("order_status", status)
    if store:
        q = q.eq("store", store)
    desc = sort_order == "desc"
    q = q.order(sort_by, desc=desc)
    start = (page - 1) * page_size
    q = q.range(start, start + page_size - 1)
    rows = q.execute().data

    return {
        'total': total, 'page': page, 'page_size': page_size,
        'total_pages': (total + page_size - 1) // page_size,
        'items': [{
            "id": x["id"], "order_no": x["order_no"], "store": x["store"], "sku": x["sku"],
            "product_name": x["product_name"], "quantity": x["quantity"],
            "unit_price": x["unit_price"], "total_amount": x["total_amount"],
            "order_status": x["order_status"], "platform": x["platform"], "ordered_at": x["ordered_at"],
        } for x in rows],
    }


def rows_from_upload(file_name, content):
    if file_name.lower().endswith('.csv'):
        text = content.decode('utf-8-sig', errors='ignore')
        return list(csv.DictReader(io.StringIO(text)))
    wb = load_workbook(io.BytesIO(content), data_only=True)
    ws = wb[wb.sheetnames[0]]
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []
    headers = [str(x).strip() if x is not None else '' for x in rows[0]]
    data = []
    for row in rows[1:]:
        data.append({headers[i]: row[i] for i in range(len(headers))})
    return data


HEADER_SIGNATURES = {
    'jd_purchase': ['采购单号', '商品编号', '采购价格', '采购数量'],
    'sales_order': ['订单编号', '实付金额', '商品数量'],
}

def detect_type(headers):
    h_set = set(headers)
    for dtype, sig in HEADER_SIGNATURES.items():
        if all(s in h_set for s in sig):
            return dtype
    return 'unknown'


FIELD_MAPS = {
    'jd_purchase': {
        'order_no':       lambda row, idx: f"{str(row.get('采购单号','') or '').strip()}-{str(row.get('商品编号','') or '').strip()}",
        'store':          lambda row, idx: str(row.get('配送中心') or row.get('京东仓库') or '京东采购').strip(),
        'sku':            lambda row, idx: str(row.get('商品编号') or '').strip(),
        'product_name':   lambda row, idx: str(row.get('商品名称') or '').strip(),
        'quantity':       lambda row, idx: int(float(row.get('采购数量') or row.get('原始采购数量') or 0)),
        'unit_price':     lambda row, idx: float(row.get('采购价格') or 0),
        'total_amount':   lambda row, idx: float(row.get('采购金额') or 0),
        'order_status':   lambda row, idx: str(row.get('订单状态') or '已完成').strip(),
        'ordered_at':     lambda row, idx: str(row.get('订购时间') or '').strip(),
        'platform':       lambda row, idx: 'jd_purchase',
        'source':         lambda row, idx: 'jd_import',
    },
    'sales_order': {
        'order_no':       lambda row, idx: str(row.get('订单编号') or row.get('order_no') or '').strip(),
        'parent_order_no':lambda row, idx: row.get('父订单编号') or None,
        'store':          lambda row, idx: str(row.get('店铺名称') or row.get('store') or '未知店铺').strip(),
        'sku':            lambda row, idx: str(row.get('商品编号') or row.get('sku') or '').strip(),
        'product_name':   lambda row, idx: str(row.get('商品名称') or row.get('product_name') or '').strip(),
        'quantity':       lambda row, idx: int(float(row.get('商品数量') or row.get('quantity') or 0)),
        'unit_price':     lambda row, idx: float(row.get('商品单价') or row.get('unit_price') or 0),
        'total_amount':   lambda row, idx: float(row.get('实付金额') or row.get('total_amount') or 0),
        'order_status':   lambda row, idx: str(row.get('订单状态') or row.get('order_status') or '未知').strip(),
        'ordered_at':     lambda row, idx: str(row.get('下单时间') or row.get('ordered_at') or '').strip(),
        'platform':       lambda row, idx: row.get('platform') or 'jd',
        'source':         lambda row, idx: 'import_file',
    },
}


@router.post('/batch-delete')
def batch_delete_orders(ids: str = '', supabase: Client = Depends(get_supabase)):
    if not ids or ids == 'auto':
        data = supabase.table("orders").delete().ilike("order_no", "AUTO-%").execute().data
        deleted = len(data)
    else:
        id_list = [int(x.strip()) for x in ids.split(',') if x.strip().isdigit()]
        data = supabase.table("orders").delete().in_("id", id_list).execute().data
        deleted = len(data)
    return {'ok': True, 'deleted': deleted}


@router.post('/import')
async def import_orders(file: UploadFile = File(...), supabase: Client = Depends(get_supabase)):
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
                'field_name': 'order_no', 'issue_type': 'missing_key',
                'issue_message': '缺少订单编号', 'severity': 'error',
                'raw_data': json.dumps(row, ensure_ascii=False, default=str),
            })
            continue

        exist = supabase.table("orders").select("id").eq("order_no", order_no).execute().data
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
        supabase.table("orders").insert(orders_to_insert).execute()
    if quality_logs:
        supabase.table("quality_logs").insert(quality_logs).execute()

    task = {
        'task_type': 'import_orders', 'platform': 'manual_import', 'status': 'success',
        'started_at': datetime.utcnow().isoformat(), 'finished_at': datetime.utcnow().isoformat(),
        'success_count': success, 'failed_count': failed,
        'message': f'导入 {success} 条（{doc_type}），异常 {failed} 条',
    }
    supabase.table("sync_tasks").insert(task).execute()

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
