from fastapi import APIRouter
from app.core.dashboard_cache import get_dashboard
from app.core.database import get_db
from app.core.sales_utils import calc_sales, rolling_predict
from app.core.response import ok, fail
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

@router.get("/summary")
def dashboard_summary():
    data = get_dashboard()
    return ok(data)

@router.get("/stock-risk")
def stock_risk():
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
    now = datetime.utcnow()

    # 读取补货参数
    cfg_rows = db.table("replenishment_config").select("*").execute().data or []
    cfg = {r['key']: r['value'] for r in cfg_rows}
    b_to_c = int(cfg.get('b_to_c_days', '3'))
    c_safety = int(cfg.get('c_safety_days', '0'))
    bbcc_lead = b_to_c + c_safety

    orders = db.table("orders").select("*").execute().data or []
    inv = db.table("inventory").select("*").execute().data or []
    products = {p["sku"]: p for p in (db.table("products").select("*").execute().data or [])}
    sku_barcode_map = {sku: p.get('barcode', '') or '' for sku, p in products.items()}

    # 三窗口日销 + 融合值（复用补货建议算法）
    s7 = calc_sales(orders, 7, sku_barcode_map=sku_barcode_map)
    s14 = calc_sales(orders, 14, sku_barcode_map=sku_barcode_map)
    s28 = calc_sales(orders, 28, sku_barcode_map=sku_barcode_map)
    all_skus = set(o.get('sku', '') for o in orders)
    fused = {}
    for sku in all_skus:
        barcode = sku_barcode_map.get(sku, '')
        if barcode:
            s7v = s7.get(f"{sku}|{barcode}") or s7.get(sku, 0)
            s14v = s14.get(f"{sku}|{barcode}") or s14.get(sku, 0)
            s28v = s28.get(f"{sku}|{barcode}") or s28.get(sku, 0)
        else:
            s7v = s7.get(sku, 0)
            s14v = s14.get(sku, 0)
            s28v = s28.get(sku, 0)
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
            "product_name": products.get(sku, {}).get("product_name", st["product_name"]),
            "warehouse": wh, "type": "C",
            "available_qty": avail,
            "daily_sales": round(ds, 1),
            "days_to_empty": days_left,
        })

    result.sort(key=lambda x: x["days_to_empty"])
    return ok(result[:10])