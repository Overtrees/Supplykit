"""规则管理 API"""
from fastapi import APIRouter, HTTPException
from app.core.database import get_db
import json

router = APIRouter(prefix="/api/rules", tags=["rules"])

@router.get("")
def list_rules(db = get_db()):
    return db.table("rules").select("*").order("id").execute().data

@router.post("")
def create_rule(data: dict, db = get_db()):
    payload = {
        "name": data.get("name",""), "event": data.get("event",""),
        "condition_json": json.dumps(data.get("condition",{})),
        "alert_type": data.get("alert_type",""), 
        "alert_title": data.get("alert_title",""),
        "alert_desc": data.get("alert_desc",""),
        "severity": data.get("severity","warning"),
        "is_active": 1 if data.get("is_active",True) else 0,
    }
    db.table("rules").insert(payload).execute()
    return {"ok": True, "message": f"规则已创建"}

@router.put("/{rule_id}")
def update_rule(rule_id: int, data: dict, db = get_db()):
    if not db.table("rules").select("id").eq("id", rule_id).execute().data:
        raise HTTPException(status_code=404, detail="规则不存在")
    update = {}
    for k in ["name","event","alert_type","alert_title","alert_desc","severity"]:
        if k in data: update[k] = data[k]
    if "condition" in data: update["condition_json"] = json.dumps(data["condition"])
    if "is_active" in data: update["is_active"] = 1 if data["is_active"] else 0
    db.table("rules").update(update).eq("id", rule_id).execute()
    return {"ok": True, "message": "已更新"}

@router.delete("/{rule_id}")
def delete_rule(rule_id: int, db = get_db()):
    db.table("rules").delete().eq("id", rule_id).execute()
    return {"ok": True, "message": "已删除"}

@router.post("/evaluate-all")
def evaluate_all_rules(db = get_db()):
    rules_data = db.table("rules").select("*").eq("is_active", 1).execute().data
    from app.core.rules import evaluate as rule_evaluate
    count = 0
    for r in rules_data:
        try: rule_evaluate(r["event"], {"db": db, "rule": r}); count += 1
        except: pass
    return {"ok": True, "message": f"已评估 {count} 条规则", "count": count}
