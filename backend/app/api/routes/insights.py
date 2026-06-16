from fastapi import APIRouter, Depends
from app.core.database import get_db
from datetime import datetime

router = APIRouter(prefix="/api/insights", tags=["insights"])


@router.get('/replenishment')
def get_replenishment_suggestions(db = get_db()):
    from datetime import timedelta
    items = db.table("inventory").select("*").execute().data
    products = {p["sku"]: p for p in db.table("products").select("*").execute().data}
    orders = db.table("orders").select("*").execute().data

    now = datetime.utcnow()
    cutoff = (now - timedelta(days=30)).strftime('%Y-%m-%d')
    sku_sales = {}
    for o in orders:
        sku = o.get('sku', '')
        if not sku: continue
        dt = str(o.get('ordered_at', ''))[:10]
        qty = int(o.get('quantity', 0) or 0)
        if dt >= cutoff:
            sku_sales[sku] = sku_sales.get(sku, 0) + qty

    suggestions = []
    for inv in items:
        sku = inv.get("sku", "")
        avail = int(inv.get("available_qty") or 0)
        safety = int(inv.get("safety_qty") or 0)
        transit = int(inv.get("in_transit_qty") or 0)
        total_sales = sku_sales.get(sku, 0)
        daily_sales = round(total_sales / 30, 1)
        lead_time = 10
        suggested = 0
        if daily_sales > 0:
            suggested = max(round(daily_sales * lead_time + safety - avail - transit), 0)
        days_to_empty = round(avail / daily_sales, 1) if daily_sales > 0 else 999

        p = products.get(sku, {})
        suggestions.append({
            "sku": sku, "product_name": inv.get("product_name") or p.get("product_name", ""),
            "store": inv.get("store"), "category": p.get("category", ""),
            "available_qty": avail, "safety_qty": safety, "in_transit_qty": transit,
            "daily_sales": daily_sales, "total_sales_30d": total_sales,
            "suggested_qty": suggested,
            "days_to_empty": days_to_empty,
            "urgency": "紧急" if days_to_empty < safety/(daily_sales or 1)/2 else ("建议" if suggested > 0 else "正常"),
        })

    suggestions.sort(key=lambda x: x['days_to_empty'])
    return suggestions


@router.get('/purchase')
def get_purchase_suggestions(db = get_db()):
    replen = get_replenishment_suggestions(db)
    suppliers = db.table("suppliers").select("*").eq("status", "active").execute().data
    if not suppliers:
        return {"suggestions": replen, "suppliers": []}

    result = []
    for item in replen:
        best = None
        for s in suppliers:
            if item.get("category") and item["category"] in (s.get("supplier_name") or ""):
                best = s
                break
        if not best and suppliers:
            best = max(suppliers, key=lambda x: x.get("score") or 0)

        result.append({
            **item,
            "supplier_code": best["supplier_code"] if best else "",
            "supplier_name": best["supplier_name"] if best else "",
            "supplier_score": best["score"] if best else 0,
        })

    return {"suggestions": result, "suppliers": len(suppliers)}


def detect_slow_moving_products(db=None, create_alerts=False):
    from datetime import datetime, timedelta
    if db is None:
        from app.core.database import get_db; db = get_db()
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
    return result

@router.get('/slow-moving')
def get_slow_moving_products(db = get_db()):
    return detect_slow_moving_products(db, create_alerts=False)


@router.get('/summary')
def get_insight_summary(db = get_db()):
    inv = db.table("inventory").select("*").execute().data
    total = len(inv)
    low_stock = len([x for x in inv if int(x.get("available_qty") or 0) < int(x.get("safety_qty") or 0)])
    out_of_stock = len([x for x in inv if int(x.get("available_qty") or 0) == 0])

    replen = get_replenishment_suggestions(db)
    urgent = len([x for x in replen if x["urgency"] == "紧急"])

    slow = get_slow_moving_products(db)
    slow_count = len([x for x in slow if x["level"] == "滞销"])
    cold_count = len([x for x in slow if x["level"] == "冷淡"])

    return {
        "total_products": total,
        "low_stock": low_stock,
        "out_of_stock": out_of_stock,
        "urgent_replenish": urgent,
        "suggestions_count": len(replen),
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


@router.get('/export-purchase')
def export_purchase_excel(db = get_db()):
    """导出补货建议为采购单 Excel"""
    from openpyxl import Workbook
    from io import BytesIO
    from fastapi.responses import StreamingResponse

    replen = get_replenishment_suggestions(db)
    suppliers = {s["supplier_code"]: s for s in db.table("suppliers").select("*").execute().data}

    wb = Workbook()
    ws = wb.active
    ws.title = "采购建议"

    headers = ["序号", "SKU", "商品名称", "店铺", "建议采购量", "当前库存",
               "安全库存", "日均销量", "可撑天数", "紧急度", "推荐供应商", "供应商编码"]
    ws.append(headers)

    # 样式
    from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
    head_fill = PatternFill(start_color="1d4ed8", end_color="1d4ed8", fill_type="solid")
    head_font = Font(bold=True, color="ffffff", size=11)
    thin = Border(
        left=Side(style='thin', color='e2e8f0'),
        right=Side(style='thin', color='e2e8f0'),
        top=Side(style='thin', color='e2e8f0'),
        bottom=Side(style='thin', color='e2e8f0')
    )
    for cell in ws[1]:
        cell.fill = head_fill
        cell.font = head_font
        cell.alignment = Alignment(horizontal='center')
        cell.border = thin

    for i, r in enumerate(replen, 1):
        if r["suggested_qty"] <= 0:
            continue
        supplier_name = ""
        supplier_code = ""
        # 简单供应商匹配：按商品分类或店铺找
        for s in suppliers.values():
            if r.get("category") and r["category"] in (s.get("supplier_name") or ""):
                supplier_name = s["supplier_name"]
                supplier_code = s["supplier_code"]
                break
        if not supplier_name and suppliers:
            s = max(suppliers.values(), key=lambda x: x.get("score") or 0)
            supplier_name = s["supplier_name"]
            supplier_code = s["supplier_code"]

        ws.append([
            i, r["sku"], r["product_name"], r["store"],
            r["suggested_qty"], r["available_qty"],
            r["safety_qty"], r["daily_sales"],
            r["days_to_empty"] if r["days_to_empty"] < 999 else "∞",
            r["urgency"], supplier_name, supplier_code
        ])
        for cell in ws[ws.max_row]:
            cell.border = thin
            cell.alignment = Alignment(horizontal='center')

    # 列宽
    widths = [6, 14, 22, 14, 12, 12, 10, 10, 10, 10, 28, 16]
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[ws.cell(1, i).column_letter].width = w

    # 总采购单
    ws2 = wb.create_sheet("汇总")
    total_qty = sum(r["suggested_qty"] for r in replen if r["suggested_qty"] > 0)
    total_items = sum(1 for r in replen if r["suggested_qty"] > 0)
    ws2.append(["采购单汇总"])
    ws2.append(["生成时间", datetime.utcnow().strftime("%Y-%m-%d %H:%M")])
    ws2.append(["建议采购SKU数", total_items])
    ws2.append(["建议采购总量", total_qty])
    ws2.merge_cells('A1:D1')
    ws2['A1'].font = Font(bold=True, size=14)

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)

    from fastapi.responses import Response
    from urllib.parse import quote
    filename = f"采购建议_{datetime.utcnow().strftime('%Y%m%d')}.xlsx"
    return Response(
        content=buf.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"}
    )


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
