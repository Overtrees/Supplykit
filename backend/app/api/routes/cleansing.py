from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from supabase import Client
from datetime import datetime
import json, csv, io, re, os
from openpyxl import load_workbook
from app.core.supabase_client import get_supabase
from app.api.routes.ws import broadcast
from app.api.routes.insights import auto_adjust_inventory

router = APIRouter(prefix="/api/cleansing", tags=["cleansing"])

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

CUSTOM_FIELDS_PATH = '/home/Overtrees/Supplykit/backend/custom_fields.json'

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
        return list(csv.DictReader(io.StringIO(text)))
    wb = load_workbook(io.BytesIO(content), data_only=True)
    ws = wb[wb.sheetnames[0]]
    raw = list(ws.iter_rows(values_only=True))
    if not raw:
        return []
    headers = [str(c).strip() if c is not None else '' for c in raw[0]]
    return [{headers[i]: raw[r][i] for i in range(len(headers))} for r in range(1, len(raw))]

# ─── 检测接口 ────────────────────────────────────────────────────────────────

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

# ─── 预览接口 ────────────────────────────────────────────────────────────────

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
async def execute_cleansing(file: UploadFile = File(...), mapping: str = Form(''),
                             target: str = Form('order'), template_name: str = Form(''),
                             supabase: Client = Depends(get_supabase)):
    content = await file.read()
    rows = parse_file(content, file.filename)
    if not rows:
        return {'ok': False, 'error': '文件为空'}
    try:
        mapping_config = json.loads(mapping) if mapping else {}
    except json.JSONDecodeError:
        return {'ok': False, 'error': '映射配置格式错误'}

    success = 0
    failed = 0
    orders_to_insert = []
    inv_to_insert = []
    order_no_seen = set()

    # 批量加载已存在的订单号，避免逐行 SELECT
    dedup = {}
    for row in rows:
        data = {}
        for src_col, cfg in mapping_config.items():
            target_field = cfg.get('target', '')
            if target_field:
                data[target_field] = cleanse_value(row.get(src_col, ''), cfg)
        order_no = data.get('order_no', '')
        if not order_no:
            order_no = f"AUTO-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        if order_no in dedup:
            dedup[order_no] += 1
        else:
            dedup[order_no] = 0

    if dedup:
        existing_data = supabase.table("orders").select("order_no").in_("order_no", list(dedup.keys())).execute().data
        order_no_seen = {r['order_no'] for r in existing_data}

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
                if order_no in dedup:
                    dedup[order_no] += 1
                    order_no = f"{order_no}-{dedup[order_no]}"
                else:
                    dedup[order_no] = 0
                data['order_no'] = order_no

                if order_no not in order_no_seen:
                    order_no_seen.add(order_no)
                    orders_to_insert.append({
                        "order_no": order_no,
                        "store": str(data.get('store', '未知'))[:100],
                        "sku": str(data.get('sku', ''))[:100],
                        "product_name": str(data.get('product_name', ''))[:200],
                        "quantity": int(float(data.get('quantity', 0))),
                        "unit_price": float(data.get('unit_price', 0)),
                        "total_amount": float(data.get('total_amount', 0)),
                        "order_status": str(data.get('order_status', '已完成'))[:50],
                        "ordered_at": str(data.get('ordered_at', ''))[:50],
                    })
                    auto_adjust_inventory(data, 'cleansing', supabase)
                    success += 1
                else:
                    failed += 1

            elif target == 'inventory':
                sku = str(data.get('sku', ''))
                if sku:
                    exists = supabase.table("inventory").select("id").eq("sku", sku).execute().data
                    if not exists:
                        inv_to_insert.append({
                            "store": str(data.get('store', '未知'))[:100],
                            "sku": sku[:100],
                            "product_name": str(data.get('product_name', ''))[:200],
                            "available_qty": int(float(data.get('available_qty', 0))),
                            "locked_qty": int(float(data.get('locked_qty', 0))),
                            "in_transit_qty": int(float(data.get('in_transit_qty', 0))),
                            "safety_qty": int(float(data.get('safety_qty', 0))),
                            "source": "cleansing",
                            "raw_data": json.dumps(row, ensure_ascii=False, default=str),
                        })
                        success += 1
                    else:
                        failed += 1
                else:
                    failed += 1
        except Exception as e:
            failed += 1
            supabase.table("quality_logs").insert({
                "log_type": "cleansing_error",
                "message": str(e)[:200], "level": "error",
            }).execute()

    if orders_to_insert:
        try:
            supabase.table("orders").insert(orders_to_insert).execute()
        except Exception as e:
            failed += len(orders_to_insert)
            success -= len(orders_to_insert)
            supabase.table("quality_logs").insert({
                "log_type": "cleansing_batch_error",
                "message": f"批量写入订单失败: {str(e)[:150]}", "level": "error",
            }).execute()
    if inv_to_insert:
        try:
            supabase.table("inventory").insert(inv_to_insert).execute()
        except Exception as e:
            failed += len(inv_to_insert)
            success -= len(inv_to_insert)
            supabase.table("quality_logs").insert({
                "log_type": "cleansing_batch_error",
                "message": f"批量写入库存失败: {str(e)[:150]}", "level": "error",
            }).execute()

    # 保存模板
    if template_name:
        existing = supabase.table("cleansing_templates").select("id").eq("name", template_name).execute().data
        if existing:
            supabase.table("cleansing_templates").update({"mapping": json.dumps(mapping_config, ensure_ascii=False)}).eq("id", existing[0]["id"]).execute()
        else:
            supabase.table("cleansing_templates").insert({
                "name": template_name, "doc_type": target,
                "mapping": json.dumps(mapping_config, ensure_ascii=False),
            }).execute()

    # 构建提示消息
    msg_parts = []
    if success > 0:
        msg_parts.append(f"成功导入 {success} 条")
    if failed > 0:
        msg_parts.append(f"{failed} 条跳过（已存在或写入失败）")
    message = "，".join(msg_parts) if msg_parts else "无数据变更"

    from app.core.events import bus
    bus.emit('data.cleaned', {
        'target': target,
        'event_type': f'{target}.cleansed',
        'entity_type': target,
        'title': f'清洗导入 {success} 条',
        'payload': {'success': success, 'failed': failed, 'file': file.filename or ''},
        'ws_message': {
            'type': f'{target}.cleansed',
            'payload': {'success': success, 'failed': failed, 'file': file.filename or ''}
        }
    })

    if success == 0 and failed > 0:
        return {'ok': False, 'success': 0, 'failed': failed, 'file': file.filename, 'target': target,
                'error': '所有记录均重复或写入失败，无新增数据。请检查文件是否已导入过'}
    return {'ok': True, 'success': success, 'failed': failed, 'file': file.filename,
            'target': target, 'message': message}

# ─── 模板管理 ────────────────────────────────────────────────────────────────

@router.get('/templates')
def list_templates(supabase: Client = Depends(get_supabase)):
    templates = supabase.table("cleansing_templates").select("*").order("updated_at", desc=True).execute().data
    return [{
        'id': t['id'], 'name': t['name'], 'doc_type': t['doc_type'],
        'mapping': json.loads(t.get('mapping') or '{}'),
        'updated_at': t.get('updated_at'),
    } for t in templates]

@router.delete('/templates/{template_id}')
def delete_template(template_id: int, supabase: Client = Depends(get_supabase)):
    data = supabase.table("cleansing_templates").select("id").eq("id", template_id).execute().data
    if not data:
        raise HTTPException(status_code=404, detail='模板不存在')
    supabase.table("cleansing_templates").delete().eq("id", template_id).execute()
    return {'ok': True}

# ─── 字段管理 ────────────────────────────────────────────────────────────────

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
def add_custom_field(target: str, data: dict):
    if target not in ('order', 'inventory'):
        raise HTTPException(status_code=400, detail='目标必须是 order 或 inventory')
    key = str(data.get('key', '')).strip()
    label = str(data.get('label', key)).strip()
    ftype = str(data.get('type', 'string')).strip()
    if not key:
        raise HTTPException(status_code=400, detail='字段名不能为空')
    cf = load_custom_fields()
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
        return cfg.get('default', '')
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
