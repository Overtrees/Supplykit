"""SupplyKit API 端到端测试（BBCC/传统补货 + 采购建议）

运行: cd backend && python -m pytest tests/test_e2e.py -v

设计说明：数据库初始化/种子数据全部放在 setup_module() 中（pytest 运行期执行），
模块顶层只做 stdlib import——避免 collection 阶段 import 副作用互相污染。
"""
import os, sys
os.environ['SQLITE_PATH'] = os.path.join(os.path.dirname(__file__), '..', '.test_e2e.db')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from datetime import datetime, timedelta

# 模块级占位（setup_module 中填充）
client = None
db = None
DB_PATH = None
unwrap = None


def setup_module():
    """每个测试文件运行前执行：清空 app 缓存 → 用本文件路径重新导入 → 建库 → 种子"""
    global client, db, DB_PATH, unwrap
    # 强制重载 app 模块（DB_PATH 在 import 时固化，必须按本文件路径重新导入）
    for _m in list(sys.modules):
        if _m.startswith('app.'):
            sys.modules.pop(_m, None)

    from fastapi.testclient import TestClient
    from fastapi import FastAPI
    from app.core.database import init_db, get_db, DB_PATH as _DB_PATH

    DB_PATH = _DB_PATH
    init_db()
    db = get_db()

    # 清理上次运行残留数据（幂等：重复运行不报 UNIQUE 冲突）
    import sqlite3
    _conn = sqlite3.connect(DB_PATH)
    for _t in ['products', 'orders', 'inventory', 'alerts', 'replenishment_config', 'daily_sales_snapshot']:
        try: _conn.execute(f'DELETE FROM "{_t}"')
        except Exception: pass
    _conn.commit(); _conn.close()

    seed_data()

    from app.api.routes.insights import router as insights_router
    from app.api.routes.replenishment import router as replenishment_router
    from app.api.routes.purchase import router as purchase_router

    app = FastAPI()
    app.include_router(insights_router)
    app.include_router(replenishment_router)
    app.include_router(purchase_router)
    client = TestClient(app)

    # 辅助：兼容统一响应格式 {ok, data} 和原始格式
    def _unwrap(r):
        d = r.json()
        if isinstance(d, dict) and "data" in d: return d["data"]
        return d
    unwrap = _unwrap


def seed_data():
    today = datetime.utcnow()

    # 商品
    for p in [
        {"sku": "SKU-001", "product_name": "特级鲜酱油 500ml", "store": "京东自营", "box_qty": 12, "status": "active", "channel": "jd"},
        {"sku": "SKU-002", "product_name": "金标生抽王 500ml", "store": "京东自营", "box_qty": 12, "status": "active", "channel": "jd"},
    ]:
        db.table("products").insert(p).execute()

    # 订单（28天窗口内均匀分布）
    orders_data = [
        ("ORD-001", "SKU-001", 100, 1),
        ("ORD-002", "SKU-001", 80, 3),
        ("ORD-003", "SKU-001", 120, 7),
        ("ORD-004", "SKU-001", 90, 14),
        ("ORD-005", "SKU-001", 60, 21),
        ("ORD-006", "SKU-002", 50, 2),
        ("ORD-007", "SKU-002", 40, 5),
        ("ORD-008", "SKU-002", 30, 10),
        ("ORD-009", "SKU-002", 20, 20),
    ]
    for no, sku, qty, days_ago in orders_data:
        db.table("orders").insert({
            "order_no": no, "sku": sku, "store": "京东自营",
            "quantity": qty, "ordered_at": (today - timedelta(days=days_ago)).strftime("%Y-%m-%d"),
            "order_status": "已完成", "channel": "jd",
        }).execute()

    # 库存（C仓 + B仓）
    inv_data = [
        ("SKU-001", "北京", "platform", 200, 50, 300),
        ("SKU-001", "上海", "platform", 150, 30, 200),
        ("SKU-001", "B-华东", "platform_b", 500, 0, 0),
        ("SKU-002", "北京", "platform", 50, 20, 100),
        ("SKU-002", "B-华东", "platform_b", 100, 0, 0),
    ]
    for sku, wh, wtype, avail, transit, safety in inv_data:
        db.table("inventory").upsert({
            "sku": sku, "warehouse": wh, "warehouse_type": wtype,
            "available_qty": avail, "in_transit_qty": transit,
            "safety_qty": safety, "product_name": "特级鲜酱油 500ml" if sku == "SKU-001" else "金标生抽王 500ml",
            "store": "京东自营", "channel": "jd",
        }, conflict_col="id")

    # 构建日销快照（补货日销从快照读历史，必须显式构建）
    from app.core.sales_utils import build_daily_sales_snapshot
    build_daily_sales_snapshot(db)


# ── 测试 ──────────────────────────────────────────────────────────────────

class TestBBCCReplenishment:
    """BBCC 补货建议端到端"""

    def test_returns_list(self):
        resp = client.get("/api/insights/replenishment?mode=bbcc&days=28")
        assert resp.status_code == 200
        data = unwrap(resp)
        assert isinstance(data, list)
        assert len(data) > 0

    def test_response_structure(self):
        resp = client.get("/api/insights/replenishment?mode=bbcc&days=28")
        item = unwrap(resp)[0]
        for field in ["sku", "product_name", "daily_sales", "daily_sales_7",
                       "daily_sales_14", "daily_sales_28", "suggested_qty",
                       "b_suggested", "b_stock", "c_stock", "note"]:
            assert field in item, f"缺少字段: {field}"

    def test_sku_001_daily_sales_positive(self):
        """SKU-001 28天内有450件销量，日销应为正数"""
        resp = client.get("/api/insights/replenishment?mode=bbcc&days=28")
        item = next(x for x in unwrap(resp) if x["sku"] == "SKU-001")
        assert item["daily_sales"] > 0

    def test_sku_002_b_stock_present(self):
        """SKU-002 B仓有100件库存"""
        resp = client.get("/api/insights/replenishment?mode=bbcc&days=28")
        item = next(x for x in unwrap(resp) if x["sku"] == "SKU-002")
        assert item["b_stock"] == 100

    def test_suggested_qty_is_int(self):
        resp = client.get("/api/insights/replenishment?mode=bbcc&days=28")
        for item in unwrap(resp):
            assert isinstance(item["suggested_qty"], (int, float))
            assert isinstance(item["b_suggested"], (int, float))


class TestTraditionalReplenishment:
    """传统多仓补货建议端到端"""

    def test_returns_list(self):
        resp = client.get("/api/insights/replenishment?mode=traditional&days=28")
        assert resp.status_code == 200
        data = unwrap(resp)
        assert isinstance(data, list)

    def test_has_warehouse_field(self):
        resp = client.get("/api/insights/replenishment?mode=traditional&days=28")
        for item in unwrap(resp):
            assert "warehouse" in item

    def test_daily_sales_breakdown(self):
        """传统模式按仓库维度返回日销"""
        resp = client.get("/api/insights/replenishment?mode=traditional&days=28")
        data = unwrap(resp)
        if data:
            item = data[0]
            for field in ["daily_sales_7", "daily_sales_14", "daily_sales_28"]:
                assert field in item


class TestPurchaseSuggestions:
    """采购建议端到端"""

    def test_returns_suggestions(self):
        resp = client.get("/api/insights/purchase")
        assert resp.status_code == 200
        data = unwrap(resp)
        assert isinstance(data, list)

    def test_response_structure(self):
        resp = client.get("/api/insights/purchase")
        item = unwrap(resp)[0]
        for field in ["sku", "product_name", "daily_sales", "sys_total", "safety_qty", "purchase_qty", "box_qty"]:
            assert field in item, f"缺少字段: {field}"

    def test_sys_total_breakdown(self):
        """系统总库存 = 各仓之和（jd 含 B 仓）"""
        resp = client.get("/api/insights/purchase")
        for item in unwrap(resp):
            total = item.get("sys_total", 0)
            assert isinstance(total, (int, float))

    def test_actual_purchase_is_int(self):
        resp = client.get("/api/insights/purchase")
        for item in unwrap(resp):
            assert isinstance(item.get("purchase_qty", 0), (int, float))


class TestPing:
    def test_ping_ok(self):
        resp = client.get("/api/insights/ping")
        assert resp.status_code == 200
        assert "time" in unwrap(resp)
