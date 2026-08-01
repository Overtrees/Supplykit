"""种子数据 — 填充/重置"""
from fastapi import APIRouter
from app.core.database import get_db, init_db
from app.core.response import ok, fail
from datetime import datetime, timedelta
import random, json

router = APIRouter(prefix="/api/seed", tags=["seed"])

@router.post("/fill")
def seed_fill(db=get_db()):
    now = datetime.utcnow()
    ch = 'jd'

    # 商品
    products = [
        {'sku':'SKU001','product_name':'洗发水','store':'京东自营','category':'洗护','price':39.9,'box_qty':12,'barcode':'6901234567890','weight':12,'volume':0.05,'channel':ch},
        {'sku':'SKU002','product_name':'护发素','store':'京东自营','category':'洗护','price':49.9,'box_qty':12,'barcode':'6901234567891','weight':13,'volume':0.05,'channel':ch},
        {'sku':'SKU003','product_name':'沐浴露','store':'京东旗舰店','category':'洗护','price':59.9,'box_qty':6,'barcode':'6901234567892','weight':15,'volume':0.06,'channel':ch},
        {'sku':'SKU004','product_name':'洗面奶','store':'京东自营','category':'护肤','price':29.9,'box_qty':24,'barcode':'6901234567893','weight':10,'volume':0.04,'channel':ch},
        {'sku':'SKU005','product_name':'面霜','store':'京东旗舰店','category':'护肤','price':89.9,'box_qty':12,'barcode':'6901234567894','weight':8,'volume':0.03,'channel':ch},
    ]
    for p in products:
        db.table("products").upsert(p, conflict_col='sku')

    # 供应商
    suppliers = [
        {'supplier_code':'SUP001','supplier_name':'广州日化有限公司','contact_person':'张三','contact_phone':'13800138001','channel':ch},
        {'supplier_code':'SUP002','supplier_name':'上海美妆科技有限公司','contact_person':'李四','contact_phone':'13800138002','channel':ch},
    ]
    for s in suppliers:
        db.table("suppliers").upsert(s, conflict_col='supplier_code')

    # 库存
    warehouses = [('北京仓','platform'),('上海仓','platform'),('广州仓','own')]
    for sku in ['SKU001','SKU002','SKU003','SKU004','SKU005']:
        for w_name, w_type in warehouses:
            inv = {
                'sku': sku, 'product_name': next(p['product_name'] for p in products if p['sku']==sku),
                'warehouse': w_name, 'warehouse_type': w_type,
                'available_qty': random.randint(50,500),
                'in_transit_qty': random.randint(0,100),
                'safety_qty': 100, 'channel': ch
            }
            db.table("inventory").insert(inv)

    # 订单
    statuses = ['已完成','待发货','已发货','待确认']
    for i in range(20):
        sku = random.choice(products)['sku']
        days_ago = random.randint(0,30)
        order = {
            'order_no': f'JD{i+1:04d}',
            'store': '京东自营',
            'warehouse': random.choice(warehouses)[0],
            'sku': sku,
            'product_name': next(p['product_name'] for p in products if p['sku']==sku),
            'quantity': random.randint(1,10),
            'unit_price': random.uniform(20,100),
            'total_amount': 0,
            'order_status': random.choice(statuses),
            'ordered_at': (now - timedelta(days=days_ago)).strftime('%Y-%m-%d'),
            'paid_at': (now - timedelta(days=days_ago-1)).strftime('%Y-%m-%d'),
            'channel': ch,
        }
        order['total_amount'] = round(order['quantity'] * order['unit_price'], 2)
        db.table("orders").insert(order)

    return ok({'products':len(products),'suppliers':len(suppliers),'inventory':len(warehouses)*5,'orders':20})


@router.post("/reset")
def seed_reset(db=get_db()):
    tables = ['orders','inventory','products','suppliers','alerts','quality_logs','events','purchase_orders','replenishment_config_history']
    for t in tables:
        try:
            db.table(t).delete().neq('id', -1).execute()
        except:
            pass
    # 重新初始化种子规则
    from app.core.database import _seed_builtin_rules
    try:
        _seed_builtin_rules()
    except:
        pass
    return ok({'reset': True})