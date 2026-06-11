from fastapi import APIRouter
from app.core.dashboard_cache import get_dashboard

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

@router.get("/summary")
def dashboard_summary():
    return get_dashboard()
