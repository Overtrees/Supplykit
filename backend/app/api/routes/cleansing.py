from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import json, csv, io, re
from openpyxl import load_workbook
from app.core.database import get_db, Base, engine
from app.models.entities import Order, Inventory, QualityLog, SyncTask
from sqlalchemy import Column, Integer, String, Text, DateTime
from app.api.routes.ws import broadcast
from app.services.event_service import create_event
from app.api.routes.insights import auto_adjust_inventory

router = APIRouter(prefix="/api/cleansing", tags=["cleansing"])

# ─── 清洗模板模型 ────────────────────────────────────────────────────────────

class CleansingTemplate(Base):
    __tablename__ = "cleansing_templates"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    doc_type = Column(String, default="custom")       # jd_purchase / sales_order / custom
    mapping = Column(Text, default="{}")               # JSON: { source_col: { target, type, format, default, rules } }
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

Base.metadata.create_all(bind=engine)

# ─── 系统目标字段定义 ────────────────────────────────────────────────────────

SYSTEM_FIELDS = {
    'order': [
        {'key':'order_no',       'label':'订单号',     'type':'string'},
        {'key':'store',          'label':'店铺',       'type':'string'},
        {'key':'warehouse',      'label':'仓库',       'type':'string'},
        {'key':'sku',            'label':'商品编号',   'type':'string'},
        {'key':'product_name',   'label':'商品名称',   'type':'string'},
        {'key':'quantity',       'label':'数量',       'type':'number'},
        {'key':'unit_price',     'label':'单价',       'type':'number'},
        {'key':'total_amount',   'label':'总金额',     'type':'number'},
        {'key':'order_status',   'label':'状态',       'type':'string'},
        {'key':'ordered_at',     'label':'日期',       'type':'date'},
        {'key':'supplier',       'label':'供应商',     'type':'string'},
        {'key':'remark',         'label':'备注',       'type':'string'},
    ],
    'inventory': [
        {'key':'store',          'label':'店铺',       'type':'string'},
        {'key':'warehouse',      'label':'仓库',       'type':'string'},
        {'key':'sku',            'label':'商品编号',   'type':'string'},
        {'key':'product_name',   'label':'商品名称',   'type':'string'},
        {'key':'available_qty',  'label':'可用库存',   'type':'number'},
        {'key':'locked_qty',     'label':'锁定库存',   'type':'number'},
        {'key':'in_transit_qty', 'label':'在途数量',   'type':'number'},
        {'key':'safety_qty',     'label':'安全库存',   'type':'number'},
    ],
}

# ─── 自定义字段存储 ────────────────────────────────────────────────────────────
# 存储为 JSON 文件，因为字段结构简单且需要频繁修改

CUSTOM_FIELDS_PATH = '/home/Overtrees/Supplykit/backend/custom_fields.json'
import os

def load_custom_fields():
    if os.path.exists(CUSTOM_FIELDS_PATH):
        try:
            with open(CUSTOM_FIELDS_PATH) as f:
                return json.load(f)
        except: pass
    return {'order': [], 'inventory': []}

def save_custom_fields(data):
    os.makedirs(os.path.dirname(CUSTOM_FIELDS_PATH), exist_ok=True)
    with open(CUSTOM_FIELDS_PATH, 'w') as f:
        json.dump(data, f, ensure_ascii=False)

# ─── 文件解析 ────────────────────────────────────────────────────────────────

def parse_file(content, filename):
    if filename.lower().endswith('.csv'):
        text = content.decode('utf-8-sig', errors='ignore')
        rows = list(csv.DictReader(io.StringIO(text)))
        return rows
    wb = load_workbook(io.BytesIO(content), data_only=True)
    ws = wb[wb.sheetnames[0]]
    raw = list(ws.iter_rows(values_only=True))
    if not raw:
        return []
    headers = [str(c).strip() if c is not None else '' for c in raw[0]]
    return [{headers[i]: raw[r][i] for i in range(len(headers))} for r in range(1, len(raw))]

# ─── 检测接口：上传文件返回列名+样例 ────────────────────────────────────────

@router.post('/detect')
async def detect_columns(file: UploadFile = File(...)):
    content = await file.read()
    rows = parse_file(content, file.filename)
    if not rows:
        return {'ok': False, 'error': '文件为空'}
    cols = []
    for key in rows[0].keys():
        samples = []
        for r in rows[:5]:
            v = r.get(key)
            if v is not None and str(v).strip():
                samples.append(str(v)[:60])
        cols.append({'name': key, 'samples': samples[:3], 'count': len(rows)})
    return {'ok': True, 'columns': cols, 'total': len(rows), 'file': file.filename}

# ─── 预览接口：按映射配置预览结果 ───────────────────────────────────────────

@router.post('/preview')
async def preview_cleansing(file: UploadFile = File(...), mapping: str = Form('')):
    content = await file.read()
    rows = parse_file(content, file.filename)
    if not rows:
        return {'ok': False, 'error': '文件为空'}
    try:
        mapping_config = json.loads(mapping) if mapping else {}
    except json.JSONDecodeError:
        return {'ok': False, 'error': '映射配置格式错误'}

    preview_rows = []
    for row in rows[:20]:
        result = {'_source': {}}
        for src_col, cfg in mapping_config.items():
            target = cfg.get('target', '')
            if not target:
                continue
            raw_val = row.get(src_col, '')
            cleaned = cleanse_value(raw_val, cfg)
            result['_source'][src_col] = str(raw_val)[:80] if raw_val is not None else ''
            result[target] = cleaned
        preview_rows.append(result)

    return {'ok': True, 'preview': preview_rows, 'total': len(rows), 'mapped': len(mapping_config)}

# ─── 执行清洗 ────────────────────────────────────────────────────────────────

@router.post('/execute')
async def execute_cleansing(file: UploadFile = File(...), mapping: str = Form(''), target: str = Form('order'), template_name: str = Form('')):
    content = await file.read()
    rows = parse_file(content, file.filename)
    if not rows:
        return {'ok': False, 'error': '文件为空'}
    try:
        mapping_config = json.loads(mapping) if mapping else {}
    except json.JSONDecodeError:
        return {'ok': False, 'error': '映射配置格式错误'}

    db = next(get_db())
    success = 0
    failed = 0

    dedup = {}  # 跟踪已用的 order_no，重复自动加后缀
    for row in rows:
        try:
            data = {}
            for src_col, cfg in mapping_config.items():
                target_field = cfg.get('target', '')
                if target_field:
                    data[target_field] = cleanse_value(row.get(src_col, ''), cfg)

            if target == 'order':
                order_no = data.get('order_no', '')
                if not order_no:
                    order_no = f"AUTO-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{success}"
                # 处理重复 order_no
                if order_no in dedup:
                    dedup[order_no] += 1
                    order_no = f"{order_no}-{dedup[order_no]}"
                else:
                    dedup[order_no] = 0
                data['order_no'] = order_no

                exists = db.query(Order).filter(Order.order_no == order_no).first()
                if not exists:
                    db.add(Order(
                        order_no=order_no,
                        store=str(data.get('store', '未知'))[:100],
                        sku=str(data.get('sku', ''))[:100],
                        product_name=str(data.get('product_name', ''))[:200],
                        quantity=int(float(data.get('quantity', 0))),
                        unit_price=float(data.get('unit_price', 0)),
                        total_amount=float(data.get('total_amount', 0)),
                        order_status=str(data.get('order_status', '已完成'))[:50],
                        ordered_at=str(data.get('ordered_at', ''))[:50],
                        platform='cleansed',
                        source='cleansing',
                        raw_data=json.dumps(row, ensure_ascii=False, default=str),
                    ))
                    # 自动联动库存
                    auto_adjust_inventory(data, 'cleansing', db)
                    success += 1
                else:
                    failed += 1
            elif target == 'inventory':
                sku = str(data.get('sku', ''))
                if sku:
                    exists = db.query(Inventory).filter(Inventory.sku == sku).first()
                    if not exists:
                        db.add(Inventory(
                            store=str(data.get('store', '未知'))[:100],
                            sku=sku[:100],
                            product_name=str(data.get('product_name', ''))[:200],
                            available_qty=int(float(data.get('available_qty', 0))),
                            locked_qty=int(float(data.get('locked_qty', 0))),
                            in_transit_qty=int(float(data.get('in_transit_qty', 0))),
                            safety_qty=int(float(data.get('safety_qty', 0))),
                            source='cleansing',
                            raw_data=json.dumps(row, ensure_ascii=False, default=str),
                        ))
                        success += 1
                    else:
                        failed += 1
                else:
                    failed += 1
        except Exception as e:
            failed += 1
            db.add(QualityLog(entity_type=target, issue_type='cleansing_error', issue_message=str(e)[:200], severity='error'))

    # 保存模板（如有名称）
    if template_name:
        existing = db.query(CleansingTemplate).filter(CleansingTemplate.name == template_name).first()
        if existing:
            existing.mapping = json.dumps(mapping_config, ensure_ascii=False)
        else:
            db.add(CleansingTemplate(name=template_name, doc_type=target, mapping=json.dumps(mapping_config, ensure_ascii=False)))

    db.commit()
    create_event(db, f'{target}.cleansed', target, None, f'清洗导入 {success} 条', {'success': success, 'failed': failed, 'file': file.filename})
    db.close()
    return {'ok': True, 'success': success, 'failed': failed, 'file': file.filename, 'target': target}

# ─── 模板管理 ────────────────────────────────────────────────────────────────

@router.get('/templates')
def list_templates(db: Session = Depends(get_db)):
    templates = db.query(CleansingTemplate).order_by(CleansingTemplate.updated_at.desc()).all()
    return [{
        'id': t.id, 'name': t.name, 'doc_type': t.doc_type,
        'mapping': json.loads(t.mapping),
        'updated_at': t.updated_at.isoformat() if t.updated_at else None,
    } for t in templates]

@router.delete('/templates/{template_id}')
def delete_template(template_id: int, db: Session = Depends(get_db)):
    t = db.query(CleansingTemplate).filter(CleansingTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail='模板不存在')
    db.delete(t)
    db.commit()
    return {'ok': True}

# ─── 获取系统字段定义 ────────────────────────────────────────────────────────

@router.get('/fields/{target}')
def get_fields(target: str):
    system = SYSTEM_FIELDS.get(target)
    if not system:
        raise HTTPException(status_code=404, detail=f'目标 {target} 不存在')
    custom = load_custom_fields().get(target, [])
    return {'system': system, 'custom': custom, 'all': system + custom}

@router.get('/custom-fields/{target}')
def list_custom_fields(target: str):
    data = load_custom_fields()
    return data.get(target, [])

@router.post('/custom-fields/{target}')
def add_custom_field(target: str, data: dict, db: Session = Depends(get_db)):
    if target not in ('order', 'inventory'):
        raise HTTPException(status_code=400, detail='目标必须是 order 或 inventory')
    key = str(data.get('key', '')).strip()
    label = str(data.get('label', key)).strip()
    ftype = str(data.get('type', 'string')).strip()
    if not key:
        raise HTTPException(status_code=400, detail='字段名不能为空')
    cf = load_custom_fields()
    # 去重
    existing = [f for f in cf.get(target, []) if f['key'] == key]
    if not existing:
        cf[target].append({'key': key, 'label': label, 'type': ftype})
        save_custom_fields(cf)
    return {'ok': True, 'fields': cf[target]}

@router.delete('/custom-fields/{target}/{field_key}')
def remove_custom_field(target: str, field_key: str):
    cf = load_custom_fields()
    cf[target] = [f for f in cf.get(target, []) if f['key'] != field_key]
    save_custom_fields(cf)
    return {'ok': True}

# ─── 清洗工具函数 ────────────────────────────────────────────────────────────

def cleanse_value(raw_val, cfg):
    if raw_val is None or str(raw_val).strip() == '':
        default = cfg.get('default', '')
        return default
    v = str(raw_val).strip()
    field_type = cfg.get('type', 'string')
    fmt_str = cfg.get('format', '')
    try:
        if field_type == 'number':
            cleaned = re.sub(r'[^\d.\-]', '', v)
            return float(cleaned) if '.' in cleaned else int(float(cleaned))
        elif field_type == 'date':
            if fmt_str == 'YMD':
                return v[:10]
            return v
        else:
            return v
    except:
        return v
