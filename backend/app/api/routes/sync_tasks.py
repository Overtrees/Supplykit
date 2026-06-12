from fastapi import APIRouter, Depends
from app.core.database import get_db

router = APIRouter(prefix="/api/sync-tasks", tags=["sync_tasks"])

@router.get("")
def list_sync_tasks(db = get_db()):
    try:
        data = db.table("sync_tasks").select("*").order("id", desc=True).execute().data
        return data
    except Exception:
        return []
