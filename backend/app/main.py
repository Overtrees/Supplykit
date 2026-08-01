import os, sys, subprocess

# ─── 自动修复：确保依赖已安装 ───
_req = os.path.expanduser("~/Supplykit/backend/requirements.txt")
_app_dir = os.path.dirname(__file__)
_pkg_dir = os.path.join(_app_dir, "_vendor")
if _pkg_dir not in sys.path:
    sys.path.insert(0, _pkg_dir)
if os.path.exists(_req):
    import zipfile
    os.makedirs(_pkg_dir, exist_ok=True)
    for _f in os.listdir(_app_dir):
        if _f.endswith('.whl'):
            try:
                with zipfile.ZipFile(os.path.join(_app_dir, _f)) as _z:
                    _z.extractall(_pkg_dir)
            except: pass
    # 确保 vendor 路径在 sys.path 最前面
    while _pkg_dir in sys.path: sys.path.remove(_pkg_dir)
    sys.path.insert(0, _pkg_dir)

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
import logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger('supplykit')

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.orders import router as orders_router
from app.api.routes.inventory import router as inventory_router
from app.api.routes.quality_logs import router as quality_router
from app.api.routes.ws import router as ws_router
from app.api.routes.alerts import router as alerts_router
from app.api.routes.events import router as events_router
from app.api.routes.sync_tasks import router as sync_tasks_router
from app.api.routes.cleansing import router as cleansing_router
from app.api.routes.rules import router as rules_router
from app.api.routes.replenishment_config import router as replenishment_config_router
from app.api.routes.products import router as products_router
from app.api.routes.suppliers import router as suppliers_router
from app.api.routes.insights import router as insights_router
from app.api.routes.purchase_orders import router as purchase_orders_router
from app.api.routes.seed import router as seed_router
from app.api.routes.purchase import router as purchase_router
from app.api.routes.replenishment import router as replenishment_router
from app.api.routes.records import router as records_router

from app.core.events import register_core_handlers
from app.core.database import init_db, backup_db
from app.core.scheduler import start as start_scheduler, get_status as scheduler_status

init_db()
bak = backup_db()
if bak:
    import logging; logging.info(f"Database backed up to {bak}")
register_core_handlers()
start_scheduler()

app = FastAPI(title="Supplykit", openapi_url="/api/docs.json", docs_url="/api/docs")
origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "*").split(",") if x.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── API 请求日志中间件 ─────────────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    import time
    start = time.time()
    response = await call_next(request)
    cost = round((time.time() - start) * 1000)
    if cost > 500:
        logger.warning(f"[API] {request.method} {request.url.path} {cost}ms {response.status_code}")
    elif cost > 100:
        logger.info(f"[API] {request.method} {request.url.path} {cost}ms {response.status_code}")
    return response

app.include_router(dashboard_router)
app.include_router(orders_router)
app.include_router(inventory_router)
app.include_router(quality_router)
app.include_router(alerts_router)
app.include_router(events_router)

# ─── 健康检查 ───────────────────────────────────────────────────────────────
@app.get('/api/health')
def health():
    try:
        from app.core.database import get_db
        db = get_db()
        orders = db.table("orders").select("*").limit(1).execute().data
        return {"status":"ok","db":True,"orders":len(orders)}
    except Exception as e:
        return {"status":"error","db":False,"error":str(e)[:100]}

app.include_router(sync_tasks_router)
app.include_router(ws_router)
app.include_router(cleansing_router)
app.include_router(rules_router)
app.include_router(replenishment_config_router)
app.include_router(products_router)
app.include_router(suppliers_router)

app.include_router(records_router)
app.include_router(purchase_router)
app.include_router(replenishment_router)
app.include_router(insights_router)
app.include_router(seed_router)
app.include_router(purchase_orders_router)

@app.get("/")
def root():
    return {"ok": True, "name": "Supplykit API"}
