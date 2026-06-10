from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.entities import Alert

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

@router.get("")
def list_alerts(db: Session = Depends(get_db)):
    rows = db.query(Alert).order_by(Alert.id.desc()).all()
    return [{
        "id": x.id,
        "alert_type": x.alert_type,
        "title": x.title,
        "content": x.content,
        "level": x.level,
        "is_read": x.is_read,
        "status": x.status,
        "created_at": x.created_at.isoformat() if x.created_at else None,
    } for x in rows]
