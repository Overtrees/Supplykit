from fastapi import APIRouter, Depends
from app.core.database import get_db
from datetime import datetime
import json

router = APIRouter(prefix="/api/insights", tags=["insights"])


@router.get('/replenishment')
def get_replenishment_suggestions(days: int = 28, source: str = '', mode: str = 'bbcc', db = get_db()):
    """补货建议，支持 days=7/14/28 切换，mode=bbcc/traditional 切换模型"""
    from datetime import timedelta

    # 清理旧的 storage_fee 告警（已废弃的逻辑）
    try: db.table("alerts").update({"status": "inactive"}).eq("alert_type", "storage_fee").eq("status", "active").execute()
    except: pass

    # B仓超储预警：基于标记操作的入库日期
    try:
        pos = db.table("purchase_orders").select("*").execute().data or []
        now = datetime.utcnow()
        for po in pos:
            ad = po.get("arrival_date", "")
            if not ad or po.get("status") == "completed": continue
            try: days = (now - datetime.strptime(ad[:10], "%Y-%m-%d")).days
            except: continue
            sku = po.get("sku", "")
            existing = db.table("alerts").select("id").eq("alert_type", "b_storage_warn").eq("related_sku", sku).eq("status", "active").execute().data
            if days >= 11 and days < 15:
                if not existing:
                    db.table("alerts").insert({"alert_type":"b_storage_warn","title":f"B仓即将超免费期: {po.get('product_name',sku)}",
                        "description":f"入库已{days}天，即将超B仓15天免费期","severity":"info","source":"replenishment_engine","related_sku":sku,"status":"active"}).execute()
            elif days >= 15 and days < 20:
                if not existing:
                    db.table("alerts").insert({"alert_type":"b_storage_warn","title":f"B仓超免费期: {po.get('product_name',sku)}",
                        "description":f"入库已{days}天，超B仓15天免费期，产生仓储费","severity":"warning","source":"replenishment_engine","related_sku":sku,"status":"active"}).execute()
            elif days >= 20:
                # 超20天升级为严重
                if existing:
                    db.table("alerts").update({"severity":"error","description":f"入库已{days}天，远超B仓15天免费期，仓储费持续累计"}).eq("id", existing[0]["id"]).execute()
                else:
                    db.table("alerts").insert({"alert_type":"b_storage_warn","title":f"B仓严重超期: {po.get('product_name',sku)}",
                        "description":f"入库已{days}天，远超B仓15天免费期，仓储费持续累计","severity":"error","source":"replenishment_engine","related_sku":sku,"status":"active"}).execute()
            elif days >= 11 and existing:
                # 接近时已有告警则更新描述
                db.table("alerts").update({"description":f"入库已{days}天，即将超B仓15天免费期"}).eq("id", existing[0]["id"]).execute()
    except Exception as e:
        import logging; logging.warning("B仓预警失败: %s", e)

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

# 三周期日销预计算（可选按数据源和仓库过滤）——返回日均值（含异常剔除+趋势加权）
    def calc_sales(cutoff_days, wh_name=None):
        from datetime import timedelta
        cutoff = (datetime.utcnow() - timedelta(days=cutoff_days)).strftime('%Y-%m-%d')
        daily_by_sku = {}
        for o in orders:
            if source and o.get('data_source','') != source: continue
            if wh_name and o.get('warehouse','') != wh_name: continue
            sku = o.get('sku', '')
            if not sku: continue
            dt = str(o.get('ordered_at', ''))[:10]
            qty = int(o.get('quantity', 0) or 0)
            if dt >= cutoff:
                if sku not in daily_by_sku:
                    daily_by_sku[sku] = {}
                daily_by_sku[sku][dt] = daily_by_sku[sku].get(dt, 0) + qty

        from datetime import timedelta
        result = {}
        for sku, daily in daily_by_sku.items():
            n = len(daily)
            total = sum(daily.values())
            base_avg = total / cutoff_days
            if n < 3 or cutoff_days < 7:
                result[sku] = base_avg
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
            result[sku] = weighted_sum / weight_total if weight_total > 0 else 0
        # 补0日销的SKU
        for sku in set(o.get('sku','') for o in orders):
            if sku not in result:
                result[sku] = 0
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

    sales_7 = calc_sales(7)
    sales_14 = calc_sales(14)
    sales_28 = calc_sales(28)

    if mode == 'bbcc':
        # BBCC：仅算B→C调拨周期（不算生产到货和发B仓）
        c_lead = int(cfg.get('b_to_c_days', '0')) + int(cfg.get('c_safety_days', '0'))
        lead_time = c_lead
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
            ds7 = round(sales_7.get(sku, 0), 1)
            ds14 = round(sales_14.get(sku, 0), 1)
            ds28 = round(sales_28.get(sku, 0), 1)
            sel_ds = round(rolling_predict(ds7, ds14, ds28) * active_factor, 1)
            sku_safety_days = st['safety_days']
            safety_days = sku_safety_days if sku_safety_days > 0 else float(cfg.get('safety_multiplier', '0'))
            effective_safety = round(sel_ds * safety_days) if sel_ds > 0 else 0
            # 第一步：C仓需求缺口（安全天数 safety_multiplier 归自有仓→B仓调拨使用，不叠加在此）
            c_gap = max(round(sel_ds * lead_time - avail - transit), 0) if sel_ds > 0 else 0
            # 第二步：B仓供给约束（B不足时用自有仓→B仓调拨量兜底）
            b_available = b_stock.get(sku, 0)
            suggested = min(c_gap, b_available)
            b_gap = max(c_gap - b_available, 0)
            # 第三层：自有仓→B仓调拨量（运输期间C仓持续销售，货到B仓即被京东调往C，需多备这段消耗）
            b_ship_days = int(cfg.get('ship_to_b_days', '0'))
            b_replenish = round(b_gap + sel_ds * b_ship_days + effective_safety) if b_gap > 0 else 0
            raw_suggested = c_gap  # C仓实际缺口（与B仓有无库存无关）
            # 箱规向上取整
            prod = products.get(sku, {})
            box = int(prod.get('box_qty', 1) or 1)
            box_qty = (raw_suggested + box - 1) // box * box if raw_suggested > 0 else 0
            suggested = box_qty  # C仓建议补（箱规后）
            b_box_qty = (b_replenish + box - 1) // box * box if b_replenish > 0 else 0  # B仓需补（箱规后）
            after_stock = avail + transit + suggested
            after_turnover = round(after_stock / sel_ds, 1) if sel_ds > 0 else 999
            days_to_empty = round(avail / sel_ds, 1) if sel_ds > 0 else 999
            tw15 = int(cfg.get('turnover_warning_15', '15'))
            tw90 = int(cfg.get('turnover_warning_90', '90'))
            note = f"C仓建议{suggested}件  B仓需补{b_box_qty}件 · 箱规{box}件" if (suggested > 0 or b_box_qty > 0) else ""
            combined_turnover_current = round((avail + transit + b_stock.get(sku, 0)) / sel_ds, 1) if sel_ds > 0 else None
            # 当前综转超90天预警
            if combined_turnover_current is not None and combined_turnover_current > 90:
                note += (" " if note else "") + f"🔴 当前综转{combined_turnover_current}天超红线90"
            if not note:
                note = "库存充足"
            if b_gap > 0:
                c_cover = round((avail + transit) / sel_ds, 1) if sel_ds > 0 else 0
                b_idle = max(round(c_cover - b_ship_days, 1), 0)
                note += f" ⚠️ B仓仅{b_available}件, 缺口{b_gap}件需从自有仓调拨(运输{round(sel_ds*b_ship_days)}件+安全{round(effective_safety)}件)"
                note += f" · B仓预计空闲{b_idle}天后调出"
                if b_idle > 15:
                    note += " 🔴 超15天免费期有仓储费"
                elif b_idle > 10:
                    note += " ⚠️ 接近15天免费期"
            # BBCC三环节周转
            c_turnover = round(avail / sel_ds, 1) if sel_ds > 0 else None      # C仓周转
            transit_turnover = round(transit / sel_ds, 1) if sel_ds > 0 else None  # 在途周转
            combined_turnover = round((avail + transit + suggested + b_stock.get(sku, 0) + b_box_qty) / sel_ds, 1) if sel_ds > 0 else None  # 补后综合周转
            suggestions.append({
                "sku": sku, "product_name": prod.get('product_name', ''),
                "store": prod.get('store', ''), "category": prod.get('category', ''),
                "available_qty": avail, "safety_qty": safety, "in_transit_qty": transit,
                "b_stock": b_stock.get(sku, 0), "c_stock": avail, "b_gap": b_gap,
                "daily_sales": sel_ds, "daily_sales_7": round(ds7, 1), "daily_sales_14": round(ds14, 1), "daily_sales_28": round(ds28, 1),
                "raw_suggested": raw_suggested, "suggested_qty": suggested,
                "b_suggested": b_box_qty, "b_replenish_raw": b_replenish,
                "days_to_empty": days_to_empty, "after_turnover": after_turnover,
                "c_turnover": c_turnover, "transit_turnover": transit_turnover,
                "combined_turnover_current": combined_turnover_current, "combined_turnover": combined_turnover,
                "warehouse_detail": wh_detail.get(sku, []),
                "urgency": "紧急" if days_to_empty < 3 else ("建议" if suggested > 0 or b_box_qty > 0 else "正常"),
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
        # 预计算各 SKU 在各仓的销量分布（跨仓对比用）
        sku_wh_sales28 = {}
        for inv in items:
            s = inv.get("sku", ""); w = inv.get("warehouse", "")
            if s and w:
                ws = wh_sales_cache.get(w, {28:{}})[28]
                v = round(ws.get(s, 0), 1)
                sku_wh_sales28.setdefault(s, {})[w] = v
        sku_best_wh = {s: max(wk.items(), key=lambda x: x[1])[0] if wk else ''
                       for s, wk in sku_wh_sales28.items()}

        for inv in items:
            sku = inv.get("sku", "")
            wh = inv.get("warehouse", "")
            avail = int(inv.get("available_qty") or 0)
            safety = int(inv.get("safety_qty") or 0)
            transit = int(inv.get("in_transit_qty") or 0)
            wh_s = wh_sales_cache.get(wh, {7:{},14:{},28:{}})
            ds7 = round(wh_s[7].get(sku, 0), 1)
            ds14 = round(wh_s[14].get(sku, 0), 1)
            ds28 = round(wh_s[28].get(sku, 0), 1)
            sel_ds = round(rolling_predict(ds7, ds14, ds28) * active_factor, 1)

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
            tw15 = int(cfg.get('turnover_warning_15', '15'))
            tw90 = int(cfg.get('turnover_warning_90', '90'))
            # 趋势分析
            t7 = '📈' if ds7 > ds14 * 1.15 else ('📉' if ds7 < ds14 * 0.85 else '➡️')
            t14 = '📈' if ds14 > ds28 * 1.15 else ('📉' if ds14 < ds28 * 0.85 else '➡️')
            trend_text = f"近7{t7} 近14{t14}"
            if ds7 > ds14 * 1.15 and ds14 > ds28 * 1.1:
                trend_text += " 持续上行, 按滚动预测补"
            elif ds7 < ds14 * 0.85 and ds14 < ds28 * 0.9:
                trend_text += " 持续下行, 建议减量或观望"
            elif ds7 > ds14 * 1.15:
                trend_text += " 7天抬头, 正常补关注下期"
            elif ds7 < ds14 * 0.85:
                trend_text += " 7天走弱, 保守补避免积压"
            else:
                trend_text += " 趋势平稳, 按滚动预测补"
            note = f"{trend_text}"
            if suggested > 0:
                note += f" · 箱规{box}件, 实补{suggested}件({suggested//box}箱)"
                note += f" · 补后{after_turnover}天"
                if after_turnover <= tw15:
                    note += " ✅"
                elif after_turnover <= tw90:
                    note += " ⚠️ 超15天"
                else:
                    note += " 🔴 超90天"
                # 跨仓提示
                if sku in sku_wh_sales28 and wh != sku_best_wh.get(sku, ''):
                    best_wh = sku_best_wh[sku]
                    best_sales = sku_wh_sales28[sku][best_wh]
                    if best_sales > ds28 * 2:
                        note += f" · {best_wh}日均{best_sales}件, 可考虑内配"
            else:
                note += " · 无需补货"
            suggestions.append({
                "sku": sku, "product_name": inv.get("product_name") or p.get("product_name", ""),
                "store": inv.get("store"), "warehouse": inv.get("warehouse", ""), "category": p.get("category", ""),
                "available_qty": avail, "safety_qty": safety, "in_transit_qty": transit,
                "daily_sales": sel_ds, "daily_sales_7": round(sales_7.get(sku, 0), 1), "daily_sales_14": round(sales_14.get(sku, 0), 1), "daily_sales_28": round(sales_28.get(sku, 0), 1),
                "raw_suggested": raw_suggested, "suggested_qty": suggested,
                "days_to_empty": days_to_empty, "after_turnover": after_turnover, "note": note,
                "box_qty": box, "urgency": "紧急" if days_to_empty < 3 else ("建议" if suggested > 0 else "正常"),
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

    # 3. 日销：14天+28天双窗口融合（采购求稳，不加7天）
    def purchase_calc(win):
        cutoff = (now - timedelta(days=win)).strftime('%Y-%m-%d')
        daily_raw = {}
        for o in db.table("orders").select("*").execute().data:
            s = o.get("sku", ""); dt = str(o.get("ordered_at", ""))[:10]; q = int(o.get('quantity',0) or 0)
            if dt >= cutoff and s:
                if s not in daily_raw: daily_raw[s] = {}
                daily_raw[s][dt] = daily_raw[s].get(dt, 0) + q
        result = {}
        for sku, daily in daily_raw.items():
            all_d = [(now - timedelta(days=i)).strftime('%Y-%m-%d') for i in range(win)]
            vals = [daily.get(d, 0) for d in all_d]
            mean = sum(vals) / win
            var = sum((v-mean)**2 for v in vals) / win
            th = max(3*var**0.5, mean*1.5)
            w_sum = w_total = 0
            for idx, v in enumerate(reversed(vals)):
                if abs(v-mean) <= th:
                    w = 1.5 if idx >= win-3 else 1.0
                    w_sum += v * w; w_total += w
            result[sku] = round(w_sum/w_total, 1) if w_total > 0 else round(mean, 1)
        return result
    now = datetime.utcnow()
    sales_14 = purchase_calc(14)
    sales_28 = purchase_calc(28)
    # 融合：按14vs28趋势分配权重
    fused_sales = {}
    all_skus = set(sales_14.keys()) | set(sales_28.keys())
    for sku in all_skus:
        s14 = sales_14.get(sku, 0); s28 = sales_28.get(sku, 0)
        if s14 > s28 * 1.15: w14, w28 = 0.55, 0.45
        elif s14 < s28 * 0.85: w14, w28 = 0.35, 0.65
        else: w14, w28 = 0.20, 0.80
        fused_sales[sku] = round(s14 * w14 + s28 * w28, 1)

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

    # 5. 商品信息
    products = {p["sku"]: p for p in db.table("products").select("*").execute().data}
    

    # 6. 逐 SKU 计算（系统总库存视角，日销用14+28融合值）
    result = []
    for sku, st in stock_by_sku.items():
        ds = round(fused_sales.get(sku, 0) * active_factor, 1)  # 含活动系数
        sys_avail = st['available']; sys_transit = st['transit']
        sys_total = sys_avail + sys_transit  # 全仓总库存（含C/自有/B/在途）

        # 安全库存
        safety_days = st['safety_days'] if st['safety_days'] > 0 else purchase_safety_days
        eff_safety = round(ds * safety_days) if ds > 0 else 0

        # 采购量 = 日销×供应期 + 安全库存 − 系统总库存
        purchase_qty = max(round(ds * purchase_lead_time) + eff_safety - sys_total, 0) if ds > 0 else 0
        # 兜底 MOQ
        purchase_qty = max(purchase_qty, moq_default) if purchase_qty > 0 else 0

        # 箱规取整
        prod = products.get(sku, {})
        box_qty = int(prod.get('box_qty', 1) or 1)
        actual_purchase = (purchase_qty + box_qty - 1) // box_qty * box_qty if purchase_qty > 0 else 0

        days_to_empty = round(sys_avail / ds, 1) if ds > 0 else 999

        # 补后自有仓周转（采购到自有仓后含在途，对比目标周转）
        after_stock = st['own_avail'] + st['own_transit'] + actual_purchase
        after_turnover = round(after_stock / ds, 1) if ds > 0 else 999
        target_turn = int(raw.get('max_turnover_days', '0'))
        c_consume = round(ds * purchase_lead_time) if ds > 0 else 0
        note = ""
        if purchase_qty > 0:
            note = f"消耗{c_consume}+安全{eff_safety} -系统总库存{int(sys_total)} ={int(purchase_qty)}"
            note += f" | 箱规{box_qty}件, 实购{actual_purchase}件"
            note += f"（{actual_purchase//box_qty}箱）" if box_qty > 1 else ""
            note += f", 补后周转{after_turnover}天"
            if target_turn > 0:
                note += f" > 目标{target_turn}天" if after_turnover > target_turn else f" < 目标{target_turn}天"

        result.append({
            'sku': sku, 'product_name': prod.get('product_name', ''),
            'store': prod.get('store', ''), 'warehouse': st['own_warehouse'], 'category': prod.get('category', ''),
            'sys_available': sys_avail, 'sys_transit': sys_transit, 'sys_total': sys_total,
            'own_available': st['own_avail'], 'own_transit': st['own_transit'],
            'plat_available': st['plat_avail'], 'plat_transit': st['plat_transit'],
            'b_available': b_avail.get(sku, 0),
            'safety_qty': st['safety'], 'daily_sales': ds,
            'daily_sales_14': sales_14.get(sku, 0), 'daily_sales_28': sales_28.get(sku, 0),
            'purchase_qty': purchase_qty, 'box_qty': box_qty, 'actual_purchase': actual_purchase,
            'after_stock': st['own_avail'] + purchase_qty, 'after_turnover': after_turnover,
            'target_turnover': target_turn,
            'days_to_empty': days_to_empty, 'note': note,
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
    return {"suggestions": result}


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
    """导出库存为CSV"""
    import csv, io
    from fastapi.responses import PlainTextResponse
    raw = db.table("inventory").select("*").order("id", desc=True).execute().data or []
    # 自有仓才合并计算字段（期初、日销、周转）
    ws_map = {}
    for w in (inventory_with_sales(db=db) or []):
        ws_map[(w.get('sku',''), w.get('warehouse',''))] = w
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(['仓库','SKU','商品','期初库存','在途','当月采购入库','当月出库','可用','在库周转'])
    for r in raw[:500]:
        if r.get('warehouse','') != '京东集货仓': continue
        k = (r.get('sku',''), r.get('warehouse',''))
        ws = ws_map.get(k, {}) if r.get('warehouse_type') == 'own' else {}
        w.writerow([r.get('warehouse',''), r.get('sku',''), r.get('product_name',''),
                   ws.get('beginning_stock',''), r.get('in_transit_qty',0),
                   ws.get('month_inbound',''), ws.get('month_outbound',''),
                   r.get('available_qty',0), ws.get('turnover_days','')])
    return PlainTextResponse(out.getvalue(), media_type='text/csv',
                             headers={'Content-Disposition':'attachment; filename=inventory.csv'})
    return PlainTextResponse(out.getvalue(), media_type='text/csv',
                             headers={'Content-Disposition':'attachment; filename=inventory.csv'})

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
        ds = round(sales_28.get(sku, 0), 1)
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