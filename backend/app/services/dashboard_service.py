import json
from collections import defaultdict
from sqlalchemy.orm import Session
from app.models.entities import Order, Inventory

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
    return {
        "summary": {
            "gmv": gmv,
            "pending_count": pending,
            "refund_count": refund,
            "low_stock_count": low_stock,
        },
        "trend": trend,
        "stores": store_rows,
    }
