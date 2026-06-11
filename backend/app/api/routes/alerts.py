from fastapi import APIRouter, Depends
from supabase import Client
from app.core.supabase_client import get_supabase

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

@router.get("")
def list_alerts(supabase: Client = Depends(get_supabase)):
    data = supabase.table("alerts").select("*").order("id", desc=True).execute().data
    return data
