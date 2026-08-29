"""周期聚合口径测试(2026-08-29)

GMV 小卡口径: 只统计已完成维度(订单数/GMV 都是已完成)
订单阶段分布(漏斗): 统计全部状态
两卡是不同业务口径, periods(供 GMV 卡)必须只含已完成。

运行: cd backend && TZ=Asia/Shanghai python -m pytest tests/test_period_orders_scope.py -v
"""
import os, sys
os.environ['SQLITE_PATH'] = os.path.join(os.path.dirname(__file__), '..', '.test_period_scope.db')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


def setup_module():
    for _m in list(sys.modules):
        if _m.startswith('app.'):
            sys.modules.pop(_m, None)
    from app.core.database import init_db, DB_PATH
    import sqlite3
    init_db()
    c = sqlite3.connect(DB_PATH)
    for t in ['orders']:
        c.execute(f'DELETE FROM "{t}"')
    # 同一天内混合状态: 已完成2单(100+50) + 待发货1单(30) + 申请退款1单(20)
    base = '2026-08-20'
    orders = [
        ('A', base + ' 10:00:00', '已完成', 100.0),
        ('B', base + ' 11:00:00', '已完成', 50.0),
        ('C', base + ' 12:00:00', '待发货', 30.0),
        ('D', base + ' 13:00:00', '申请退款', 20.0),
        ('E', '2026-08-21 10:00:00', '已完成', 200.0),
    ]
    for no, dt, st, amt in orders:
        c.execute("INSERT INTO orders(order_no,sku,channel,store,ordered_at,order_status,total_amount,deleted_at) VALUES(?,?,?,?,?,?,?,?)",
                  (no, 'SKU', 'jd', '店', dt, st, amt, ''))
    c.commit(); c.close()


class TestPeriodOrdersScope:

    def test_periods_only_done_orders(self):
        """periods(供 GMV 卡)的 orders 必须=已完成订单数(不是全部), gmv 也=已完成"""
        from datetime import datetime, UTC, timedelta
        from app.core.database import get_conn
        from app.core.dashboard_cache import _compute_period_trends
        conn = get_conn()
        today = (datetime.now(UTC) + timedelta(hours=8)).date()  # 北京时间
        periods = _compute_period_trends(conn, 'jd', today)
        conn.close()
        month = periods.get('month', {})
        if month.get('orders'):
            # 数据: 08-20 已完成2单 + 待发货1 + 退款1; 08-21 已完成1单 → 已完成共3单
            assert month['orders'] == 3, f"month.orders(GMV卡)应为已完成3单: {month['orders']}"
            assert month['gmv'] == 350.0, f"month.gmv 应只计已完成(100+50+200): {month['gmv']}"
        trend = periods.get('month_trend', [])
        for t in trend:
            if t['日期'] == '08-20':
                assert t['订单数'] == 2, f"08-20 GMV卡订单数应2(仅已完成): {t['订单数']}"
                assert t['GMV'] == 150.0, f"08-20 GMV 应150: {t['GMV']}"
            if t['日期'] == '08-21':
                assert t['订单数'] == 1 and t['GMV'] == 200.0, f"08-21 应为1单200: {t}"
