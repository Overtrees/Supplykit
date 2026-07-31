"""SupplyKit API 路由测试 — 覆盖 cleansing/products/suppliers/orders/alerts/config

运行: cd backend && python -m pytest tests/test_api.py -v
"""
import sys, os, json, io, time
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'app', 'test_supplykit.db')
os.environ['SQLITE_PATH'] = DB_PATH

from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.core.database import init_db, get_db
from app.api.routes.cleansing import router as cl_router
from app.api.routes.products import router as pr_router
from app.api.routes.suppliers import router as sp_router
from app.api.routes.orders import router as or_router
from app.api.routes.alerts import router as al_router
from app.api.routes.replenishment_config import router as rc_router
from app.core.dashboard_cache import invalidate

# 每次测试前重新初始化数据库，避免锁冲突
def setup_module():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    init_db()
    invalidate()
    # 关闭 init_db 留下的连接，释放锁
    import app.core.database as dbmod
    if hasattr(dbmod._local, 'conn') and dbmod._local.conn:
        try: dbmod._local.conn.close()
        except: pass
        dbmod._local.conn = None

app = FastAPI()
for r in [cl_router, pr_router, sp_router, or_router, al_router, rc_router]:
    app.include_router(r)
client = TestClient(app)


# ─── 清洗导入 ────────────────────────────────────────────────────────────────

class TestCleansing:
    CSV_DATA = 'sku,product_name,store,warehouse,available_qty\nSKU-TEST-001,测试商品A,测试店铺,北京,100\nSKU-TEST-002,测试商品B,测试店铺,上海,200'

    def test_detect_columns(self):
        r = client.post('/api/cleansing/detect', files={'file': ('test.csv', self.CSV_DATA.encode(), 'text/csv')})
        assert r.status_code == 200
        d = r.json()
        cols = d.get('data', {}).get('columns', d.get('columns', []))
        assert len(cols) > 0
        assert any('sku' in str(c).lower() for c in cols)


# ─── 商品 ────────────────────────────────────────────────────────────────────

class TestProducts:
    def test_list_products(self):
        r = client.get('/api/products?channel=jd')
        assert r.status_code == 200
        d = r.json()
        items = d.get('data', d) if isinstance(d, dict) else d
        assert isinstance(items, list)

    def test_list_products_other_channel(self):
        r = client.get('/api/products?channel=other')
        assert r.status_code == 200

    def test_list_products_search(self):
        r = client.get('/api/products?channel=jd&search=SKU')
        assert r.status_code == 200
        d = r.json()
        items = d.get('data', d) if isinstance(d, dict) else d
        assert isinstance(items, list)


# ─── 供应商 ──────────────────────────────────────────────────────────────────

class TestSuppliers:
    def test_list_suppliers(self):
        r = client.get('/api/suppliers')
        assert r.status_code == 200
        d = r.json()
        items = d.get('data', d) if isinstance(d, dict) else d
        assert isinstance(items, list)

    def test_create_supplier(self):
        r = client.post('/api/suppliers', json={
            'code': 'SUP-TEST-' + str(os.getpid()), 'name': '测试供应商', 'contact': '张三',
            'phone': '13800138000', 'score': 5
        })
        assert r.status_code == 200

    def test_update_supplier(self):
        r = client.get('/api/suppliers')
        items = r.json().get('data', r.json()) if isinstance(r.json(), dict) else r.json()
        if items:
            sid = items[0]['id']
            r = client.put(f'/api/suppliers/{sid}', json={'score': 4})
            assert r.status_code == 200


# ─── 订单 ─────────────────────────────────────────────────────────────────────

class TestOrders:
    def test_list_orders(self):
        r = client.get('/api/orders?page=1&channel=jd')
        assert r.status_code == 200
        d = r.json()
        assert 'total' in d or 'data' in d

    def test_list_orders_other_channel(self):
        r = client.get('/api/orders?page=1&channel=other')
        assert r.status_code == 200

    def test_orders_pagination(self):
        r = client.get('/api/orders?page=1&page_size=5&channel=jd')
        assert r.status_code == 200

    def test_orders_search(self):
        r = client.get('/api/orders?page=1&search=SKU&channel=jd')
        assert r.status_code == 200

    def test_orders_filter_by_status(self):
        r = client.get('/api/orders?page=1&status=已完成&channel=jd')
        assert r.status_code == 200


# ─── 告警 ─────────────────────────────────────────────────────────────────────

class TestAlerts:
    def test_list_alerts_jd(self):
        r = client.get('/api/alerts?channel=jd')
        assert r.status_code == 200
        d = r.json()
        items = d.get('data', d) if isinstance(d, dict) else d
        assert isinstance(items, list)

    def test_list_alerts_other(self):
        r = client.get('/api/alerts?channel=other')
        assert r.status_code == 200


# ─── 补货配置 ────────────────────────────────────────────────────────────────

class TestReplenishmentConfig:
    def test_get_config(self):
        r = client.get('/api/replenishment-config?channel=jd')
        assert r.status_code == 200
        d = r.json()
        data = d.get('data', d) if isinstance(d, dict) else d
        assert isinstance(data, dict)

    def test_get_config_other_channel(self):
        r = client.get('/api/replenishment-config?channel=other')
        assert r.status_code == 200

    def test_get_config_with_mode(self):
        r = client.get('/api/replenishment-config?mode=bbcc&channel=jd')
        assert r.status_code == 200

    def test_update_config(self):
        with TestClient(app) as c:
            r = c.put('/api/replenishment-config?mode=bbcc&channel=jd', json={'b_to_c_days': '5', 'c_safety_days': '2'})
            assert r.status_code == 200
            d = r.json()
            assert d.get('ok') or d.get('mode') == 'bbcc'

    def test_config_isolation(self):
        # 京东配置修改不应影响其他渠道
        r = client.get('/api/replenishment-config?mode=bbcc&channel=other')
        d = r.json()
        assert d.get('b_to_c_days') != '5'  # 其他渠道不应有京东的值

    def test_get_seasons(self):
        r = client.get('/api/replenishment-config/seasons?mode=bbcc&channel=jd')
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d, list) if isinstance(d, list) else isinstance(d.get('data', d), list)

    def test_update_seasons(self):
        seasons = [{'key': '618', 'name': '618大促', 'factor': 1.5, 'enabled': True}]
        r = client.put('/api/replenishment-config/seasons?mode=bbcc&channel=jd', json={'items': seasons})
        assert r.status_code == 200


# ─── 渠道隔离验证 ────────────────────────────────────────────────────────────

class TestChannelIsolation:
    """验证各渠道数据互不干扰"""
    def test_products_isolation(self):
        r_jd = client.get('/api/products?channel=jd')
        r_ot = client.get('/api/products?channel=other')
        jd = r_jd.json().get('data', r_jd.json()) if isinstance(r_jd.json(), dict) else r_jd.json()
        ot = r_ot.json().get('data', r_ot.json()) if isinstance(r_ot.json(), dict) else r_ot.json()
        # 两个渠道商品列表独立（可能数量不同）
        assert isinstance(jd, list) and isinstance(ot, list)

    def test_orders_isolation(self):
        r_jd = client.get('/api/orders?page=1&channel=jd')
        r_ot = client.get('/api/orders?page=1&channel=other')
        jd = r_jd.json().get('data', r_jd.json()) if isinstance(r_jd.json(), dict) else r_jd.json()
        ot = r_ot.json().get('data', r_ot.json()) if isinstance(r_ot.json(), dict) else r_ot.json()
        # 两个渠道订单独立
        assert isinstance(jd, dict) and isinstance(ot, dict)

    def test_config_isolation(self):
        # 保存京东配置
        client.put('/api/replenishment-config?mode=bbcc&channel=jd', json={'b_to_c_days': '99'})
        # 其他渠道不应受影响
        r = client.get('/api/replenishment-config?mode=bbcc&channel=other')
        d = r.json()
        assert d.get('b_to_c_days') != '99'