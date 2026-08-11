"""Health check endpoint for monitoring"""
from fastapi import APIRouter
from datetime import datetime
import os, sqlite3

router = APIRouter(tags=["health"])

@router.get("/api/vacuum")
def run_vacuum():
    """后台执行 VACUUM 压缩数据库"""
    from app.core.database import submit_task, DB_PATH
    import os, logging
    def _do_vacuum():
        import sqlite3, os, time, shutil
        _tmp = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tmp', 'vacuumed.db')
        conn = sqlite3.connect(DB_PATH)
        conn.execute("PRAGMA busy_timeout=120000")
        try:
            conn.execute("VACUUM INTO ?", (_tmp,))
            conn.close()
            if os.path.exists(_tmp) and os.path.getsize(_tmp) > 1024:
                os.replace(_tmp, DB_PATH)
                import logging; logging.info(f"[vacuum] VACUUM INTO done")
        except Exception as e:
            import logging; logging.warning(f"[vacuum] VACUUM INTO: {e}")
            conn.close()
            if os.path.exists(_tmp): os.remove(_tmp)
        sz = os.path.getsize(DB_PATH) / 1024 / 1024
        logging.info(f"[vacuum] done: {sz:.0f}MB")
        return {"size_mb": round(sz, 1)}
    submit_task("vacuum", _do_vacuum)
    return {"ok": True, "message": "VACUUM 已在后台执行"}

@router.get("/api/vacuum/status")
def vacuum_status():
    from app.core.database import get_task
    t = get_task("vacuum")
    if not t: return {"ok": False, "status": "not_found"}
    return {"ok": True, "data": t}

@router.get("/api/health")
def health():
    """系统健康检查 + 缓存版本号"""
    status = "ok"
    checks = {}
    
    # 数据库检查（含完整性快速检测 + 运行中自动修复）
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
                checks["integrity"] = f"error: {qc}（尝试后台修复中）"
                status = "degraded"
                # 后台异步修复（不影响健康检查响应）
                def _repair():
                    try:
                        _c2 = sqlite3.connect(db_path)
                        _c2.execute("PRAGMA busy_timeout=30000")
                        _c2.execute("VACUUM")
                        _qc2 = _c2.execute("PRAGMA quick_check").fetchone()
                        _c2.close()
                        if _qc2 and _qc2[0] == 'ok':
                            import logging; logging.info("[db] 健康检查触发 VACUUM 修复成功")
                        else:
                            raise Exception("VACUUM 后仍损坏")
                    except Exception as _ve:
                        import logging; logging.warning(f"[db] VACUUM 修复失败，尝试备份恢复: {_ve}")
                        import glob, shutil, os
                        baks = sorted(glob.glob(db_path + ".bak.*"), key=os.path.getmtime, reverse=True)
                        for b in baks:
                            try:
                                shutil.copy2(b, db_path)
                                logging.info(f"[db] 从备份恢复成功: {b}")
                                break
                            except Exception:
                                pass
                import threading
                threading.Thread(target=_repair, daemon=True).start()
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