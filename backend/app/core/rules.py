"""轻量规则引擎：定义 → 评估 → 执行动作"""
import json
from datetime import datetime

# ─── 内置动作 ──────────────────────────────────────────────────────────────

def _action_create_alert(ctx):
    db = ctx['db']
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

def evaluate(event: str, context: dict):
    """根据事件名匹配规则，满足条件则执行动作"""
    results = []
    for rule in RULES:
        if rule['event'] != event:
            continue
        ctx = {**context, 'rule': rule, 'avail': context.get('inv',{}).get('available_qty',0),
               'safety': context.get('inv',{}).get('safety_qty',0),
               'product_name': context.get('inv',{}).get('product_name','')}
        try:
            if rule['condition'](ctx):
                for action in rule['actions']:
                    action(ctx)
                results.append(rule['name'])
        except Exception as e:
            results.append(f"{rule['name']} error: {e}")
    return results
