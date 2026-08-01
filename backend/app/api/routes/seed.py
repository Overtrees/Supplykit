from fastapi import APIRouter
from app.core.database import get_db, get_conn, DB_PATH
from app.core.response import ok
from app.core.dashboard_cache import invalidate
from datetime import datetime, timedelta
import random, sqlite3

router = APIRouter(prefix="/api/seed", tags=["seed"])

cat_names = ['酱油','酱料','调味汁','食用油','醋','料酒','蚝油','芝麻油','辣椒酱','拌面酱']
store_names = ['京东自营','京东旗舰店','广州调味食材专营店','华南食品旗舰店']
WH = [('北京仓','platform'),('上海仓','platform'),('广州仓','own'),('成都仓','platform'),('武汉仓','platform'),('沈阳仓','platform'),('西安仓','platform'),('郑州仓','platform'),('天津仓','own')]
SUP = [
    {'code':'SUP-001','name':'广州海天调味品有限公司','contact':'张伟','phone':'13800138001','score':5},
    {'code':'SUP-002','name':'上海太太乐食品有限公司','contact':'李娜','phone':'13800138002','score':4},
    {'code':'SUP-003','name':'佛山海天味业有限公司','contact':'王强','phone':'13800138003','score':5},
    {'code':'SUP-004','name':'成都红九九食品有限公司','contact':'赵敏','phone':'13800138004','score':3},
    {'code':'SUP-005','name':'北京王致和食品有限公司','contact':'孙丽','phone':'13800138005','score':4},
]

def make_skus(sfx):
    r = []
    for i in range(1, 81):
        c = cat_names[(i-1)%len(cat_names)]
        s = store_names[(i-1)%len(store_names)]
        p = round(random.uniform(5.8, 39.9), 1)
        r.append({'sku':f'SKU-{i:03d}{sfx}','name':f'调味品{c}{i}','store':s,'cat':c,'price':p,'box':random.choice([6,12,24]),'unit':'瓶','barcode':f'690{i:010d}','weight':round(random.uniform(5,25),1),'volume':round(random.uniform(0.02,0.12),3),'status':'active'})
    return r

@router.post("/fill")
def seed_fill(db=get_db()):
    today = datetime.utcnow()
    conn = get_conn()
    for t in ['orders','inventory','products','suppliers','alerts','quality_logs','events','purchase_orders','replenishment_config_history','cleansing_templates','custom_fields']:
        try: conn.execute(f'DELETE FROM "{t}"')
        except: pass
    conn.commit()

    jd_s = make_skus('')
    ot_s = make_skus('-O')
    for skus,ch in [(jd_s,'jd'),(ot_s,'other')]:
        for p in skus:
            db.table("products").upsert({'sku':p['sku'],'product_name':p['name'],'store':p['store'],'category':p['cat'],'price':p['price'],'box_qty':p['box'],'unit':p['unit'],'barcode':p['barcode'],'weight':p['weight'],'volume':p['volume'],'status':p['status'],'channel':ch}, conflict_col='sku')
    for s in SUP:
        for ch in ['jd','other']:
            db.table("suppliers").upsert({'supplier_code':s['code'],'supplier_name':s['name'],'contact_person':s['contact'],'contact_phone':s['phone'],'score':s['score'],'channel':ch}, conflict_col='supplier_code')

    orders = []
    for ch,label,skus,base in [('jd','jd',jd_s,4),('other','other',ot_s,2)]:
        promo = {'618':list(range(5,20)),'月末':list(range(45,55))}
        for d in range(60):
            dt = today - timedelta(days=d)
            is_promo = any(d in v for v in promo.values())
            cnt = int(base * random.uniform(2,4)) if is_promo else (int(base * random.uniform(0.6,1.2)) if dt.weekday()>=5 else base)
            for _ in range(cnt):
                sk = random.choice(skus)
                q = random.randint(1,20) if is_promo else random.randint(1,8)
                st = random.choices(['已完成','已发货','待发货','待确认','申请退款'],[60,15,12,8,5])[0]
                orders.append({'order_no':f'{label.upper()}-{ch}{d:03d}-{len(orders):03d}','store':sk['store'],'warehouse':random.choice(WH)[0],'sku':sk['sku'],'product_name':sk['name'],'barcode':sk['barcode'],'quantity':q,'unit_price':sk['price'],'total_amount':round(q*sk['price'],2),'order_status':st,'ordered_at':dt.strftime('%Y-%m-%d'),'paid_at':(dt+timedelta(hours=random.randint(1,48))).strftime('%Y-%m-%d'),'channel':ch,'platform':'京东' if label=='jd' else '天猫'})
    db.table("orders").insert(orders).execute()

    inv = []
    for skus in [jd_s,ot_s]:
        for sk in skus:
            for wn,wt in WH:
                q = random.randint(0,30) if random.random()<0.08 else random.randint(50,800)
                inv.append({'sku':sk['sku'],'product_name':sk['name'],'barcode':sk['barcode'],'warehouse':wn,'warehouse_type':wt,'available_qty':q,'in_transit_qty':random.randint(0,200),'safety_qty':100,'beginning_stock':q+random.randint(50,200),'month_inbound':random.randint(100,500),'month_outbound':random.randint(80,450),'turnover_days':round(random.uniform(5,45),1),'weight':sk['weight'],'volume':sk['volume'],'channel':'jd' if skus is jd_s else 'other'})
    db.table("inventory").insert(inv).execute()

    invalidate()
    return ok({'products':160,'suppliers':10,'inventory':len(inv),'orders':len(orders)})

@router.post("/reset")
def seed_reset():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys=OFF")
    for t in ['orders','inventory','products','suppliers','alerts','quality_logs','events','purchase_orders','replenishment_config_history','cleansing_templates','custom_fields','replenishment_config','rules']:
        try: conn.execute(f'DELETE FROM "{t}"')
        except: pass
    conn.execute("PRAGMA foreign_keys=ON")
    conn.commit(); conn.close()
    invalidate()
    from app.core.database import _seed_builtin_rules
    try: _seed_builtin_rules()
    except: pass
    return ok({"reset": True})