from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.entities import Event
import json

router = APIRouter(prefix="/api/events", tags=["events"])

@router.get("")
def list_events(db: Session = Depends(get_db)):
    rows = db.query(Event).order_by(Event.id.desc()).all()
    return [{
        "id": x.id,
        "event_type": x.event_type,
        "entity_type": x.entity_type,
        "entity_id": x.entity_id,
        "title": x.title,
        "payload": json.loads(x.payload or "{}"),
        "level": x.level,
        "status": x.status,
        "created_at": x.created_at.isoformat() if x.created_at else None,
    } for x in rows]
