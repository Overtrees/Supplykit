from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import Base, engine, SessionLocal
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.orders import router as orders_router
from app.api.routes.inventory import router as inventory_router
from app.api.routes.quality_logs import router as quality_router
from app.api.routes.ws import router as ws_router
from app.api.routes.alerts import router as alerts_router
from app.api.routes.events import router as events_router
from app.api.routes.sync_tasks import router as sync_tasks_router
from app.services.dashboard_service import seed_data
from app.services.event_service import rebuild_low_stock_alerts
import os

app = FastAPI(title="SupplyChain V1")
origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "*").split(",") if x.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)
db = SessionLocal()
if os.getenv("APP_ENV", "development") != "production":
    seed_data(db)
if os.getenv("APP_ENV", "development") != "production":
    rebuild_low_stock_alerts(db)
db.commit()
db.close()

app.include_router(dashboard_router)
app.include_router(orders_router)
app.include_router(inventory_router)
app.include_router(quality_router)
app.include_router(alerts_router)
app.include_router(events_router)
app.include_router(sync_tasks_router)
app.include_router(ws_router)

@app.get("/")
def root():
    return {"ok": True, "name": "SupplyChain V1 API"}
