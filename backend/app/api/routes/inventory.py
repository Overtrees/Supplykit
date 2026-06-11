from fastapi import APIRouter, Depends
from supabase import Client
from app.core.supabase_client import get_supabase

router = APIRouter(prefix="/api/inventory", tags=["inventory"])

@router.get("")
def list_inventory(supabase: Client = Depends(get_supabase), store: str = ""):
    q = supabase.table("inventory").select("*")
    if store:
        q = q.eq("store", store)
    data = q.order("id", desc=True).execute().data
    return data

@router.post("")
def create_inventory(body: dict, supabase: Client = Depends(get_supabase)):
    data = supabase.table("inventory").insert({
        "sku": body.get("sku"),
        "product_name": body.get("product_name"),
        "store": body.get("store", ""),
        "available_qty": int(body.get("available_qty", 0)),
        "locked_qty": int(body.get("locked_qty", 0)),
        "in_transit_qty": int(body.get("in_transit_qty", 0)),
        "safety_qty": int(body.get("safety_qty", 10)),
        "status": body.get("status", "active"),
    }).execute().data
    return data[0] if data else {"ok": True}

@router.put("/{iid}")
def update_inventory(iid: int, body: dict, supabase: Client = Depends(get_supabase)):
    supabase.table("inventory").update(body).eq("id", iid).execute()
    return {"ok": True}

@router.delete("/{iid}")
def delete_inventory(iid: int, supabase: Client = Depends(get_supabase)):
    supabase.table("inventory").delete().eq("id", iid).execute()
    return {"ok": True}

@router.post("/adjust")
def adjust_inventory(body: dict, supabase: Client = Depends(get_supabase)):
    iid = body.get("id")
    action = body.get("action")
    qty = int(body.get("quantity", 0))
    inv = supabase.table("inventory").select("*").eq("id", iid).single().execute().data
    if not inv:
        return {"ok": False, "error": "not found"}
    avail = int(inv.get("available_qty") or 0)
    new_avail = avail
    if action == "in":
        new_avail = avail + qty
        supabase.table("inventory").update({"available_qty": new_avail}).eq("id", iid).execute()
    elif action == "out":
        new_avail = max(0, avail - qty)
        supabase.table("inventory").update({"available_qty": new_avail}).eq("id", iid).execute()
    elif action == "set":
        new_avail = qty
        supabase.table("inventory").update({"available_qty": new_avail}).eq("id", iid).execute()
    
    inv["available_qty"] = new_avail
    from app.core.events import bus
    bus.emit('inventory.changed', {
        'inventory': inv,
        'action': action,
        'quantity': qty,
    })
    return {"ok": True}
