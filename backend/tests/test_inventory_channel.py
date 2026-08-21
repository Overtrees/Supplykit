"""库存接口渠道隔离测试 — other 渠道强制排除 B 仓(platform_b)"""
import os, sys
_db_path = os.path.join(os.path.dirname(__file__), '..', 'test_inv_ch.db')
os.environ['SQLITE_PATH'] = _db_path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import sqlite3
from fastapi.testclient import TestClient
from fastapi import FastAPI
from app.core.database import init_db, get_db

init_db()
db = get_db()
_conn = sqlite3.connect(_db_path)
for t in ['inventory']:
    try: _conn.execute(f'DELETE FROM "{t}"')
    except Exception: pass
_conn.commit(); _conn.close()

for ch, wt, wh in [('jd','platform_b','京东B仓'), ('jd','platform','北京仓'),
                   ('other','platform_b','京东B仓'), ('other','platform','北京仓'), ('other','own','三方仓')]:
    db.table("inventory").insert({"sku":f"SKU-1-{ch}","warehouse":wh,"warehouse_type":wt,
        "available_qty":10,"in_transit_qty":0,"safety_qty":5,"channel":ch}).execute()

from app.api.routes import inventory
app = FastAPI()
app.include_router(inventory.router)
client = TestClient(app)

class TestInventoryChannelIsolation:
    def test_other_omits_b_rows(self):
        """其他渠道列表不含 platform_b 行"""
        r = client.get("/api/inventory?channel=other")
        assert r.status_code == 200
        d = r.json(); items = d if isinstance(d, list) else d.get("data", [])
        assert len(items) == 2, f"other 应有 2 行(platform+own)，实际 {len(items)}: {[i['warehouse_type'] for i in items]}"
        assert all(i["warehouse_type"] != "platform_b" for i in items)

    def test_other_filter_b_returns_empty(self):
        """其他渠道显式查 B 仓返回空"""
        r = client.get("/api/inventory?channel=other&warehouse_type=platform_b")
        d = r.json(); items = d if isinstance(d, list) else d.get("data", [])
        assert len(items) == 0

    def test_jd_keeps_b_rows(self):
        """京东渠道保留 B 仓行"""
        r = client.get("/api/inventory?channel=jd&warehouse_type=platform_b")
        d = r.json(); items = d if isinstance(d, list) else d.get("data", [])
        assert len(items) == 1, f"jd B 仓应有 1 行: {len(items)}"