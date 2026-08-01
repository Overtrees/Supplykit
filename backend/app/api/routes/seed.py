"""种子数据 — 填充/重置（按测试脚本复刻）"""
from fastapi import APIRouter
from app.core.database import get_db, init_db, get_conn
from app.core.dashboard_cache import invalidate
from app.core.response import ok, fail
from datetime import datetime, timedelta
import random, json

router = APIRouter(prefix="/api/seed", tags=["seed"])

@router.post("/fill")
def seed_fill(db=get_db()):
    today = datetime.utcnow()
    ch = 'jd'

    # 商品（按测试脚本复刻）
    products = [
        {"sku": "SKU-001", "product_name": "特级鲜酱油 500ml", "store": "京东自营", "box_qty": 12, "status": "active", "channel": ch, "category": "调味品", "price": 15.9},
        {"sku": "SKU-002", "product_name": "金标生抽王 500ml", "store": "京东自营", "box_qty": 12, "status": "active", "channel": ch, "category": "调味品", "price": 18.9},
        {"sku": "SKU-003", "product_name": "纯花生油 1L", "store": "京东旗舰店", "box_qty": 6, "status": "active", "channel": ch, "category": "粮油", "price": 69.9},
        {"sku": "SKU-004", "product_name": "有机大米 5kg", "store": "京东自营", "box_qty": 4, "status": "active", "channel": ch, "category": "粮油", "price": 49.9},
        {"sku": "SKU-005", "product_name": "矿泉水 550ml×24", "store": "京东自营", "box_qty": 24, "status": "active", "channel": ch, "category": "饮料", "price": 29.9},
    ]
    for p in products:
        db.table("products").upsert(p, conflict_col='sku')

    # 供应商
    suppliers = [
        {"supplier_code": "SUP-001", "supplier_name": "广州海天调味品有限公司", "contact_person": "张三", "contact_phone": "13800138001", "score": 5, "channel": ch},
        {"supplier_code": "SUP-002", "supplier_name": "中粮集团粮油事业部", "contact_person": "李四", "contact_phone": "13800138002", "score": 4, "channel": ch},
    ]
    for s in suppliers:
        db.table("suppliers").upsert(s, conflict_col='supplier_code')

    # 库存（按测试脚本：SKU-001 各仓有库存，SKU-002 低库存触发预警）
    inv_data = [
        # SKU-001: 充足库存
        {"sku":"SKU-001","product_name":"特级鲜酱油 500ml","warehouse":"北京仓","warehouse_type":"platform","available_qty":500,"in_transit_qty":200,"safety_qty":100,"channel":ch},
        {"sku":"SKU-001","product_name":"特级鲜酱油 500ml","warehouse":"上海仓","warehouse_type":"platform","available_qty":300,"in_transit_qty":100,"safety_qty":100,"channel":ch},
        {"sku":"SKU-001","product_name":"特级鲜酱油 500ml","warehouse":"广州仓","warehouse_type":"own","available_qty":800,"in_transit_qty":0,"safety_qty":200,"channel":ch},
        # SKU-002: 低库存
        {"sku":"SKU-002","product_name":"金标生抽王 500ml","warehouse":"北京仓","warehouse_type":"platform","available_qty":30,"in_transit_qty":50,"safety_qty":100,"channel":ch},
        {"sku":"SKU-002","product_name":"金标生抽王 500ml","warehouse":"上海仓","warehouse_type":"platform","available_qty":20,"in_transit_qty":0,"safety_qty":100,"channel":ch},
        {"sku":"SKU-002","product_name":"金标生抽王 500ml","warehouse":"广州仓","warehouse_type":"own","available_qty":60,"in_transit_qty":0,"safety_qty":200,"channel":ch},
        # SKU-003/SKU-004/SKU-005: 适量库存
        {"sku":"SKU-003","product_name":"纯花生油 1L","warehouse":"北京仓","warehouse_type":"platform","available_qty":200,"in_transit_qty":80,"safety_qty":50,"channel":ch},
        {"sku":"SKU-004","product_name":"有机大米 5kg","warehouse":"上海仓","warehouse_type":"platform","available_qty":150,"in_transit_qty":60,"safety_qty":40,"channel":ch},
        {"sku":"SKU-005","product_name":"矿泉水 550ml×24","warehouse":"北京仓","warehouse_type":"platform","available_qty":400,"in_transit_qty":100,"safety_qty":80,"channel":ch},
    ]
    for i in inv_data:
        db.table("inventory").insert(i).execute()

    # 订单（28天窗口内均匀分布，按测试脚本复刻）
    orders_data = [
        ("ORD-001", "SKU-001", 100, 1, "已完成"),
        ("ORD-002", "SKU-001", 80, 3, "已完成"),
        ("ORD-003", "SKU-001", 120, 7, "已完成"),
        ("ORD-004", "SKU-001", 90, 14, "已完成"),
        ("ORD-005", "SKU-001", 60, 21, "已完成"),
        ("ORD-006", "SKU-002", 50, 2, "已完成"),
        ("ORD-007", "SKU-002", 40, 5, "已完成"),
        ("ORD-008", "SKU-002", 30, 10, "已完成"),
        ("ORD-009", "SKU-002", 20, 20, "已完成"),
        ("ORD-010", "SKU-003", 15, 4, "待发货"),
        ("ORD-011", "SKU-003", 25, 8, "已发货"),
        ("ORD-012", "SKU-004", 10, 6, "已完成"),
        ("ORD-013", "SKU-004", 8, 15, "已完成"),
        ("ORD-014", "SKU-005", 50, 1, "待确认"),
        ("ORD-015", "SKU-005", 30, 12, "已完成"),
    ]
    for no, sku, qty, days_ago, status in orders_data:
        od = (today - timedelta(days=days_ago))
        db.table("orders").insert({
            "order_no": no, "sku": sku, "store": "京东自营",
            "quantity": qty, "order_status": status,
            "ordered_at": od.strftime("%Y-%m-%d"),
            "paid_at": (od + timedelta(days=1)).strftime("%Y-%m-%d"),
            "product_name": next(p["product_name"] for p in products if p["sku"]==sku),
            "total_amount": round(qty * next(p["price"] for p in products if p["sku"]==sku), 2),
            "channel": ch,
        }).execute()

    invalidate()  # 清除看板缓存
    return ok({"products": len(products), "suppliers": len(suppliers), "inventory": len(inv_data), "orders": len(orders_data)})


@router.post("/reset")
def seed_reset(db=get_db()):
    conn = get_conn()
    conn.execute("PRAGMA busy_timeout=10000")
    conn.execute("PRAGMA foreign_keys=OFF")
    conn.executescript("""
        DELETE FROM orders;
        DELETE FROM inventory;
        DELETE FROM products;
        DELETE FROM suppliers;
        DELETE FROM alerts;
        DELETE FROM quality_logs;
        DELETE FROM events;
        DELETE FROM purchase_orders;
        DELETE FROM replenishment_config_history;
        DELETE FROM cleansing_templates;
        DELETE FROM custom_fields;
        DELETE FROM replenishment_config;
        DELETE FROM rules;
    """)
    conn.execute("PRAGMA foreign_keys=ON")
    conn.commit()
    invalidate()
    from app.core.database import _seed_builtin_rules
    try:
        _seed_builtin_rules()
    except:
        pass
    return ok({"reset": True})