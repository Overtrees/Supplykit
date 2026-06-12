from fastapi import APIRouter, Depends
from app.core.database import get_db

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

@router.get("")
def list_alerts(db = get_db()):
    data = db.table("alerts").select("*").order("id", desc=True).execute().data
    return data
