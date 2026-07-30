from fastapi import APIRouter, Depends
from app.core.database import get_db
from app.core.response import ok, fail
from app.core.sales_utils import calc_sales, rolling_predict
from app.api.routes.replenishment import get_replenishment_suggestions
from datetime import datetime
import json, os

router = APIRouter(prefix="/api/insights", tags=["insights"])


@router.get('/ping')
def ping():
    return ok({"time": datetime.utcnow().isoformat()})

def detect_slow_moving_products(db=None, create_alerts=False):
    from datetime import datetime, timedelta
    if db is None:
        from app.core.database import get_db
        db = get_db()
    orders = db.table("orders").select("*").execute().data
    products_map = {p["sku"]: p for p in db.table("products").select("*").execute().data}
    inventory_map = {i["sku"]: i for i in db.table("inventory").select("*").execute().data}
    last_order = {}
    for o in orders:
        sku = o.get("sku")
        if not sku: continue
        ds = str(o.get("ordered_at") or "")[:10]
        if sku not in last_order or ds > last_order[sku]: last_order[sku] = ds
    now = datetime.utcnow()
    result = []
    all_skus = set(products_map.keys()) | {o.get("sku") for o in orders if o.get("sku")} | set(inventory_map.keys())
    for sku in all_skus:
        p = products_map.get(sku)
        inv = inventory_map.get(sku)
        last_date = last_order.get(sku, "")
        days = 999
        if last_date:
            try: days = (now - datetime.strptime(last_date[:10], "%Y-%m-%d")).days
            except: pass
        stock = int(inv.get("available_qty") or 0) if inv else 0
        if days > 30 and stock > 0:
            level = "滞销" if days > 60 else ("冷淡" if days > 30 else "正常")
            result.append({"sku": sku, "product_name": p["product_name"] if p else inv.get("product_name",sku) if inv else sku, "last_order_date": last_date[:10], "days_since_last": days, "stock": stock, "level": level})
            if create_alerts:
                ex = db.table("alerts").select("id").eq("alert_type","slow_moving").eq("related_sku",sku).eq("status","active").execute().data
                if not ex:
                    db.table("alerts").insert({"alert_type":"slow_moving", "title":f"滞销: {result[-1]['product_name']}", "description":f"{days} 天无销售，库存 {stock} 件", "severity":"warning", "source":"event_bus", "related_sku":sku, "status":"active"}).execute()
    result.sort(key=lambda x: -x["days_since_last"])
    return ok(result)

@router.get('/slow-moving')
def get_slow_moving_products(db = get_db()):
    return detect_slow_moving_products(db, create_alerts=False)


@router.get('/summary')
def get_insight_summary(db = get_db()):
    inv = db.table("inventory").select("*").execute().data
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

    return {
        "total_products": total,
        "low_stock": low_stock,
        "out_of_stock": out_of_stock,
        "urgent_replenish": urgent,
        "suggestions_count": len(replen) if isinstance(replen, list) else 0,
        "slow_moving": slow_count,
        "cold_count": cold_count,
    }


@router.get('/trend-analysis')
def trend_analysis(days: int = 30, db = get_db()):
    """趋势分析：日/周/月维度聚合"""
    from collections import defaultdict
    orders = db.table("orders").select("*").execute().data
    inventory = db.table("inventory").select("*").execute().data

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
def inventory_with_sales(wh_type: str = 'own', db = get_db()):
    """库存列表 + 日销 + 在库周转 + 当月出入库
    wh_type: own=自有仓, platform=平台仓(C仓), platform_b=B仓
    """
    inv = db.table("inventory").select("*").eq("warehouse_type", wh_type).execute().data or []
    orders = db.table("orders").select("*").execute().data or []
    from datetime import datetime, timedelta
    now = datetime.utcnow()
    cutoff_28 = (now - timedelta(days=28)).strftime('%Y-%m-%d')
    cur_month = now.strftime('%Y-%m')  # 当前自然月，用于统计
    # 动态获取出入库记录的实际日期范围（仅用于表头显示）
    in_records = db.table("inbound_records").select("*").execute().data or []
    out_records = db.table("outbound_records").select("*").execute().data or []
    all_dates = set()
    for r in in_records:
        d = (r.get('inbound_date') or '')[:10]
        if d[:7] == cur_month: all_dates.add(d)
    for r in out_records:
        d = (r.get('outbound_date') or '')[:10]
        if d[:7] == cur_month: all_dates.add(d)
    if all_dates:
        month_start = min(all_dates)[:10]
        month_end = max(all_dates)[:10]
    else:
        month_start = now.replace(day=1).strftime('%Y-%m-%d')
        month_end = now.strftime('%Y-%m-%d')
    # 当月出入库汇总（按当前自然月）
    inbound_month = {}
    for r in in_records:
        if (r.get('inbound_date') or '')[:7] == cur_month:
            s = r['sku']
            inbound_month[s] = inbound_month.get(s, 0) + int(r.get('quantity',0) or 0)
    outbound_month = {}
    for r in out_records:
        if (r.get('outbound_date') or '')[:7] == cur_month:
            s = r['sku']
            outbound_month[s] = outbound_month.get(s, 0) + int(r.get('quantity',0) or 0)
    sales_28 = {}
    products_for_barcode = {p["sku"]: p for p in (db.table("products").select("*").execute().data or [])}
    for o in orders:
        sku = o.get('sku','')
        dt = str(o.get('ordered_at',''))[:10]
        qty = int(o.get('quantity',0) or 0)
        if not sku or dt < cutoff_28: continue
        bc = (products_for_barcode.get(sku) or {}).get('barcode', '')
        key = f"{sku}|{bc}" if bc else sku
        sales_28[key] = sales_28.get(key, 0) + qty
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
        result.append({
            'id': i['id'],
            'sku': sku,
            'product_name': i.get('product_name',''),
            'store': i.get('store',''),
            'warehouse': i.get('warehouse',''),
            'warehouse_type': i.get('warehouse_type','platform'),
            'available_qty': avail,
            'in_transit_qty': int(i.get('in_transit_qty',0) or 0),
            'c_transit': c_transit.get(sku, 0) if wh_type == 'platform_b' else 0,
            'daily_sales': ds,
            'month_inbound': inbound_month.get(sku, 0),
            'month_outbound': outbound_month.get(sku, 0),
            'beginning_stock': begin,
            'month_start': month_start,
            'month_end': month_end,
            'turnover_days': round((begin + inbound_month.get(sku, 0)) / outbound_month.get(sku, 0), 1) if outbound_month.get(sku, 0) > 0 else None,
        })
    return ok(result)