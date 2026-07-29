"""SupplyKit API 端到端测试（BBCC/传统补货 + 采购建议）

运行: cd backend && python -m pytest tests/test_e2e.py -v
"""
import os, sys, json

# 必须在任何 app 导入前设置临时数据库路径
_db_path = os.path.join(os.path.dirname(__file__), '..', 'test_e2e.db')
os.environ['SQLITE_PATH'] = _db_path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from fastapi import FastAPI

from app.core.database import init_db, get_db, DB_PATH

# 辅助：兼容统一响应格式 {ok, data} 和原始格式
def unwrap(r):
    d = r.json()
    if isinstance(d, dict) and "data" in d: return d["data"]
    return d
from app.api.routes.insights import router as insights_router
from app.api.routes.replenishment import router as replenishment_router
from app.api.routes.purchase import router as purchase_router

# 初始化数据库表
init_db()
db = get_db()


# ── 种子数据 ──────────────────────────────────────────────────────────────

def seed_data():
    today = datetime.utcnow()

    # 商品
    for p in [
        {"sku": "SKU-001", "product_name": "特级鲜酱油 500ml", "store": "京东自营", "box_qty": 12, "status": "active"},
        {"sku": "SKU-002", "product_name": "金标生抽王 500ml", "store": "京东自营", "box_qty": 12, "status": "active"},
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
            "order_status": "已完成",
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
            "store": "京东自营",
        }, conflict_col="id")

seed_data()


# ── FastAPI 测试应用 ──────────────────────────────────────────────────────

app = FastAPI()
app.include_router(insights_router)
app.include_router(replenishment_router)
app.include_router(purchase_router)
client = TestClient(app)


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
            assert "warehouse" in item or "store" in item

    def test_daily_sales_breakdown(self):
        resp = client.get("/api/insights/replenishment?mode=traditional&days=28")
        for item in unwrap(resp):
            assert "daily_sales_7" in item
            assert "daily_sales_14" in item
            assert "daily_sales_28" in item


class TestPurchaseSuggestions:
    """采购建议端到端"""

    def test_returns_suggestions(self):
        r = client.get("/api/insights/purchase?days=28&mode=bbcc")
        assert r.status_code == 200
        data = unwrap(r)
        assert isinstance(data, list)

    def test_response_structure(self):
        r = client.get("/api/insights/purchase?days=28&mode=bbcc")
        data = unwrap(r)
        if len(data) == 0: return
        item = data[0]
        for field in ["sku", "product_name", "purchase_qty", "actual_purchase",
                       "sys_total", "daily_sales", "note"]:
            assert field in item, f"缺少字段: {field}"

    def test_sys_total_breakdown(self):
        r = client.get("/api/insights/purchase?days=28&mode=bbcc")
        for item in unwrap(r):
            assert "own_available" in item
            assert "plat_available" in item
            assert "b_available" in item

    def test_actual_purchase_is_int(self):
        r = client.get("/api/insights/purchase?days=28&mode=bbcc")
        for item in unwrap(r):
            assert isinstance(item["actual_purchase"], (int, float))


class TestPing:
    def test_ping_ok(self):
        resp = client.get("/api/insights/ping")
        assert resp.status_code == 200
        assert resp.json()["ok"] is True


# ── 清理 ──────────────────────────────────────────────────────────────────

def teardown_module():
    import time
    try:
        # 关闭所有数据库连接
        from app.core.database import _local
        if hasattr(_local, 'conn') and _local.conn:
            _local.conn.close()
        os.unlink(_db_path)
    except Exception:
        pass