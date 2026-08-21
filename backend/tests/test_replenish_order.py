"""补货建议排序测试 — 需要补货的 SKU 必须排在最前，否则首屏全是"建议补 -"（用户视角无数据）

运行: cd backend && python -m pytest tests/test_replenish_order.py -v
"""
import os, sys
_db_path = os.path.join(os.path.dirname(__file__), '..', 'test_order.db')
os.environ['SQLITE_PATH'] = _db_path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from fastapi import FastAPI
from app.core.database import init_db, get_db
from app.core.replenishment_cache import invalidate_cache

init_db()
db = get_db()
today = datetime.utcnow()

# 清理旧数据（含补货缓存键）
import sqlite3
_conn = sqlite3.connect(_db_path)
for t in ['products','orders','inventory','alerts','replenishment_config','daily_sales_snapshot']:
    try: _conn.execute(f'DELETE FROM "{t}"')
    except Exception: pass
_conn.commit(); _conn.close()

# ── 种子：FULL 先插入（id 小），NEED 后插入 —— 未排序时代码会返回 FULL 在前 ──
products = [
    {"sku":"SKU-FULL","product_name":"库存充足品","store":"测试店","box_qty":12,"status":"active","barcode":"BAR-FULL"},
    {"sku":"SKU-NEED","product_name":"需要补货品","store":"测试店","box_qty":12,"status":"active","barcode":"BAR-NEED"},
]
for p in products: db.table("products").insert(p).execute()

# 订单：NEED 高销量（今天 90 件 → 日销 30+），FULL 无销量
_today = today.strftime("%Y-%m-%d")
for o in [("O-N1","SKU-NEED",30,0),("O-N2","SKU-NEED",30,0),("O-N3","SKU-NEED",30,0)]:
    db.table("orders").insert({"order_no":o[0],"sku":o[1],"quantity":o[2],
        "ordered_at":(today-timedelta(days=o[3])).strftime("%Y-%m-%d"),
        "order_status":"已完成","channel":"jd"}).execute()

# 库存：FULL 充足（avail=500），NEED 低（avail=10）
for i in [("SKU-FULL","北京","platform",500,0,0),("SKU-NEED","北京","platform",10,0,0)]:
    db.table("inventory").insert({"sku":i[0],"warehouse":i[1],"warehouse_type":i[2],
        "available_qty":i[3],"in_transit_qty":i[4],"safety_qty":i[5],"channel":"jd"}).execute()

# 参数：前置期 7 天 → NEED 出现正建议
for k,v in [("lead_time_days","7"),("safety_multiplier","1.5"),("turnover_warning_90","90")]:
    db.table("replenishment_config").upsert({"key":k,"value":v,"channel":"jd"})

from app.api.routes import replenishment
app = FastAPI()
app.include_router(replenishment.router)
client = TestClient(app)

def unwrap(r):
    d = r.json()
    if isinstance(d, dict) and "data" in d: return d["data"]
    return d

class TestReplenishmentSort:
    def setup_method(self):
        # 每次清空补货缓存，避免跨测试污染
        invalidate_cache(db)

    def test_traditional_need_first(self):
        """传统模式：需要补货的 SKU 必须排在最前"""
        r = client.get("/api/insights/replenishment?mode=traditional&days=28&channel=jd")
        assert r.status_code == 200
        items = unwrap(r)
        assert isinstance(items, list) and len(items) >= 2
        skus = [x["sku"] for x in items]
        # SKU-NEED 有正建议（日销 30 × 7 + 安全 45 - 10 ≈ 245）
        need = next(x for x in items if x["sku"] == "SKU-NEED")
        full = next(x for x in items if x["sku"] == "SKU-FULL")
        assert need["suggested_qty"] > 0, f"SKU-NEED 应有正建议，实际 {need['suggested_qty']}"
        assert full["suggested_qty"] == 0, f"SKU-FULL 不应有建议，实际 {full['suggested_qty']}"
        # 排序断言：NEED 必须在 FULL 前面
        assert skus.index("SKU-NEED") < skus.index("SKU-FULL"), f"排序失败: {skus}"
        # 首条必须是有建议的
        assert items[0]["suggested_qty"] > 0, f"首条应为需补货项，实际 {items[0]}"

    def test_traditional_all_zero_sorted(self):
        """全部无建议时顺序仍稳定（不崩溃）"""
        r = client.get("/api/insights/replenishment?mode=traditional&days=28&channel=other")
        assert r.status_code == 200
        items = unwrap(r)
        assert isinstance(items, list)