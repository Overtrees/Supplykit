from fastapi import APIRouter, Depends
from app.core.database import get_db
from datetime import datetime
import json

router = APIRouter(prefix="/api/insights", tags=["insights"])


@router.get('/replenishment')
def get_replenishment_suggestions(days: int = 28, source: str = '', mode: str = 'bbcc', db = get_db()):
    """补货建议，支持 days=7/14/28 切换，mode=bbcc/traditional 切换模型"""
    from datetime import timedelta

    # 读取当前模式的补货参数
    cfg_rows = db.table("replenishment_config").select("*").execute().data
    raw = {r['key']: r['value'] for r in cfg_rows}
    cfg = {}
    prefix = f'mode_{mode}_'
    for k, v in raw.items():
        if k.startswith(prefix):
            cfg[k[len(prefix):]] = v
    # mode 前缀找不到时回退到全局旧参数（如 lead_time_days → mode 未设时取全局值）
    for k, v in raw.items():
        if not k.startswith('mode_') and k not in cfg:
            cfg[k] = v
    items = db.table("inventory").select("*").in_("warehouse_type", ["platform", "platform_b"]).execute().data
    products = {p["sku"]: p for p in db.table("products").select("*").execute().data}
    orders = db.table("orders").select("*").execute().data

    # 三周期日销预计算（可选按数据源和仓库过滤）
    def calc_sales(cutoff_days, wh_name=None):
        cutoff = (datetime.utcnow() - timedelta(days=cutoff_days)).strftime('%Y-%m-%d')
        sku_s = {}
        for o in orders:
            if source and o.get('data_source','') != source: continue
            if wh_name and o.get('warehouse','') != wh_name: continue
            sku = o.get('sku', '')
            if not sku: continue
            dt = str(o.get('ordered_at', ''))[:10]
            qty = int(o.get('quantity', 0) or 0)
            if dt >= cutoff:
                sku_s[sku] = sku_s.get(sku, 0) + qty
        return sku_s

    sales_7 = calc_sales(7)
    sales_14 = calc_sales(14)
    sales_28 = calc_sales(28)
    selected_sales = {28: sales_28, 14: sales_14, 7: sales_7}.get(days, sales_28)

    if mode == 'bbcc':
        lead_time = int(cfg.get('lead_time_days', '0'))
        lead_time = lead_time + int(cfg.get('ship_to_b_days', '0')) + int(cfg.get('b_to_c_days', '0')) + int(cfg.get('c_safety_days', '0'))
    else:
        lead_time = int(cfg.get('lead_time_days', '0'))
    # 活动系数（按模式独立存储）
    season_key = f'season_config_{mode}'
    season_val = db.table('replenishment_config').select('*').eq('key', season_key).execute().data
    season_config = json.loads(season_val[0]['value']) if season_val and season_val[0].get('value') else []
    active_factor = 1.0
    for s in season_config:
        if isinstance(s, dict) and s.get("enabled") and float(s.get("factor", 1.0)) > active_factor:
            active_factor = float(s["factor"])

    suggestions = []

    if mode == 'bbcc':
        # BBCC 模式：全仓汇总，按 SKU 一条建议（送B仓，京东内配到C仓）
        agg = {}
        wh_detail = {}
        b_stock = {}
        for inv in items:
            sku = inv.get("sku", "")
            if sku not in agg:
                agg[sku] = {'available': 0, 'transit': 0, 'safety': 0, 'safety_days': 0, 'warehouses': set()}
                wh_detail[sku] = []
                b_stock[sku] = 0
            wt = inv.get('warehouse_type', '')
            qty = int(inv.get("available_qty") or 0)
            tty = int(inv.get("in_transit_qty") or 0)
            if wt == 'platform_b':
                b_stock[sku] += qty
            else:
                agg[sku]['available'] += qty
                agg[sku]['transit'] += tty
            agg[sku]['safety'] += int(inv.get("safety_qty") or 0)
            sd = float(inv.get('safety_days') or 0)
            if sd > agg[sku]['safety_days']: agg[sku]['safety_days'] = sd
            wh_name = inv.get('warehouse', '')
            if wh_name:
                agg[sku]['warehouses'].add(wh_name)
                wh_detail[sku].append({
                    'warehouse': wh_name, 'type': wt,
                    'available': qty, 'transit': tty,
                })
        for sku, st in agg.items():
            avail = st['available']; transit = st['transit']; safety = st['safety']
            ds7 = round(sales_7.get(sku, 0) / 7, 1)
            ds14 = round(sales_14.get(sku, 0) / 14, 1)
            ds28 = round(sales_28.get(sku, 0) / 28, 1)
            sel_ds = {28: ds28, 14: ds14, 7: ds7}[days]
            sel_ds = round(sel_ds * active_factor, 1)
            sku_safety_days = st['safety_days']
            safety_days = sku_safety_days if sku_safety_days > 0 else float(cfg.get('safety_multiplier', '0'))
            effective_safety = round(sel_ds * safety_days) if sel_ds > 0 else 0
            # 第一步：C仓需求缺口
            c_gap = max(round(sel_ds * lead_time + effective_safety - avail - transit), 0) if sel_ds > 0 else 0
            # 第二步：B仓供给约束
            b_available = b_stock.get(sku, 0)
            suggested = min(c_gap, b_available)
            b_gap = max(c_gap - b_available, 0)  # B仓缺口：需要从自有仓调
            raw_suggested = suggested
            # 箱规向上取整
            prod = products.get(sku, {})
            box = int(prod.get('box_qty', 1) or 1)
            box_qty = (suggested + box - 1) // box * box if suggested > 0 else 0
            suggested = box_qty
            days_to_empty = round(avail / sel_ds, 1) if sel_ds > 0 else 999
            after_stock = avail + transit + suggested
            after_turnover = round(after_stock / sel_ds, 1) if sel_ds > 0 else 999
            max_turnover = int(cfg.get('max_turnover_days', '0'))
            tw15 = int(cfg.get('turnover_warning_15', '15'))
            tw90 = int(cfg.get('turnover_warning_90', '90'))
            note = f"箱规{box}件, 实补{suggested}件（{suggested//box}箱）" if suggested > 0 else "无需补货"
            if c_gap > b_available and suggested > 0:
                note += f" ⚠️ B仓仅{b_available}件, 缺口{b_gap}件需从自有仓调拨"
            if suggested > 0:
                note += f", 补后周转{after_turnover}天"
                if after_turnover <= tw15:
                    note += " ✅ B仓免费期内"
                elif after_turnover <= tw90:
                    note += " ⚠️ 超B仓免费期, 有仓储费"
                else:
                    note += " 🔴 超周转考核红线90天"
                note += ", 建议分批" if after_turnover > tw15 else ", 周转正常"
            # BBCC三环节周转
            c_turnover = round(avail / sel_ds, 1) if sel_ds > 0 else None      # C仓周转
            transit_turnover = round(transit / sel_ds, 1) if sel_ds > 0 else None  # 在途周转
            combined_turnover = round((avail + transit + b_stock.get(sku, 0)) / sel_ds, 1) if sel_ds > 0 else None  # 综合周转(B+在途+C)
            suggestions.append({
                "sku": sku, "product_name": prod.get('product_name', ''),
                "store": prod.get('store', ''), "category": prod.get('category', ''),
                "available_qty": avail, "safety_qty": safety, "in_transit_qty": transit,
                "b_stock": b_stock.get(sku, 0), "c_stock": avail, "b_gap": b_gap,
                "daily_sales": sel_ds, "raw_suggested": raw_suggested, "suggested_qty": suggested,
                "days_to_empty": days_to_empty, "after_turnover": after_turnover,
                "c_turnover": c_turnover, "transit_turnover": transit_turnover,
                "combined_turnover": combined_turnover,
                "warehouse_detail": wh_detail.get(sku, []),
                "urgency": "紧急" if days_to_empty < 3 else ("建议" if suggested > 0 else "正常"),
                "warehouses": len(st['warehouses']), "note": note, "box_qty": box,
                "lead_time": lead_time, "safety_days": safety_days,
            })
    else:
        # 传统模式：按仓逐条计算，日销按对应仓库+SKU独立统计
        # 预计算各仓库的日销
        wh_names = set(i.get('warehouse','') for i in items if i.get('warehouse'))
        wh_sales_cache = {}
        for wh_name in wh_names:
            wh_sales_cache[wh_name] = {
                7: calc_sales(7, wh_name),
                14: calc_sales(14, wh_name),
                28: calc_sales(28, wh_name),
            }
        for inv in items:
            sku = inv.get("sku", "")
            wh = inv.get("warehouse", "")
            avail = int(inv.get("available_qty") or 0)
            safety = int(inv.get("safety_qty") or 0)
            transit = int(inv.get("in_transit_qty") or 0)
            wh_s = wh_sales_cache.get(wh, {7:{},14:{},28:{}})
            ds7 = round(wh_s[7].get(sku, 0) / 7, 1)
            ds14 = round(wh_s[14].get(sku, 0) / 14, 1)
            ds28 = round(wh_s[28].get(sku, 0) / 28, 1)
            sel_ds = {28: ds28, 14: ds14, 7: ds7}[days]
            sel_ds = round(sel_ds * active_factor, 1)

            sku_safety_days = float(inv.get('safety_days') or 0)
            safety_days = sku_safety_days if sku_safety_days > 0 else float(cfg.get('safety_multiplier', '0'))
            effective_safety = round(sel_ds * safety_days) if sel_ds > 0 else 0
            suggested = max(round(sel_ds * lead_time + effective_safety - avail - transit), 0) if sel_ds > 0 else 0
            raw_suggested = suggested
            p = products.get(sku, {})
            box = int(p.get('box_qty', 1) or 1)
            box_qty = (suggested + box - 1) // box * box if suggested > 0 else 0
            suggested = box_qty
            days_to_empty = round(avail / sel_ds, 1) if sel_ds > 0 else 999
            after_stock = avail + transit + suggested
            after_turnover = round(after_stock / sel_ds, 1) if sel_ds > 0 else 999
            max_turnover = int(cfg.get('max_turnover_days', '0'))
            tw15 = int(cfg.get('turnover_warning_15', '15'))
            tw90 = int(cfg.get('turnover_warning_90', '90'))
            note = f"箱规{box}件, 实补{suggested}件（{suggested//box}箱）" if suggested > 0 else "无需补货"
            if suggested > 0:
                note += f", 补后周转{after_turnover}天"
                if after_turnover <= tw15:
                    note += " ✅ 周转正常"
                elif after_turnover <= tw90:
                    note += " ⚠️ 超过15天, 关注仓储"
                else:
                    note += " 🔴 超过90天, 周转考核风险"
            suggestions.append({
                "sku": sku, "product_name": inv.get("product_name") or p.get("product_name", ""),
                "store": inv.get("store"), "warehouse": inv.get("warehouse", ""), "category": p.get("category", ""),
                "available_qty": avail, "safety_qty": safety, "in_transit_qty": transit,
                "daily_sales": sel_ds, "raw_suggested": raw_suggested, "suggested_qty": suggested,
                "days_to_empty": days_to_empty, "after_turnover": after_turnover, "note": note,
                "box_qty": box, "urgency": "紧急" if days_to_empty < 3 else ("建议" if suggested > 0 else "正常"),
            })

        # B仓超15天仓储费风险告警
        if days_to_empty > max_turnover and sel_ds > 0:
            try:
                exists = db.table("alerts").select("id").eq("alert_type","storage_fee")\
                    .eq("related_sku",sku).eq("status","active").execute().data
                if not exists:
                    db.table("alerts").insert({
                        "alert_type":"storage_fee","title":f"B仓周转超限: {inv.get('product_name',sku)}",
                        "description":f"库存可撑 {days_to_empty}天 > B仓免费 {max_turnover}天，超期将产生仓储费",
                        "severity":"warning","source":"replenishment_engine",
                        "related_sku":sku,"status":"active"
                    }).execute()
            except Exception as e:
                import logging; logging.warning('B仓告警创建失败: %s', e)

        p = products.get(sku, {})
        suggestions.append({
            "sku": sku, "product_name": inv.get("product_name") or p.get("product_name", ""),
            "store": inv.get("store"), "category": p.get("category", ""),
            "available_qty": avail, "safety_qty": safety, "in_transit_qty": transit,
            "safety_days": safety_days,
            "daily_sales": sel_ds,
            "daily_sales_7": ds7, "daily_sales_14": ds14, "daily_sales_28": ds28,
            "suggested_qty": suggested,
            "days_to_empty": days_to_empty,
            "urgency": "仓储费风险" if days_to_empty > max_turnover else ("紧急" if days_to_empty < effective_safety/(sel_ds or 1)/2 else ("建议" if suggested > 0 else "正常")),
        })

    suggestions.sort(key=lambda x: x['days_to_empty'])
    return suggestions


@router.get('/replenishment/compare')
def compare_replenishment_sources(days: int = 28, db = get_db()):
    """对比不同数据源的补货建议：综合 / 商智日销 / 京东采购单"""
    return {
        'all': get_replenishment_suggestions(days=days, source='', db=db),
        'jdzx_sale': get_replenishment_suggestions(days=days, source='jdzx_sale', db=db),
        'jd_po': get_replenishment_suggestions(days=days, source='jd_po', db=db),
    }


@router.get('/purchase')
def get_purchase_suggestions(days: int = 28, mode: str = 'bbcc', db = get_db()):
    """采购建议：系统总库存视角，含目标周转控制"""
    from datetime import timedelta
    # 1. 读取全库配置
    raw = {r['key']: r['value'] for r in db.table("replenishment_config").select("*").execute().data}

    purchase_lead_time = int(raw.get('purchase_lead_days', '0'))
    moq_default = int(raw.get('moq', '0'))
    purchase_safety_days = float(raw.get('purchase_safety_days', '0'))
    target_turnover = int(raw.get('max_turnover_days', '0'))  # 目标周转天数

    # 2. 活动系数
    season_key = f'season_config_{mode}'
    sv = db.table('replenishment_config').select('*').eq('key', season_key).execute().data
    season_config = json.loads(sv[0]['value']) if sv and sv[0].get('value') else []
    active_factor = 1.0
    for s in season_config:
        if isinstance(s, dict) and s.get('enabled') and float(s.get('factor', 1.0)) > active_factor:
            active_factor = float(s['factor'])

    # 3. 日销（按 days 窗口）
    now = datetime.utcnow()
    cutoff = (now - timedelta(days=days)).strftime('%Y-%m-%d')
    sales_by_sku = {}
    for o in db.table("orders").select("*").execute().data:
        sku = o.get("sku", "")
        dt = str(o.get("ordered_at", ""))[:10]
        if dt >= cutoff:
            sales_by_sku[sku] = sales_by_sku.get(sku, 0) + int(o.get('quantity', 0) or 0)
    daily_sales = {k: round(v / days, 1) for k, v in sales_by_sku.items()}

    # 4. 系统总库存 = 全仓可用 + 全仓在途（平台仓+自有仓统一汇总）
    inv_data = db.table("inventory").select("*").execute().data
    stock_by_sku = {}
    b_avail = {}
    for i in inv_data:
        s = i['sku']
        if s not in stock_by_sku:
            stock_by_sku[s] = {'available': 0, 'transit': 0, 'safety': 0, 'safety_days': 0,
                               'own_avail': 0, 'own_transit': 0, 'plat_avail': 0, 'plat_transit': 0,
                               'own_warehouse': ''}
            b_avail[s] = 0
        qty = int(i.get('available_qty', 0) or 0)
        tty = int(i.get('in_transit_qty', 0) or 0)
        wt = i.get('warehouse_type', 'platform')
        stock_by_sku[s]['available'] += qty
        stock_by_sku[s]['transit'] += tty
        stock_by_sku[s]['safety'] += int(i.get('safety_qty', 0) or 0)
        sd = float(i.get('safety_days', 0) or 0)
        if sd > stock_by_sku[s]['safety_days']:
            stock_by_sku[s]['safety_days'] = sd
        if wt == 'platform_b':
            b_avail[s] += qty
        elif wt == 'own':
            stock_by_sku[s]['own_avail'] += qty
            stock_by_sku[s]['own_transit'] += tty
            if not stock_by_sku[s]['own_warehouse']:
                stock_by_sku[s]['own_warehouse'] = i.get('warehouse', '')
        else:
            stock_by_sku[s]['plat_avail'] += qty
            stock_by_sku[s]['plat_transit'] += tty

    # 5. 供应商
    suppliers = db.table("suppliers").select("*").eq("status", "active").execute().data
    products = {p["sku"]: p for p in db.table("products").select("*").execute().data}

    # 6. 逐 SKU 计算（系统总库存视角）
    result = []
    for sku, st in stock_by_sku.items():
        ds = round(daily_sales.get(sku, 0) * active_factor, 1)  # 含活动系数
        sys_avail = st['available']
        sys_transit = st['transit']
        sys_total = sys_avail + sys_transit  # 系统总库存

        # 安全库存
        safety_days = st['safety_days'] if st['safety_days'] > 0 else purchase_safety_days
        eff_safety = round(ds * safety_days) if ds > 0 else 0
        b_a = b_avail.get(sku, 0)
        own_a = st['own_avail']

        # 采购量 = (全国C仓日销×采购前置期) + B仓安全库存 − B仓可用 − 自有仓可用
        c_consume = round(ds * purchase_lead_time) if ds > 0 else 0
        purchase_qty = max(c_consume + eff_safety - b_a - own_a, 0) if ds > 0 else 0
        # 兜底 MOQ
        purchase_qty = max(purchase_qty, moq_default) if purchase_qty > 0 else 0

        days_to_empty = round(sys_avail / ds, 1) if ds > 0 else 999

        # 补后自有仓周转（采购货到自有仓后/日销，仅对比参考）
        after_stock = st['own_avail'] + purchase_qty
        after_turnover = round(after_stock / ds, 1) if ds > 0 else 999
        target_turn = int(raw.get('max_turnover_days', '0'))
        note = ""
        if purchase_qty > 0:
            note = f"C仓消耗{c_consume}+安全{eff_safety} -B仓{int(b_a)} -自有{int(own_a)} ={int(purchase_qty)}"
            note += f" | 箱规{box_qty}件, 实购{actual_purchase}件"
            note += f"（{actual_purchase//box_qty}箱）" if box_qty > 1 else ""
            note += f", 补后周转{after_turnover}天"
            if target_turn > 0:
                note += f" > 目标{target_turn}天" if after_turnover > target_turn else f" < 目标{target_turn}天"

        # 匹配供应商
        prod = products.get(sku, {})
        box_qty = int(prod.get('box_qty', 1) or 1)
        actual_purchase = (purchase_qty + box_qty - 1) // box_qty * box_qty if purchase_qty > 0 else 0
        best = None
        for s in suppliers:
            if prod.get('category') and prod['category'] in (s.get('supplier_name') or ''):
                best = s; break
        if not best and suppliers:
            best = max(suppliers, key=lambda x: x.get('score', 0))

        result.append({
            'sku': sku, 'product_name': prod.get('product_name', ''),
            'store': prod.get('store', ''), 'warehouse': st['own_warehouse'], 'category': prod.get('category', ''),
            'sys_available': sys_avail, 'sys_transit': sys_transit, 'sys_total': sys_total,
            'own_available': st['own_avail'], 'own_transit': st['own_transit'],
            'plat_available': st['plat_avail'], 'plat_transit': st['plat_transit'],
            'b_available': b_avail.get(sku, 0),
            'safety_qty': st['safety'], 'daily_sales': ds,
            'purchase_qty': purchase_qty, 'box_qty': box_qty, 'actual_purchase': actual_purchase,
            'after_stock': st['own_avail'] + purchase_qty, 'after_turnover': after_turnover,
            'days_to_empty': days_to_empty, 'note': note,
            'supplier_code': best['supplier_code'] if best else '',
            'supplier_name': best['supplier_name'] if best else '',
            'supplier_score': best['score'] if best else 0,
        })

    result.sort(key=lambda x: x['days_to_empty'])
    # 创建补货告警
    for r in result:
        if r['purchase_qty'] > 0 and r['days_to_empty'] < 14:
            try:
                ex = db.table("alerts").select("id").eq("alert_type","purchase_need").eq("related_sku",r['sku']).eq("status","active").execute().data
                if not ex:
                    db.table("alerts").insert({
                        "alert_type":"purchase_need","title":f"需采购: {r['product_name']}",
                        "description":f"可用{r['available_qty']}件, 建议采购{r['purchase_qty']}件, 可撑{r['days_to_empty']}天",
                        "severity":"warning","source":"purchase_engine",
                        "related_sku":r['sku'],"status":"active"
                    }).execute()
            except: pass
        elif r['purchase_qty'] == 0:
            try:
                # 库存充足 → 关闭已有告警
                db.table("alerts").update({"status":"closed"}).eq("alert_type","purchase_need").eq("related_sku",r['sku']).eq("status","active").execute()
            except: pass
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

    replen = get_replenishment_suggestions(db=db)
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


@router.get('/export-orders')
def export_orders_excel(db = get_db()):
    from openpyxl import Workbook
    from io import BytesIO
    from fastapi.responses import StreamingResponse
    orders = db.table("orders").select("*").order("id", desc=True).execute().data or []
    wb = Workbook()
    ws = wb.active; ws.title = "订单"
    headers = ['订单号','店铺','仓库','SKU','商品名称','数量','单价','金额','状态','日期','平台','供应商','备注']
    ws.append(headers)
    for o in orders:
        ws.append([o.get('order_no',''),o.get('store',''),o.get('warehouse',''),o.get('sku',''),
                   o.get('product_name',''),o.get('quantity',0),o.get('unit_price',0),
                   o.get('total_amount',0),o.get('order_status',''),o.get('ordered_at',''),
                   o.get('platform',''),o.get('supplier',''),o.get('remark','')])
    buf = BytesIO(); wb.save(buf); buf.seek(0)
    return StreamingResponse(buf, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                             headers={'Content-Disposition':'attachment; filename=orders.xlsx'})

@router.get('/export-inventory')
def export_inventory_excel(db = get_db()):
    from openpyxl import Workbook
    from io import BytesIO
    from fastapi.responses import StreamingResponse
    items = db.table("inventory").select("*").order("id", desc=True).execute().data or []
    wb = Workbook()
    ws = wb.active; ws.title = "库存"
    headers = ['SKU','商品名称','店铺','仓库','可用','锁定','在途','安全线','安全天数']
    ws.append(headers)
    for i in items:
        ws.append([i.get('sku',''),i.get('product_name',''),i.get('store',''),i.get('warehouse',''),
                   i.get('available_qty',0),i.get('locked_qty',0),i.get('in_transit_qty',0),
                   i.get('safety_qty',0),i.get('safety_days',0)])
    buf = BytesIO(); wb.save(buf); buf.seek(0)
    return StreamingResponse(buf, media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                             headers={'Content-Disposition':'attachment; filename=inventory.xlsx'})

@router.get('/export-purchase')
def export_purchase_excel(days: int = 28, mode: str = 'bbcc', db = get_db()):
    """导出补货建议为采购单 Excel"""
    from openpyxl import Workbook
    from io import BytesIO
    from fastapi.responses import StreamingResponse

    replen = get_replenishment_suggestions(days=days, db=db)
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
@router.get('/with-sales')
def inventory_with_sales(db = get_db()):
    """库存列表 + 日销 + 在库周转 + 当月出入库"""
    inv = db.table("inventory").select("*").eq("warehouse_type", "own").execute().data or []
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
    for o in orders:
        sku = o.get('sku','')
        dt = str(o.get('ordered_at',''))[:10]
        qty = int(o.get('quantity',0) or 0)
        if sku and dt >= cutoff_28:
            sales_28[sku] = sales_28.get(sku, 0) + qty
    result = []
    for i in inv:
        sku = i['sku']
        ds = round(sales_28.get(sku, 0) / 28, 1)
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
            'daily_sales': ds,
            'month_inbound': inbound_month.get(sku, 0),
            'month_outbound': outbound_month.get(sku, 0),
            'beginning_stock': begin,
            'month_start': month_start,
            'month_end': month_end,
            'turnover_days': round((begin + inbound_month.get(sku, 0)) / outbound_month.get(sku, 0), 1) if outbound_month.get(sku, 0) > 0 else None,
        })
    return result