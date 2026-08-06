"""规则管理 API"""
from fastapi import APIRouter, HTTPException
from app.core.database import get_db
from app.core.response import ok, fail
from app.core.schemas import RuleCreate, RuleUpdate
import json

router = APIRouter(prefix="/api/rules", tags=["rules"])

@router.get("")
def list_rules(channel: str = 'jd', db = get_db()):
    return db.table("rules").select("*").eq("channel", channel).order("id").execute().data

@router.post("")
def create_rule(data: RuleCreate, db = get_db()):
    payload = {
        "name": data.name, "event": data.event,
        "condition_json": json.dumps(data.condition),
        "alert_type": data.alert_type,
        "alert_title": data.alert_title,
        "alert_desc": data.alert_desc,
        "severity": data.severity,
        "channel": data.channel,
        "is_active": 1 if data.is_active else 0,
    }
    db.table("rules").insert(payload).execute()
    return ok({"message": "规则已创建"})

@router.put("/{rule_id}")
def update_rule(rule_id: int, data: RuleUpdate, db = get_db()):
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
    if data.is_active is not None: update["is_active"] = 1 if data.is_active else 0
    if update:
        db.table("rules").update(update).eq("id", rule_id).execute()
    return ok({"message": "已更新"})

@router.delete("/{rule_id}")
def delete_rule(rule_id: int, db = get_db()):
    # 软删除
    from datetime import datetime
    db.table("rules").update({"is_active": 0, "deleted_at": datetime.utcnow().isoformat()}).eq("id", rule_id).execute()
    return ok({"message": "已删除", "id": rule_id})

@router.post("/{rule_id}/restore")
def restore_rule(rule_id: int, db = get_db()):
    db.table("rules").update({"is_active": 1, "deleted_at": None}).eq("id", rule_id).execute()
    return ok({"message": "已恢复", "id": rule_id})

@router.post("/{rule_id}/permanent-delete")
def permanent_delete_rule(rule_id: int, db = get_db()):
    db.table("rules").delete().eq("id", rule_id).execute()
    return ok({"message": "已永久删除", "id": rule_id})

@router.post("/evaluate-all")
def evaluate_all_rules(db = get_db()):
    rules_data = db.table("rules").select("*").eq("is_active", 1).execute().data
    from app.core.rules import evaluate as rule_evaluate
    count = 0
    for r in rules_data:
        try: rule_evaluate(r["event"], {"db": db, "rule": r}); count += 1
        except: pass
    return ok({"message": f"已评估 {count} 条规则", "count": count})
