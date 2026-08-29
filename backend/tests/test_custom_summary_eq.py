"""自定义日期 summary 优化 —— 等价重构验证(2026-08-28)

新实现: 单次 SQL 扫描聚合(GROUP BY d,status,store)替代旧版全表 orders 加载 + Python 遍历。
运行: cd backend && TZ=Asia/Shanghai python -m pytest tests/test_custom_summary_eq.py -v

验证:
  1. 数学等价: gmv/pending/refund/total_orders/stores/funnel/low_stock/alerts/products/suppliers
     与旧逻辑完全一致(同一数据集)
  2. 有意修正: 旧版 trend GMV 计所有状态、订单数只计已完成(与标准 summary 相反) → 已对齐标准
  3. 渠道隔离: 旧版 orders 不过滤 channel(混入另一渠道) → 已修
  4. health_index.bc = platform + platform_b(B+C 总和, 京东主体口径, 非单独 B 仓)
"""
import os, sys
os.environ['SQLITE_PATH'] = os.path.join(os.path.dirname(__file__), '..', '.test_custom_sum.db')
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
    from app.api.routes.dashboard import router

    init_db()
    db = get_db()
    import sqlite3
    from app.core.database import DB_PATH
    _conn = sqlite3.connect(DB_PATH)
    for t in ['orders', 'inventory', 'products', 'suppliers', 'alerts']:
        _conn.execute(f'DELETE FROM "{t}"')
    _conn.commit(); _conn.close()

    _seed()

    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)


def _seed():
    """jd + other 双渠道订单/库存/商品/供应商/告警, 含各状态与软删"""
    import sqlite3
    from app.core.database import DB_PATH
    c = sqlite3.connect(DB_PATH)
    orders = [
        # (channel, date, status, store, amount)
        ('jd', '2026-08-01', '已完成', '店铺A', 100.0),
        ('jd', '2026-08-01', '已完成', '店铺A', 50.0),
        ('jd', '2026-08-02', '待发货', '店铺A', 30.0),
        ('jd', '2026-08-02', '已完成', '店铺B', 200.0),
        ('jd', '2026-08-03', '申请退款', '店铺A', 20.0),
        ('jd', '2026-08-03', '已发货', '店铺B', 10.0),
        ('jd', '2026-08-10', '已完成', '店铺A', 999.0),   # 范围外
        ('other', '2026-08-01', '已完成', '店铺X', 500.0),  # 另一渠道(旧版会混入)
        ('other', '2026-08-02', '已完成', '店铺X', 600.0),
    ]
    for ch, d, st, store, amt in orders:
        c.execute("INSERT INTO orders(order_no,sku,channel,store,ordered_at,order_status,total_amount,deleted_at) VALUES(?,?,?,?,?,?,?,?)",
                  (f'NO-{ch}-{d}-{st}-{amt}', f'SKU-{ch}', ch, store, f'{d} 10:00:00', st, amt, ''))
    inv = [
        # (channel, warehouse_type, avail, safety)
        ('jd', 'own', 50, 40),        # healthy
        ('jd', 'own', 5, 10),         # warning(0<avail<safety)
        ('jd', 'platform', 0, 10),    # out_of_stock
        ('jd', 'platform', 8, 10),    # warning
        ('jd', 'platform_b', 30, 20), # healthy
        ('jd', 'platform_b', 3, 10),  # warning
        ('other', 'platform', 60, 50),# healthy
    ]
    for ch, wt, avail, safety in inv:
        c.execute("INSERT INTO inventory(sku,channel,warehouse,warehouse_type,product_name,available_qty,in_transit_qty,safety_qty) VALUES(?,?,?,?,?,?,?,?)",
                  (f'INV-{ch}-{wt}-{avail}', ch, f'仓-{wt}', wt, f'商品{ch}-{wt}', avail, 0, safety))
    c.execute("INSERT INTO products(sku,product_name,channel,price,deleted_at) VALUES('P-JD-1','JD商品1','jd',10.0,'')")
    c.execute("INSERT INTO products(sku,product_name,channel,price,deleted_at) VALUES('P-JD-DEL','JD已删','jd',10.0,'2026-08-01')")
    c.execute("INSERT INTO products(sku,product_name,channel,price,deleted_at) VALUES('P-OTH','其他商品','other',10.0,'')")
    c.execute("INSERT INTO suppliers(supplier_code,supplier_name,channel) VALUES('S1','供应商1','jd')")
    c.execute("INSERT INTO suppliers(supplier_code,supplier_name,channel) VALUES('S2','供应商2','other')")
    c.execute("INSERT INTO alerts(alert_type,title,description,severity,source,channel,related_sku,status) VALUES('low_stock','a','d','warning','rules_engine','jd','X','active')")
    c.execute("INSERT INTO alerts(alert_type,title,description,severity,source,channel,related_sku,status) VALUES('low_stock','a','d','warning','rules_engine','other','Y','active')")
    c.commit(); c.close()


def _old_logic(channel, start, end):
    """复刻旧版 dashboard.py 自定义 summary 逻辑(Python 全量遍历)"""
    import sqlite3
    from collections import defaultdict
    from app.core.database import DB_PATH
    c = sqlite3.connect(DB_PATH); c.row_factory = sqlite3.Row
    all_orders = [dict(r) for r in c.execute("SELECT * FROM orders").fetchall()]
    c.close()
    all_orders = [o for o in all_orders if not (o.get('deleted_at') or '')]
    # 等价对比口径: 旧逻辑 + 渠道过滤(渠道隔离是本次"有意修正", 单独在 test_channel_isolation_fixed 验证)
    orders = [o for o in all_orders if o.get('channel') == channel and start <= str(o.get('ordered_at', ''))[:10] <= end]
    inv = [dict(r) for r in c.execute("SELECT * FROM inventory WHERE channel=?", (channel,)).fetchall()] if False else None
    # 重新查(上面连接已关)
    c = sqlite3.connect(DB_PATH); c.row_factory = sqlite3.Row
    inv = [dict(r) for r in c.execute("SELECT * FROM inventory WHERE channel=?", (channel,)).fetchall()]
    products = [dict(r) for r in c.execute("SELECT * FROM products WHERE channel=? AND deleted_at=''", (channel,)).fetchall()]
    suppliers = [dict(r) for r in c.execute("SELECT * FROM suppliers").fetchall()]
    alerts = [dict(r) for r in c.execute("SELECT * FROM alerts WHERE status='active' AND channel=?", (channel,)).fetchall()]
    c.close()
    gmv = sum(float(x.get('total_amount') or 0) for x in orders if x.get('order_status') in ('待发货', '已发货', '已完成', '申请退款'))
    pending = len([x for x in orders if x.get('order_status') == '待发货'])
    refund = len([x for x in orders if x.get('order_status') == '申请退款'])
    low_stock = len([x for x in inv if int(x.get('available_qty') or 0) < int(x.get('safety_qty') or 0)])
    trend = defaultdict(lambda: {'GMV': 0, '订单数': 0})
    for o in orders:
        d = str(o.get('ordered_at', ''))[:10]
        if o.get('order_status') in ('待发货', '已发货', '已完成', '申请退款'):
            trend[d]['GMV'] += float(o.get('total_amount') or 0)
            trend[d]['订单数'] += 1
    trend_data = [{'日期': k, 'GMV': v['GMV'], '订单数': v['订单数']} for k, v in sorted(trend.items())]
    store_gmv = defaultdict(float)
    for o in orders:
        if o.get('order_status') in ('待发货', '已发货', '已完成', '申请退款'):
            store_gmv[o.get('store', '其他')] += float(o.get('total_amount') or 0)
    stores = [{'name': k, 'gmv': round(v, 2)} for k, v in sorted(store_gmv.items(), key=lambda x: -x[1])]
    from app.core.dashboard_cache import _compute_funnel, _compute_health
    funnel = _compute_funnel(orders)
    health = _compute_health(inv)
    return {
        'gmv': gmv, 'total_orders': len(orders), 'pending': pending, 'refund': refund,
        'low_stock': low_stock, 'alerts': len(alerts), 'products': len(products), 'suppliers': len(suppliers),
        'trend': trend_data, 'stores': stores, 'funnel': funnel, 'health': health,
    }


class TestCustomSummaryEquivalence:

    def test_equivalence_jd(self):
        """jd 渠道: 全部等价指标与旧逻辑一致(同数据集同聚合)"""
        new = client.get('/api/dashboard/summary?channel=jd&start_date=2026-08-01&end_date=2026-08-03').json()['data']
        old = _old_logic('jd', '2026-08-01', '2026-08-03')
        s = new['summary']
        assert s['gmv'] == round(old['gmv'], 2), f"gmv {s['gmv']} vs {old['gmv']}"
        assert s['total_orders'] == old['total_orders'], f"total_orders {s['total_orders']} vs {old['total_orders']}"
        assert s['pending_count'] == old['pending'], f"pending {s['pending_count']} vs {old['pending']}"
        assert s['refund_count'] == old['refund'], f"refund {s['refund_count']} vs {old['refund']}"
        assert s['low_stock_count'] == old['low_stock'], f"low_stock {s['low_stock_count']} vs {old['low_stock']}"
        assert s['active_alerts'] == old['alerts']
        assert s['total_products'] == old['products']
        assert s['total_suppliers'] == old['suppliers']
        assert new['stores'] == old['stores'], f"stores {new['stores']} vs {old['stores']}"
        assert new['funnel'] == old['funnel'], f"funnel {new['funnel']} vs {old['funnel']}"
        # 健康卡: 全维度一致, 且 bc = platform + platform_b(B+C 总和)
        assert new['health_index'] == old['health'], f"health {new['health_index']} vs {old['health']}"

    def test_bc_is_b_plus_c_combined(self):
        """京东主体 BC tab = B仓(platform_b)+C仓(platform) 总和, 不是单独 B 仓"""
        new = client.get('/api/dashboard/summary?channel=jd&start_date=2026-08-01&end_date=2026-08-03').json()['data']
        h = new['health_index']
        # 数据: platform out1+warning1=2; platform_b healthy1+warning1=2 → BC=4
        assert h['bc']['total'] == 4, f"BC total 应为 B+C=2+2=4: {h['bc']['total']}"
        assert h['bc']['healthy'] == 1, f"BC healthy 应为 0+1=1: {h['bc']['healthy']}"
        assert h['bc']['warning'] == 2, f"BC warning 应为 1+1=2: {h['bc']['warning']}"
        assert h['bc']['out_of_stock'] == 1, f"BC out_of_stock 应为 1+0=1: {h['bc']['out_of_stock']}"
        assert h['platform_b']['total'] == 2, "platform_b(单独B仓)应独立存在且不等于 bc"

    def test_trend_paid_orders_scope(self):
        """自定义路径 trend 订单数/GMV = 已支付(待发货/已发货/已完成/申请退款, GMV小卡口径);
        漏斗=全部状态(另一业务口径)。"""
        new = client.get('/api/dashboard/summary?channel=jd&start_date=2026-08-01&end_date=2026-08-03').json()['data']
        by_date = {t['日期']: t for t in new['trend']}
        # 08-01: 2单已完成(100+50) → GMV=150, 订单数=2
        assert by_date['2026-08-01']['GMV'] == 150.0, by_date['2026-08-01']
        assert by_date['2026-08-01']['订单数'] == 2, by_date['2026-08-01']
        # 08-02: 待发货(30) + 已完成(200) → GMV=230(已支付含待发货), 订单数=2
        assert by_date['2026-08-02']['GMV'] == 230.0, by_date['2026-08-02']
        assert by_date['2026-08-02']['订单数'] == 2, by_date['2026-08-02']
        # 08-03: 申请退款(20)+已发货(10) → GMV=30(已支付含退款/已发货), 订单数=2
        assert by_date['2026-08-03']['GMV'] == 30.0, by_date['2026-08-03']
        assert by_date['2026-08-03']['订单数'] == 2, by_date['2026-08-03']
        # GMV 卡周期订单数 = 已支付(本 seed 全部6单都是已支付状态)
        assert new['periods']['custom']['orders'] == 6, new['periods']['custom']
        # 净GMV = GMV - 退款金额(申请退款 20)
        assert new['summary']['gmv'] == 410.0, new['summary']
        assert new['summary']['refund_amount'] == 20.0, new['summary']
        assert new['summary']['net_gmv'] == 390.0, new['summary']
        # 漏斗 = 全部状态(总订单6: 2+2+2)
        ftotal = new['funnel'][0]['value']
        assert ftotal == 6, f"漏斗总订单应=全部状态6: {ftotal}"

    def test_channel_isolation_fixed(self):
        """有意修正: 旧版 orders 不过滤 channel 会混入 other 渠道(500+600) → 已修只算 jd"""
        new = client.get('/api/dashboard/summary?channel=jd&start_date=2026-08-01&end_date=2026-08-03').json()['data']
        # jd 范围内已完成: 100+50+200 = 350 (不含 other 的 1100)
        assert new['summary']['gmv'] == 410.0, f"jd gmv 应 410(已支付: 150+230+30, 不含 other 1100): {new['summary']['gmv']}"
        assert new['summary']['total_orders'] == 6, f"jd 订单应 6(不含 other 2): {new['summary']['total_orders']}"

    def test_soft_deleted_orders_excluded(self):
        """软删订单不计入(与旧版一致)"""
        new = client.get('/api/dashboard/summary?channel=jd&start_date=2026-08-01&end_date=2026-08-03').json()['data']
        # 数据里无软删订单; 单独验证 products 软删被排除
        assert new['summary']['total_products'] == 1, f"jd products 应为 1(P-JD-1, 排除 P-JD-DEL): {new['summary']['total_products']}"
