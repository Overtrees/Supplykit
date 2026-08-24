"""补充测试 — 覆盖 stock-risk / alerts / inventory / replenishment"""
import os, sys
os.environ['SQLITE_PATH'] = os.path.join(os.path.dirname(__file__), '..', '.test_more.db')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from datetime import datetime, timedelta

client = None
db = None
unwrap = None
is_ok = None


def setup_module():
    global client, db, unwrap, is_ok
    # 强制重载 app 模块（DB_PATH 在 import 时固化，必须按本文件路径重新导入）
    for _m in list(sys.modules):
        if _m.startswith('app.'):
            sys.modules.pop(_m, None)

    from fastapi.testclient import TestClient
    from fastapi import FastAPI
    from app.core.database import DB_PATH, init_db, get_db

    init_db()
    db = get_db()
    today = datetime.utcnow()

    # 清理旧数据
    import sqlite3
    _conn = sqlite3.connect(DB_PATH)
    for t in ['products','orders','inventory','alerts','daily_sales_snapshot']:
        try: _conn.execute(f'DELETE FROM "{t}"')
        except: pass
    _conn.commit()
    _conn.close()

    # 种子数据
    for p in [{"sku":"SKU-T01","product_name":"测试商品A","store":"测试店","box_qty":12,"status":"active","channel":"jd"}]:
        db.table("products").insert(p).execute()
    for o in [("O-1","SKU-T01",50,1),("O-2","SKU-T01",30,3),("O-3","SKU-T01",20,7)]:
        db.table("orders").insert({"order_no":o[0],"sku":o[1],"quantity":o[2],"ordered_at":(today-timedelta(days=o[3])).strftime("%Y-%m-%d"),"order_status":"已完成","channel":"jd"}).execute()
    # 构建日销快照（stock-risk 依赖日销>0 才纳入风险列表）
    from app.core.sales_utils import build_daily_sales_snapshot
    build_daily_sales_snapshot(db)
    for i in [("SKU-T01","北京","platform",100,50,200),("SKU-T01","B-华东","platform_b",300,0,0)]:
        db.table("inventory").insert({"sku":i[0],"warehouse":i[1],"warehouse_type":i[2],"available_qty":i[3],"in_transit_qty":i[4],"safety_qty":i[5],"product_name":"","store":"测试店","channel":"jd"}).execute()
    for k,v in [("b_to_c_days","3"),("c_safety_days","0"),("turnover_warning_90","90")]:
        db.table("replenishment_config").upsert({"key":k,"value":v,"channel":"jd"})
    db.table("alerts").insert({"alert_type":"low_stock","title":"测试告警","description":"可用<安全线","severity":"warning","status":"active","related_sku":"SKU-T01","source":"test","channel":"jd"}).execute()

    from app.api.routes import dashboard, alerts, inventory, replenishment
    app = FastAPI()
    app.include_router(dashboard.router)
    app.include_router(alerts.router)
    app.include_router(inventory.router)
    app.include_router(replenishment.router)
    client = TestClient(app)

    # 辅助：兼容统一格式和原始格式
    def _unwrap(r):
        d = r.json()
        if isinstance(d, dict) and "data" in d: return d["data"]
        return d
    def _is_ok(r):
        d = r.json()
        if isinstance(d, dict) and "ok" in d: return d["ok"]
        return True  # 原始格式默认为成功
    unwrap = _unwrap
    is_ok = _is_ok


class TestStockRisk:
    def test_returns_list(self):
        r = client.get("/api/dashboard/stock-risk")
        assert r.status_code == 200 and is_ok(r)
        assert isinstance(unwrap(r), list)

    def test_sku_t01_included(self):
        skus = [x["sku"] for x in unwrap(client.get("/api/dashboard/stock-risk"))]
        assert "SKU-T01" in skus


class TestAlerts:
    def test_list(self):
        r = client.get("/api/alerts")
        assert r.status_code == 200 and is_ok(r)
        assert len(unwrap(r)) >= 1

    def test_active_filter(self):
        for a in unwrap(client.get("/api/alerts")):
            assert a["status"] == "active"


class TestInventory:
    def test_list(self):
        r = client.get("/api/inventory")
        assert r.status_code == 200
        assert len(unwrap(r)) >= 1

    def test_filter_by_type(self):
        for i in unwrap(client.get("/api/inventory?warehouse_type=platform")):
            assert i["warehouse_type"] == "platform"

    def test_create(self):
        r = client.post("/api/inventory", json={
            "sku": "SKU-T02", "warehouse": "上海", "warehouse_type": "platform",
            "available_qty": 10, "safety_qty": 20, "product_name": "测试商品B",
            "channel": "jd"
        })
        assert r.status_code in (200, 201)


class TestReplenishment:
    def test_bbcc(self):
        r = client.get("/api/insights/replenishment?mode=bbcc&days=28")
        assert r.status_code == 200 and is_ok(r)
        assert len(unwrap(r)) >= 1

    def test_traditional(self):
        r = client.get("/api/insights/replenishment?mode=traditional&days=28")
        assert r.status_code == 200 and is_ok(r)
