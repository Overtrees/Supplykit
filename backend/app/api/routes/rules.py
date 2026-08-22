"""规则管理 API"""
from fastapi import APIRouter, HTTPException
from app.core.database import get_db
from app.core.response import ok, fail
from app.core.schemas import RuleCreate, RuleUpdate
import json

router = APIRouter(prefix="/api/rules", tags=["rules"])

# 规则缓存（30s TTL，创建/更新/删除规则时自动失效）
_rules_cache = {}

@router.get("")
def list_rules(channel: str = 'jd', db = get_db()):
    import time
    key = f"rules_{channel}"
    cached = _rules_cache.get(key)
    if cached and time.time() - cached['ts'] < 30:
        return cached['data']
    data = db.table("rules").select("*").eq("channel", channel).order("id").execute().data
    _rules_cache[key] = {'data': ok(data), 'ts': time.time()}
    return ok(data)

@router.post("")
def create_rule(data: RuleCreate, db = get_db()):
    _rules_cache.clear()
    payload = {
        "name": data.name, "event": data.event,
        "condition_json": json.dumps(data.condition),
        "alert_type": data.alert_type,
        "alert_title": data.alert_title,
        "alert_desc": data.alert_desc,
        "severity": data.severity,
        "channel": data.channel,
        "mode": data.mode,
        "is_active": 1 if data.is_active else 0,
    }
    db.table("rules").insert(payload).execute()
    return ok({"message": "规则已创建"})

@router.put("/{rule_id}")
def update_rule(rule_id: int, data: RuleUpdate, db = get_db()):
    _rules_cache.clear()
    if not db.table("rules").select("id").eq("id", rule_id).execute().data:
        raise HTTPException(status_code=404, detail="规则不存在")
    update = {}
    if data.name is not None: update["name"] = data.name
    if data.event is not None: update["event"] = data.event
    if data.alert_type is not None: update["alert_type"] = data.alert_type
    if data.alert_title is not None: update["alert_title"] = data.alert_title
    if data.alert_desc is not None: update["alert_desc"] = data.alert_desc
    if data.severity is not None: update["severity"] = data.severity
    if data.condition is not None: update["condition_json"] = json.dumps(data.condition)
    if data.mode is not None: update["mode"] = data.mode
    if data.is_active is not None: update["is_active"] = 1 if data.is_active else 0
    if update:
        db.table("rules").update(update).eq("id", rule_id).execute()
    return ok({"message": "已更新"})

@router.delete("/{rule_id}")
def delete_rule(rule_id: int, db = get_db()):
    _rules_cache.clear()
    # 软删除
    from datetime import datetime
    db.table("rules").update({"is_active": 0, "deleted_at": datetime.utcnow().isoformat()}).eq("id", rule_id).execute()
    return ok({"message": "已删除", "id": rule_id})

@router.post("/{rule_id}/restore")
def restore_rule(rule_id: int, db = get_db()):
    _rules_cache.clear()
    db.table("rules").update({"is_active": 1, "deleted_at": None}).eq("id", rule_id).execute()
    return ok({"message": "已恢复", "id": rule_id})

@router.post("/{rule_id}/permanent-delete")
def permanent_delete_rule(rule_id: int, db = get_db()):
    _rules_cache.clear()
    db.table("rules").delete().eq("id", rule_id).execute()
    return ok({"message": "已永久删除", "id": rule_id})

@router.post("/{rule_id}/test")
def test_rule(rule_id: int, body: dict, db = get_db()):
    """规则引擎可视化调试：传入模拟数据(库存/订单), 判断该规则条件是否触发"""
    rules_data = db.table("rules").select("*").eq("id", rule_id).execute().data
    if not rules_data:
        raise HTTPException(status_code=404, detail="规则不存在")
    rule = rules_data[0]
    try:
        cond = json.loads(rule.get("condition_json") or "{}")
    except Exception:
        cond = {}
    # 构造上下文：inv/order 从 body 取，默认 0
    inv = body.get("inv") or {}
    order = body.get("order") or {}
    ctx = {
        "inv": {
            "available_qty": inv.get("available_qty", 0),
            "safety_qty": inv.get("safety_qty", 0),
            "in_transit_qty": inv.get("in_transit_qty", 0),
            "warehouse_type": inv.get("warehouse_type", ""),
            "days_since_last": inv.get("days_since_last", 0),
        },
        "order": {
            "quantity": order.get("quantity", 0),
            "total_amount": order.get("total_amount", 0),
        },
        "channel": rule.get("channel", "jd"),
        "days_since_last": inv.get("days_since_last", 0),
        "stock": inv.get("available_qty", 0),
    }
    from app.core.rules import _check_condition, _resolve_value
    triggered = _check_condition(cond, ctx)
    # 计算明细（左右值解析结果）
    detail = {}
    try:
        left_raw = cond.get("left", "")
        right_raw = cond.get("right", "")
        detail["left"] = left_raw
        detail["right"] = right_raw
        detail["op"] = cond.get("op", "<")
        detail["left_value"] = _resolve_value(left_raw, ctx)
        # 简化 right 值解析（兼容 max() 与直接值）
        if str(right_raw).startswith("max("):
            detail["right_value"] = f"max({right_raw[4:-1]})"
        elif str(right_raw).replace('.','',1).isdigit():
            detail["right_value"] = float(right_raw)
        elif '.' in str(right_raw):
            detail["right_value"] = _resolve_value(right_raw, ctx)
        else:
            detail["right_value"] = right_raw
        detail["warehouse"] = cond.get("warehouse", "")
    except Exception:
        pass
    return ok({
        "triggered": triggered,
        "alert_title": rule.get("alert_title", ""),
        "alert_desc": rule.get("alert_desc", ""),
        "detail": detail,
    })
    rules_data = db.table("rules").select("*").eq("is_active", 1).execute().data
    from app.core.rules import evaluate as rule_evaluate
    count = 0
    for r in rules_data:
        try: rule_evaluate(r["event"], {"db": db, "rule": r, "channel": r.get('channel', 'jd')}); count += 1
        except Exception as e: import logging; logging.warning(f"[rules] evaluate rule {r.get('id')} error: {e}")
    return ok({"message": f"已评估 {count} 条规则", "count": count})
