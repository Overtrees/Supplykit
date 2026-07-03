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

# ── Orders ──────────────────────────────────────────────
# store=店铺维度  warehouse=仓库维度  沈阳是仓库，不混入 store
SEED_ORDERS = [
  {"order_no":"DEMO-001","store":"数码旗舰店","sku":"SKU-001","product_name":"蓝牙耳机 Pro","quantity":2,"unit_price":299,"total_amount":598,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=2)),"platform":"jd"},
  {"order_no":"DEMO-002","store":"家电专卖店","sku":"SKU-005","product_name":"智能手表 S3","quantity":1,"unit_price":899,"total_amount":899,"order_status":"待发货","ordered_at":str(TODAY - timedelta(days=1)),"platform":"jd"},
  {"order_no":"DEMO-003","store":"数码旗舰店","sku":"SKU-002","product_name":"充电宝 20000mAh","quantity":3,"unit_price":159,"total_amount":477,"order_status":"已发货","ordered_at":str(TODAY - timedelta(days=3)),"platform":"jd"},
  {"order_no":"DEMO-004","store":"配件专营店","sku":"SKU-008","product_name":"手机壳 iPhone15","quantity":5,"unit_price":39,"total_amount":195,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=4)),"platform":"jd"},
  {"order_no":"DEMO-005","store":"家电专卖店","sku":"SKU-006","product_name":"无线充电器 15W","quantity":2,"unit_price":199,"total_amount":398,"order_status":"待确认","ordered_at":str(TODAY - timedelta(days=5)),"platform":"jd"},
  {"order_no":"DEMO-006","store":"数码旗舰店","sku":"SKU-003","product_name":"主动降噪耳机","quantity":1,"unit_price":599,"total_amount":599,"order_status":"申请退款","ordered_at":str(TODAY - timedelta(days=6)),"platform":"jd"},
  {"order_no":"DEMO-007","store":"数码旗舰店","sku":"SKU-004","product_name":"运动蓝牙耳机","quantity":1,"unit_price":449,"total_amount":449,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=7)),"platform":"jd"},
  {"order_no":"DEMO-008","store":"数码旗舰店","warehouse":"沈阳","sku":"SKU-001","product_name":"蓝牙耳机 Pro","quantity":10,"unit_price":299,"total_amount":2990,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=10)),"platform":"jd"},
  {"order_no":"DEMO-009","store":"数码旗舰店","warehouse":"沈阳","sku":"SKU-002","product_name":"充电宝 20000mAh","quantity":5,"unit_price":159,"total_amount":795,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=10)),"platform":"jd"},
  {"order_no":"DEMO-010","store":"家电专卖店","warehouse":"沈阳","sku":"SKU-005","product_name":"智能手表 S3","quantity":2,"unit_price":899,"total_amount":1798,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=10)),"platform":"jd"},
  {"order_no":"DEMO-011","store":"数码旗舰店","warehouse":"沈阳","sku":"SKU-003","product_name":"主动降噪耳机","quantity":3,"unit_price":599,"total_amount":1797,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=10)),"platform":"jd"},
  {"order_no":"DEMO-012","store":"家电专卖店","warehouse":"沈阳","sku":"SKU-007","product_name":"桌面风扇","quantity":1,"unit_price":349,"total_amount":349,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=10)),"platform":"jd"},
  {"order_no":"DEMO-013","store":"家电专卖店","warehouse":"沈阳","sku":"SKU-006","product_name":"无线充电器 15W","quantity":2,"unit_price":199,"total_amount":398,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=10)),"platform":"jd"},
  {"order_no":"DEMO-014","store":"配件专营店","warehouse":"沈阳","sku":"SKU-009","product_name":"数据线 3合1","quantity":1,"unit_price":29,"total_amount":29,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=10)),"platform":"jd"},
  {"order_no":"DEMO-015","store":"配件专营店","warehouse":"沈阳","sku":"SKU-010","product_name":"钢化膜通用款","quantity":1,"unit_price":15,"total_amount":15,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=10)),"platform":"jd"},
  {"order_no":"DEMO-016","store":"数码旗舰店","warehouse":"沈阳","sku":"SKU-004","product_name":"运动蓝牙耳机","quantity":1,"unit_price":449,"total_amount":449,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=10)),"platform":"jd"},
  {"order_no":"DEMO-017","store":"配件专营店","warehouse":"沈阳","sku":"SKU-008","product_name":"手机壳 iPhone15","quantity":3,"unit_price":39,"total_amount":117,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=10)),"platform":"jd"},
  {"order_no":"DEMO-018","store":"家电专卖店","warehouse":"沈阳","sku":"SKU-005","product_name":"智能手表 S3","quantity":1,"unit_price":899,"total_amount":899,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=10)),"platform":"jd"},
  {"order_no":"DEMO-019","store":"数码旗舰店","warehouse":"沈阳","sku":"SKU-001","product_name":"蓝牙耳机 Pro","quantity":2,"unit_price":299,"total_amount":598,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=10)),"platform":"jd"},
  {"order_no":"DEMO-020","store":"数码旗舰店","warehouse":"沈阳","sku":"SKU-004","product_name":"运动蓝牙耳机","quantity":1,"unit_price":449,"total_amount":449,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=10)),"platform":"jd"},
  {"order_no":"DEMO-021","store":"家电专卖店","warehouse":"沈阳","sku":"SKU-007","product_name":"桌面风扇","quantity":1,"unit_price":349,"total_amount":349,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=10)),"platform":"jd"},
  {"order_no":"DEMO-022","store":"数码旗舰店","warehouse":"沈阳","sku":"SKU-002","product_name":"充电宝 20000mAh","quantity":2,"unit_price":159,"total_amount":318,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=10)),"platform":"jd"},
  # 更久的历史订单（用于趋势线填充）
  {"order_no":"DEMO-023","store":"数码旗舰店","sku":"SKU-001","product_name":"蓝牙耳机 Pro","quantity":2,"unit_price":299,"total_amount":598,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=15)),"platform":"jd"},
  {"order_no":"DEMO-024","store":"数码旗舰店","sku":"SKU-002","product_name":"充电宝 20000mAh","quantity":1,"unit_price":159,"total_amount":159,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=20)),"platform":"jd"},
  {"order_no":"DEMO-025","store":"家电专卖店","sku":"SKU-005","product_name":"智能手表 S3","quantity":1,"unit_price":899,"total_amount":899,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=25)),"platform":"jd"},
  {"order_no":"DEMO-026","store":"数码旗舰店","sku":"SKU-003","product_name":"主动降噪耳机","quantity":1,"unit_price":599,"total_amount":599,"order_status":"已完成","ordered_at":str(TODAY - timedelta(days=28)),"platform":"jd"},
]

SEED_PRODUCTS = [
  {"sku":"SKU-001","product_name":"蓝牙耳机 Pro","store":"数码旗舰店","category":"耳机","price":299,"status":"active"},
  {"sku":"SKU-002","product_name":"充电宝 20000mAh","store":"数码旗舰店","category":"配件","price":159,"status":"active"},
  {"sku":"SKU-003","product_name":"主动降噪耳机","store":"数码旗舰店","category":"耳机","price":599,"status":"active"},
  {"sku":"SKU-004","product_name":"运动蓝牙耳机","store":"数码旗舰店","category":"耳机","price":449,"status":"active"},
  {"sku":"SKU-005","product_name":"智能手表 S3","store":"家电专卖店","category":"穿戴","price":899,"status":"active"},
  {"sku":"SKU-006","product_name":"无线充电器 15W","store":"家电专卖店","category":"配件","price":199,"status":"active"},
  {"sku":"SKU-007","product_name":"桌面风扇","store":"家电专卖店","category":"小家电","price":349,"status":"active"},
  {"sku":"SKU-008","product_name":"手机壳 iPhone15","store":"配件专营店","category":"配件","price":39,"status":"active"},
  {"sku":"SKU-009","product_name":"数据线 3合1","store":"配件专营店","category":"配件","price":29,"status":"active"},
  {"sku":"SKU-010","product_name":"钢化膜通用款","store":"配件专营店","category":"配件","price":15,"status":"active"},
]

SEED_SUPPLIERS = [
  {"supplier_code":"gzscymy","supplier_name":"广东三乘云网络科技有限公司","contact_person":"李春虹","score":85},
  {"supplier_code":"szdzkj","supplier_name":"深圳电子科技有限公司","contact_person":"张明","score":92},
  {"supplier_code":"shpjkj","supplier_name":"上海配件科技有限公司","contact_person":"王芳","score":78},
]

# store=店铺  warehouse=仓库（沈阳）
SEED_INVENTORY = [
  {"sku":"SKU-001","product_name":"蓝牙耳机 Pro","store":"数码旗舰店","available_qty":50,"locked_qty":5,"in_transit_qty":20,"safety_qty":15},
  {"sku":"SKU-002","product_name":"充电宝 20000mAh","store":"数码旗舰店","available_qty":30,"locked_qty":2,"in_transit_qty":10,"safety_qty":10},
  {"sku":"SKU-003","product_name":"主动降噪耳机","store":"数码旗舰店","available_qty":15,"locked_qty":1,"in_transit_qty":5,"safety_qty":8},
  {"sku":"SKU-004","product_name":"运动蓝牙耳机","store":"数码旗舰店","available_qty":25,"locked_qty":0,"in_transit_qty":0,"safety_qty":10},
  {"sku":"SKU-005","product_name":"智能手表 S3","store":"家电专卖店","available_qty":8,"locked_qty":1,"in_transit_qty":5,"safety_qty":10},
  {"sku":"SKU-006","product_name":"无线充电器 15W","store":"家电专卖店","available_qty":20,"locked_qty":0,"in_transit_qty":0,"safety_qty":5},
  {"sku":"SKU-007","product_name":"桌面风扇","store":"家电专卖店","available_qty":10,"locked_qty":0,"in_transit_qty":0,"safety_qty":5},
  {"sku":"SKU-008","product_name":"手机壳 iPhone15","store":"配件专营店","available_qty":10,"locked_qty":2,"in_transit_qty":0,"safety_qty":15},
  {"sku":"SKU-009","product_name":"数据线 3合1","store":"配件专营店","warehouse":"沈阳","available_qty":50,"locked_qty":0,"in_transit_qty":0,"safety_qty":10},
  {"sku":"SKU-010","product_name":"钢化膜通用款","store":"配件专营店","warehouse":"沈阳","available_qty":80,"locked_qty":0,"in_transit_qty":0,"safety_qty":10},
]

SEED_QUALITY_LOGS = [
  {"log_type":"field_warning","level":"warning","message":"导入订单 JD2401 缺少店铺名称，已自动填充为'未知'","source":"import"},
  {"log_type":"field_error","level":"error","message":"订单 JD2402 金额为 0，已标记异常","source":"import"},
  {"log_type":"duplicate_sku","level":"warning","message":"发现重复 SKU: SKU-001，已合并库存","source":"cleansing"},
  {"log_type":"mapping_info","level":"info","message":"字段 '日期' 自动映射到 'ordered_at'","source":"cleansing"},
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
