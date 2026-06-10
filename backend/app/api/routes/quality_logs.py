from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.entities import QualityLog

router = APIRouter(prefix="/api/quality-logs", tags=["quality"])

@router.get("")
def list_quality_logs(db: Session = Depends(get_db)):
    rows = db.query(QualityLog).order_by(QualityLog.id.desc()).all()
    return [{
        "id": x.id,
        "entity_type": x.entity_type,
        "entity_id": x.entity_id,
        "field_name": x.field_name,
        "issue_type": x.issue_type,
        "issue_message": x.issue_message,
        "severity": x.severity,
        "created_at": x.created_at.isoformat() if x.created_at else None,
    } for x in rows]
