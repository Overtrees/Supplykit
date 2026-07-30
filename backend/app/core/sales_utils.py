"""日销计算工具 — 三窗口异常剔除 + 趋势加权融合

供 insights.py（补货建议）和 dashboard.py（濒临断货）共用
"""
from datetime import datetime, timedelta
import os


def calc_sales(orders, cutoff_days, source='', wh_name=None, sku_barcode_map=None):
    """计算指定窗口的日均销量（含 3σ 异常剔除 + 近3天1.5倍加权）
    
    sku_barcode_map: {sku: barcode} 用于生成 sku|barcode 复合 key，提高匹配精度
    """
    cutoff = (datetime.utcnow() - timedelta(days=cutoff_days)).strftime('%Y-%m-%d')
    daily_by_sku = {}
    for o in orders:
        if source and o.get('data_source', '') != source:
            continue
        if wh_name and o.get('warehouse', '') != wh_name:
            continue
        sku = o.get('sku', '')
        if not sku:
            continue
        # 生成 key：有 barcode 时用 sku|barcode，否则降级为 sku
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