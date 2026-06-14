from fastapi import APIRouter, Depends
from app.core.database import get_db

router = APIRouter(prefix="/api/products", tags=["products"])

@router.get("")
def list_products(db = get_db(), search: str = ""):
    q = db.table("products").select("*")
    if search:
        like = f"%{search}%"
        q = q.ilike("product_name", like) | q.ilike("sku", like)
    data = q.order("id", desc=True).execute().data
    return data

@router.post("")
def create_product(body: dict, db = get_db()):
    import json
    data = db.table("products").insert({
        "sku": body.get("sku"),
        "product_name": body.get("product_name"),
        "store": body.get("store", ""),
        "category": body.get("category", ""),
        "spec": body.get("spec", ""),
        "price": float(body.get("price", 0)),
        "status": body.get("status", "active"),
        "raw_data": json.dumps(body, ensure_ascii=False),
    }).execute().data
    return data[0] if data else {"ok": True}

@router.put("/{pid}")
def update_product(pid: int, body: dict, db = get_db()):
    db.table("products").update(body).eq("id", pid).execute()
    return {"ok": True}

@router.delete("/{pid}")
def delete_product(pid: int, db = get_db()):
    db.table("products").delete().eq("id", pid).execute()
    return {"ok": True}

@router.delete("")
def batch_delete_products(ids: str, db = get_db()):
    id_list = [int(x.strip()) for x in ids.split(",") if x.strip().isdigit()]
    data = db.table("products").delete().in_("id", id_list).execute().data
    return {"ok": True, "deleted": len(data)}
