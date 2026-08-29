"""批量操作主体隔离测试(2026-08-29)

场景: 规则/商品 id 全局唯一, 若前端勾选态跨渠道残留(切渠道未清空)或请求伪造,
批量操作可能误伤另一渠道数据。后端批量端点必须按 channel 过滤(双保险)。

运行: cd backend && TZ=Asia/Shanghai python -m pytest tests/test_batch_channel_iso.py -v
"""
import os, sys
os.environ['SQLITE_PATH'] = os.path.join(os.path.dirname(__file__), '..', '.test_batch_iso.db')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

client = None
db = None


def setup_module():
    global client, db
    for _m in list(sys.modules):
        if _m.startswith('app.'):
            sys.modules.pop(_m, None)

    from fastapi.testclient import TestClient
    from fastapi import FastAPI
    from app.core.database import init_db, get_db
    from app.api.routes.rules import router as rules_router
    from app.api.routes.products import router as products_router

    init_db()
    db = get_db()
    import sqlite3
    from app.core.database import DB_PATH
    _conn = sqlite3.connect(DB_PATH)
    for t in ['rules', 'products', 'alerts']:
        _conn.execute(f'DELETE FROM "{t}"')
    _conn.commit(); _conn.close()

    _seed()

    app = FastAPI()
    app.include_router(rules_router)
    app.include_router(products_router)
    client = TestClient(app)


def _seed():
    import sqlite3
    from app.core.database import DB_PATH
    c = sqlite3.connect(DB_PATH)
    # 规则: jd 一条、other 一条
    c.execute("INSERT INTO rules(id,name,event,condition_json,alert_type,alert_title,alert_desc,severity,is_active,channel) VALUES(1,'jd规则','inventory.changed','{}','low_stock','t','d','warning',1,'jd')")
    c.execute("INSERT INTO rules(id,name,event,condition_json,alert_type,alert_title,alert_desc,severity,is_active,channel) VALUES(2,'other规则','inventory.changed','{}','low_stock','t','d','warning',1,'other')")
    # 商品: jd 一条、other 一条
    c.execute("INSERT INTO products(id,sku,product_name,channel,price,status,deleted_at) VALUES(11,'SKU-JD','jd商品','jd',1.0,'active','')")
    c.execute("INSERT INTO products(id,sku,product_name,channel,price,status,deleted_at) VALUES(12,'SKU-OTH','other商品','other',1.0,'active','')")
    c.commit(); c.close()


def _rule(id):
    import sqlite3
    from app.core.database import DB_PATH
    c = sqlite3.connect(DB_PATH)
    r = c.execute("SELECT is_active FROM rules WHERE id=?", (id,)).fetchone()
    c.close()
    return r[0] if r else None


def _prod(id):
    import sqlite3
    from app.core.database import DB_PATH
    c = sqlite3.connect(DB_PATH)
    r = c.execute("SELECT status FROM products WHERE id=?", (id,)).fetchone()
    c.close()
    return r[0] if r else None


class TestBatchChannelIsolation:

    def test_rules_wrong_channel_ignored(self):
        """从 other 渠道批量停用 jd 规则(id=1, 全局id但属于jd) → 不得生效"""
        r = client.post('/api/rules/batch?channel=other', json={"action": "inactive", "ids": [1]})
        assert r.status_code == 200
        assert _rule(1) == 1, f"jd 规则不应被 other 渠道批量操作命中: is_active={_rule(1)}"

    def test_rules_right_channel_works(self):
        """从 jd 渠道批量停用 jd 规则 → 生效"""
        r = client.post('/api/rules/batch?channel=jd', json={"action": "inactive", "ids": [1]})
        assert r.status_code == 200
        assert _rule(1) == 0, f"jd 规则应从 jd 渠道批量停用: is_active={_rule(1)}"
        # 其他渠道规则不受影响
        assert _rule(2) == 1

    def test_rules_sync_alerts_channel_scoped(self):
        """批量停用联动告警也按渠道: 停用 jd 规则只关 jd 告警, other 告警保留"""
        import sqlite3
        from app.core.database import DB_PATH
        c = sqlite3.connect(DB_PATH)
        c.execute("INSERT INTO alerts(alert_type,title,description,severity,source,channel,related_sku,status) VALUES('low_stock','jd告警','d','warning','rules_engine','jd','X','active')")
        c.execute("INSERT INTO alerts(alert_type,title,description,severity,source,channel,related_sku,status) VALUES('low_stock','other告警','d','warning','rules_engine','other','X','active')")
        c.commit(); c.close()
        # jd 规则当前已停用(上个用例), 恢复它再停用触发联动
        client.post('/api/rules/batch?channel=jd', json={"action": "active", "ids": [1]})
        client.post('/api/rules/batch?channel=jd', json={"action": "inactive", "ids": [1]})
        c = sqlite3.connect(DB_PATH)
        jd = c.execute("SELECT status FROM alerts WHERE channel='jd' AND related_sku='X'").fetchone()[0]
        oh = c.execute("SELECT status FROM alerts WHERE channel='other' AND related_sku='X'").fetchone()[0]
        c.close()
        assert jd in ('inactive', 'closed'), f"jd 告警应被关闭: {jd}"
        assert oh == 'active', f"other 告警不应被 jd 批量操作联动关闭: {oh}"

    def test_products_wrong_channel_ignored(self):
        """从 other 渠道批量停用 jd 商品(id=11) → 不得生效"""
        r = client.post('/api/products/batch?channel=other', json={"action": "inactive", "ids": [11]})
        assert r.status_code == 200
        assert _prod(11) == 'active', f"jd 商品不应被 other 渠道批量操作命中: {_prod(11)}"

    def test_products_right_channel_works(self):
        """从 jd 渠道批量停用 jd 商品 → 生效; other 商品不受影响"""
        r = client.post('/api/products/batch?channel=jd', json={"action": "inactive", "ids": [11]})
        assert r.status_code == 200
        assert _prod(11) == 'inactive'
        assert _prod(12) == 'active', "other 商品不应被 jd 批量操作影响"

    def test_no_channel_means_global(self):
        """channel 为空/未传(回收站 purge 等) → 不限制(全局语义)"""
        r = client.post('/api/rules/batch', json={"action": "active", "ids": [1, 2]})
        assert r.status_code == 200
        assert _rule(1) == 1 and _rule(2) == 1