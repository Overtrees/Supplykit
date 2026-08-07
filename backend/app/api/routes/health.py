"""Health check endpoint for monitoring"""
from fastapi import APIRouter
from datetime import datetime
import os, sqlite3

router = APIRouter(tags=["health"])

@router.get("/api/health")
def health():
    """系统健康检查 + 缓存版本号"""
    status = "ok"
    checks = {}
    
    # 数据库检查
    try:
        db_path = os.getenv("SQLITE_PATH", os.path.join(os.path.dirname(__file__), "..", "supplykit.db"))
        conn = sqlite3.connect(db_path)
        conn.execute("SELECT 1")
        conn.close()
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {e}"
        status = "degraded"
    
    # 磁盘空间
    try:
        stat = os.statvfs("/")
        free_gb = stat.f_bavail * stat.f_frsize / 1024 / 1024 / 1024
        checks["disk_free_gb"] = round(free_gb, 1)
        if free_gb < 0.5:
            checks["disk"] = "warning: low disk space"
            status = "degraded"
        else:
            checks["disk"] = "ok"
    except:
        checks["disk"] = "unknown"
    
    # 缓存版本号（用于前端轮询）
    version = 0
    try:
        from app.core.database import get_db
        db = get_db()
        ver = db.table("replenishment_config").select("*").eq("key", "_cache_version").execute().data
        version = int(ver[0]["value"]) if ver else 0
    except Exception:
        pass
    
    return {
        "status": status,
        "timestamp": datetime.utcnow().isoformat(),
        "checks": checks,
        "version": version,
    }