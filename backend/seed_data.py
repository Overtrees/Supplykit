import os, json
from supabase import create_client

url = os.getenv("SUPABASE_URL", "https://ngdclcdrzoyngkjkzdpu.supabase.co")
key = os.getenv("SUPABASE_ANON_KEY", "")
supabase = create_client(url, key)

SEED_ORDERS = [
  {"order_no":"JD2401001","store":"数码旗舰店","sku":"SKU-001","product_name":"蓝牙耳机 Pro","quantity":2,"unit_price":299,"total_amount":598,"order_status":"已完成","ordered_at":"2024-01-15","platform":"jd"},
  {"order_no":"JD2401002","store":"家电专卖店","sku":"SKU-005","product_name":"智能手表 S3","quantity":1,"unit_price":899,"total_amount":899,"order_status":"待发货","ordered_at":"2024-01-15","platform":"jd"},
  {"order_no":"JD2401003","store":"数码旗舰店","sku":"SKU-002","product_name":"充电宝 20000mAh","quantity":3,"unit_price":159,"total_amount":477,"order_status":"已发货","ordered_at":"2024-01-14","platform":"jd"},
  {"order_no":"JD2401004","store":"配件专营店","sku":"SKU-008","product_name":"手机壳 iPhone15","quantity":5,"unit_price":39,"total_amount":195,"order_status":"已完成","ordered_at":"2024-01-14","platform":"jd"},
  {"order_no":"JD2401005","store":"家电专卖店","sku":"SKU-006","product_name":"无线充电器 15W","quantity":2,"unit_price":199,"total_amount":398,"order_status":"待确认","ordered_at":"2024-01-14","platform":"jd"},
  {"order_no":"JD2401006","store":"数码旗舰店","sku":"SKU-003","product_name":"主动降噪耳机","quantity":1,"unit_price":599,"total_amount":599,"order_status":"申请退款","ordered_at":"2024-01-13","platform":"jd"},
  {"order_no":"JD2401007","store":"数码旗舰店","sku":"SKU-004","product_name":"运动蓝牙耳机","quantity":1,"unit_price":449,"total_amount":449,"order_status":"已完成","ordered_at":"2024-01-12","platform":"jd"},
  {"order_no":"JD2401008","store":"沈阳","sku":"SKU-001","product_name":"蓝牙耳机 Pro","quantity":10,"unit_price":299,"total_amount":2990,"order_status":"已完成","ordered_at":"2024-06-19","platform":"jd"},
  {"order_no":"JD2401009","store":"沈阳","sku":"SKU-002","product_name":"充电宝 20000mAh","quantity":5,"unit_price":159,"total_amount":795,"order_status":"已完成","ordered_at":"2024-06-19","platform":"jd"},
  {"order_no":"JD2401010","store":"沈阳","sku":"SKU-005","product_name":"智能手表 S3","quantity":2,"unit_price":899,"total_amount":1798,"order_status":"已完成","ordered_at":"2024-06-19","platform":"jd"},
  {"order_no":"JD2401011","store":"沈阳","sku":"SKU-003","product_name":"主动降噪耳机","quantity":3,"unit_price":599,"total_amount":1797,"order_status":"已完成","ordered_at":"2024-06-19","platform":"jd"},
  {"order_no":"JD2401012","store":"沈阳","sku":"SKU-007","product_name":"桌面风扇","quantity":1,"unit_price":349,"total_amount":349,"order_status":"已完成","ordered_at":"2024-06-19","platform":"jd"},
  {"order_no":"JD2401013","store":"沈阳","sku":"SKU-006","product_name":"无线充电器 15W","quantity":2,"unit_price":199,"total_amount":398,"order_status":"已完成","ordered_at":"2024-06-19","platform":"jd"},
  {"order_no":"JD2401014","store":"沈阳","sku":"SKU-009","product_name":"数据线 3合1","quantity":1,"unit_price":29,"total_amount":29,"order_status":"已完成","ordered_at":"2024-06-19","platform":"jd"},
  {"order_no":"JD2401015","store":"沈阳","sku":"SKU-010","product_name":"钢化膜通用款","quantity":1,"unit_price":15,"total_amount":15,"order_status":"已完成","ordered_at":"2024-06-19","platform":"jd"},
  {"order_no":"JD2401016","store":"沈阳","sku":"SKU-004","product_name":"运动蓝牙耳机","quantity":1,"unit_price":449,"total_amount":449,"order_status":"已完成","ordered_at":"2024-06-19","platform":"jd"},
  {"order_no":"JD2401017","store":"沈阳","sku":"SKU-008","product_name":"手机壳 iPhone15","quantity":3,"unit_price":39,"total_amount":117,"order_status":"已完成","ordered_at":"2024-06-19","platform":"jd"},
  {"order_no":"JD2401018","store":"沈阳","sku":"SKU-005","product_name":"智能手表 S3","quantity":1,"unit_price":899,"total_amount":899,"order_status":"已完成","ordered_at":"2024-06-19","platform":"jd"},
  {"order_no":"JD2401019","store":"沈阳","sku":"SKU-001","product_name":"蓝牙耳机 Pro","quantity":2,"unit_price":299,"total_amount":598,"order_status":"已完成","ordered_at":"2024-06-19","platform":"jd"},
  {"order_no":"JD2401020","store":"沈阳","sku":"SKU-004","product_name":"运动蓝牙耳机","quantity":1,"unit_price":449,"total_amount":449,"order_status":"已完成","ordered_at":"2024-06-19","platform":"jd"},
  {"order_no":"JD2401021","store":"沈阳","sku":"SKU-008","product_name":"手机壳 iPhone15","quantity":1,"unit_price":39,"total_amount":39,"order_status":"已完成","ordered_at":"2024-06-19","platform":"jd"},
  {"order_no":"JD2401022","store":"沈阳","sku":"SKU-001","product_name":"蓝牙耳机 Pro","quantity":1,"unit_price":299,"total_amount":299,"order_status":"申请退款","ordered_at":"2024-06-19","platform":"jd"},
]

SEED_INV = [
    {"sku":"SKU-001","product_name":"蓝牙耳机 Pro","store":"数码旗舰店","available_qty":45,"locked_qty":8,"in_transit_qty":0,"safety_qty":20},
    {"sku":"SKU-002","product_name":"充电宝 20000mAh","store":"数码旗舰店","available_qty":12,"locked_qty":5,"in_transit_qty":50,"safety_qty":30},
    {"sku":"SKU-006","product_name":"无线充电器 15W","store":"家电专卖店","available_qty":4,"locked_qty":8,"in_transit_qty":0,"safety_qty":25},
    {"sku":"SKU-008","product_name":"手机壳 iPhone15","store":"配件专营店","available_qty":234,"locked_qty":12,"in_transit_qty":0,"safety_qty":50},
]

SEED_PRODUCTS = [
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

SEED_SUPPLIERS = [
    {"supplier_code":"gzscymy","supplier_name":"广东三乘云网络科技有限公司","contact_person":"李春虹","score":85},
    {"supplier_code":"szdzkj","supplier_name":"深圳电子科技有限公司","contact_person":"张明","score":92},
    {"supplier_code":"shpjkj","supplier_name":"上海配件科技有限公司","contact_person":"王芳","score":78},
]

def seed():
    count = supabase.table("orders").select("*", count="exact").limit(1).execute().count
    if count == 0:
        for item in SEED_ORDERS:
            item["raw_data"] = json.dumps(item, ensure_ascii=False)
        supabase.table("orders").insert(SEED_ORDERS).execute()
        print(f"Seeded {len(SEED_ORDERS)} orders")

    count = supabase.table("inventory").select("*", count="exact").limit(1).execute().count
    if count == 0:
        supabase.table("inventory").insert(SEED_INV).execute()
        print(f"Seeded {len(SEED_INV)} inventory items")

    count = supabase.table("products").select("*", count="exact").limit(1).execute().count
    if count == 0:
        supabase.table("products").insert(SEED_PRODUCTS).execute()
        print(f"Seeded {len(SEED_PRODUCTS)} products")

    count = supabase.table("suppliers").select("*", count="exact").limit(1).execute().count
    if count == 0:
        supabase.table("suppliers").insert(SEED_SUPPLIERS).execute()
        print(f"Seeded {len(SEED_SUPPLIERS)} suppliers")

    # Rebuild low stock alerts
    inv = supabase.table("inventory").select("*").execute().data
    supabase.table("alerts").delete().eq("alert_type", "low_stock").execute()
    alerts = []
    for x in inv:
        if int(x.get("available_qty") or 0) < int(x.get("safety_qty") or 0):
            alerts.append({
                "alert_type": "low_stock",
                "title": f"低库存预警：{x['sku']}",
                "content": f"{x.get('store','')} / {x.get('product_name','')} 可用 {x.get('available_qty',0)}，安全线 {x.get('safety_qty',0)}",
                "level": "warning",
                "entity_type": "inventory",
                "entity_id": str(x["id"]),
                "raw_data": json.dumps({"sku": x["sku"], "store": x.get("store","")}, ensure_ascii=False),
            })
    if alerts:
        supabase.table("alerts").insert(alerts).execute()
        print(f"Created {len(alerts)} low stock alerts")

if __name__ == "__main__":
    seed()
    print("Seed complete!")
