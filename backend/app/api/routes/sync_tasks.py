from fastapi import APIRouter, Depends
from supabase import Client
from app.core.supabase_client import get_supabase

router = APIRouter(prefix="/api/sync-tasks", tags=["sync_tasks"])

@router.get("")
def list_sync_tasks(supabase: Client = Depends(get_supabase)):
    try:
        data = supabase.table("sync_tasks").select("*").order("id", desc=True).execute().data
        return data
    except Exception:
        return []
