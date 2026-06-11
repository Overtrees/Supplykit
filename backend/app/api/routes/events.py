from fastapi import APIRouter, Depends
from supabase import Client
from app.core.supabase_client import get_supabase

router = APIRouter(prefix="/api/events", tags=["events"])

@router.get("")
def list_events(supabase: Client = Depends(get_supabase)):
    try:
        data = supabase.table("events").select("*").order("id", desc=True).execute().data
        return data
    except Exception:
        return []

def create_event(supabase: Client, event_type: str, entity_type: str,
                  entity_id: str, title: str, payload: dict, level: str = "info"):
    import json
    supabase.table("events").insert({
        "event_type": event_type,
        "entity_type": entity_type,
        "entity_id": str(entity_id) if entity_id is not None else None,
        "title": title,
        "payload": json.dumps(payload, ensure_ascii=False),
        "level": level,
        "status": "new",
    }).execute()
