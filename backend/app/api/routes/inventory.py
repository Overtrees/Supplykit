from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session
from datetime import datetime
import json
import csv
import io
from openpyxl import load_workbook
from app.core.database import get_db
from app.models.entities import Inventory, QualityLog, SyncTask
from app.api.routes.ws import broadcast
from app.services.event_service import create_event, rebuild_low_stock_alerts

router = APIRouter(prefix="/api/inventory", tags=["inventory"])

@router.get("")
def list_inventory(db: Session = Depends(get_db)):
    rows = db.query(Inventory).order_by(Inventory.id.desc()).all()
    return [{
        "id": x.id,
        "store": x.store,
        "sku": x.sku,
        "product_name": x.product_name,
        "available_qty": x.available_qty,
        "locked_qty": x.locked_qty,
        "in_transit_qty": x.in_transit_qty,
        "safety_qty": x.safety_qty,
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
async def import_inventory(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    rows = rows_from_upload(file.filename, content)
    success = 0
    failed = 0
    for row in rows:
        sku = str(row.get('商品编号') or row.get('SKU编号') or row.get('sku') or '').strip()
        store = str(row.get('店铺名称') or row.get('store') or '未知店铺').strip()
        if not sku:
          failed += 1
          db.add(QualityLog(entity_type='inventory', entity_id=None, field_name='sku', issue_type='missing_key', issue_message='缺少SKU', severity='error', raw_data=json.dumps(row, ensure_ascii=False, default=str)))
          continue
        exists = db.query(Inventory).filter(Inventory.sku == sku, Inventory.store == store).first()
        payload = {
            'store': store,
            'sku': sku,
            'product_name': str(row.get('商品名称') or row.get('product_name') or '').strip(),
            'available_qty': int(float(row.get('可用库存') or row.get('available_qty') or 0)),
            'locked_qty': int(float(row.get('锁定库存') or row.get('locked_qty') or 0)),
            'in_transit_qty': int(float(row.get('在途数量') or row.get('in_transit_qty') or 0)),
            'safety_qty': int(float(row.get('预警库存') or row.get('safety_qty') or 0)),
            'source': 'import_file',
            'raw_data': json.dumps(row, ensure_ascii=False, default=str),
        }
        if exists:
            for k, v in payload.items():
                setattr(exists, k, v)
        else:
            db.add(Inventory(**payload))
        success += 1
    task = SyncTask(task_type='import_inventory', platform='manual_import', status='success', started_at=datetime.utcnow(), finished_at=datetime.utcnow(), success_count=success, failed_count=failed, message=f'导入库存 {success} 条，异常 {failed} 条')
    db.add(task)
    create_event(db, 'inventory.imported', 'inventory', None, '库存导入完成', {'success': success, 'failed': failed, 'file': file.filename})
    db.flush()
    rebuild_low_stock_alerts(db)
    db.commit()
    await broadcast({'type': 'inventory.imported', 'payload': {'success': success, 'failed': failed, 'file': file.filename}})
    return {'ok': True, 'success': success, 'failed': failed, 'file': file.filename}
