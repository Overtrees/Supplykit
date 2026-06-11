from fastapi import APIRouter, Depends
from supabase import Client
from app.core.supabase_client import get_supabase

router = APIRouter(prefix="/api/products", tags=["products"])

@router.get("")
def list_products(supabase: Client = Depends(get_supabase), search: str = ""):
    q = supabase.table("products").select("*")
    if search:
        like = f"%{search}%"
        q = q.ilike("product_name", like) | q.ilike("sku", like)
    data = q.order("id", desc=True).execute().data
    return data

@router.post("")
def create_product(body: dict, supabase: Client = Depends(get_supabase)):
    import json
    data = supabase.table("products").insert({
        "sku": body.get("sku"),
        "product_name": body.get("product_name"),
        "store": body.get("store", ""),
        "category": body.get("category", ""),
        "unit": body.get("unit", "件"),
        "price": float(body.get("price", 0)),
        "status": body.get("status", "active"),
        "raw_data": json.dumps(body, ensure_ascii=False),
    }).execute().data
    return data[0] if data else {"ok": True}

@router.put("/{pid}")
def update_product(pid: int, body: dict, supabase: Client = Depends(get_supabase)):
    supabase.table("products").update(body).eq("id", pid).execute()
    return {"ok": True}

@router.delete("/{pid}")
def delete_product(pid: int, supabase: Client = Depends(get_supabase)):
    supabase.table("products").delete().eq("id", pid).execute()
    return {"ok": True}

@router.delete("")
def batch_delete_products(ids: str, supabase: Client = Depends(get_supabase)):
    id_list = [int(x.strip()) for x in ids.split(",") if x.strip().isdigit()]
    data = supabase.table("products").delete().in_("id", id_list).execute().data
    return {"ok": True, "deleted": len(data)}
