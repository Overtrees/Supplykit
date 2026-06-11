import os
import sys

# ─── 务必最先：加载 .env 文件 ───
_env_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(_env_path):
    with open(_env_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith('#') and '=' in _line:
                _k, _v = _line.split('=', 1)
                os.environ[_k.strip()] = _v.strip()

# ─── 导入 ───
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.orders import router as orders_router
from app.api.routes.inventory import router as inventory_router
from app.api.routes.quality_logs import router as quality_router
from app.api.routes.ws import router as ws_router
from app.api.routes.alerts import router as alerts_router
from app.api.routes.events import router as events_router
from app.api.routes.sync_tasks import router as sync_tasks_router
from app.api.routes.cleansing import router as cleansing_router
from app.api.routes.products import router as products_router
from app.api.routes.suppliers import router as suppliers_router
from app.api.routes.insights import router as insights_router

from app.core.events import register_core_handlers
register_core_handlers()

app = FastAPI(title="SupplyChain V1")
origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "*").split(",") if x.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard_router)
app.include_router(orders_router)
app.include_router(inventory_router)
app.include_router(quality_router)
app.include_router(alerts_router)
app.include_router(events_router)
app.include_router(sync_tasks_router)
app.include_router(ws_router)
app.include_router(cleansing_router)
app.include_router(products_router)
app.include_router(suppliers_router)
app.include_router(insights_router)

@app.get("/")
def root():
    return {"ok": True, "name": "SupplyChain V1 API"}
