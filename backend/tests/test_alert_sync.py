"""告警与规则停用联动测试 — 覆盖历史遗留告警(related_rule_id=0)整类关闭 + 补货引擎告警不误伤

运行: cd backend && TZ=Asia/Shanghai python -m pytest tests/test_alert_sync.py -v
"""
import os, sys
os.environ['SQLITE_PATH'] = os.path.join(os.path.dirname(__file__), '..', '.test_alert_sync.db')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

client = None
db = None
DB_PATH = None


def setup_module():
    global client, db, DB_PATH
    # 强制重载 app 模块（DB_PATH 在 import 时固化，必须按本文件路径重新导入）
    for _m in list(sys.modules):
        if _m.startswith('app.'):
            sys.modules.pop(_m, None)

    import sqlite3
    from fastapi.testclient import TestClient
    from fastapi import FastAPI
    from app.core.database import DB_PATH as _DB_PATH, init_db, get_db
    from app.api.routes.rules import router

    DB_PATH = _DB_PATH
    init_db()
    db = get_db()
    # 清空测试表
    _conn = sqlite3.connect(DB_PATH)
    for t in ['rules', 'alerts']:
        try: _conn.execute(f'DELETE FROM "{t}"')
        except Exception: pass
    _conn.commit(); _conn.close()

    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)


class TestAlertRuleSync:
    def _seed(self):
        """构造：低库存规则(active) + 历史遗留告警(related_rule_id=0) + 补货引擎告警"""
        db.table("rules").insert({
            "id": 501, "name": "低库存预警", "event": "inventory.changed",
            "condition_json": "{}", "alert_type": "low_stock",
            "alert_title": "低库存", "alert_desc": "desc", "severity": "warning",
            "is_active": 1, "channel": "jd"
        }).execute()
        db.table("alerts").insert({
            "alert_type": "low_stock", "title": "历史遗留低库存", "description": "旧数据",
            "severity": "warning", "status": "active", "source": "rules_engine",
            "related_sku": "SKU-A", "related_rule_id": 0, "channel": "jd"
        }).execute()
        db.table("alerts").insert({
            "alert_type": "b_storage_warn", "title": "B仓超期", "description": "补货引擎",
            "severity": "warning", "status": "active", "source": "replenishment_engine",
            "related_sku": "SKU-B", "related_rule_id": 0, "channel": "jd"
        }).execute()

    def _active(self, alert_type=None):
        q = db.table("alerts").select("*").eq("status", "active")
        if alert_type:
            q = q.eq("alert_type", alert_type)
        return q.execute().data

    def test_disable_rule_closes_legacy_alerts(self):
        """停用规则 → 同类型历史遗留告警(related_rule_id=0)整类关闭"""
        self._seed()
        r = client.post('/api/rules/batch', json={"action": "inactive", "ids": [501]})
        assert r.status_code == 200
        active = self._active()
        types = [(a['alert_type'], a['source']) for a in active]
        # 低库存告警已关闭
        assert ('low_stock', 'rules_engine') not in types, f"low_stock 应关闭: {types}"
        # 补货引擎告警保留
        assert ('b_storage_warn', 'replenishment_engine') in types, f"补货引擎告警不应误伤: {types}"

    def test_enable_rule_restores_alerts(self):
        """恢复规则 → 该类型 rules_engine 告警恢复 active"""
        r = client.post('/api/rules/batch', json={"action": "active", "ids": [501]})
        assert r.status_code == 200
        active = self._active('low_stock')
        assert len(active) == 1, f"low_stock 应恢复 1 条: {len(active)}"
        assert active[0]['source'] == 'rules_engine'

    def test_delete_rule_closes_legacy_alerts(self):
        """删除规则 → 同类型告警关闭（含历史遗留）"""
        r = client.delete('/api/rules/501')
        assert r.status_code == 200
        active = self._active()
        assert not any(a['alert_type'] == 'low_stock' for a in active), f"删除规则后 low_stock 应全关: {[a['alert_type'] for a in active]}"
        assert any(a['source'] == 'replenishment_engine' for a in active), "补货引擎告警应保留"

    def test_deleted_rule_hidden_from_list(self):
        """删除规则后：正常列表不再显示（修复：提示成功但页面残留）"""
        # 再建一条规则并删除
        db.table("rules").insert({
            "id": 502, "name": "临时规则", "event": "inventory.changed",
            "condition_json": "{}", "alert_type": "low_stock",
            "alert_title": "t", "alert_desc": "d", "severity": "warning",
            "is_active": 1, "channel": "jd"
        }).execute()
        r = client.delete('/api/rules/502')
        assert r.status_code == 200
        live = client.get('/api/rules?channel=jd').json()['data']
        assert not any(x['id'] == 502 for x in live), f"已删规则 502 不应在列表: {[x['id'] for x in live]}"
        # 回收站视角：include_deleted=1 应包含 502
        deleted = client.get('/api/rules?channel=all&include_deleted=1').json()['data']
        assert any(x['id'] == 502 for x in deleted), "回收站应能看到已删规则 502"
        # 停用（未删除）的规则仍显示在正常列表
        db.table("rules").insert({
            "id": 503, "name": "停用规则", "event": "inventory.changed",
            "condition_json": "{}", "alert_type": "low_stock",
            "alert_title": "t", "alert_desc": "d", "severity": "warning",
            "is_active": 0, "channel": "jd"
        }).execute()
        # 清除 30s 列表缓存（前序请求已缓存 rules_jd_live）
        from app.api.routes.rules import _rules_cache
        _rules_cache.clear()
        live = client.get('/api/rules?channel=jd').json()['data']
        assert any(x['id'] == 503 for x in live), "停用规则应保留在列表"

    def test_orphan_cleanup_skip_replenish(self):
        """孤儿清理：无 active 规则的类型才清，replenishment_engine 不受影响"""
        # 构造孤儿：orphan_test 类型无任何规则 + active 告警
        db.table("alerts").insert({
            "alert_type": "orphan_test", "title": "孤儿告警", "description": "无规则对应",
            "severity": "warning", "status": "active", "source": "rules_engine",
            "related_sku": "SKU-C", "related_rule_id": 0, "channel": "jd"
        }).execute()
        from app.core.scheduler import _cleanup_orphan_alerts
        cleared = _cleanup_orphan_alerts(db)
        active = self._active()
        assert not any(a['alert_type'] == 'orphan_test' for a in active), "孤儿 orphan_test 应被清理"
        assert any(a['source'] == 'replenishment_engine' for a in active), "b_storage_warn 应保留"
        assert cleared >= 1