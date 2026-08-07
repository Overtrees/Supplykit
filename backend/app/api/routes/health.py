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
    
    # 数据库检查（含完整性快速检测）
    try:
        db_path = os.getenv("SQLITE_PATH", os.path.join(os.path.dirname(__file__), "..", "supplykit.db"))
        conn = sqlite3.connect(db_path)
        conn.execute("PRAGMA busy_timeout=5000")
        conn.execute("SELECT 1")
        checks["database"] = "ok"
        # 轻量完整性检测（quick_check 比 integrity_check 快，用于早期发现损坏）
        try:
            qc = conn.execute("PRAGMA quick_check").fetchone()
            if qc and qc[0] == 'ok':
                checks["integrity"] = "ok"
            else:
                checks["integrity"] = f"error: {qc}"
                status = "degraded"
        except Exception as e:
            checks["integrity"] = f"error: {e}"
        # 检查 WAL 文件是否异常膨胀（>200MB 提示）
        try:
            wal = db_path + "-wal"
            if os.path.exists(wal):
                wal_mb = os.path.getsize(wal) / 1024 / 1024
                checks["wal_mb"] = round(wal_mb, 1)
                if wal_mb > 200:
                    checks["wal"] = f"warning: {wal_mb:.0f}MB"
                    status = "degraded"
                else:
                    checks["wal"] = "ok"
        except Exception:
            pass
        conn.close()
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
    except Exception as e:
        import logging; logging.warning(f"[health] disk check error: {e}")
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