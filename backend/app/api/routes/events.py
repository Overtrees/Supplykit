from fastapi import APIRouter, Depends
from app.core.database import get_db

router = APIRouter(prefix="/api/events", tags=["events"])

@router.get("")
def list_events(db = get_db()):
    try:
        data = db.table("events").select("*").order("id", desc=True).execute().data
        return data
    except Exception:
        return []

def create_event(db, event_type: str, entity_type: str,
                  entity_id: str, title: str, payload: dict, level: str = "info"):
    import json
    db.table("events").insert({
        "event_type": event_type,
        "entity_type": entity_type,
        "entity_id": str(entity_id) if entity_id is not None else None,
        "title": title,
        "payload": json.dumps(payload, ensure_ascii=False),
        "level": level,
        "status": "new",
    }).execute()
