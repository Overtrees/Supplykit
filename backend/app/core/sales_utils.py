"""日销计算工具 — 三窗口异常剔除 + 趋势加权融合

供 insights.py（补货建议）和 dashboard.py（濒临断货）共用
"""
from datetime import datetime, timedelta
import os
import logging

logger = logging.getLogger("sales_utils")


def load_daily_sales(cutoff_days, db, sku_barcode_map=None, channel=None):
    """统一数据源：从快照读历史 + 当天 orders 补充，消除重复计算
    
    返回: {key: {date: qty, ...}, ...}  key 为 sku 或 sku|barcode
    """
    from app.core.database import get_conn
    cutoff = (datetime.utcnow() - timedelta(days=cutoff_days)).strftime('%Y-%m-%d')
    today = datetime.utcnow().strftime('%Y-%m-%d')
    daily_by_sku = {}
    
    # 1. 快照读历史（原始 SQL 避免 ORM 行转 dict 开销）
    try:
        conn = get_conn()
        if channel:
            rows = conn.execute("SELECT date, sku, order_count FROM daily_sales_snapshot WHERE date>=? AND channel=?", (cutoff, channel)).fetchall()
        else:
            rows = conn.execute("SELECT date, sku, order_count FROM daily_sales_snapshot WHERE date>=?", (cutoff,)).fetchall()
        for row in rows:
            sku = row[1]  # tuple 索引访问，避免 dict 创建开销
            key = sku
            if sku_barcode_map and sku_barcode_map.get(sku):
                key = f"{sku}|{sku_barcode_map[sku]}"
            daily_by_sku.setdefault(key, {})[row[0]] = (row[2] or 0)
    except Exception as e:
        logger.warning(f"[sales] snapshot raw read: {e}")
    
    # 2. 当天 orders 补充（原始 SQL）
    try:
        orders = db.table("orders").select("*").gte("ordered_at", today).execute().data or []
        for o in orders:
            sku = o.get('sku', '')
            if not sku: continue
            key = sku
            if sku_barcode_map and sku_barcode_map.get(sku):
                key = f"{sku}|{sku_barcode_map[sku]}"
            dt = str(o.get('ordered_at', ''))[:10]
            qty = int(o.get('quantity', 0) or 0)
            if dt >= cutoff:
                daily_by_sku.setdefault(key, {})[dt] = daily_by_sku[key].get(dt, 0) + qty
    except Exception as e:
        logger.warning(f"[sales] today orders: {e}")
    
    return daily_by_sku


def calc_sales_from_daily(daily_by_sku, cutoff_days, orders=None, sku_barcode_map=None):
    """从已构建的 daily_by_sku 计算指定窗口的日均销量（含 3σ 剔除 + 近3天1.5倍加权）
    
    daily_by_sku: load_daily_sales 的返回值，或旧版 calc_sales 兼容格式
    cutoff_days: 窗口天数
    orders: 可选，用于补充 0 日销 SKU（兼容旧调用方）
    sku_barcode_map: 可选，用于补 0 日销
    """
    # 预计算日期列表，避免循环内重复调用 datetime.utcnow()
    now = datetime.utcnow()
    all_days = [(now - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(cutoff_days)]
    result = {}
    for key, daily in daily_by_sku.items():
        n = len(daily)
        total = sum(daily.values())
        base_avg = total / cutoff_days
        if n < 3 or cutoff_days < 7:
            result[key] = base_avg
            continue
        vals = [daily.get(d, 0) for d in all_days]
        nd = cutoff_days
        mean = sum(vals) / nd
        var = sum((v - mean) ** 2 for v in vals) / nd
        std = var ** 0.5
        threshold = max(3 * std, mean * 1.5)
        weighted_sum = 0
        weight_total = 0
        for idx, v in enumerate(reversed(vals)):
            if abs(v - mean) <= threshold:
                w = 1.5 if idx >= nd - 3 else 1.0
                weighted_sum += v * w
                weight_total += w
        result[key] = weighted_sum / weight_total if weight_total > 0 else 0

    # 补 0 日销的 SKU
    if orders:
        for o in orders:
            sku = o.get('sku', '')
            if not sku: continue
            key = sku
            if sku_barcode_map and sku_barcode_map.get(sku):
                key = f"{sku}|{sku_barcode_map[sku]}"
            if key not in result:
                result[key] = 0

    if os.getenv('SALES_LOG') and any(v > 0 for v in result.values()):
        nonzero = {k: round(v, 2) for k, v in result.items() if v > 0}
        logger.info(f"[SALES] cutoff={cutoff_days}d → {len(nonzero)} SKU: {nonzero}")
    return result


def calc_sales(orders, cutoff_days, source='', wh_name=None, sku_barcode_map=None, db=None):
    """旧版兼容入口：内部调用 load_daily_sales + calc_sales_from_daily
    
    如果传入了 db，优先使用快照（统一数据源），orders 只用于当天补充。
    如果未传入 db，走旧逻辑（仅从 orders 计算）。
    """
    if db:
        # 统一数据源路径：快照 + 当天 orders
        daily = load_daily_sales(cutoff_days, db, sku_barcode_map=sku_barcode_map)
        # 过滤 source/wh_name（外部调用时已有）
        if source or wh_name:
            filtered = {}
            for o in orders:
                if source and o.get('data_source', '') != source: continue
                if wh_name and o.get('warehouse', '') != wh_name: continue
                sku = o.get('sku', '')
                if not sku: continue
                key = sku
                if sku_barcode_map and sku_barcode_map.get(sku):
                    key = f"{sku}|{sku_barcode_map[sku]}"
                if key not in filtered:
                    filtered[key] = daily.get(key, {})
            daily = filtered
        return calc_sales_from_daily(daily, cutoff_days, orders=orders, sku_barcode_map=sku_barcode_map)
    else:
        # 旧路径：仅从 orders 计算（无 db 时）
        cutoff = (datetime.utcnow() - timedelta(days=cutoff_days)).strftime('%Y-%m-%d')
        daily_by_sku = {}
        for o in orders:
            if source and o.get('data_source', '') != source: continue
            if wh_name and o.get('warehouse', '') != wh_name: continue
            sku = o.get('sku', '')
            if not sku: continue
            key = sku
            if sku_barcode_map and sku_barcode_map.get(sku):
                key = f"{sku}|{sku_barcode_map[sku]}"
            dt = str(o.get('ordered_at', ''))[:10]
            qty = int(o.get('quantity', 0) or 0)
            if dt >= cutoff:
                daily_by_sku.setdefault(key, {})[dt] = daily_by_sku[key].get(dt, 0) + qty
        return calc_sales_from_daily(daily_by_sku, cutoff_days, orders=orders, sku_barcode_map=sku_barcode_map)


def build_daily_sales_snapshot(db):
    """构建/更新日销快照表（增量：只处理快照最大日期之后的新订单）"""
    from collections import defaultdict
    from datetime import datetime, timedelta
    # 快照中已有的最大日期
    try:
        max_row = db.table("daily_sales_snapshot").select("MAX(date) as m").execute().data
        max_date = (max_row[0]['m'] or '') if max_row else ''
    except Exception as e:
        import logging; logging.warning(f"[sales] snapshot max date: {e}")
        max_date = ''
    # 增量窗口：max_date 之后到昨天
    cutoff = (datetime.utcnow() - timedelta(days=90)).strftime('%Y-%m-%d')
    today = datetime.utcnow().strftime('%Y-%m-%d')
    start = max(cutoff, max_date) if max_date else cutoff
    orders = db.table("orders").select("*").gte("ordered_at", start).execute().data or []
    recent = [o for o in orders if str(o.get('ordered_at',''))[:10] < today]
    if not recent:
        return 0
    # 按日期+渠道+SKU 聚合
    agg = defaultdict(int)
    for o in recent:
        date = str(o.get('ordered_at',''))[:10]
        channel = o.get('channel','jd')
        sku = o.get('sku','')
        if not sku: continue
        qty = int(o.get('quantity', 0) or 0)
        agg[(date, channel, sku)] += qty
    # 批量 UPSERT（executemany 减少 IO）
    from app.core.database import get_conn
    conn = get_conn()
    rows = [(d, ch, s, q) for (d, ch, s), q in agg.items()]
    conn.executemany(
        "INSERT INTO daily_sales_snapshot(date, channel, sku, order_count) VALUES(?,?,?,?) "
        "ON CONFLICT(date, channel, sku) DO UPDATE SET order_count=excluded.order_count",
        rows
    )
    conn.commit()
    count = len(rows)
    # 清理超出 100 天的旧快照
    try:
        old_cutoff = (datetime.utcnow() - timedelta(days=100)).strftime('%Y-%m-%d')
        conn.execute("DELETE FROM daily_sales_snapshot WHERE date < ?", (old_cutoff,))
        conn.commit()
    except Exception as e:
        import logging; logging.warning(f"[sales] snapshot cleanup: {e}")
    return count


def rolling_predict(s7, s14, s28):
    """三窗口滚动预测：按趋势信号分配权重融合"""
    a7 = 1 if s7 > s14 * 1.15 else (-1 if s7 < s14 * 0.85 else 0)
    a14 = 1 if s14 > s28 * 1.15 else (-1 if s14 < s28 * 0.85 else 0)
    weights = {
        (1, 1): (0.50, 0.30, 0.20),   # 持续上行
        (1, 0): (0.35, 0.40, 0.25),   # 刚抬头
        (1, -1): (0.25, 0.35, 0.40),  # 短期冲高回落
        (0, 1): (0.20, 0.40, 0.40),   # 中期走强
        (0, 0): (0.10, 0.20, 0.70),   # 平稳
        (0, -1): (0.15, 0.35, 0.50),  # 中期走弱
        (-1, 1): (0.25, 0.35, 0.40),  # 短期跌中期回升
        (-1, 0): (0.20, 0.30, 0.50),  # 短期走弱
        (-1, -1): (0.40, 0.35, 0.25), # 持续下行
    }
    w7, w14, w28 = weights.get((a7, a14), (0.10, 0.20, 0.70))
    return s7 * w7 + s14 * w14 + s28 * w28