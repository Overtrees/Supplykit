from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.entities import SyncTask

router = APIRouter(prefix="/api/sync-tasks", tags=["sync_tasks"])

@router.get("")
def list_sync_tasks(db: Session = Depends(get_db)):
    rows = db.query(SyncTask).order_by(SyncTask.id.desc()).all()
    return [{
        "id": x.id,
        "task_type": x.task_type,
        "platform": x.platform,
        "status": x.status,
        "started_at": x.started_at.isoformat() if x.started_at else None,
        "finished_at": x.finished_at.isoformat() if x.finished_at else None,
        "success_count": x.success_count,
        "failed_count": x.failed_count,
        "message": x.message,
    } for x in rows]
