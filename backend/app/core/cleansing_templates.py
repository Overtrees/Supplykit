"""模板管理 — 从 cleansing.py 拆出"""
import json
from app.core.database import get_db


def load_custom_fields():
    """加载自定义字段配置"""
    import os
    path = os.path.join(os.path.dirname(__file__), '..', 'custom_fields.json')
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return {'order': [], 'inventory': []}


def save_custom_fields(data):
    """保存自定义字段配置"""
    import os
    path = os.path.join(os.path.dirname(__file__), '..', 'custom_fields.json')
    with open(path, 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def list_templates(db=None):
    """获取所有清洗模板"""
    if db is None:
        db = get_db()
    return db.table("cleansing_templates").select("*").order("id", desc=True).execute().data


def save_template(data: dict, db=None):
    """保存清洗模板"""
    if db is None:
        db = get_db()
    name = data.get('name', '').strip()
    if not name:
        return False
    existing = db.table("cleansing_templates").select("id").eq("name", name).execute().data
    if existing:
        db.table("cleansing_templates").update({
            "mapping": json.dumps(data.get('mapping', {}), ensure_ascii=False),
            "doc_type": data.get('doc_type', data.get('target', 'order')),
            "updated_at": __import__('datetime').datetime.now(UTC).isoformat(),
        }).eq("id", existing[0]["id"]).execute()
    else:
        db.table("cleansing_templates").insert({
            "name": name,
            "mapping": json.dumps(data.get('mapping', {}), ensure_ascii=False),
            "doc_type": data.get('doc_type', data.get('target', 'order')),
        }).execute()
    return True


def delete_template(template_id: int, db=None):
    """删除清洗模板"""
    if db is None:
        db = get_db()
    db.table("cleansing_templates").delete().eq("id", template_id).execute()


SYSTEM_FIELDS = {
    'order': [
        {'key': 'order_no', 'label': '订单号', 'type': 'string', 'required': True, 'desc': '订单唯一编号'},
        {'key': 'sku', 'label': 'SKU', 'type': 'string', 'required': True, 'desc': '商品编码'},
        {'key': 'product_name', 'label': '商品名称', 'type': 'string'},
        {'key': 'store', 'label': '店铺', 'type': 'string'},
        {'key': 'warehouse', 'label': '仓库', 'type': 'string', 'required': True, 'desc': '必填, 用于批次出入库按仓库维度聚合'},
        {'key': 'quantity', 'label': '数量', 'type': 'number'},
        {'key': 'unit_price', 'label': '单价', 'type': 'number'},
        {'key': 'total_amount', 'label': '金额', 'type': 'number'},
        {'key': 'order_status', 'label': '订单状态', 'type': 'string'},
        {'key': 'ordered_at', 'label': '下单时间', 'type': 'date', 'format': 'YMD'},
        {'key': 'platform', 'label': '平台', 'type': 'string'},
        {'key': 'supplier', 'label': '供应商', 'type': 'string'},
        {'key': 'remark', 'label': '备注', 'type': 'string'},
        {'key': 'weight', 'label': '箱重/KG', 'type': 'number'},
        {'key': 'volume', 'label': '体积/方', 'type': 'number'},
    ],
    'inventory': [
        {'key': 'sku', 'label': 'SKU', 'type': 'string', 'required': True},
        {'key': 'product_name', 'label': '商品名称', 'type': 'string'},
        {'key': 'store', 'label': '店铺', 'type': 'string'},
        {'key': 'warehouse', 'label': '仓库', 'type': 'string', 'required': True},
        {'key': 'available_qty', 'label': '可用库存', 'type': 'number'},
        {'key': 'in_transit_qty', 'label': '在途库存', 'type': 'number'},
        {'key': 'safety_qty', 'label': '安全库存', 'type': 'number'},
        {'key': 'weight', 'label': '箱重/KG', 'type': 'number'},
        {'key': 'volume', 'label': '体积/方', 'type': 'number'},
        {'key': 'prod_date', 'label': '生产日期', 'type': 'date', 'format': 'YMD', 'desc': '批次效期用, 可留空'},
        {'key': 'exp_date', 'label': '截止日期', 'type': 'date', 'format': 'YMD', 'desc': '映射后将按批次写入, 同SKU仓库多行=多批次'},
        {'key': 'warehouse_type', 'label': '仓库类型', 'type': 'string', 'desc': 'platform=京东C仓, platform_b=京东B仓, own=自有仓'},
    ],
    'inbound': [
        {'key': 'sku', 'label': 'SKU', 'type': 'string', 'required': True},
        {'key': 'product_name', 'label': '商品名称', 'type': 'string'},
        {'key': 'store', 'label': '店铺', 'type': 'string'},
        {'key': 'warehouse', 'label': '仓库', 'type': 'string', 'required': True, 'desc': '必填, 用于批次出入库按仓库维度聚合'},
        {'key': 'quantity', 'label': '入库数量', 'type': 'number'},
        {'key': 'inbound_date', 'label': '入库日期', 'type': 'date', 'format': 'YMD'},
        {'key': 'prod_date', 'label': '生产日期', 'type': 'date', 'format': 'YMD', 'desc': '批次效期用, 可留空'},
        {'key': 'exp_date', 'label': '截止日期', 'type': 'date', 'format': 'YMD', 'desc': '映射后将按批次写入'},
    ],
    'outbound': [
        {'key': 'sku', 'label': 'SKU', 'type': 'string', 'required': True},
        {'key': 'product_name', 'label': '商品名称', 'type': 'string'},
        {'key': 'warehouse', 'label': '仓库', 'type': 'string', 'required': True, 'desc': '必填, 用于批次出入库按仓库维度聚合'},
        {'key': 'quantity', 'label': '出库数量', 'type': 'number'},
        {'key': 'outbound_date', 'label': '出库日期', 'type': 'date', 'format': 'YMD'},
        {'key': 'prod_date', 'label': '生产日期', 'type': 'date', 'format': 'YMD', 'desc': '批次效期用, 可留空'},
        {'key': 'exp_date', 'label': '截止日期', 'type': 'date', 'format': 'YMD', 'desc': '映射后将按批次写入'},
    ],
    'product': [
        {'key': 'sku', 'label': 'SKU', 'type': 'string', 'required': True},
        {'key': 'product_name', 'label': '商品名称', 'type': 'string'},
        {'key': 'store', 'label': '店铺', 'type': 'string'},
        {'key': 'category', 'label': '分类', 'type': 'string'},
        {'key': 'price', 'label': '单价', 'type': 'number'},
        {'key': 'box_qty', 'label': '箱规', 'type': 'number'},
        {'key': 'barcode', 'label': '69码', 'type': 'string'},
        {'key': 'weight', 'label': '箱重/KG', 'type': 'number'},
        {'key': 'volume', 'label': '体积/方', 'type': 'number'},
        {'key': 'best_before', 'label': '保质期日期', 'type': 'date', 'format': 'YMD'},
    ],
}


def get_system_fields(target: str):
    """获取系统预定义字段"""
    return SYSTEM_FIELDS.get(target, [])