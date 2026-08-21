"""采购建议渠道隔离测试 — B 仓(platform_b)是京东主体专属，其他渠道不得计入

历史 bug: seed 对两个渠道都生成 '京东B仓' 库存行, purchase 汇总把 platform_b
计入系统总库存(sys_total) → 其他渠道采购建议出现 B 仓数据

运行: cd backend && python -m pytest tests/test_purchase_channel.py -v
"""
import os, sys
_db_path = os.path.join(os.path.dirname(__file__), '..', 'test_purchase_ch.db')
os.environ['SQLITE_PATH'] = _db_path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import sqlite3
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from fastapi import FastAPI
from app.core.database import init_db, get_db
from app.core.replenishment_cache import invalidate_cache

init_db()
db = get_db()
today = datetime.utcnow()

_conn = sqlite3.connect(_db_path)
for t in ['products','orders','inventory','replenishment_config','daily_sales_snapshot']:
    try: _conn.execute(f'DELETE FROM "{t}"')
    except Exception: pass
_conn.commit(); _conn.close()

# 商品
for p in [{"sku":"SKU-100-J","product_name":"商品J","channel":"jd","supplier_code":"SUP-001-JD","box_qty":12,"barcode":"BAR-100J"},
          {"sku":"SKU-100-O","product_name":"商品O","channel":"other","supplier_code":"SUP-001-OTHER","box_qty":12,"barcode":"BAR-100O"}]:
    db.table("products").insert(p).execute()

# 库存：两渠道都建 platform(北京) + own(集货仓) + platform_b(京东B仓)
for ch, sku in [('jd','SKU-100-J'), ('other','SKU-100-O')]:
    for wt, wh, qty in [('platform','北京',100), ('own','集货仓',50), ('platform_b','京东B仓',20)]:
        db.table("inventory").insert({"sku":sku,"warehouse":wh,"warehouse_type":wt,
            "available_qty":qty,"in_transit_qty":0,"safety_qty":30,"channel":ch}).execute()

# 参数
for k,v in [("purchase_lead_days","7"),("purchase_safety_days","3"),("turnover_warning_90","90")]:
    db.table("replenishment_config").upsert({"key":k,"value":v,"channel":"jd"})

from app.api.routes import purchase
app = FastAPI()
app.include_router(purchase.router)
client = TestClient(app)

def unwrap(r):
    d = r.json()
    if isinstance(d, dict) and "data" in d: return d["data"]
    return d

class TestPurchaseChannelIsolation:
    def setup_method(self):
        invalidate_cache(db)
        # 清空日销快照干扰（无历史数据时日销来自订单，此处无订单→日销0，不影响库存断言）
        c = sqlite3.connect(_db_path)
        c.execute("DELETE FROM daily_sales_snapshot"); c.commit(); c.close()

    def test_other_excludes_b_warehouse(self):
        """其他渠道：platform_b 不计入系统总库存，b_available=0"""
        r = client.get("/api/insights/purchase?channel=other&days=28")
        assert r.status_code == 200
        items = unwrap(r)
        item = next(x for x in items if x["sku"] == "SKU-100-O")
        # own 50 + platform 100 = 150，不含 B 仓 20
        assert item["sys_total"] == 150, f"other sys_total 不应含 B 仓: {item['sys_total']}"
        assert item["b_available"] == 0, f"other 不应有 b_available: {item['b_available']}"
        assert item["sys_available"] == 150

    def test_jd_includes_b_warehouse(self):
        """京东渠道：B 仓保留在系统总库存/单独 b_available（原设计不变）"""
        r = client.get("/api/insights/purchase?channel=jd&days=28")
        assert r.status_code == 200
        items = unwrap(r)
        item = next(x for x in items if x["sku"] == "SKU-100-J")
        assert item["b_available"] == 20, f"jd 应保留 b_available: {item['b_available']}"
        # jd 原设计：sys_total 含 B 仓（own50+plat100+B20=170）
        assert item["sys_total"] == 170, f"jd sys_total: {item['sys_total']}"