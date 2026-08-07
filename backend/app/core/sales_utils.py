"""日销计算工具 — 三窗口异常剔除 + 趋势加权融合

供 insights.py（补货建议）和 dashboard.py（濒临断货）共用
"""
from datetime import datetime, timedelta
import os


def calc_sales(orders, cutoff_days, source='', wh_name=None, sku_barcode_map=None, db=None):
    """计算指定窗口的日均销量（含 3σ 异常剔除 + 近3天1.5倍加权）
    
    如果传入了 db，优先使用 daily_sales_snapshot 快照，减少计算量。
    sku_barcode_map: {sku: barcode} 用于生成 sku|barcode 复合 key，提高匹配精度
    """
    cutoff = (datetime.utcnow() - timedelta(days=cutoff_days)).strftime('%Y-%m-%d')
    today = datetime.utcnow().strftime('%Y-%m-%d')
    
    # 如果有 db，尝试从快照获取历史日销
    daily_by_sku = {}
    if db:
        try:
            rows = db.table("daily_sales_snapshot").select("*").execute().data or []
            for row in rows:
                if row['date'] < cutoff:
                    continue
                key = row['sku']
                if key not in daily_by_sku:
                    daily_by_sku[key] = {}
                daily_by_sku[key][row['date']] = daily_by_sku[key].get(row['date'], 0) + (row['order_count'] or 0)
        except Exception as e:
            import logging; logging.warning(f"[sales] snapshot read: {e}")
            daily_by_sku = {}
    
    # 从原始订单补充当天数据（快照不包含当天）
    for o in orders:
        if source and o.get('data_source', '') != source:
            continue
        if wh_name and o.get('warehouse', '') != wh_name:
            continue
        sku = o.get('sku', '')
        if not sku:
            continue
        if sku_barcode_map and sku_barcode_map.get(sku):
            key = f"{sku}|{sku_barcode_map[sku]}"
        else:
            key = sku
        dt = str(o.get('ordered_at', ''))[:10]
        qty = int(o.get('quantity', 0) or 0)
        if dt >= cutoff:
            if key not in daily_by_sku:
                daily_by_sku[key] = {}
            daily_by_sku[key][dt] = daily_by_sku[key].get(dt, 0) + qty

    result = {}
    for key, daily in daily_by_sku.items():
        n = len(daily)
        total = sum(daily.values())
        base_avg = total / cutoff_days
        if n < 3 or cutoff_days < 7:
            result[key] = base_avg
            continue
        all_days = []
        for i in range(cutoff_days):
            d = (datetime.utcnow() - timedelta(days=i)).strftime("%Y-%m-%d")
            all_days.append(daily.get(d, 0))
        nd = cutoff_days
        mean = sum(all_days) / nd
        var = sum((v - mean) ** 2 for v in all_days) / nd
        std = var ** 0.5
        threshold = max(3 * std, mean * 1.5)
        weighted_sum = 0
        weight_total = 0
        for idx, v in enumerate(reversed(all_days)):
            if abs(v - mean) <= threshold:
                w = 1.5 if idx >= nd - 3 else 1.0
                weighted_sum += v * w
                weight_total += w
        result[key] = weighted_sum / weight_total if weight_total > 0 else 0

    # 补0日销的SKU（用原始 sku 或 key）
    for o in orders:
        sku = o.get('sku', '')
        if not sku: continue
        if sku_barcode_map and sku_barcode_map.get(sku):
            key = f"{sku}|{sku_barcode_map[sku]}"
        else:
            key = sku
        if key not in result:
            result[key] = 0

    if os.getenv('SALES_LOG') and any(v > 0 for v in result.values()):
        import logging
        nonzero = {k: round(v, 2) for k, v in result.items() if v > 0}
        logging.info(f"[SALES] cutoff={cutoff_days}d wh={wh_name} → {len(nonzero)} SKU: {nonzero}")
    return result


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