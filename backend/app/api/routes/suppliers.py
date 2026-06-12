from fastapi import APIRouter, Depends
from app.core.database import get_db

router = APIRouter(prefix="/api/suppliers", tags=["suppliers"])

@router.get("")
def list_suppliers(db = get_db(), search: str = ""):
    q = db.table("suppliers").select("*")
    if search:
        like = f"%{search}%"
        q = q.ilike("supplier_name", like) | q.ilike("supplier_code", like)
    data = q.order("id", desc=True).execute().data
    return data

@router.post("")
def create_supplier(body: dict, db = get_db()):
    data = db.table("suppliers").insert({
        "supplier_code": body.get("supplier_code"),
        "supplier_name": body.get("supplier_name"),
        "contact_person": body.get("contact_person", ""),
        "contact_phone": body.get("contact_phone", ""),
        "score": int(body.get("score", 0)),
        "status": body.get("status", "active"),
    }).execute().data
    return data[0] if data else {"ok": True}

@router.put("/{sid}")
def update_supplier(sid: int, body: dict, db = get_db()):
    db.table("suppliers").update(body).eq("id", sid).execute()
    return {"ok": True}

@router.delete("/{sid}")
def delete_supplier(sid: int, db = get_db()):
    db.table("suppliers").delete().eq("id", sid).execute()
    return {"ok": True}
