from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.entities import Inventory, Product, Supplier, Order

router = APIRouter(prefix="/api/insights", tags=["insights"])

# ─── 补货建议 ────────────────────────────────────────────────────────────────

@router.get('/replenishment')
def get_replenishment_suggestions(db: Session = Depends(get_db)):
    """低于安全库存的商品 → 生成建议补货量"""
    items = db.query(Inventory).all()
    products = {p.sku: p for p in db.query(Product).all()}
    suggestions = []

    for inv in items:
        avail = int(inv.available_qty or 0)
        safety = int(inv.safety_qty or 0)
        transit = int(inv.in_transit_qty or 0)

        if avail >= safety:
            continue

        suggested = max(safety * 2 - avail - transit, safety - avail)
        p = products.get(inv.sku)

        suggestions.append({
            'sku': inv.sku,
            'product_name': inv.product_name or (p.product_name if p else ''),
            'store': inv.store,
            'category': p.category if p else '',
            'available_qty': avail,
            'safety_qty': safety,
            'in_transit_qty': transit,
            'suggested_qty': suggested,
            'urgency': '紧急' if avail <= safety * 0.3 else ('关注' if avail <= safety * 0.6 else '预警'),
        })

    suggestions.sort(key=lambda x: (x['urgency'] != '紧急', x['urgency'] != '关注', x['available_qty']))
    return suggestions

# ─── 采购建议 ────────────────────────────────────────────────────────────────

@router.get('/purchase')
def get_purchase_suggestions(db: Session = Depends(get_db)):
    """基于补货建议 + 供应商匹配 → 采购建议"""
    replen = get_replenishment_suggestions(db)
    suppliers = db.query(Supplier).filter(Supplier.status == 'active').all()
    if not suppliers:
        return {'suggestions': replen, 'suppliers': []}

    result = []
    for item in replen:
        # 按类别或名称模糊匹配最佳供应商
        best = None
        for s in suppliers:
            if item.get('category') and item['category'] in (s.supplier_name or ''):
                best = s
                break
        if not best and suppliers:
            best = max(suppliers, key=lambda x: x.score or 0)

        result.append({
            **item,
            'supplier_code': best.supplier_code if best else '',
            'supplier_name': best.supplier_name if best else '',
            'supplier_score': best.score if best else 0,
        })

    return {'suggestions': result, 'suppliers': len(suppliers)}

# ─── 库存变动统计 ─────────────────────────────────────────────────────────────

@router.get('/summary')
def get_insight_summary(db: Session = Depends(get_db)):
    inv = db.query(Inventory).all()
    total = len(inv)
    low_stock = len([x for x in inv if int(x.available_qty or 0) < int(x.safety_qty or 0)])
    out_of_stock = len([x for x in inv if int(x.available_qty or 0) == 0])

    replen = get_replenishment_suggestions(db)
    urgent = len([x for x in replen if x['urgency'] == '紧急'])

    return {
        'total_products': total,
        'low_stock': low_stock,
        'out_of_stock': out_of_stock,
        'urgent_replenish': urgent,
        'suggestions_count': len(replen),
    }

# ─── 自动库存联动 ────────────────────────────────────────────────────────────

def auto_adjust_inventory(order_data: dict, order_type: str, db: Session):
    """
    订单自动联动库存：
    - jd_purchase / cleansing_purchase → 入库
    - sales_order → 出库
    """
    sku = order_data.get('sku', '')
    qty = int(float(order_data.get('quantity', 0)))
    if not sku or qty <= 0:
        return

    inv = db.query(Inventory).filter(Inventory.sku == sku).first()
    if not inv:
        # 自动创建库存记录
        inv = Inventory(
            sku=sku,
            product_name=order_data.get('product_name', ''),
            store=order_data.get('store', ''),
            available_qty=0,
            locked_qty=0,
            in_transit_qty=0,
            safety_qty=10,
            source='auto_created',
        )
        db.add(inv)

    if order_type in ('jd_purchase', 'cleansing_purchase'):
        inv.available_qty = (inv.available_qty or 0) + qty
    elif order_type in ('sales', 'jd_sales', 'cleansing'):
        inv.available_qty = max(0, (inv.available_qty or 0) - qty)
