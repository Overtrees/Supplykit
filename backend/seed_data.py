"""Seed data builder — inject sample data into SQLite.
Run with: python seed_data.py (from backend/ directory)
Uses dynamic relative dates so demo data always falls within rolling windows.
"""

import os, sys
sys.path.insert(0, os.path.dirname(__file__))

from app.core.database import init_db, get_db
from datetime import datetime, timedelta, timezone

init_db()
db = get_db()

TODAY = datetime.now(timezone.utc).date()

# ── 商品（珠江桥牌调味品为主） ──────────────────────────────────
SEED_PRODUCTS = [
  {"sku":"SKU-001","product_name":"珠江桥牌 特级鲜酱油 500ml","store":"珠江桥牌（京东自营）","category":"酱油","price":18.9,"status":"active"},
  {"sku":"SKU-002","product_name":"珠江桥牌 金标生抽王 500ml","store":"珠江桥牌（京东自营）","category":"酱油","price":12.8,"status":"active"},
  {"sku":"SKU-003","product_name":"珠江桥牌 蚝油 挤瓶装 510g","store":"珠江桥牌（京东自营）","category":"酱料","price":15.5,"status":"active"},
  {"sku":"SKU-004","product_name":"珠江桥牌 白灼汁 300ml","store":"珠江桥牌（京东自营）","category":"调味汁","price":9.9,"status":"active"},
  {"sku":"SKU-005","product_name":"珠江桥牌 老抽王 500ml","store":"珠江桥牌（京东自营）","category":"酱油","price":11.5,"status":"active"},
  {"sku":"SKU-006","product_name":"珠江桥牌 柱侯酱 240g","store":"广州调味食材专营店","category":"酱料","price":8.8,"status":"active"},
  {"sku":"SKU-007","product_name":"珠江桥牌 辣椒酱 230g","store":"广州调味食材专营店","category":"酱料","price":10.5,"status":"active"},
  {"sku":"SKU-008","product_name":"珠江桥牌 拌面酱 200g","store":"华南食品旗舰店","category":"酱料","price":12.9,"status":"active"},
  {"sku":"SKU-009","product_name":"珠江桥牌 芝麻油 220ml","store":"华南食品旗舰店","category":"食用油","price":16.8,"status":"active"},
  {"sku":"SKU-010","product_name":"珠江桥牌 饺子醋 300ml","store":"珠江桥牌（京东自营）","category":"调味汁","price":7.5,"status":"active"},
]

# ── 供应商 ──────────────────────────────────────────────────
SEED_SUPPLIERS = [
  {"supplier_code":"gzscymy","supplier_name":"广东珠江桥生物科技股份有限公司","contact_person":"陈志强","phone":"020-83568899","score":92},
  {"supplier_code":"szdzkj","supplier_name":"深圳冠华食品包装有限公司","contact_person":"林晓燕","phone":"0755-82889911","score":85},
  {"supplier_code":"shpjkj","supplier_name":"上海鑫源调味品贸易有限公司","contact_person":"赵建国","phone":"021-64882233","score":78},
]

# ── 订单 ──────────────────────────────────────────────────
SEED_ORDERS = [
  {"order_no":"DEMO-001","store":"珠江桥牌（京东自营）","sku":"SKU-001","product_name":"珠江桥牌 特级鲜酱油 500ml","quantity":200,"unit_price":18.9,"total_amount":3780,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=1)),"platform":"京东"},
  {"order_no":"DEMO-002","store":"珠江桥牌（京东自营）","sku":"SKU-002","product_name":"珠江桥牌 金标生抽王 500ml","quantity":150,"unit_price":12.8,"total_amount":1920,"order_status":"待发货","ordered_at":str(TODAY - timedelta(days=2)),"platform":"京东"},
  {"order_no":"DEMO-003","store":"珠江桥牌（京东自营）","sku":"SKU-005","product_name":"珠江桥牌 老抽王 500ml","quantity":120,"unit_price":11.5,"total_amount":1380,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=3)),"platform":"京东"},
  {"order_no":"DEMO-004","store":"广州调味食材专营店","sku":"SKU-006","product_name":"珠江桥牌 柱侯酱 240g","quantity":300,"unit_price":8.8,"total_amount":2640,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=2)),"platform":"天猫"},
  {"order_no":"DEMO-005","store":"广州调味食材专营店","sku":"SKU-007","product_name":"珠江桥牌 辣椒酱 230g","quantity":180,"unit_price":10.5,"total_amount":1890,"order_status":"待确认","ordered_at":str(TODAY - timedelta(days=4)),"platform":"天猫"},
  {"order_no":"DEMO-006","store":"华南食品旗舰店","sku":"SKU-008","product_name":"珠江桥牌 拌面酱 200g","quantity":240,"unit_price":12.9,"total_amount":3096,"order_status":"申请退款","ordered_at":str(TODAY - timedelta(days=5)),"platform":"拼多多"},
  {"order_no":"DEMO-007","store":"珠江桥牌（京东自营）","sku":"SKU-003","product_name":"珠江桥牌 蚝油 挤瓶装 510g","quantity":100,"unit_price":15.5,"total_amount":1550,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=6)),"platform":"京东"},
  {"order_no":"DEMO-008","store":"珠江桥牌（京东自营）","warehouse":"北京","sku":"SKU-001","product_name":"珠江桥牌 特级鲜酱油 500ml","quantity":500,"unit_price":18.9,"total_amount":9450,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=8)),"platform":"京东"},
  {"order_no":"DEMO-009","store":"珠江桥牌（京东自营）","warehouse":"北京","sku":"SKU-002","product_name":"珠江桥牌 金标生抽王 500ml","quantity":300,"unit_price":12.8,"total_amount":3840,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=8)),"platform":"京东"},
  {"order_no":"DEMO-010","store":"珠江桥牌（京东自营）","warehouse":"上海","sku":"SKU-001","product_name":"珠江桥牌 特级鲜酱油 500ml","quantity":400,"unit_price":18.9,"total_amount":7560,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=9)),"platform":"京东"},
  {"order_no":"DEMO-011","store":"珠江桥牌（京东自营）","warehouse":"上海","sku":"SKU-003","product_name":"珠江桥牌 蚝油 挤瓶装 510g","quantity":250,"unit_price":15.5,"total_amount":3875,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=9)),"platform":"京东"},
  {"order_no":"DEMO-012","store":"珠江桥牌（京东自营）","warehouse":"广州","sku":"SKU-004","product_name":"珠江桥牌 白灼汁 300ml","quantity":180,"unit_price":9.9,"total_amount":1782,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=10)),"platform":"京东"},
  {"order_no":"DEMO-013","store":"珠江桥牌（京东自营）","warehouse":"广州","sku":"SKU-005","product_name":"珠江桥牌 老抽王 500ml","quantity":200,"unit_price":11.5,"total_amount":2300,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=10)),"platform":"京东"},
  {"order_no":"DEMO-014","store":"珠江桥牌（京东自营）","warehouse":"武汉","sku":"SKU-002","product_name":"珠江桥牌 金标生抽王 500ml","quantity":350,"unit_price":12.8,"total_amount":4480,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=11)),"platform":"京东"},
  {"order_no":"DEMO-015","store":"珠江桥牌（京东自营）","warehouse":"武汉","sku":"SKU-001","product_name":"珠江桥牌 特级鲜酱油 500ml","quantity":280,"unit_price":18.9,"total_amount":5292,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=11)),"platform":"京东"},
  {"order_no":"DEMO-016","store":"珠江桥牌（京东自营）","warehouse":"成都","sku":"SKU-003","product_name":"珠江桥牌 蚝油 挤瓶装 510g","quantity":160,"unit_price":15.5,"total_amount":2480,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=12)),"platform":"京东"},
  {"order_no":"DEMO-017","store":"广州调味食材专营店","warehouse":"成都","sku":"SKU-007","product_name":"珠江桥牌 辣椒酱 230g","quantity":200,"unit_price":10.5,"total_amount":2100,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=12)),"platform":"天猫"},
  {"order_no":"DEMO-018","store":"珠江桥牌（京东自营）","warehouse":"西安","sku":"SKU-004","product_name":"珠江桥牌 白灼汁 300ml","quantity":120,"unit_price":9.9,"total_amount":1188,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=13)),"platform":"京东"},
  {"order_no":"DEMO-019","store":"华南食品旗舰店","warehouse":"西安","sku":"SKU-009","product_name":"珠江桥牌 芝麻油 220ml","quantity":90,"unit_price":16.8,"total_amount":1512,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=13)),"platform":"拼多多"},
  {"order_no":"DEMO-020","store":"珠江桥牌（京东自营）","warehouse":"沈阳","sku":"SKU-005","product_name":"珠江桥牌 老抽王 500ml","quantity":220,"unit_price":11.5,"total_amount":2530,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=14)),"platform":"京东"},
  {"order_no":"DEMO-021","store":"珠江桥牌（京东自营）","warehouse":"沈阳","sku":"SKU-001","product_name":"珠江桥牌 特级鲜酱油 500ml","quantity":300,"unit_price":18.9,"total_amount":5670,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=14)),"platform":"京东"},
  {"order_no":"DEMO-022","store":"广州调味食材专营店","sku":"SKU-006","product_name":"珠江桥牌 柱侯酱 240g","quantity":150,"unit_price":8.8,"total_amount":1320,"order_status":"已发货","ordered_at":str(TODAY - timedelta(days=15)),"platform":"天猫"},
  {"order_no":"DEMO-023","store":"珠江桥牌（京东自营）","sku":"SKU-010","product_name":"珠江桥牌 饺子醋 300ml","quantity":100,"unit_price":7.5,"total_amount":750,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=18)),"platform":"京东"},
  {"order_no":"DEMO-024","store":"珠江桥牌（京东自营）","sku":"SKU-002","product_name":"珠江桥牌 金标生抽王 500ml","quantity":80,"unit_price":12.8,"total_amount":1024,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=22)),"platform":"京东"},
  {"order_no":"DEMO-025","store":"华南食品旗舰店","sku":"SKU-008","product_name":"珠江桥牌 拌面酱 200g","quantity":60,"unit_price":12.9,"total_amount":774,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=25)),"platform":"拼多多"},
  {"order_no":"DEMO-026","store":"珠江桥牌（京东自营）","sku":"SKU-003","product_name":"珠江桥牌 蚝油 挤瓶装 510g","quantity":70,"unit_price":15.5,"total_amount":1085,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=28)),"platform":"京东"},
]

# ── 库存 ──────────────────────────────────────────────────
SEED_INVENTORY = [
  {"sku":"SKU-001","product_name":"珠江桥牌 特级鲜酱油 500ml","store":"珠江桥牌（京东自营）","warehouse":"北京","available_qty":1200,"locked_qty":200,"in_transit_qty":500,"safety_qty":800},
  {"sku":"SKU-001","product_name":"珠江桥牌 特级鲜酱油 500ml","store":"珠江桥牌（京东自营）","warehouse":"上海","available_qty":800,"locked_qty":150,"in_transit_qty":400,"safety_qty":600},
  {"sku":"SKU-001","product_name":"珠江桥牌 特级鲜酱油 500ml","store":"珠江桥牌（京东自营）","warehouse":"广州","available_qty":600,"locked_qty":100,"in_transit_qty":300,"safety_qty":400},
  {"sku":"SKU-001","product_name":"珠江桥牌 特级鲜酱油 500ml","store":"珠江桥牌（京东自营）","warehouse":"武汉","available_qty":400,"locked_qty":80,"in_transit_qty":200,"safety_qty":300},
  {"sku":"SKU-002","product_name":"珠江桥牌 金标生抽王 500ml","store":"珠江桥牌（京东自营）","warehouse":"北京","available_qty":600,"locked_qty":100,"in_transit_qty":300,"safety_qty":500},
  {"sku":"SKU-002","product_name":"珠江桥牌 金标生抽王 500ml","store":"珠江桥牌（京东自营）","warehouse":"上海","available_qty":500,"locked_qty":80,"in_transit_qty":200,"safety_qty":400},
  {"sku":"SKU-002","product_name":"珠江桥牌 金标生抽王 500ml","store":"珠江桥牌（京东自营）","warehouse":"武汉","available_qty":2,"locked_qty":0,"in_transit_qty":350,"safety_qty":300},
  {"sku":"SKU-003","product_name":"珠江桥牌 蚝油 挤瓶装 510g","store":"珠江桥牌（京东自营）","warehouse":"北京","available_qty":5,"locked_qty":0,"in_transit_qty":200,"safety_qty":300},
  {"sku":"SKU-003","product_name":"珠江桥牌 蚝油 挤瓶装 510g","store":"珠江桥牌（京东自营）","warehouse":"成都","available_qty":300,"locked_qty":50,"in_transit_qty":100,"safety_qty":200},
  {"sku":"SKU-004","product_name":"珠江桥牌 白灼汁 300ml","store":"珠江桥牌（京东自营）","warehouse":"广州","available_qty":8,"locked_qty":0,"in_transit_qty":150,"safety_qty":200},
  {"sku":"SKU-005","product_name":"珠江桥牌 老抽王 500ml","store":"珠江桥牌（京东自营）","warehouse":"沈阳","available_qty":400,"locked_qty":60,"in_transit_qty":200,"safety_qty":300},
  {"sku":"SKU-005","product_name":"珠江桥牌 老抽王 500ml","store":"珠江桥牌（京东自营）","warehouse":"西安","available_qty":3,"locked_qty":0,"in_transit_qty":100,"safety_qty":150},
  {"sku":"SKU-006","product_name":"珠江桥牌 柱侯酱 240g","store":"广州调味食材专营店","warehouse":"成都","available_qty":500,"locked_qty":100,"in_transit_qty":200,"safety_qty":300},
  {"sku":"SKU-007","product_name":"珠江桥牌 辣椒酱 230g","store":"广州调味食材专营店","warehouse":"成都","available_qty":10,"locked_qty":0,"in_transit_qty":100,"safety_qty":120},
  {"sku":"SKU-008","product_name":"珠江桥牌 拌面酱 200g","store":"华南食品旗舰店","warehouse":"西安","available_qty":200,"locked_qty":30,"in_transit_qty":100,"safety_qty":150},
  {"sku":"SKU-009","product_name":"珠江桥牌 芝麻油 220ml","store":"华南食品旗舰店","warehouse":"西安","available_qty":6,"locked_qty":0,"in_transit_qty":80,"safety_qty":100},
  {"sku":"SKU-010","product_name":"珠江桥牌 饺子醋 300ml","store":"珠江桥牌（京东自营）","warehouse":"北京","available_qty":300,"locked_qty":50,"in_transit_qty":100,"safety_qty":200},
  {"sku":"SKU-003","product_name":"珠江桥牌 蚝油 挤瓶装 510g","store":"珠江桥牌（京东自营）","warehouse":"郑州","available_qty":80,"locked_qty":5,"in_transit_qty":20,"safety_qty":40},
  {"sku":"SKU-009","product_name":"珠江桥牌 芝麻油 220ml","store":"华南食品旗舰店","warehouse":"郑州","available_qty":60,"locked_qty":5,"in_transit_qty":15,"safety_qty":30},
]

SEED_QUALITY_LOGS = [
  {"log_type":"field_warning","level":"warning","message":"导入订单 DEMO-005 店铺名称不完整，自动归为'广州调味食材专营店'","source":"import"},
  {"log_type":"field_error","level":"error","message":"订单 DEMO-006 金额与数量不匹配，已标记异常","source":"import"},
  {"log_type":"duplicate_sku","level":"warning","message":"发现重复 SKU: SKU-001（北京/上海仓均存在），已合并库存","source":"cleansing"},
  {"log_type":"mapping_info","level":"info","message":"字段 '商品编号' 自动映射到 'sku'","source":"cleansing"},
]


def seed():
    for name, items in [('orders', SEED_ORDERS), ('products', SEED_PRODUCTS), ('suppliers', SEED_SUPPLIERS)]:
        for item in items:
            try:
                db.table(name).insert(item).execute()
            except Exception:
                pass
        print(f"Seeded {len(items)} {name}")

    for item in SEED_INVENTORY:
        db.table("inventory").insert(item).execute()
    print(f"Seeded {len(SEED_INVENTORY)} inventory")

    for item in SEED_QUALITY_LOGS:
        db.table("quality_logs").insert(item).execute()
    print(f"Seeded {len(SEED_QUALITY_LOGS)} quality_logs")

    print("Seed complete!")


if __name__ == "__main__":
    seed()
