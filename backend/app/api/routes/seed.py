from fastapi import APIRouter
from app.core.database import get_db, get_conn, DB_PATH, submit_task, get_task, _task_lock, _task_results
from app.core.response import ok
from app.core.dashboard_cache import invalidate
from app.core.sales_utils import build_daily_sales_snapshot
from datetime import datetime, timedelta
import random, sqlite3, uuid, threading

router = APIRouter(prefix="/api/seed", tags=["seed"])

cat_names = ['酱油','酱料','调味汁','食用油','醋','料酒','蚝油','芝麻油','辣椒酱','拌面酱',
             '老抽','生抽','陈醋','香醋','白醋','米醋','花椒油','藤椒油','辣椒油','芥末油',
             '番茄酱','甜辣酱','沙拉酱','芝麻酱','花生酱','豆瓣酱','豆豉','腐乳','糟卤','鱼露',
             '咖喱块','咖喱粉','五香粉','孜然粉','花椒粉','辣椒粉','胡椒粉','十三香','卤料包','炖肉料',
             '鸡精','味精','白糖','冰糖','红糖','麦芽糖','蜂蜜','料酒','黄酒','米酒',
             '薯片','虾条','爆米花','坚果','瓜子','花生','饼干','威化','巧克力','糖果',
             '洗衣液','洗洁精','洗手液','消毒液','纸巾','湿巾','垃圾袋','保鲜膜','保鲜袋','收纳盒']
store_names = ['京东自营','京东旗舰店','广州调味食材专营店','华南食品旗舰店','上海调味品专营店']
WH = [('北京仓','platform'),('上海仓','platform'),('集货仓','own'),('成都仓','platform'),('武汉仓','platform'),('沈阳仓','platform'),('西安仓','platform'),('郑州仓','platform'),('三方仓','own'),('京东B仓','platform_b')]
SUP = [
    {'code':'SUP-001','name':'广州海天调味品有限公司','contact':'张伟','phone':'13800138001','score':5},
    {'code':'SUP-002','name':'上海太太乐食品有限公司','contact':'李娜','phone':'13800138002','score':4},
    {'code':'SUP-003','name':'佛山海天味业有限公司','contact':'王强','phone':'13800138003','score':5},
    {'code':'SUP-004','name':'成都红九九食品有限公司','contact':'赵敏','phone':'13800138004','score':3},
    {'code':'SUP-005','name':'北京王致和食品有限公司','contact':'孙丽','phone':'13800138005','score':4},
    {'code':'SUP-006','name':'广东美味鲜调味食品有限公司','contact':'周杰','phone':'13800138006','score':5},
    {'code':'SUP-007','name':'山东欣和调味品有限公司','contact':'吴磊','phone':'13800138007','score':4},
    {'code':'SUP-008','name':'湖南加加食品有限公司','contact':'郑爽','phone':'13800138008','score':3},
    {'code':'SUP-009','name':'福建安记食品有限公司','contact':'陈静','phone':'13800138009','score':4},
    {'code':'SUP-010','name':'重庆涪陵榨菜集团','contact':'林峰','phone':'13800138010','score':5},
]

def make_skus(sfx, count=1000, shared=None):
    r = []
    for i in range(1, count + 1):
        c = cat_names[(i-1)%len(cat_names)]
        s = store_names[(i-1)%len(store_names)]
        price_type = random.choices(['normal','low','high'],[80,10,10])[0]
        if price_type == 'low': p = round(random.uniform(1.9, 5.0), 1)
        elif price_type == 'high': p = round(random.uniform(100, 299), 1)
        else: p = round(random.uniform(5.8, 99.9), 1)
        unit = '包' if c in ['薯片','虾条','爆米花','坚果','瓜子','花生','饼干','威化','巧克力','糖果','纸巾','湿巾','垃圾袋','保鲜膜','保鲜袋'] else ('瓶' if c in ['洗衣液','洗洁精','洗手液','消毒液'] else '瓶')
        sku = shared[i-1] if shared and i <= len(shared) and shared[i-1] is not None else f'SKU-{i:04d}{sfx}'
        r.append({'sku':sku,'name':f'{c}{i}','store':s,'cat':c,'price':p,'box':random.choice([6,12,24]),'unit':unit,'barcode':f'690{i:010d}','weight':round(random.uniform(5,25),1),'volume':round(random.uniform(0.02,0.12),3),'status':'active'})
    return r

_current_task_id = None

@router.post("/fill")
def seed_fill():
    global _current_task_id
    task_id = 'seed_fill_' + uuid.uuid4().hex[:8]
    _current_task_id = task_id
    submit_task(task_id, _seed_fill_async)
    return ok({"task_id": task_id, "message": "种子数据填充已开始"})

@router.get("/fill/status")
def seed_fill_status(task_id: str = 'seed_fill'):
    t = get_task(task_id)
    if not t: return ok({"status": "not_found"})
    r = {"status": t['status'], "steps": t.get('steps', [])}
    if t.get('error'): r['error'] = t['error']
    if t.get('result'): r['result'] = t['result']
    return ok(r)

def _run_step(step_name, fn):
    import time as _t
    start = _t.time()
    try:
        fn()
        return {"name": step_name, "status": "ok", "elapsed": round(_t.time() - start, 1)}
    except Exception as e:
        err = str(e)[:500]
        # 持久化异常到 quality_logs（可跨重启查看）
        try:
            conn = get_conn()
            conn.execute("INSERT INTO quality_logs(log_type,level,message,details,source) VALUES(?,?,?,?,?)",
                ("seed_step", "error", f"种子填充步骤失败: {step_name}", err, "seed_engine"))
            conn.commit()
        except Exception as le:
            pass
        return {"name": step_name, "status": "error", "error": err, "elapsed": round(_t.time() - start, 1)}

def _seed_fill_async():
    global _current_task_id
    db = get_db()
    today = datetime.utcnow()
    conn = get_conn()
    steps = []

    # 先统一生成 SKU，确保各步骤数据一致
    jd_s = make_skus('-J', 1000)
    shared_skus = [s['sku'] for s in jd_s[:200]]
    ot_s = make_skus('-O', 1000, shared=shared_skus + [None] * 800)
    skus_data = {'jd': jd_s, 'other': ot_s}

    # 步骤1: 清空旧数据（临时切 DELETE 模式避免 WAL 膨胀，orders 分批删除防 I/O error）
    def _clear_all():
        conn = get_conn()
        # 临时切到 DELETE journal 模式（清空期间避免 WAL 文件膨胀导致 disk I/O error）
        try: conn.execute("PRAGMA journal_mode=DELETE")
        except Exception: pass
        for t in ['inventory','products','suppliers','alerts','quality_logs','events','purchase_orders','replenishment_config_history','cleansing_templates','custom_fields','daily_sales_snapshot','daily_stats','inbound_records','outbound_records','rules','replenishment_config']:
            try: conn.execute(f'DELETE FROM "{t}"')
            except Exception: pass
        # orders 大表分批删除（每批 5000 行 commit，避免单事务过大）
        try:
            while True:
                cur = conn.execute("DELETE FROM orders WHERE id IN (SELECT id FROM orders LIMIT 5000)")
                conn.commit()
                if cur.rowcount == 0: break
        except Exception as e:
            # 分批删除失败则 DROP 重建
            try:
                conn.execute("DROP TABLE IF EXISTS orders")
                conn.execute("""CREATE TABLE orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_no TEXT NOT NULL, store TEXT DEFAULT '', warehouse TEXT DEFAULT '',
                    sku TEXT DEFAULT '', product_name TEXT DEFAULT '', quantity INTEGER DEFAULT 0,
                    unit_price REAL DEFAULT 0, total_amount REAL DEFAULT 0, data_source TEXT DEFAULT '',
                    order_status TEXT DEFAULT '', ordered_at TEXT DEFAULT '', platform TEXT DEFAULT '',
                    supplier TEXT DEFAULT '', remark TEXT DEFAULT '', parent_order_no TEXT DEFAULT '',
                    raw_data TEXT DEFAULT '', source TEXT DEFAULT '', owner_id TEXT DEFAULT '',
                    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
                    channel TEXT DEFAULT 'jd', paid_at TEXT DEFAULT '', barcode TEXT DEFAULT '')""")
                conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_no_sku ON orders(order_no, sku)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_orders_ordered_at ON orders(ordered_at)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_orders_sku ON orders(sku)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_orders_ch_status ON orders(channel, order_status)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_orders_sku_ordered_at ON orders(sku, ordered_at, channel)")
            except Exception as e2:
                pass
        conn.commit()
        # 恢复 WAL 模式
        try: conn.execute("PRAGMA journal_mode=WAL")
        except Exception: pass
    steps.append(_run_step('清空旧数据', _clear_all))
    _update_steps(steps)

    # 步骤2: 写入商品/供应商
    steps.append(_run_step('写入商品/供应商', lambda: _seed_products_suppliers(db, skus_data)))
    _update_steps(steps)

    # 步骤3: 生成订单
    steps.append(_run_step('生成订单', lambda: _seed_orders(db, today, skus_data)))
    _update_steps(steps)

    # 步骤4: 生成库存
    steps.append(_run_step('生成库存', lambda: _seed_inventory(db, skus_data)))
    _update_steps(steps)

    # 步骤5: 写入补货参数和规则
    steps.append(_run_step('写入补货参数/规则', lambda: _seed_config(db, conn)))
    _update_steps(steps)

    # 步骤6: 触发规则引擎
    steps.append(_run_step('触发规则引擎', lambda: _seed_rules(db, skus_data)))
    _update_steps(steps)

    # 步骤7: 构建日销快照（新数据实时纳入日销计算，不等次日凌晨）
    steps.append(_run_step('构建日销快照', lambda: build_daily_sales_snapshot(db)))
    _update_steps(steps)

    # 刷新缓存
    try:
        invalidate()
        from app.core.replenishment_cache import invalidate_cache
        invalidate_cache(db)
    except: pass
    # 预热看板缓存（避免首次请求超时）
    try:
        import requests
        base = os.getenv("API_BASE_URL", "https://overtrees.pythonanywhere.com")
        for ch in ['jd','other']:
            requests.get(f"{base}/api/dashboard/summary?channel={ch}", timeout=120)
    except: pass

    # 持久化填充结果 summary（成功/失败，跨重启可查）
    try:
        ok_steps = [s for s in steps if s.get('status') == 'ok']
        err_steps = [s for s in steps if s.get('status') == 'error']
        conn = get_conn()
        conn.execute("INSERT INTO quality_logs(log_type,level,message,details,source) VALUES(?,?,?,?,?)",
            ("seed_result",
             "success" if not err_steps else "error",
             f"种子填充{'完成' if not err_steps else '部分失败'}: {len(ok_steps)}/{len(steps)} 步成功",
             f"步骤: {[s['name'] for s in err_steps]} 失败: {[s.get('error','')[:100] for s in err_steps]}",
             "seed_engine"))
        conn.commit()
    except Exception as e:
        pass

    return {"steps": steps}


def _update_steps(steps):
    global _current_task_id
    if _current_task_id:
        with _task_lock:
            t = _task_results.get(_current_task_id)
            if t: t['steps'] = list(steps)

def _seed_products_suppliers(db, skus_data):
    for skus,ch in [(skus_data['jd'],'jd'),(skus_data['other'],'other')]:
        for p in skus:
            db.table("products").upsert({'sku':p['sku'],'product_name':p['name'],'store':p['store'],'category':p['cat'],'price':p['price'],'box_qty':p['box'],'barcode':p['barcode'],'weight':p['weight'],'volume':p['volume'],'status':p['status'],'channel':ch}, conflict_col='sku')
    for s in SUP:
        for ch in ['jd','other']:
            # supplier_code 加渠道后缀，避免两渠道共用同一 code 导致 upsert 互相覆盖
            db.table("suppliers").upsert({'supplier_code':f"{s['code']}-{ch.upper()}",'supplier_name':s['name'],'contact_person':s['contact'],'contact_phone':s['phone'],'score':s['score'],'channel':ch}, conflict_col='supplier_code')

def _seed_orders(db, today, skus_data):
    jd_s, ot_s = skus_data['jd'], skus_data['other']
    orders = []
    for ch,label,skus,base in [('jd','jd',jd_s,1100),('other','other',ot_s,550)]:
        promo = {'618':list(range(5,20)),'月末':list(range(45,55))}
        for d in range(60):
            dt = today - timedelta(days=d)
            is_promo = any(d in v for v in promo.values())
            cnt = int(base * random.uniform(2,4)) if is_promo else (int(base * random.uniform(0.6,1.2)) if dt.weekday()>=5 else base)
            for _ in range(cnt):
                sk = random.choice(skus)
                q = random.randint(1,20) if is_promo else random.randint(1,8)
                st = random.choices(['已完成','已发货','待发货','待确认','申请退款'],[45,18,15,10,7])[0]
                if random.random() < 0.03: st = '已退货'
                orders.append({'order_no':f'{label.upper()}-{ch}{d:03d}-{len(orders):03d}','store':sk['store'],'warehouse':random.choice(WH)[0],'sku':sk['sku'],'product_name':sk['name'],'quantity':q,'unit_price':sk['price'],'total_amount':round(q*sk['price'],2),'order_status':st,'ordered_at':dt.strftime('%Y-%m-%d'),'channel':ch,'platform':'京东' if label=='jd' else '天猫'})
    # 批量写入：executemany + 分批 commit（每 500 条一次 fsync，替代逐条 commit）
    conn = get_conn()
    cols = ['order_no','store','warehouse','sku','product_name','quantity','unit_price','total_amount',
            'order_status','ordered_at','channel','platform']
    batch_size = 500
    for i in range(0, len(orders), batch_size):
        batch = orders[i:i+batch_size]
        conn.executemany(
            f"INSERT INTO orders({','.join(cols)}) VALUES({','.join(['?']*len(cols))})",
            [[o.get(c) for c in cols] for o in batch]
        )
        conn.commit()

def _seed_inventory(db, skus_data):
    jd_s, ot_s = skus_data["jd"], skus_data["other"]
    inv = []
    jd_s, ot_s = skus_data['jd'], skus_data['other']
    for skus in [jd_s,ot_s]:
        for sk in skus:
            # 12% SKU 全仓低库存（模拟需补货场景），其余正常
            low = random.random() < 0.12
            for wn,wt in WH:
                if wt == 'own': wh_name = '集货仓' if skus is jd_s else '三方仓'
                else: wh_name = wn
                if low and wt == 'platform':
                    q = random.randint(0, 25)      # C 仓低库存 → 触发补货
                elif low and wt == 'platform_b':
                    q = random.randint(0, 10)      # B 仓也低
                else:
                    q = random.randint(50, 800)
                inv.append({'sku':sk['sku'],'product_name':sk['name'],'warehouse':wh_name,'warehouse_type':wt,'available_qty':q,'in_transit_qty':random.randint(0,80) if low else random.randint(0,200),'safety_qty':random.randint(30,200),'channel':'jd' if skus is jd_s else 'other'})
    db.table("inventory").insert(inv).execute()

def _seed_rules(db, skus_data):
    """触发规则引擎：从真实库存批量判断低库存/紧急补货，批量生成告警
    （替代逐 SKU evaluate，20000 次 → 1 次批量）"""
    conn = get_conn()
    # 读取真实库存（按渠道）
    inv_rows = conn.execute(
        "SELECT sku, product_name, available_qty, safety_qty, channel, warehouse_type FROM inventory"
    ).fetchall()
    # 批量查现有活跃告警，避免重复
    existing = {}
    for r in conn.execute("SELECT alert_type, related_sku FROM alerts WHERE status='active'").fetchall():
        existing.setdefault((r[0], r[1]), True)
    # 逐 SKU 聚合可用库存（同 SKU 多仓求和），判断规则
    from collections import defaultdict
    sku_stock = defaultdict(lambda: {'avail': 0, 'safety': 0, 'name': '', 'ch': 'jd'})
    for r in inv_rows:
        s = sku_stock[r[0]]
        s['avail'] += int(r[2] or 0)
        s['safety'] += int(r[3] or 0)
        s['name'] = r[1] or r[0]
        s['ch'] = r[4] or 'jd'
    inserts = []
    for sku, st in sku_stock.items():
        avail, safety = st['avail'], st['safety']
        if avail < safety and (('low_stock', sku) not in existing):
            inserts.append(("low_stock", f"低库存预警: {st['name']}",
                            f"可用 {avail} < 安全线 {safety}", "warning", st['ch'], sku))
        if avail <= max(1, safety * 0.3) and (('replenish', sku) not in existing):
            inserts.append(("replenish", f"紧急补货: {st['name']}",
                            f"可用 {avail}，低于安全线 30%", "error", st['ch'], sku))
    if inserts:
        conn.executemany(
            "INSERT INTO alerts(alert_type,title,description,severity,source,channel,related_sku,status) VALUES(?,?,?,?,?,?,?,?)",
            [(t, ti, de, se, "rules_engine", ch, sk, "active") for (t, ti, de, se, ch, sk) in inserts]
        )
    conn.commit()

def _seed_config(db, conn):
    conn.execute("DELETE FROM replenishment_config")
    for ch in ['jd','other']:
        configs = [
            ('lead_time_days', '10'), ('safety_multiplier', '1.5'), ('max_turnover_days', '17'),
            ('turnover_warning_15', '15'), ('turnover_warning_90', '90'),
            ('purchase_lead_days', '14'), ('purchase_safety_days', '3'), ('moq', '50'),
            ('b_to_c_days', '3'), ('c_safety_days', '0'), ('active_factor', '1.0'),
            ('target_turnover', '15'), ('_cache_version', '0'),
        ]
        for k,v in configs:
            conn.execute("INSERT OR REPLACE INTO replenishment_config(key,value,channel) VALUES(?,?,?)", (k,v,ch))
    conn.execute("DELETE FROM rules")
    rules = [
        ("低库存预警", "inventory.changed", '{"left":"inv.available_qty","op":"<","right":"inv.safety_qty"}', "low_stock", "低库存预警: {product_name}", "可用 {avail} < 安全线 {safety}", "warning", 1),
        ("紧急补货", "inventory.changed", '{"left":"inv.available_qty","op":"<=","right":"max(1,inv.safety_qty*0.3)"}', "replenish", "紧急补货: {product_name}", "可用 {avail}，低于安全线 30%", "error", 1),
        ("超卖保护", "order.created", '{"left":"order.quantity","op":">","right":"inv.available_qty"}', "oversell", "超卖告警: {sku}", "订单数量超过可用库存", "error", 1),
        ("滞销识别", "scheduled.daily", '{"left":"inv.days_since_last","op":">","right":"30"}', "slow_moving", "滞销: {product_name}", "{days} 天无销售", "warning", 1),
    ]
    for ch in ['jd','other']:
        for r in rules:
            conn.execute("INSERT INTO rules(name,event,condition_json,alert_type,alert_title,alert_desc,severity,is_active,channel) VALUES(?,?,?,?,?,?,?,?,?)", r + (ch,))
    conn.commit()

@router.post("/reset")
def seed_reset(db=get_db()):
    conn = get_conn()
    for t in ['orders','inventory','products','suppliers','alerts','quality_logs','events','purchase_orders','replenishment_config_history','cleansing_templates','custom_fields','replenishment_config','rules']:
        try: conn.execute(f'DELETE FROM "{t}"')
        except: pass
    conn.commit()
    invalidate()
    from app.core.replenishment_cache import invalidate_cache
    try: invalidate_cache(db)
    except: pass
    from app.core.database import _seed_builtin_rules
    try: _seed_builtin_rules()
    except: pass
    return ok({"reset": True})