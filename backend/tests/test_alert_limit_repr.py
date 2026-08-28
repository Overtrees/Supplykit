"""告警列表健壮性测试 —— 对应 2026-08-28 18:35 低库存卡空白问题

运行: cd backend && TZ=Asia/Shanghai python -m pytest tests/test_alert_limit_repr.py -v

覆盖(2026-08-28 治本修复后全部应为绿色):
  A. 分组配额: 补货告警 3000 条挤不空低库存卡(原 18:35 报障)
  B. 镜像: 非 replenish 1100 条挤不空补货卡
  C. alert_counts 精确计数(严重数/类型数, 不取自截断列表)
  D. 缓存 key 含 limit + 数据版本号
  E. _seed_rules 跨渠道 SQL 隔离
  F. _seed_rules 去重字典含 channel+source(不抑制其他渠道同 SKU 告警)
  G. _seed_rules 关闭陈旧告警(补货后历史 low_stock 不再 active)
"""
import os, sys
import pytest
os.environ['SQLITE_PATH'] = os.path.join(os.path.dirname(__file__), '..', '.test_alert_repr.db')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

client = None
db = None
DB_PATH = None


def setup_module():
    global client, db, DB_PATH
    for _m in list(sys.modules):
        if _m.startswith('app.'):
            sys.modules.pop(_m, None)

    import sqlite3
    from fastapi.testclient import TestClient
    from fastapi import FastAPI
    from app.core.database import DB_PATH as _DB_PATH, init_db, get_db
    from app.api.routes.alerts import router

    DB_PATH = _DB_PATH
    init_db()
    db = get_db()
    _conn = sqlite3.connect(DB_PATH)
    for t in ['alerts', 'replenishment_config']:
        try:
            _conn.execute(f'DELETE FROM "{t}"')
        except Exception:
            pass
    _conn.commit()
    _conn.close()

    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)


_ver_seq = [0]


def _reset_versions():
    """每个用例重置双版本号，避免跨用例缓存命中"""
    from app.core.database import get_conn
    _ver_seq[0] += 1
    c = get_conn()
    for k in ['_rules_version', '_replen_version']:
        c.execute("INSERT OR REPLACE INTO replenishment_config(key,value,channel,updated_at) VALUES(?,?,?,?)",
                  (k, str(_ver_seq[0]), 'jd', '2026-08-28 00:00:00'))
    c.commit()
    c.close()


def _clear_cache():
    from app.api.routes.alerts import _alerts_cache
    _alerts_cache.clear()


def _wipe_alerts():
    from app.core.database import get_conn
    c = get_conn()
    c.execute("DELETE FROM alerts")
    c.commit()
    c.close()


def _insert_batch(alert_type, source, severity, count, start_id, product="商品"):
    """批量插入告警，id 从 start_id 递增（模拟 id DESC 的时间先后）"""
    from app.core.database import get_conn
    c = get_conn()
    for i in range(count):
        c.execute(
            "INSERT INTO alerts(id,alert_type,title,description,severity,source,channel,related_sku,status) "
            "VALUES(?,?,?,?,?,?,?,?,?)",
            (start_id + i, alert_type, f"{product}{start_id + i}", "desc", severity, source, "jd", f"SKU-{start_id + i}", "active"))
    c.commit()
    c.close()


def _split(rows):
    return [a for a in rows if a['alert_type'] != 'replenish'], [a for a in rows if a['alert_type'] == 'replenish']


class TestAlertLimitRepresentation:

    def test_A_lowstock_and_replenish_both_visible(self):
        """场景A（18:35 报障）: 补货告警 3000 条且 id 更大(更新) + 低库存 209 条 id 较小(更早)
        分组配额下 低库存卡/补货卡都必须有数据, 不再被某一类挤空"""
        _wipe_alerts(); _clear_cache(); _reset_versions()
        _insert_batch('low_stock', 'rules_engine', 'warning', 209, 1000)        # 更早生成
        _insert_batch('replenish', 'replenishment_engine', 'warning', 3000, 2000)  # 更晚生成, id 全大
        rows = client.get('/api/alerts?channel=jd&limit=200').json()['data']
        ls, rp = _split(rows)
        assert len(ls) == 200, f"低库存组应满额 200 条(分组配额): {len(ls)}"
        assert len(rp) == 200, f"补货组应满额 200 条(分组配额): {len(rp)}"
        assert len(rows) == 400, f"分组配额总计应 400(200×2): {len(rows)}"

    def test_B_lowstock_flood_does_not_kill_replenish(self):
        """场景B（镜像）: 非 replenish 告警 1100 条 + 补货 100 条 —— 补货卡必须仍有数据"""
        _wipe_alerts(); _clear_cache(); _reset_versions()
        _insert_batch('low_stock', 'rules_engine', 'warning', 900, 1000)
        _insert_batch('slow_moving', 'rules_engine', 'warning', 200, 2000)
        _insert_batch('replenish', 'replenishment_engine', 'warning', 100, 3000)
        rows = client.get('/api/alerts?channel=jd&limit=200').json()['data']
        ls, rp = _split(rows)
        assert len(rp) == 100, f"补货组应取满 100 条(配额内全量): {len(rp)}"
        assert len(ls) == 400, f"非补货(低库存200+滞销200)应 400 条: {len(ls)}"

    def test_C_severity_count_exact_from_counts(self):
        """场景C: 看板「(N 严重)」必须用后端 alert_counts(独立 COUNT) ——
        severity=error 500 条(补货类) 全量计数, 不能从截断列表 filter"""
        _wipe_alerts(); _clear_cache(); _reset_versions()
        _insert_batch('low_stock', 'rules_engine', 'warning', 300, 1000)
        _insert_batch('replenish', 'replenishment_engine', 'error', 500, 2000)
        from app.api.routes.alerts import alert_counts
        from app.core.database import get_conn
        c = get_conn()
        cnt = alert_counts(c, 'jd')
        c.close()
        assert cnt['by_severity']['error'] == 500, f"严重数应精确 500: {cnt['by_severity']}"
        assert cnt['by_type']['replenish'] == 500
        assert cnt['total'] == 800
        assert cnt['non_replenish'] == 300

    def test_D_cache_key_includes_limit(self):
        """场景D: 缓存 key 含 limit → limit=50 与 limit=200 不共用缓存
        数据: 300 low_stock + 100 replenish
        limit=50 → 50低库存 + 50补货 = 100 条
        limit=200 → 200低库存 + 100补货 = 300 条"""
        _wipe_alerts(); _clear_cache(); _reset_versions()
        _insert_batch('low_stock', 'rules_engine', 'warning', 300, 1000)
        _insert_batch('replenish', 'replenishment_engine', 'warning', 100, 2000)
        r50 = client.get('/api/alerts?channel=jd&limit=50').json()['data']
        r200 = client.get('/api/alerts?channel=jd&limit=200').json()['data']
        assert len(r50) == 100, f"limit=50 应 100 条(50低库存+50补货): {len(r50)}"
        assert len(r200) == 300, (
            f"limit=200 应 300 条(200低库存+100补货) —— 若命中 limit=50 缓存则只有 100 条: {len(r200)}")

    def test_E_seed_rules_channel_isolation(self):
        """场景E: _seed_rules 跨渠道隔离 —— jd/other 同 SKU 库存相加不应掩盖单渠道低库存
        jd 单渠道 avail < safety 但 jd+other 汇总后 >= safety: 必须各渠道独立产出告警"""
        # inventory 有 UNIQUE(sku,warehouse,channel)，须同时清 inventory 保证幂等
        _wipe_alerts()
        from app.core.database import get_conn
        _c = get_conn(); _c.execute("DELETE FROM inventory"); _c.commit(); _c.close()
        _clear_cache(); _reset_versions()
        from app.core.database import get_conn
        c = get_conn()
        # jd: 可用 3 < 安全线 10 → 应产生 jd low_stock
        c.execute("INSERT INTO inventory(channel,warehouse_type,warehouse,sku,product_name,available_qty,in_transit_qty,safety_qty) VALUES(?,?,?,?,?,?,?,?)",
                  ('jd', 'platform', '京东B仓', 'SKU-X', '商品X', 3, 0, 10))
        # other: 同 SKU 可用 100, 若跨渠道汇总 103 >= 10 则 jd 的低库存会被掩盖
        c.execute("INSERT INTO inventory(channel,warehouse_type,warehouse,sku,product_name,available_qty,in_transit_qty,safety_qty) VALUES(?,?,?,?,?,?,?,?)",
                  ('other', 'platform', '其他平台仓', 'SKU-X', '商品X', 100, 0, 10))
        c.commit(); c.close()
        from app.api.routes.seed import _seed_rules
        _seed_rules(db, {'jd': [], 'other': []})
        from app.core.database import get_conn as gc
        c2 = gc()
        rows = c2.execute("SELECT channel, alert_type, related_sku FROM alerts WHERE related_sku='SKU-X' AND status='active'").fetchall()
        c2.close()
        chs = {r[0] for r in rows}
        assert 'jd' in chs, (f"jd 渠道低库存告警未生成(跨渠道汇总掩盖 bug 复现): {[tuple(r) for r in rows]}")


class TestSeedRulesCrossChannel:

    def _wipe(self):
        from app.core.database import get_conn
        c = get_conn()
        c.execute("DELETE FROM alerts")
        c.execute("DELETE FROM inventory")
        c.commit()
        c.close()
        _clear_cache()
        _reset_versions()

    def test_F_dedup_dict_not_channel_scoped(self):
        """场景F: _seed_rules 跨渠道修复残留 bug —— existing 去重字典的 key 是
        (alert_type, related_sku)，不含 channel（且不含 source）。
        真实业务里 other 渠道已有该 SKU 的 active 告警(由 rules.py:evaluate 实时事件产生)，
        再跑 _seed_rules / rebuild_rules 时 jd 的同 SKU 告警被抑制 → jd 低库存漏报"""
        self._wipe()
        from app.core.database import get_conn
        c = get_conn()
        c.execute("INSERT INTO inventory(channel,warehouse_type,warehouse,sku,product_name,available_qty,in_transit_qty,safety_qty) VALUES(?,?,?,?,?,?,?,?)",
                  ('jd', 'platform', '京东B仓', 'SKU-Y', '商品Y', 3, 0, 10))
        c.execute("INSERT INTO inventory(channel,warehouse_type,warehouse,sku,product_name,available_qty,in_transit_qty,safety_qty) VALUES(?,?,?,?,?,?,?,?)",
                  ('other', 'platform', '其他平台仓', 'SKU-Y', '商品Y', 2, 0, 10))
        # other 渠道已有 active 告警（实时事件路径 rules.py:evaluate 的产物）
        c.execute("INSERT INTO alerts(id,alert_type,title,description,severity,source,channel,related_sku,status) VALUES(?,?,?,?,?,?,?,?,?)",
                  (800, 'low_stock', '低库存预警: 商品Y', '可用 2 < 安全线 10', 'warning', 'rules_engine', 'other', 'SKU-Y', 'active'))
        c.commit(); c.close()
        from app.api.routes.seed import _seed_rules
        _seed_rules(db, {'jd': [], 'other': []})
        from app.core.database import get_conn as gc
        c2 = gc()
        pairs = {(r[1], r[0]) for r in c2.execute(
            "SELECT channel, alert_type FROM alerts WHERE related_sku='SKU-Y' AND status='active'")}
        c2.close()
        missing = {('low_stock', ch) for ch in ('jd', 'other')} - pairs
        assert not missing, (
            f"去重字典 key=(alert_type,sku) 不含 channel → other 已有 low_stock 时 jd 的同类型被抑制，"
            f"漏报 {sorted(missing)}；现有组合 {sorted(pairs)}。"
            f"jd 与 other 是两个独立运营主体，同 SKU 低库存必须各出告警。"
            f"对照 rules.py:_alert_dedup_key 含 channel+source，此处口径不一致")

    def test_G_stale_alerts_never_closed(self):
        """场景G: _seed_rules 只跳过已存在告警，从不关闭陈旧告警。
        SKU 已补货到安全线以上，历史 low_stock 告警仍保持 active → 数据联动失真"""
        self._wipe()
        from app.core.database import get_conn
        c = get_conn()
        # 已补货充足: avail 50 >> safety 10，但历史 low_stock 告警仍 active
        c.execute("INSERT INTO inventory(channel,warehouse_type,warehouse,sku,product_name,available_qty,in_transit_qty,safety_qty) VALUES(?,?,?,?,?,?,?,?)",
                  ('jd', 'platform', '京东B仓', 'SKU-Z', '商品Z', 50, 0, 10))
        c.execute("INSERT INTO alerts(id,alert_type,title,description,severity,source,channel,related_sku,status) VALUES(?,?,?,?,?,?,?,?,?)",
                  (900, 'low_stock', '低库存预警: 商品Z', '可用 2 < 安全线 10', 'warning', 'rules_engine', 'jd', 'SKU-Z', 'active'))
        c.commit(); c.close()
        from app.api.routes.seed import _seed_rules
        _seed_rules(db, {'jd': [], 'other': []})
        from app.core.database import get_conn as gc
        c2 = gc()
        stale = c2.execute("SELECT status FROM alerts WHERE related_sku='SKU-Z'").fetchone()[0]
        c2.close()
        assert stale == 'closed' or stale == 'inactive', (
            f"_seed_rules/rebuild_rules 不关闭陈旧告警: SKU-Z 可用 50 >> 安全线 10 仍 active={stale} "
            "→ 看板低库存卡显示已补货的 SKU, 真实数据联动失真（对照 replenishment.py:379 有 UPDATE closed 逻辑）")
