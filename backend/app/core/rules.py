"""轻量规则引擎：定义 → 评估 → 执行动作"""
import json
from datetime import datetime

# ─── 内置动作 ──────────────────────────────────────────────────────────────

def _action_create_alert(ctx):
    db = ctx.get('db') or get_db()
    existing = db.table("alerts").select("id").eq("alert_type", ctx['rule']['alert_type'])\
        .eq("related_sku", ctx.get('sku','')).eq("status", "active").execute().data
    if existing:
        return
    db.table("alerts").insert({
        "alert_type": ctx['rule']['alert_type'],
        "title": ctx['rule']['alert_title'].format(**ctx),
        "description": ctx['rule']['alert_desc'].format(**ctx),
        "severity": ctx['rule'].get('severity', 'warning'),
        "source": "rules_engine",
        "related_sku": ctx.get('sku',''),
        "status": "active",
    }).execute()
    # 同时记录事件到 events 表
    try:
        from app.api.routes.events import create_event
        create_event(db, 'rule.triggered', 'rule', str(ctx['rule'].get('id','')),
                     f"规则触发: {ctx['rule']['name']} → {ctx['rule']['alert_title'].format(**ctx)}",
                     {'rule_name': ctx['rule']['name'], 'alert_type': ctx['rule']['alert_type'],
                      'severity': ctx['rule'].get('severity','warning'), 'sku': ctx.get('sku','')})
    except Exception:
        pass

def _action_tag_slow_moving(ctx):
    db = ctx['db']
    db.table("products").update({"tag": "slow_moving"}).eq("sku", ctx.get('sku','')).execute()

def _action_suggest_restock(ctx):
    ctx['rule']['alert_type'] = 'replenish'
    _action_create_alert(ctx)

# ─── 规则定义 ──────────────────────────────────────────────────────────────

RULES = [
    {
        "name": "低库存预警",
        "event": "inventory.changed",
        "condition": lambda ctx: 0 < int(ctx['inv'].get('safety_qty',0)) and int(ctx['inv'].get('available_qty',0)) < int(ctx['inv'].get('safety_qty',0)),
        "alert_type": "low_stock",
        "alert_title": "低库存预警: {product_name}",
        "alert_desc": "可用 {avail} < 安全线 {safety}",
        "severity": "warning",
        "actions": [_action_create_alert, _action_suggest_restock],
    },
    {
        "name": "紧急补货",
        "event": "inventory.changed",
        "condition": lambda ctx: int(ctx['inv'].get('safety_qty',0)) > 0 and int(ctx['inv'].get('available_qty',0)) <= max(1, int(int(ctx['inv'].get('safety_qty',0)) * 0.3)),
        "alert_type": "replenish",
        "alert_title": "紧急补货: {product_name}",
        "alert_desc": "可用 {avail}，低于安全线 30%，建议补货",
        "severity": "error",
        "actions": [_action_create_alert],
    },
    {
        "name": "超卖保护",
        "event": "order.created",
        "condition": lambda ctx: ctx.get('order_qty',0) > ctx.get('available_stock',0),
        "alert_type": "oversell",
        "alert_title": "超卖告警: {sku}",
        "alert_desc": "订单数量 {order_qty} 超过可用库存 {available_stock}",
        "severity": "error",
        "actions": [_action_create_alert],
    },
    {
        "name": "滞销识别",
        "event": "scheduled.daily",
        "condition": lambda ctx: ctx.get('days_since_last', 999) > 30 and ctx.get('stock',0) > 0,
        "alert_type": "slow_moving",
        "alert_title": "滞销: {product_name}",
        "alert_desc": "{days_since_last} 天无销售，库存 {stock} 件",
        "severity": "warning",
        "actions": [_action_create_alert, _action_tag_slow_moving],
    },
]

# ─── 评估引擎 ──────────────────────────────────────────────────────────────

def _resolve_value(expr: str, ctx: dict):
    """解析条件表达式，如 inv.available_qty → ctx['inv']['available_qty']"""
    parts = expr.split('.')
    val = ctx
    for p in parts:
        if isinstance(val, dict):
            val = val.get(p, 0)
        else:
            return 0
    return val  # 支持字符串和数值

def _check_condition(cond: dict, ctx: dict) -> bool:
    """判断条件是否成立"""
    try:
        left_raw = cond.get('left', '0')
        right_raw = cond.get('right', '0')
        op = cond.get('op', '<')
        # 处理 max() 表达式
        if right_raw.startswith('max('):
            inner = right_raw[4:-1]
            parts = [p.strip() for p in inner.split(',')]
            right = max(_resolve_value(parts[0], ctx), float(parts[1]) if parts[1].replace('.','',1).isdigit() else 0)
        elif right_raw.replace('.','',1).isdigit():
            right = float(right_raw)
        elif '.' in right_raw or right_raw.startswith('inv.'):
            right = _resolve_value(right_raw, ctx)
        else:
            right = right_raw  # 纯文本字面量（如 platform_b）
        left = _resolve_value(left_raw, ctx)
        if op == '<': return left < right
        if op == '<=': return left <= right
        if op == '>': return left > right
        if op == '>=': return left >= right
        if op == '==': return left == right
        if op == '!=': return left != right
        return False
    except: return False

def evaluate(event: str, context: dict):
    """根据事件名匹配数据库中的规则，满足条件则执行动作"""
    results = []
    try:
        from app.core.database import get_db
        db = get_db()
        db_rules = db.table("rules").select("*").eq("is_active", 1).eq("event", event).execute().data
        for rule in db_rules:
            try:
                cond = json.loads(rule.get('condition_json', '{}'))
            except: continue
            ctx = {**context, 'rule': rule, 'avail': context.get('inv',{}).get('available_qty',0),
                   'safety': context.get('inv',{}).get('safety_qty',0),
                   'product_name': context.get('inv',{}).get('product_name','')}
            if _check_condition(cond, ctx):
                _action_create_alert(ctx)
                results.append(rule['name'])
    except Exception as e:
        results.append(f"DB rules error: {e}")
    return results
