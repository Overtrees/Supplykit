from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session
from datetime import datetime
import json
import csv
import io
from openpyxl import load_workbook
from app.core.database import get_db
from app.models.entities import Order, QualityLog, SyncTask
from app.api.routes.ws import broadcast
from app.services.event_service import create_event

router = APIRouter(prefix="/api/orders", tags=["orders"])

@router.get("")
def list_orders(db: Session = Depends(get_db)):
    rows = db.query(Order).order_by(Order.id.desc()).all()
    return [{
        "id": x.id,
        "order_no": x.order_no,
        "store": x.store,
        "sku": x.sku,
        "product_name": x.product_name,
        "quantity": x.quantity,
        "unit_price": x.unit_price,
        "total_amount": x.total_amount,
        "order_status": x.order_status,
        "ordered_at": x.ordered_at,
    } for x in rows]

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

@router.post('/import')
async def import_orders(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    rows = rows_from_upload(file.filename, content)
    success = 0
    failed = 0
    for row in rows:
        order_no = str(row.get('订单编号') or row.get('order_no') or '').strip()
        sku = str(row.get('商品编号') or row.get('sku') or '').strip()
        if not order_no:
            failed += 1
            db.add(QualityLog(entity_type='order', entity_id=sku or None, field_name='order_no', issue_type='missing_key', issue_message='缺少订单编号', severity='error', raw_data=json.dumps(row, ensure_ascii=False, default=str)))
            continue
        exists = db.query(Order).filter(Order.order_no == order_no).first()
        if exists:
            continue
        item = Order(
            order_no=order_no,
            parent_order_no=row.get('父订单编号') or None,
            store=str(row.get('店铺名称') or row.get('store') or '未知店铺').strip(),
            sku=sku,
            product_name=str(row.get('商品名称') or row.get('product_name') or '').strip(),
            quantity=int(float(row.get('商品数量') or row.get('quantity') or 0)),
            unit_price=float(row.get('商品单价') or row.get('unit_price') or 0),
            total_amount=float(row.get('实付金额') or row.get('total_amount') or 0),
            order_status=str(row.get('订单状态') or row.get('order_status') or '未知').strip(),
            ordered_at=str(row.get('下单时间') or row.get('ordered_at') or '').strip(),
            source='import_file',
            raw_data=json.dumps(row, ensure_ascii=False, default=str),
        )
        db.add(item)
        success += 1
    task = SyncTask(task_type='import_orders', platform='manual_import', status='success', started_at=datetime.utcnow(), finished_at=datetime.utcnow(), success_count=success, failed_count=failed, message=f'导入订单 {success} 条，异常 {failed} 条')
    db.add(task)
    create_event(db, 'orders.imported', 'order', None, '订单导入完成', {'success': success, 'failed': failed, 'file': file.filename})
    db.commit()
    await broadcast({'type': 'orders.imported', 'payload': {'success': success, 'failed': failed, 'file': file.filename}})
    return {'ok': True, 'success': success, 'failed': failed, 'file': file.filename}
