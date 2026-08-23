from fastapi import APIRouter, Depends
from app.core.database import get_db
from app.core.response import ok, fail

router = APIRouter(prefix="/api/suppliers", tags=["suppliers"])

@router.get("")
def list_suppliers(db = get_db(), search: str = "", channel: str = 'jd'):
    q = db.table("suppliers").select("*").eq("channel", channel)
    if search:
        like = f"%{search}%"
        q = q.ilike("supplier_name", like).or_(q.ilike("supplier_code", like))
    data = q.order("id", desc=True).execute().data
    # 每品牌单行: 供应商 brand 多值(逗号分隔)拆成多行, 每行一个品牌(便于导入导出/结构化展示)
    expanded = []
    for s in data:
        s = dict(s)
        brands = [b.strip() for b in str(s.get('brand') or '').split('，') if b.strip()]
        if len(brands) <= 1:
            expanded.append(s)
        else:
            for b in brands:
                row = dict(s)
                row['brand'] = b
                row['_key'] = f"{s.get('supplier_code')}|{b}"
                expanded.append(row)
    return ok(expanded)

@router.post("")
def create_supplier(body: dict, db = get_db()):
    data = db.table("suppliers").insert({
        "supplier_code": body.get("supplier_code"),
        "supplier_name": body.get("supplier_name"),
        "contact_person": body.get("contact_person", ""),
        "contact_phone": body.get("contact_phone", ""),
        "score": int(body.get("score", 0)),
        "status": body.get("status", "active"),
        "channel": body.get("channel", 'jd'),
    }).execute().data
    return data[0] if data else {"ok": True}

@router.put("/{sid}")
def update_supplier(sid: int, body: dict, db = get_db()):
    db.table("suppliers").update(body).eq("id", sid).execute()
    return ok({})

@router.delete("/{sid}")
def delete_supplier(sid: int, db = get_db()):
    db.table("suppliers").delete().eq("id", sid).execute()
    return ok({})
