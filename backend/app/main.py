import os, sys, subprocess, tempfile

# 统一临时目录到项目 tmp/（避免依赖 /tmp 导致 disk I/O error）
_tmp_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tmp')
os.makedirs(_tmp_dir, exist_ok=True)
os.environ['TMPDIR'] = _tmp_dir
tempfile.tempdir = _tmp_dir

# Sentry（可选，通过 SENTRY_DSN 环境变量启用）
if os.getenv("SENTRY_DSN"):
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration
        sentry_sdk.init(
            dsn=os.getenv("SENTRY_DSN"),
            environment=os.getenv("SENTRY_ENV", "production"),
            integrations=[
                FastApiIntegration(),
                LoggingIntegration(level=logging.INFO, event_level=logging.ERROR),
            ],
            traces_sample_rate=0.1,
        )
    except ImportError:
        pass

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
            except Exception as e:
                import logging; logging.warning(f"[startup] extract {_f}: {e}")
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
from app.api.routes.health import router as health_router
from app.api.routes.events import router as events_router
from app.api.routes.sync_tasks import router as sync_tasks_router
from app.api.routes.cleansing import router as cleansing_router
from app.api.routes.rules import router as rules_router
from app.api.routes.replenishment_config import router as replenishment_config_router
from app.api.routes.products import router as products_router
from app.api.routes.suppliers import router as suppliers_router
from app.api.routes.disposal_records import router as disposals_router
from app.api.routes.insights import router as insights_router
from app.api.routes.purchase_orders import router as purchase_orders_router
from app.api.routes.seed import router as seed_router
from app.api.routes.purchase import router as purchase_router
from app.api.routes.replenishment import router as replenishment_router
from app.api.routes.records import router as records_router
from app.api.routes.auth import router as auth_router
from app.api.routes.monitor import router as monitor_router
from app.api.routes.exports import router as exports_router
from app.api.routes.tasks import router as tasks_router

from app.core.events import register_core_handlers
from app.core.database import init_db, backup_db
from app.core.scheduler import start as start_scheduler, get_status as scheduler_status
from app.core.auth import verify_token
from app.core.monitor import record as monitor_record

init_db()

# 启动时清理卡死的后台任务（running 超过 10 分钟视为线程已死，标记 error 释放线程池）
try:
    import sqlite3 as _s3
    from app.core.database import DB_PATH as _DP
    _c = _s3.connect(_DP)
    _c.execute("PRAGMA busy_timeout=10000")
    _c.execute("UPDATE sync_tasks SET status='error', result='{\"error\":\"stale task cleaned on restart\"}', updated_at=datetime('now') "
        "WHERE status='running' AND updated_at < datetime('now', '-10 minutes')")
    _c.commit()
    _c.close()
except Exception:
    pass

# 数据库完整性自动恢复（启动时检测损坏，自动 VACUUM 或从备份恢复）
try:
    import sqlite3 as _sqlite3, glob as _glob, os as _os, shutil as _shutil
    from app.core.database import DB_PATH as _DB_PATH
    _c = _sqlite3.connect(_DB_PATH)
    _c.execute("PRAGMA busy_timeout=10000")
    _qc = _c.execute("PRAGMA quick_check").fetchone()
    if _qc and _qc[0] != 'ok':
        import logging as _logging
        _logging.warning(f"[db] 数据库损坏检测: {_qc}")
        # 尝试 VACUUM 修复
        try:
            _c.execute("VACUUM")
            _qc2 = _c.execute("PRAGMA quick_check").fetchone()
            if _qc2 and _qc2[0] == 'ok':
                _logging.info("[db] VACUUM 修复成功")
            else:
                raise Exception("VACUUM 后仍损坏")
        except Exception as _ve:
            _logging.warning(f"[db] VACUUM 修复失败: {_ve}，尝试从备份恢复")
            # 从最新备份恢复（支持 .gz 压缩备份）
            _baks = sorted(_glob.glob(_DB_PATH + ".bak.*"), key=_os.path.getmtime, reverse=True)
            _restored = False
            for _bak in _baks:
                try:
                    _src = _bak
                    if _bak.endswith('.gz'):
                        import gzip as _gzip
                        _tmp_restore = _DB_PATH + ".restore_tmp"
                        with _gzip.open(_bak, 'rb') as _fi, open(_tmp_restore, 'wb') as _fo:
                            _shutil.copyfileobj(_fi, _fo, 1024*1024)
                        _src = _tmp_restore
                    _shutil.copy2(_src, _DB_PATH)
                    if _bak.endswith('.gz') and _os.path.exists(_src):
                        _os.remove(_src)
                    _c2 = _sqlite3.connect(_DB_PATH)
                    _c2.execute("PRAGMA quick_check").fetchone()
                    _c2.close()
                    _logging.info(f"[db] 从备份恢复成功: {_bak}")
                    _restored = True
                    break
                except Exception as _be:
                    _logging.warning(f"[db] 备份恢复失败: {_bak}")
            if not _restored:
                _logging.error("[db] 所有备份恢复失败，数据库需要人工处理")
    _c.close()
except Exception as _e:
    import logging as _logging
    _logging.warning(f"[db] 启动自检异常: {_e}")

# 启动时 WAL checkpoint（合并 WAL 到主库，防止 reload 后 WAL 膨胀）
try:
    import sqlite3 as _sqlite3
    from app.core.database import DB_PATH as _DB_PATH
    _c = _sqlite3.connect(_DB_PATH)
    _c.execute("PRAGMA busy_timeout=10000")
    _c.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    _c.close()
except Exception:
    pass
register_core_handlers()
start_scheduler()

# 初始化 JWT SECRET（持久化到数据库，跨重启 token 有效）
if not os.getenv("JWT_SECRET"):
    try:
        _cj = _sqlite3.connect(_DB_PATH)
        _rj = _cj.execute("SELECT value FROM replenishment_config WHERE key='jwt_secret'").fetchone()
        if _rj and _rj[0]:
            os.environ["JWT_SECRET"] = _rj[0]
        else:
            import hashlib as _hl
            _secret = _hl.sha256(os.urandom(64)).hexdigest()[:48]
            _cj.execute("INSERT OR REPLACE INTO replenishment_config(key,value,channel) VALUES('jwt_secret',?,'jd')", (_secret,))
            _cj.commit()
            os.environ["JWT_SECRET"] = _secret
        _cj.close()
    except Exception:
        pass

app = FastAPI(title="Supplykit", openapi_url="/api/docs.json", docs_url="/api/docs")

# API 鉴权 + 监控中间件：保护所有 /api/* 路由（除 /api/auth 和 /api/health），记录请求统计
@app.middleware("http")
async def auth_monitor_middleware(request, next):
    import time as _mt
    _start = _mt.time()
    path = request.url.path
    # 公开接口放行
    if path.startswith("/api/auth") or path == "/api/health" or path.startswith("/api/docs") or path == "/api/insights/ping" or path == "/api/monitor":
        resp = await next(request)
        monitor_record(path, _mt.time() - _start, resp.status_code)
        return resp
    # 业务接口强制鉴权
    if path.startswith("/api/"):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            monitor_record(path, _mt.time() - _start, 401)
            return JSONResponse({"detail": "未登录，请先登录"}, status_code=401)
        user = verify_token(auth[7:])
        if not user:
            monitor_record(path, _mt.time() - _start, 401)
            return JSONResponse({"detail": "Token 无效或已过期"}, status_code=401)
        # demo 账号只读
        if request.method in ("POST", "PUT", "DELETE", "PATCH") and user == "demo":
            monitor_record(path, _mt.time() - _start, 403)
            return JSONResponse({"detail": "访客模式仅可查看，不可修改数据"}, status_code=403)
    resp = await next(request)
    try:
        monitor_record(path, _mt.time() - _start, resp.status_code)
    except Exception:
        pass
    return resp
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
app.include_router(health_router)
app.include_router(events_router)

app.include_router(sync_tasks_router)
app.include_router(ws_router)
app.include_router(cleansing_router)
app.include_router(rules_router)
app.include_router(replenishment_config_router)
app.include_router(products_router)
app.include_router(suppliers_router)
app.include_router(disposals_router)

app.include_router(records_router)
app.include_router(replenishment_router)
app.include_router(purchase_router)
app.include_router(insights_router)
app.include_router(seed_router)
app.include_router(purchase_orders_router)
app.include_router(auth_router)
app.include_router(monitor_router)
app.include_router(exports_router)
app.include_router(tasks_router)

@app.get("/")
def root():
    return {"ok": True, "name": "Supplykit API"}
