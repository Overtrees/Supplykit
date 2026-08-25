from fastapi import APIRouter, Depends
from app.core.database import get_db
from app.core.response import ok, fail

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

@router.get("")
def list_alerts(channel: str = 'jd', status: str = 'active', db = get_db()):
    data = db.table("alerts").select("*").eq("channel", channel).eq("status", status).order("id", desc=True).execute().data
    return ok(data)
