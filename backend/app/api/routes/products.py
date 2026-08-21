from fastapi import APIRouter, Depends
from app.core.database import get_db
from app.core.response import ok, fail

router = APIRouter(prefix="/api/products", tags=["products"])

@router.get("")
def list_products(db = get_db(), search: str = "", channel: str = 'jd'):
    if search:
        like = f"%{search}%"
        # 独立构造两个条件再 or_ 合并（or_ 会把两个 builder 的 WHERE 分别 AND 后 OR，
        # 若在同一个 q 上链式调用会把 channel 与两个 LIKE 全部 AND 到一起 → 永远空）
        q1 = db.table("products").select("*").eq("channel", channel).ilike("product_name", like)
        q2 = db.table("products").select("*").eq("channel", channel).ilike("sku", like)
        q = q1.or_(q2)
    else:
        q = db.table("products").select("*").eq("channel", channel)
    data = q.order("id", desc=True).execute().data
    return ok(data)

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
    return ok(data[0]) if data else ok({})

@router.put("/{pid}")
def update_product(pid: int, body: dict, db = get_db()):
    db.table("products").update(body).eq("id", pid).execute()
    return ok({})

@router.delete("/{pid}")
def delete_product(pid: int, db = get_db()):
    db.table("products").delete().eq("id", pid).execute()
    return ok({})

@router.delete("")
def batch_delete_products(ids: str, db = get_db()):
    id_list = [int(x.strip()) for x in ids.split(",") if x.strip().isdigit()]
    data = db.table("products").delete().in_("id", id_list).execute().data
    return ok({"deleted": len(data)})
