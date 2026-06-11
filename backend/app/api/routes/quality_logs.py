from fastapi import APIRouter, Depends
from supabase import Client
from app.core.supabase_client import get_supabase

router = APIRouter(prefix="/api/quality-logs", tags=["quality_logs"])

@router.get("")
def list_quality_logs(supabase: Client = Depends(get_supabase)):
    data = supabase.table("quality_logs").select("*").order("id", desc=True).execute().data
    return data
