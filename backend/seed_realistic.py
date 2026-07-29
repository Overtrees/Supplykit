"""真实场景模拟数据生成器 — 替代静态 seed_data.py

生成带销售曲线、促销波峰、断货低谷的真实感数据
运行: cd backend && python seed_realistic.py
"""
import os, sys, json, random, math
sys.path.insert(0, os.path.dirname(__file__))
from app.core.database import init_db, get_db
from datetime import datetime, timedelta, timezone

TODAY = datetime.now(timezone.utc).date()
init_db()
db = get_db()

# 清空旧数据
for t in ['orders','inventory','products','suppliers','alerts','purchase_orders']:
    try: db.table(t).delete().eq("id", -1).execute()
    except: pass
    try:
        conn = __import__('sqlite3').connect(os.getenv("SQLITE_PATH", os.path.join(os.path.dirname(__file__), "app", "supplykit.db")))
        conn.execute(f'DELETE FROM "{t}"')
        conn.commit(); conn.close()
    except: pass

random.seed(42)

# ── 商品定义 ──────────────────────────────────────────────────────────────
SKUS = [
    {"sku":"SKU-A01","name":"特级鲜酱油 500ml","store":"珠江桥牌京东自营店","cat":"酱油","price":18.9,"box":12},
    {"sku":"SKU-A02","name":"金标生抽王 500ml","store":"珠江桥牌京东自营店","cat":"酱油","price":12.8,"box":12},
    {"sku":"SKU-A03","name":"蚝油挤瓶装 510g","store":"珠江桥牌京东自营店","cat":"酱料","price":15.5,"box":12},
    {"sku":"SKU-A04","name":"白灼汁 300ml","store":"珠江桥牌京东自营店","cat":"调味汁","price":9.9,"box":12},
    {"sku":"SKU-A05","name":"老抽王 500ml","store":"珠江桥牌京东自营店","cat":"酱油","price":11.5,"box":12},
    {"sku":"SKU-A06","name":"柱侯酱 240g","store":"广州调味食材专营店","cat":"酱料","price":8.8,"box":24},
    {"sku":"SKU-A07","name":"辣椒酱 230g","store":"广州调味食材专营店","cat":"酱料","price":10.5,"box":24},
    {"sku":"SKU-A08","name":"芝麻油 220ml","store":"华南食品旗舰店","cat":"食用油","price":16.8,"box":24},
    {"sku":"SKU-A09","name":"饺子醋 300ml","store":"珠江桥牌京东自营店","cat":"调味汁","price":7.5,"box":24},
    {"sku":"SKU-A10","name":"拌面酱 200g","store":"华南食品旗舰店","cat":"酱料","price":12.9,"box":24},
    {"sku":"SKU-B01","name":"红烧酱油 500ml","store":"珠江桥牌京东自营店","cat":"酱油","price":14.5,"box":12},
    {"sku":"SKU-B02","name":"蒸鱼豉油 450ml","store":"珠江桥牌京东自营店","cat":"调味汁","price":16.8,"box":12},
]
for s in SKUS:
    db.table("products").insert({
        "sku":s["sku"],"product_name":s["name"],"store":s["store"],
        "category":s["cat"],"price":s["price"],"box_qty":s["box"],"status":"active"
    }).execute()

# ── 供应商 ──────────────────────────────────────────────────────────────────
SUPPLIERS = [
    {"code":"gdzhujiang","name":"广东珠江桥生物科技股份有限公司","score":92},
    {"code":"szdzkj","name":"深圳冠华食品包装有限公司","score":85},
]
for s in SUPPLIERS:
    db.table("suppliers").insert({
        "supplier_code":s["code"],"supplier_name":s["name"],"score":s["score"],"status":"active"
    }).execute()

# ── 销售模拟参数 ────────────────────────────────────────────────────────────
# 每个 SKU 的基础日销量（件/天）
BASE_DAILY = {
    "SKU-A01": 45, "SKU-A02": 35, "SKU-A03": 25, "SKU-A04": 18,
    "SKU-A05": 22, "SKU-A06": 12, "SKU-A07": 15, "SKU-A08": 8,
    "SKU-A09": 10, "SKU-A10": 6, "SKU-B01": 5, "SKU-B02": 3,
}

# 模拟 60 天的销售数据
DAYS = 60
orders_data = []
order_no = 1

for day_offset in range(DAYS, 0, -1):
    d = TODAY - timedelta(days=day_offset)
    is_weekend = d.weekday() >= 5
    
    for sku_info in SKUS:
        sku = sku_info["sku"]
        base = BASE_DAILY[sku]
        
        # 1. 周末效应：周末销量下降 20%
        factor = 0.8 if is_weekend else 1.0
        
        # 2. 促销波峰：第 10-12 天有大促（双11模拟）
        if 8 <= day_offset <= 12:
            factor *= 2.5
        
        # 3. 小促销：第 30-31 天
        if 29 <= day_offset <= 31:
            factor *= 1.5
        
        # 4. 断货模拟：SKU-A05 在第 5-8 天断货
        if sku == "SKU-A05" and 2 <= day_offset <= 6:
            factor = 0
        
        # 5. SKU-A07 在第 15-18 天滞销
        if sku == "SKU-A07" and 13 <= day_offset <= 16:
            factor *= 0.1
        
        # 6. 随机波动：±30%
        factor *= random.uniform(0.7, 1.3)
        
        daily_qty = max(0, round(base * factor))
        if daily_qty == 0:
            continue
        
        # 拆分为 1-3 个订单（模拟一天多单）
        num_orders = random.randint(1, min(3, max(1, daily_qty // 10)))
        qtys = []
        remaining = daily_qty
        for o in range(num_orders - 1):
            q = random.randint(1, max(1, remaining // 2))
            qtys.append(q)
            remaining -= q
        qtys.append(remaining)
        
        for qty in qtys:
            store = sku_info["store"]
            if sku_info["cat"] == "食用油":
                platform = "天猫"
            elif sku_info["cat"] == "酱料":
                platform = random.choice(["京东", "天猫"])
            else:
                platform = "京东"
            
            base_price = sku_info["price"]
            # 促销时降价 10-20%
            if 8 <= day_offset <= 12:
                price = round(base_price * random.uniform(0.8, 0.9), 2)
            else:
                price = base_price
            
            orders_data.append({
                "order_no": f"SIM-{order_no:05d}",
                "store": store,
                "sku": sku,
                "product_name": sku_info["name"],
                "quantity": qty,
                "unit_price": price,
                "total_amount": round(qty * price, 2),
                "order_status": "已完成",
                "ordered_at": d.strftime("%Y-%m-%d"),
                "platform": platform,
            })
            order_no += 1

# 批量插入订单
for i in range(0, len(orders_data), 100):
    batch = orders_data[i:i+100]
    for o in batch:
        try: db.table("orders").insert(o).execute()
        except: pass

print(f"生成 {len(orders_data)} 条订单记录，涵盖 {DAYS} 天")

# ── 库存 ──────────────────────────────────────────────────────────────────
INVENTORY = []
for sku_info in SKUS:
    sku = sku_info["sku"]
    base = BASE_DAILY[sku]
    
    # 安全库存 = 7-10 天日销
    safety = base * random.randint(7, 10)
    
    # C 仓分布（北京/上海/广州/武汉/成都/沈阳/西安/郑州）
    c_warehouses = [
        ("北京", random.uniform(0.25, 0.35)),
        ("上海", random.uniform(0.15, 0.25)),
        ("广州", random.uniform(0.12, 0.20)),
        ("武汉", random.uniform(0.08, 0.15)),
        ("成都", random.uniform(0.05, 0.10)),
    ]
    total_c = safety * 2  # C仓总库存约为安全库存的2倍
    
    for wh, ratio in c_warehouses:
        avail = max(1, round(total_c * ratio))
        wh_safety = max(1, round(safety * ratio))
        transit = max(0, round(avail * random.uniform(0.1, 0.3)))
        
        # 制造一些低库存场景
        if sku in ("SKU-A05", "SKU-A04") and wh in ("北京", "广州"):
            avail = max(1, round(wh_safety * random.uniform(0.1, 0.3)))  # 低于安全线
        
        INVENTORY.append({
            "sku": sku, "product_name": sku_info["name"], "store": sku_info["store"],
            "warehouse": wh, "warehouse_type": "platform",
            "available_qty": avail, "in_transit_qty": transit,
            "safety_qty": wh_safety,
        })
    
    # B 仓库存 = 3-5 天日销
    b_avail = base * random.randint(3, 5)
    INVENTORY.append({
        "sku": sku, "product_name": sku_info["name"], "store": sku_info["store"],
        "warehouse": "B-华东", "warehouse_type": "platform_b",
        "available_qty": b_avail, "in_transit_qty": 0, "safety_qty": 0,
    })
    
    # 自有仓库存
    own_avail = base * random.randint(10, 20)
    INVENTORY.append({
        "sku": sku, "product_name": sku_info["name"], "store": sku_info["store"],
        "warehouse": "自营仓", "warehouse_type": "own",
        "available_qty": own_avail, "in_transit_qty": max(1, round(own_avail * random.uniform(0.1, 0.2))),
        "safety_qty": base * 14,
    })

for inv in INVENTORY:
    try: db.table("inventory").insert(inv).execute()
    except: pass

print(f"生成 {len(INVENTORY)} 条库存记录")

# ── 告警 ────────────────────────────────────────────────────────────────────
alerts = [
    {"alert_type":"replenish","title":"紧急补货: 特级鲜酱油 500ml","description":"可用量低于安全线30%，需紧急补货","severity":"error","related_sku":"SKU-A05","status":"active","source":"event_bus"},
    {"alert_type":"low_stock","title":"低库存预警: 白灼汁 300ml","description":"可用量低于安全线","severity":"warning","related_sku":"SKU-A04","status":"active","source":"event_bus"},
    {"alert_type":"b_storage_warn","title":"B仓即将超免费期: 拌面酱 200g","description":"入库已12天，即将超B仓15天免费期","severity":"info","related_sku":"SKU-A10","status":"active","source":"replenishment_engine"},
]
for a in alerts:
    db.table("alerts").insert(a).execute()

print(f"生成 {len(alerts)} 条告警记录")
print("完成！数据已写入数据库")
print(f"\n数据概览：")
print(f"  商品: {len(SKUS)} 个")
print(f"  订单: {len(orders_data)} 条（{DAYS} 天）")
print(f"  库存: {len(INVENTORY)} 条")
