from fastapi import APIRouter, Depends
from app.core.database import get_db
from app.core.response import ok, fail
from app.core.sales_utils import calc_sales, rolling_predict
from app.api.routes.replenishment import get_replenishment_suggestions
from datetime import datetime
import json, os

router = APIRouter(prefix="/api/insights", tags=["insights"])

# with-sales 结果缓存（30s TTL + 版本号）
_with_sales_cache = {}


@router.get('/ping')
def ping():
    return ok({"time": datetime.utcnow().isoformat()})

def detect_slow_moving_products(db=None, create_alerts=False):
    from datetime import datetime, timedelta
    if db is None:
        from app.core.database import get_db
        db = get_db()
    cutoff = (datetime.utcnow() - timedelta(days=90)).isoformat()
    # 快照聚合：按 SKU 取最大日期，替代 orders 全表 GROUP BY
    from app.core.database import get_conn
    last_order = {}
    try:
        rows = get_conn().execute("SELECT sku, MAX(date) FROM daily_sales_snapshot WHERE date >= ? GROUP BY sku", (cutoff,)).fetchall()
        last_order = {r[0]: (r[1] or '')[:10] for r in rows}
    except Exception as e:
        import logging; logging.warning(f"[slow-moving] snapshot agg: {e}")
    # 当天 orders 补充（快照不含今天）
    try:
        today = datetime.utcnow().strftime('%Y-%m-%d')
        rows = get_conn().execute("SELECT sku, MAX(ordered_at) FROM orders WHERE ordered_at >= ? GROUP BY sku", (today,)).fetchall()
        for r in rows:
            if r[0] and (r[1] or '')[:10] > last_order.get(r[0], ''):
                last_order[r[0]] = (r[1] or '')[:10]
    except Exception as e:
        import logging; logging.warning(f"[slow-moving] today orders: {e}")
    # 只加载需要的字段，避免全量 select("*") 导致 10 万 SKU 时 OOM
    products_map = {}
    try:
        from app.core.database import get_conn
        _conn = get_conn()
        for r in _conn.execute("SELECT sku, product_name, barcode, channel FROM products").fetchall():
            products_map[r[0]] = {"sku": r[0], "product_name": r[1], "barcode": r[2] or '', "channel": r[3] or 'jd'}
    except Exception as e:
        import logging; logging.warning(f"[slow-moving] products: {e}")
    sku_barcode_map = {s: (p.get('barcode', '') or '') for s, p in products_map.items()}
    inventory_map = {}
    try:
        for r in _conn.execute("SELECT sku, available_qty, product_name, channel FROM inventory").fetchall():
            inventory_map[r[0]] = {"sku": r[0], "available_qty": r[1], "product_name": r[2] or r[0], "channel": r[3] or 'jd'}
    except Exception as e:
        import logging; logging.warning(f"[slow-moving] inventory: {e}")
    # SKU → channel（优先 products 主表，回退 inventory）
    from app.core.sales_utils import sku_to_channel
    sku_channel_map = {s: (p.get('channel') or sku_to_channel(s, db) or 'jd') for s, p in products_map.items()}
    for s, i in inventory_map.items():
        if s not in sku_channel_map or not sku_channel_map[s]:
            sku_channel_map[s] = i.get('channel') or 'jd'
    now = datetime.utcnow()
    result = []
    # 只遍历有库存的 SKU（无库存不需要滞销检测），避免 10 万+ SKU 全量遍历
    all_skus = set(inventory_map.keys())
    for sku in all_skus:
        p = products_map.get(sku)
        inv = inventory_map.get(sku)
        bc = sku_barcode_map.get(sku, '')
        key = f"{sku}|{bc}" if bc else sku
        last_date = last_order.get(key, "")
        days = 999
        if last_date:
            try: days = (now - datetime.strptime(last_date[:10], "%Y-%m-%d")).days
            except Exception as e: import logging; logging.warning(f"[slow-moving] parse date {last_date}: {e}")
        stock = int(inv.get("available_qty") or 0) if inv else 0
        if days > 30 and stock > 0:
            level = "滞销" if days > 60 else ("冷淡" if days > 30 else "正常")
            result.append({"sku": sku, "barcode": bc, "product_name": p["product_name"] if p else inv.get("product_name",sku) if inv else sku, "last_order_date": last_date[:10], "days_since_last": days, "stock": stock, "level": level, "channel": sku_channel_map.get(sku, 'jd')})
            if create_alerts:
                ex = db.table("alerts").select("id").eq("alert_type","slow_moving").eq("related_sku",sku).eq("status","active").execute().data
                if not ex:
                    db.table("alerts").insert({"alert_type":"slow_moving", "title":f"滞销: {result[-1]['product_name']}", "description":f"{days} 天无销售，库存 {stock} 件", "severity":"warning", "source":"event_bus", "related_sku":sku, "status":"active", "channel": sku_channel_map.get(sku, 'jd')}).execute()
    result.sort(key=lambda x: -x["days_since_last"])
    return ok(result)

@router.get('/slow-moving')
def get_slow_moving_products(db = get_db()):
    return detect_slow_moving_products(db, create_alerts=False)


@router.get('/export-slow-moving')
def export_slow_moving_excel(channel: str = 'jd', db = get_db()):
    """导出滞销预警为 Excel"""
    from openpyxl import Workbook
    from io import BytesIO
    from fastapi.responses import Response
    from urllib.parse import quote

    result = get_slow_moving_products(db)
    # 按渠道过滤
    import json
    data = result.get("data") if isinstance(result, dict) and "data" in result else (result if isinstance(result, list) else [])
    if channel != 'all':
        products = set()
        try:
            from app.core.database import get_conn as _gconn
            for _r in _gconn().execute("SELECT sku FROM products WHERE channel=?", (channel,)).fetchall():
                products.add(_r[0])
        except Exception:
            products = set()
        data = [x for x in data if x['sku'] in products]
    slow = [x for x in data if x.get('level') != '正常']

    wb = Workbook()
    ws = wb.active
    ws.title = "滞销预警"
    headers = ["SKU","商品","最近下单","天数","库存","级别"]
    from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
    hf = PatternFill(start_color="1d4ed8", end_color="1d4ed8", fill_type="solid")
    hfn = Font(bold=True,color="ffffff",size=11)
    thin = Border(left=Side(style='thin',color='e2e8f0'),right=Side(style='thin',color='e2e8f0'),top=Side(style='thin',color='e2e8f0'),bottom=Side(style='thin',color='e2e8f0'))
    ws.append(headers)
    for c in ws[1]: c.fill=hf; c.font=hfn; c.alignment=Alignment(horizontal='center'); c.border=thin
    for r in slow:
        ws.append([r.get('sku',''),r.get('product_name',''),r.get('last_order_date',''),r.get('days_since_last',0),r.get('stock',0),r.get('level','')])
        for c in ws[ws.max_row]: c.border=thin; c.alignment=Alignment(horizontal='center')
    buf = BytesIO(); wb.save(buf); buf.seek(0)
    return Response(content=buf.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition":f"attachment; filename*=UTF-8''slow_moving_{datetime.utcnow().strftime('%Y%m%d')}.xlsx"})


@router.get('/summary')
def get_insight_summary(db = get_db()):
    inv = []
    try:
        from app.core.database import get_conn as _gconn
        inv = [{"sku": r[0], "available_qty": r[1], "safety_qty": r[2] or 0}
               for r in _gconn().execute("SELECT sku, available_qty, safety_qty FROM inventory").fetchall()]
    except Exception:
        inv = []
    total = len(inv)
    low_stock = len([x for x in inv if int(x.get("available_qty") or 0) < int(x.get("safety_qty") or 0)])
    out_of_stock = len([x for x in inv if int(x.get("available_qty") or 0) == 0])

    replen_raw = get_replenishment_suggestions(db=db)
    replen = replen_raw.get("data") if isinstance(replen_raw, dict) and "data" in replen_raw else replen_raw
    urgent = len([x for x in replen if x.get("suggested_qty", 0) > 0]) if isinstance(replen, list) else 0

    slow = get_slow_moving_products(db)
    slow_list = slow.get("data") if isinstance(slow, dict) and "data" in slow else (slow if isinstance(slow, list) else [])
    slow_count = len([x for x in slow_list if x.get("level") == "滞销"])
    cold_count = len([x for x in slow_list if x.get("level") == "冷淡"])

    return ok({
        "total_products": total,
        "low_stock": low_stock,
        "out_of_stock": out_of_stock,
        "urgent_replenish": urgent,
        "suggestions_count": len(replen) if isinstance(replen, list) else 0,
        "slow_moving": slow_count,
        "cold_count": cold_count,
    })


@router.get('/trend-analysis')
def trend_analysis(days: int = 30, channel: str = 'jd', db = get_db()):
    """趋势分析：日/周/月维度聚合"""
    from collections import defaultdict
    from datetime import datetime, timedelta
    cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()
    orders = []
    inventory = []
    try:
        from app.core.database import get_conn as _gconn
        _c = _gconn()
        orders = [{"ordered_at": r[0], "total_amount": r[1], "product_name": r[2]}
                  for r in _c.execute("SELECT ordered_at, total_amount, product_name FROM orders WHERE channel=? AND ordered_at>=?", (channel, cutoff)).fetchall()]
        inventory = [{"available_qty": r[0], "safety_qty": r[1]}
                     for r in _c.execute("SELECT available_qty, safety_qty FROM inventory WHERE channel=?", (channel,)).fetchall()]
    except Exception:
        orders, inventory = [], []

    daily = defaultdict(lambda: {'gmv': 0, 'orders': 0})
    cat_count = defaultdict(int)
    for o in orders:
        date = (o.get('ordered_at') or '')[:10]
        daily[date]['gmv'] += float(o.get('total_amount') or 0)
        daily[date]['orders'] += 1
        cat = o.get('product_name', '未知')[:4]
        cat_count[cat] += 1

    trend = [{'date': d, **v} for d, v in sorted(daily.items())[-days:]]
    cat_pie = [{'name': k, 'value': v} for k, v in sorted(cat_count.items(), key=lambda x: -x[1])[:10]]
    inv_status = {
        'normal': sum(1 for i in inventory if int(i.get('available_qty') or 0) >= int(i.get('safety_qty') or 0)),
        'low': sum(1 for i in inventory if 0 < int(i.get('available_qty') or 0) < int(i.get('safety_qty') or 0)),
        'out': sum(1 for i in inventory if int(i.get('available_qty') or 0) <= 0),
    }
    return {'daily': trend, 'categories': cat_pie, 'inventory_health': inv_status,
            'total_gmv': sum(d['gmv'] for d in trend), 'total_orders': sum(d['orders'] for d in trend)}

@router.get('/anomaly-tracking')
def anomaly_tracking(db = get_db()):
    """异常追踪：告警 + 质量日志汇总"""
    alerts = db.table("alerts").select("*").order("id", desc=True).limit(100).execute().data or []
    quality = db.table("quality_logs").select("*").order("id", desc=True).limit(100).execute().data or []
    events = db.table("events").select("*").order("id", desc=True).limit(100).execute().data or []
    return {
        'alerts': alerts,
        'quality_logs': quality,
        'events': events,
        'summary': {
            'alert_count': len(alerts),
            'active_alerts': sum(1 for a in alerts if a.get('status') == 'active'),
            'error_count': sum(1 for q in quality if q.get('level') == 'error'),
            'event_count': len(events),
        }
    }

@router.post('/sync-from-orders')
def sync_inventory_from_orders(db = get_db(), limit: int = 200):
    """根据最近订单自动调整库存（异步调用）"""
    orders = db.table("orders").select("*").order("id", desc=True).limit(limit).execute().data
    count = 0
    for o in orders:
        try:
            auto_adjust_inventory(o, 'cleansing', db)
            count += 1
        except Exception:
            pass
    return {'ok': True, 'synced': count, 'scanned': len(orders)}


def auto_adjust_inventory(order_data: dict, order_type: str, db):
    sku = order_data.get("sku", "")
    qty = int(float(order_data.get("quantity", 0)))
    if not sku or qty <= 0:
        return

    inv_list = db.table("inventory").select("*").eq("sku", sku).execute().data
    if inv_list:
        inv = inv_list[0]
        avail = int(inv.get("available_qty") or 0)
        if order_type in ("jd_purchase", "cleansing_purchase"):
            new_avail = avail + qty
            db.table("inventory").update({"available_qty": new_avail}).eq("id", inv["id"]).execute()
            inv["available_qty"] = new_avail
        elif order_type in ("sales", "jd_sales", "cleansing"):
            new_avail = max(0, avail - qty)
            db.table("inventory").update({"available_qty": new_avail}).eq("id", inv["id"]).execute()
            inv["available_qty"] = new_avail
        else:
            return
        # Emit inventory.changed so alert/event handlers fire
        try:
            from app.core.events import bus
            bus.emit('inventory.changed', {
                'inventory': inv,
                'action': 'auto_adjust',
                'quantity': qty,
                'order_type': order_type,
            })
        except Exception:
            pass
    else:
        db.table("inventory").insert({
            "sku": sku,
            "product_name": order_data.get("product_name", ""),
            "store": order_data.get("store", ""),
            "available_qty": qty if order_type in ("jd_purchase", "cleansing_purchase") else 0,
            "locked_qty": 0,
            "in_transit_qty": 0,
            "safety_qty": 10,
        }).execute()
@router.get('/with-sales')
def inventory_with_sales(wh_type: str = 'own', channel: str = 'jd', page: int = 0, page_size: int = 0, db = get_db()):
    """库存列表 + 日销 + 在库周转 + 当月出入库
    wh_type: own=自有仓, platform=平台仓(C仓), platform_b=B仓
    page/page_size: 翻页参数，传 0 返回全部
    """
    # 结果缓存 30s（版本号校验，数据变更自动失效）
    import time as _t
    _cache_key = f"{wh_type}|{channel}"
    _now_ts = _t.time()
    try:
        from app.core.dashboard_cache import check_db_version
        _ver = check_db_version()
    except Exception:
        _ver = 0
    _cached = _with_sales_cache.get(_cache_key)
    if _cached and _cached.get('ver') == _ver and _now_ts - _cached.get('ts', 0) < 30:
        return ok(_cached['data'])
    # 惰性归档：每天最多检查一次是否有超期订单需归档（不依赖凌晨任务）
    try:
        _arc = db.table("replenishment_config").select("*").eq("key", "_last_archive_check").execute().data
        _last_arc = _arc[0]['value'] if _arc else ''
        from datetime import timedelta as _td
        if _last_arc != (datetime.utcnow() - _td(days=1)).strftime('%Y-%m-%d'):
            from app.core.scheduler import _task_archive_orders
            _task_archive_orders()
            db.table("replenishment_config").upsert({"key": "_last_archive_check", "value": datetime.utcnow().strftime('%Y-%m-%d'), "channel": "jd", "updated_at": datetime.utcnow().isoformat()}, conflict_col='key')
    except Exception:
        pass
    inv = db.table("inventory").select("*").eq("warehouse_type", wh_type).eq("channel", channel).execute().data or []
    from datetime import datetime, timedelta
    now = datetime.utcnow()
    cur_month = now.strftime('%Y-%m')
    # 日销已从快照读取，orders 全量加载已移除（死代码，改用快照）
    # 出入库记录只取当月
    month_start = now.replace(day=1).strftime('%Y-%m-%d')
    month_end = now.strftime('%Y-%m-%d')
    in_records = db.table("inbound_records").select("*").gte("inbound_date", month_start).eq("channel", channel).execute().data or []
    out_records = db.table("outbound_records").select("*").gte("outbound_date", month_start).eq("channel", channel).execute().data or []
    # 当月出入库汇总
    inbound_month = {}
    for r in in_records:
        s = r['sku']
        inbound_month[s] = inbound_month.get(s, 0) + int(r.get('quantity',0) or 0)
    outbound_month = {}
    for r in out_records:
        s = r['sku']
        outbound_month[s] = outbound_month.get(s, 0) + int(r.get('quantity',0) or 0)
    sales_28 = {}
    products_for_barcode = {}
    try:
        from app.core.database import get_conn as _gconn
        for _r in _gconn().execute("SELECT sku, barcode, price FROM products").fetchall():
            products_for_barcode[_r[0]] = {"sku": _r[0], "barcode": _r[1] or '', "price": _r[2] or 0}
    except Exception:
        products_for_barcode = {}
    # 从快照聚合 28 天日销（替代 orders 全表遍历）
    from app.core.sales_utils import load_daily_sales, calc_sales_multi, rolling_predict
    daily_28 = load_daily_sales(28, db, sku_barcode_map={s: (p.get('barcode','') or '') for s,p in products_for_barcode.items()})
    for key, daily in daily_28.items():
        sales_28[key] = sum(daily.values())
    # 融合日销（一次遍历算 7/14/28 三窗口 + 趋势加权，用于周转天数计算）
    _multi = calc_sales_multi(daily_28, windows=[7, 14, 28])
    _s7, _s14, _s28 = _multi[7], _multi[14], _multi[28]
    _fused = {}
    for _sk in set(list(_s7.keys()) + list(_s14.keys()) + list(_s28.keys())):
        _fused[_sk] = rolling_predict(_s7.get(_sk, 0), _s14.get(_sk, 0), _s28.get(_sk, 0))
    result = []
    # 当查询 B 仓时，预加载 C 仓在途用于 B→C 调拨在途列
    c_transit = {}
    if wh_type == 'platform_b':
        c_inv = db.table("inventory").select("*").eq("warehouse_type", "platform").execute().data or []
        for ci in c_inv:
            s = ci['sku']
            c_transit[s] = c_transit.get(s, 0) + int(ci.get('in_transit_qty', 0) or 0)
    for i in inv:
        sku = i['sku']
        bc = (products_for_barcode.get(sku) or {}).get('barcode', '')
        sales_key = f"{sku}|{bc}" if bc else sku
        ds = round(sales_28.get(sales_key, 0), 1)
        avail = int(i.get('available_qty',0) or 0)
        begin = avail - inbound_month.get(sku, 0) + outbound_month.get(sku, 0)
        # 单价：从 products 主表联表获取
        price = 0
        _p = products_for_barcode.get(sku) or {}
        try: price = float(_p.get('price') or 0)
        except Exception: price = 0
        # 周转天数 = 可用库存 / 融合日销（三窗口 3σ 剔除 + 趋势加权，比简单平均更精准）
        fused_ds = _fused.get(sales_key, 0) or _fused.get(sku, 0)
        turnover_days = round(avail / fused_ds, 1) if fused_ds > 0 else None
        result.append({
            'id': i['id'],
            'sku': sku,
            'barcode': bc,
            'product_name': i.get('product_name',''),
            'price': price,
            'store': i.get('store',''),
            'warehouse': i.get('warehouse',''),
            'warehouse_type': i.get('warehouse_type','platform'),
            'channel': i.get('channel', 'jd'),
            'available_qty': avail,
            'in_transit_qty': int(i.get('in_transit_qty',0) or 0),
            'c_transit': c_transit.get(sku, 0) if wh_type == 'platform_b' else 0,
            'daily_sales': ds,
            'month_inbound': inbound_month.get(sku, int(i.get('month_inbound',0) or 0)),
            'month_outbound': outbound_month.get(sku, int(i.get('month_outbound',0) or 0)),
            'beginning_stock': int(i.get('beginning_stock',0) or 0) or begin,
            'month_start': month_start,
            'month_end': month_end,
            'turnover_days': turnover_days,
        })
    total = len(result)
    # 写缓存（30s TTL + 版本号）
    try:
        _with_sales_cache[_cache_key] = {'data': result, 'ts': _t.time(), 'ver': _ver}
    except Exception:
        pass
    if page > 0 and page_size > 0:
        result = result[(page - 1) * page_size: page * page_size]
        return ok({"items": result, "total": total, "page": page, "page_size": page_size})
    return ok(result)