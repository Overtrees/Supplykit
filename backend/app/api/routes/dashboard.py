from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.dashboard_service import get_dashboard

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

@router.get("/summary")
def dashboard_summary(db: Session = Depends(get_db)):
    return get_dashboard(db)
