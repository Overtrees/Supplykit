"""products 搜索回归测试 — or_ 拼接 bug 导致按名/SKU 搜索全空"""
import os, sys
os.environ['SQLITE_PATH'] = os.path.join(os.path.dirname(__file__), '..', '.test_products_search.db')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

client = None
DB_PATH = None


def setup_module():
    global client, DB_PATH
    # 强制重载 app 模块（DB_PATH 在 import 时固化，必须按本文件路径重新导入）
    for _m in list(sys.modules):
        if _m.startswith('app.'):
            sys.modules.pop(_m, None)

    import sqlite3
    from fastapi.testclient import TestClient
    from fastapi import FastAPI
    from app.core.database import DB_PATH as _DB_PATH, init_db, get_db
    from app.api.routes import products

    DB_PATH = _DB_PATH
    init_db()
    db = get_db()
    db.table("products").insert({"sku":"SKU-0130-J","product_name":"糖果130","channel":"jd"}).execute()
    db.table("products").insert({"sku":"SKU-0130-O","product_name":"糖果130","channel":"other"}).execute()
    db.table("products").insert({"sku":"SKU-9999-J","product_name":"酱油999","channel":"jd"}).execute()
    app = FastAPI(); app.include_router(products.router)
    client = TestClient(app)


def teardown_module():
    try:
        if os.path.exists(DB_PATH):
            os.unlink(DB_PATH)
        for ext in ['-wal', '-shm']:
            if os.path.exists(DB_PATH + ext):
                os.unlink(DB_PATH + ext)
    except Exception:
        pass


class TestProductsSearch:
    def test_search_by_sku(self):
        r = client.get("/api/products?channel=jd&search=SKU-0130")
        assert r.status_code == 200
        items = r.json().get("data", [])
        assert any(x["sku"] == "SKU-0130-J" for x in items), f"按 SKU 搜索应命中: {[x['sku'] for x in items]}"

    def test_search_by_name(self):
        r = client.get("/api/products?channel=jd&search=糖果")
        assert r.status_code == 200
        items = r.json().get("data", [])
        assert any(x["sku"] == "SKU-0130-J" for x in items), f"按名称搜索应命中: {[x['sku'] for x in items]}"

    def test_search_channel_isolated(self):
        r = client.get("/api/products?channel=other&search=SKU-0130")
        items = r.json().get("data", [])
        assert all(x["channel"] == "other" for x in items)
        assert len(items) >= 1
