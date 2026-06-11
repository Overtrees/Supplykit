import json
from collections import defaultdict
from sqlalchemy.orm import Session
from app.models.entities import Order, Inventory, Product, Supplier, Alert

SEED_ORDERS = [
  {"order_no":"JD2401001","store":"数码旗舰店","sku":"SKU-001","product_name":"蓝牙耳机 Pro","quantity":2,"unit_price":299,"total_amount":598,"order_status":"已完成","ordered_at":"2024-01-15"},
  {"order_no":"JD2401002","store":"家电专卖店","sku":"SKU-005","product_name":"智能手表 S3","quantity":1,"unit_price":899,"total_amount":899,"order_status":"待发货","ordered_at":"2024-01-15"},
  {"order_no":"JD2401003","store":"数码旗舰店","sku":"SKU-002","product_name":"充电宝 20000mAh","quantity":3,"unit_price":159,"total_amount":477,"order_status":"已发货","ordered_at":"2024-01-14"},
  {"order_no":"JD2401004","store":"配件专营店","sku":"SKU-008","product_name":"手机壳 iPhone15","quantity":5,"unit_price":39,"total_amount":195,"order_status":"已完成","ordered_at":"2024-01-14"},
  {"order_no":"JD2401005","store":"家电专卖店","sku":"SKU-006","product_name":"无线充电器 15W","quantity":2,"unit_price":199,"total_amount":398,"order_status":"待确认","ordered_at":"2024-01-14"},
  {"order_no":"JD2401006","store":"数码旗舰店","sku":"SKU-003","product_name":"主动降噪耳机","quantity":1,"unit_price":599,"total_amount":599,"order_status":"申请退款","ordered_at":"2024-01-13"}
]
SEED_INV = [
  {"sku":"SKU-001","product_name":"蓝牙耳机 Pro","store":"数码旗舰店","available_qty":45,"locked_qty":8,"in_transit_qty":0,"safety_qty":20},
  {"sku":"SKU-002","product_name":"充电宝 20000mAh","store":"数码旗舰店","available_qty":12,"locked_qty":5,"in_transit_qty":50,"safety_qty":30},
  {"sku":"SKU-006","product_name":"无线充电器 15W","store":"家电专卖店","available_qty":4,"locked_qty":8,"in_transit_qty":0,"safety_qty":25},
  {"sku":"SKU-008","product_name":"手机壳 iPhone15","store":"配件专营店","available_qty":234,"locked_qty":12,"in_transit_qty":0,"safety_qty":50}
]

def seed_data(db: Session):
    if db.query(Order).count() == 0:
        for item in SEED_ORDERS:
            db.add(Order(**item, raw_data=json.dumps(item, ensure_ascii=False)))
    if db.query(Inventory).count() == 0:
        for item in SEED_INV:
            db.add(Inventory(**item, raw_data=json.dumps(item, ensure_ascii=False)))
    db.commit()

def get_dashboard(db: Session):
    orders = db.query(Order).all()
    inv = db.query(Inventory).all()
    products = db.query(Product).all()
    suppliers = db.query(Supplier).all()
    alerts = db.query(Alert).filter(Alert.status == 'active').all()

    gmv = sum(float(x.total_amount or 0) for x in orders if x.order_status == "已完成")
    pending = len([x for x in orders if x.order_status == "待发货"])
    refund = len([x for x in orders if x.order_status == "申请退款"])
    low_stock = len([x for x in inv if int(x.available_qty or 0) < int(x.safety_qty or 0)])

    by_date = defaultdict(lambda: {"订单数": 0, "GMV": 0})
    for x in orders:
        date = str(x.ordered_at)[5:] if x.ordered_at else "未知"
        by_date[date]["订单数"] += 1
        if x.order_status == "已完成":
            by_date[date]["GMV"] += float(x.total_amount or 0)
    trend = [{"日期": k, **v} for k, v in sorted(by_date.items())]

    stores = sorted(set([x.store for x in orders if x.store]))
    store_rows = []
    for s in stores:
        so = [x for x in orders if x.store == s]
        si = [x for x in inv if x.store == s]
        store_rows.append({
            "name": s,
            "gmv": sum(float(x.total_amount or 0) for x in so if x.order_status == "已完成"),
            "orders": len(so),
            "low_stock": len([x for x in si if int(x.available_qty or 0) < int(x.safety_qty or 0)])
        })

    # 订单状态分布
    status_dist = defaultdict(int)
    for x in orders:
        status_dist[x.order_status or '未知'] += 1

    # 商品分类分布
    cat_dist = defaultdict(int)
    for p in products:
        cat_dist[p.category or '未分类'] += 1

    return {
        "summary": {
            "gmv": gmv,
            "pending_count": pending,
            "refund_count": refund,
            "low_stock_count": low_stock,
            "total_orders": len(orders),
            "total_products": len(products),
            "total_suppliers": len(suppliers),
            "active_alerts": len(alerts),
        },
        "trend": trend,
        "stores": store_rows,
        "status_distribution": [{"name": k, "value": v} for k, v in sorted(status_dist.items())],
        "category_distribution": [{"name": k, "value": v} for k, v in sorted(cat_dist.items(), key=lambda x: -x[1])],
    }

def seed_products(db):
    from app.models.entities import Product
    if db.query(Product).count() > 0:
        return
    items = [
        {"sku":"SKU-001","product_name":"蓝牙耳机 Pro","store":"数码旗舰店","category":"耳机","price":299},
        {"sku":"SKU-002","product_name":"充电宝 20000mAh","store":"数码旗舰店","category":"配件","price":159},
        {"sku":"SKU-003","product_name":"主动降噪耳机","store":"数码旗舰店","category":"耳机","price":599},
        {"sku":"SKU-004","product_name":"运动蓝牙耳机","store":"数码旗舰店","category":"耳机","price":449},
        {"sku":"SKU-005","product_name":"智能手表 S3","store":"家电专卖店","category":"手表","price":899},
        {"sku":"SKU-006","product_name":"无线充电器 15W","store":"家电专卖店","category":"充电","price":199},
        {"sku":"SKU-007","product_name":"桌面风扇","store":"家电专卖店","category":"风扇","price":349},
        {"sku":"SKU-008","product_name":"手机壳 iPhone15","store":"配件专营店","category":"手机壳","price":39},
        {"sku":"SKU-009","product_name":"数据线 3合1","store":"配件专营店","category":"数据线","price":29},
        {"sku":"SKU-010","product_name":"钢化膜通用款","store":"配件专营店","category":"贴膜","price":15},
    ]
    for item in items:
        db.add(Product(**item, raw_data=json.dumps(item, ensure_ascii=False)))
    db.commit()

def seed_suppliers(db):
    from app.models.entities import Supplier
    if db.query(Supplier).count() > 0:
        return
    items = [
        {"supplier_code":"gzscymy","supplier_name":"广东三乘云网络科技有限公司","contact_person":"李春虹","score":85},
        {"supplier_code":"szdzkj","supplier_name":"深圳电子科技有限公司","contact_person":"张明","score":92},
        {"supplier_code":"shpjkj","supplier_name":"上海配件科技有限公司","contact_person":"王芳","score":78},
    ]
    for item in items:
        db.add(Supplier(**item, raw_data=json.dumps(item, ensure_ascii=False)))
    db.commit()
