from fastapi import APIRouter
from app.core.dashboard_cache import get_cached_dashboard as get_dashboard, invalidate, _compute_health
from app.core.database import get_db, DB_PATH
from app.core.sales_utils import calc_sales, rolling_predict
import sqlite3
from app.core.response import ok, fail
from datetime import datetime, timedelta, UTC
import time

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

_stock_risk_cache = {}
_STOCK_CACHE_TTL = 300  # 5 分钟

@router.get("/summary")
def dashboard_summary(channel: str = 'jd', start_date: str = '', end_date: str = '', refresh: bool = False):
    if refresh:
        # 强制同步重建（填充/导入/重置完成后前端主动触发，确保即时准确）
        from app.core.dashboard_cache import get_dashboard_sync
        return ok(get_dashboard_sync(channel))
    if start_date and end_date:
        # 自定义日期范围：实时计算，不缓存
        from datetime import datetime as dt, UTC
        from app.core.sales_utils import calc_sales
        db = get_db()
        all_orders = db.table("orders").select("*").execute().data or []
        # 软删除订单不计入统计（与订单列表过滤一致）
        all_orders = [o for o in all_orders if not (o.get("deleted_at") or "")]
        # 按日期过滤
        orders = [o for o in all_orders if start_date <= str(o.get('ordered_at',''))[:10] <= end_date]
        inv = db.table("inventory").select("*").eq("channel", channel).execute().data or []
        products = db.table("products").select("*").eq("channel", channel).execute().data or []
        suppliers = db.table("suppliers").select("*").execute().data or []
        alerts = db.table("alerts").select("*").eq("status", "active").eq("channel", channel).execute().data or []
        gmv = sum(float(x.get("total_amount") or 0) for x in orders if x.get("order_status") == "已完成")
        pending = len([x for x in orders if x.get("order_status") == "待发货"])
        refund = len([x for x in orders if x.get("order_status") == "申请退款"])
        low_stock = len([x for x in inv if int(x.get("available_qty") or 0) < int(x.get("safety_qty") or 0)])
        day_count = max(1, (dt.strptime(end_date, "%Y-%m-%d") - dt.strptime(start_date, "%Y-%m-%d")).days + 1)
        # 趋势（按天聚合）
        trend = defaultdict(lambda: {"GMV": 0, "订单数": 0})
        for o in orders:
            d = str(o.get('ordered_at',''))[:10]
            trend[d]["GMV"] += float(o.get("total_amount") or 0)
            if o.get("order_status") == "已完成": trend[d]["订单数"] += 1
        trend_data = [{"日期": k, "GMV": v["GMV"], "订单数": v["订单数"]} for k, v in sorted(trend.items())]
        summary = {
            "gmv": round(gmv, 2), "total_orders": len(orders), "pending_count": pending, "refund_count": refund,
            "low_stock_count": low_stock, "active_alerts": len(alerts), "total_products": len(products), "total_suppliers": len(suppliers),
        }
        # 店铺 GMV
        store_gmv = defaultdict(float)
        for o in orders:
            if o.get("order_status") == "已完成":
                store_gmv[o.get('store', '其他')] += float(o.get("total_amount") or 0)
        stores = [{"name": k, "gmv": round(v, 2)} for k, v in sorted(store_gmv.items(), key=lambda x: -x[1])]
        return ok({
            "summary": summary,
            "periods": {"custom": {"gmv": round(gmv, 2), "orders": len(orders), "days": day_count}},
            "trend": trend_data,
            "funnel": _compute_funnel(orders), "health_index": _compute_health(inv),
            "stores": stores,
        })
    data = get_dashboard(channel=channel)
    return ok(data)

@router.get("/stock-risk")
def stock_risk(channel: str = 'jd'):
    now = time.time()
    # 读取数据库版本号（跨进程缓存失效）
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.execute("SELECT value FROM replenishment_config WHERE key='_cache_version' AND channel='jd'")
        row = cur.fetchone()
        db_ver = int(row[0]) if row else 0
        conn.close()
    except Exception as e:
        import logging; logging.warning(f"[dash] read db version error: {e}")
        db_ver = 0
    cached = _stock_risk_cache.get(channel)
    if cached and cached.get('ver') == db_ver and now - cached['ts'] < _STOCK_CACHE_TTL:
        return ok(cached['data'])
    """
    濒临断货 TOP 10 — 日销复用三窗口融合值，参考补货建议计算逻辑

    B 仓维度（BBCC）：
      1. 前置期 = b_to_c_days + c_safety_days
      2. C仓缺口 = max(融合日销×前置期 - C仓可用 - C仓在途, 0)
      3. 缺口 > 0 → B仓每天需调拨 = 缺口/前置期 → B仓可撑天数
      缺口 ≤ 0 → C仓库存充足，B仓不纳入风险

    C 仓维度（传统）：
      C仓可用 / 融合日销，可用 < 安全线 且 > 0
    """
    db = get_db()
    now = datetime.now(UTC)

    # 读取补货参数
    cfg_rows = db.table("replenishment_config").select("*").eq("channel", channel).execute().data or []
    cfg = {r['key']: r['value'] for r in cfg_rows}
    b_to_c = int(cfg.get('b_to_c_days', '3'))
    c_safety = int(cfg.get('c_safety_days', '0'))
    bbcc_lead = b_to_c + c_safety

    inv = db.table("inventory").select("*").eq("channel", channel).execute().data or []
    products = {p["sku"]: p for p in (db.table("products").select("*").execute().data or [])}
    sku_barcode_map = {sku: p.get('barcode', '') or '' for sku, p in products.items()}

    # 统一数据源：快照+当天，不用 orders 全表扫描
    from app.core.sales_utils import load_daily_sales, calc_sales_from_daily, rolling_predict
    daily_28 = load_daily_sales(28, db, sku_barcode_map=sku_barcode_map, channel=channel)
    s7 = calc_sales_from_daily(daily_28, 7, sku_barcode_map=sku_barcode_map)
    s14 = calc_sales_from_daily(daily_28, 14, sku_barcode_map=sku_barcode_map)
    s28 = calc_sales_from_daily(daily_28, 28, sku_barcode_map=sku_barcode_map)
    all_skus = set(sku_barcode_map.keys()) | {i.get('sku','') for i in inv if i.get('sku')}
    fused = {}
    for sku in all_skus:
        s7v = s7.get(sku, 0) or s7.get(f"{sku}|{sku_barcode_map.get(sku,'')}", 0)
        s14v = s14.get(sku, 0) or s14.get(f"{sku}|{sku_barcode_map.get(sku,'')}", 0)
        s28v = s28.get(sku, 0) or s28.get(f"{sku}|{sku_barcode_map.get(sku,'')}", 0)
        fused[sku] = rolling_predict(s7v, s14v, s28v)

    # 分类型汇总库存
    c_stock = {}   # C 仓：按 (sku, warehouse) 分
    c_total = {}   # C 仓：按 sku 汇总（可用+在途）
    b_stock = {}   # B 仓：按 sku 汇总

    for i in inv:
        wt = i.get("warehouse_type", "")
        sku = i.get("sku", "")
        if not sku: continue
        qty = int(i.get("available_qty", 0) or 0)
        tty = int(i.get("in_transit_qty", 0) or 0)
        safety = int(i.get("safety_qty", 0) or 0)
        pname = i.get("product_name", "")

        if wt == "platform_b":
            if sku not in b_stock:
                b_stock[sku] = {"available": 0, "product_name": pname}
            b_stock[sku]["available"] += qty

        elif wt == "platform":
            key = (sku, i.get("warehouse", ""))
            if key not in c_stock:
                c_stock[key] = {"available": 0, "safety": 0, "transit": 0, "warehouse": i.get("warehouse", ""), "product_name": pname}
            c_stock[key]["available"] += qty
            c_stock[key]["safety"] += safety
            c_stock[key]["transit"] += tty

            if sku not in c_total:
                c_total[sku] = {"available": 0, "transit": 0}
            c_total[sku]["available"] += qty
            c_total[sku]["transit"] += tty

    result = []

    # ── B 仓维度（BBCC）──
    for sku, st in b_stock.items():
        b_avail = st["available"]
        if b_avail <= 0: continue
        ds = fused.get(sku, 0)
        if ds <= 0: continue
        c_avail = c_total.get(sku, {}).get("available", 0)
        c_transit = c_total.get(sku, {}).get("transit", 0)
        c_gap = max(round(ds * bbcc_lead - c_avail - c_transit), 0)
        if c_gap <= 0: continue
        daily_need = c_gap / bbcc_lead
        days_left = round(b_avail / daily_need, 1) if daily_need > 0 else 999
        result.append({
            "sku": sku,
            "barcode": products.get(sku, {}).get("barcode", ""),
            "product_name": products.get(sku, {}).get("product_name", st["product_name"]),
            "warehouse": "B仓", "type": "B",
            "available_qty": b_avail,
            "daily_sales": round(ds, 1),
            "days_to_empty": days_left,
            "c_gap": c_gap, "c_avail": c_avail, "c_transit": c_transit,
        })

    # ── C 仓维度（传统）──
    for (sku, wh), st in c_stock.items():
        avail = st["available"]
        safety = st["safety"]
        if avail <= 0 or avail >= safety: continue
        ds = fused.get(sku, 0)
        if ds <= 0: continue
        days_left = round(avail / ds, 1)
        result.append({
            "sku": sku,
            "barcode": products.get(sku, {}).get("barcode", ""),
            "product_name": products.get(sku, {}).get("product_name", st["product_name"]),
            "warehouse": wh, "type": "C",
            "available_qty": avail,
            "daily_sales": round(ds, 1),
            "days_to_empty": days_left,
        })

    result.sort(key=lambda x: x["days_to_empty"])
    _stock_risk_cache[channel] = {'data': result[:10], 'ts': time.time(), 'ver': db_ver}
    return ok(result[:10])