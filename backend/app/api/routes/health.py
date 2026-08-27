"""Health check endpoint for monitoring"""
from fastapi import APIRouter, Request
from datetime import datetime, UTC
import os, sqlite3

router = APIRouter(tags=["health"])


@router.post("/api/backup")
def trigger_backup(request: Request):
    """手动触发数据库备份（验证备份机制 + 应急数据保护）"""
    from app.core.response import ok, fail
    from app.core.database import backup_db
    import logging
    # 简单鉴权：需要有效 token
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else ""
    if not token:
        return fail("未登录", status=401)
    try:
        from app.core.auth import verify_token
        if not verify_token(token):
            return fail("登录已失效", status=401)
    except Exception:
        return fail("鉴权失败", status=401)
    path = backup_db()
    if path and os.path.exists(path) and os.path.getsize(path) > 1024:
        # 进程内验证：解压 + 打开 SQLite 确认可恢复（不受 PA 下载通道 10MB 限制影响）
        try:
            import gzip, sqlite3
            _sz = os.path.getsize(path)
            with gzip.open(path, 'rb') as f:
                _raw = f.read(200 * 1024 * 1024)  # 最多读 200MB
            _verify_db = path + ".verify"
            with open(_verify_db, 'wb') as f:
                f.write(_raw)
            _c = sqlite3.connect(_verify_db)
            _orders = _c.execute("SELECT COUNT(*) FROM orders").fetchone()[0]
            _products = _c.execute("SELECT COUNT(*) FROM products").fetchone()[0]
            _users = _c.execute("SELECT COUNT(*) FROM users").fetchone()[0]
            _c.close()
            try: os.remove(_verify_db)
            except Exception: pass
            logging.info(f"[backup] verify OK: orders={_orders} products={_products} users={_users}")
            return ok({"path": path, "size": _sz, "verify": {"orders": _orders, "products": _products, "users": _users}})
        except Exception as e:
            logging.error(f"[backup] verify failed: {e}")
            return fail(f"备份文件已验证失败: {e}", status=500)

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
    
    # 数据库大小监控 + 自动 VACUUM（超过阈值后台执行）
    try:
        from app.core.db_maintenance import get_db_size_mb, VACUUM_THRESHOLD_MB
        _sz = get_db_size_mb()
        checks["db_size_mb"] = round(_sz, 1)
        # 临时诊断：orders 索引
        try:
            from app.core.database import get_conn
            _c2 = get_conn()
            checks["orders_idx"] = [r[0] for r in _c2.execute("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='orders'").fetchall()]
        except Exception as _e: checks["orders_idx"] = str(_e)[:80]
        if _sz >= VACUUM_THRESHOLD_MB:
            from app.core.database import submit_task, get_task
            _tv = get_task("health_vacuum")
            if not _tv or _tv.get('status') in ('done', 'error', 'not_found'):
                submit_task("health_vacuum", lambda: __import__('app.core.db_maintenance', fromlist=['vacuum_database']).vacuum_database())
    except: pass
    
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

    # 备份状态（最近一次备份结果 + 备份文件时间）
    try:
        import glob as _glob
        from app.core.database import DB_PATH as _BDB
        _baks = sorted(_glob.glob(_BDB + ".bak.*.gz"), key=os.path.getmtime, reverse=True)
        if _baks:
            checks["last_backup"] = os.path.basename(_baks[0])
            import datetime as _dt
            checks["last_backup_time"] = _dt.datetime.fromtimestamp(os.path.getmtime(_baks[0])).strftime('%Y-%m-%d %H:%M')
        else:
            checks["last_backup"] = "none"
        # 最近备份是否失败（查 quality_logs）
        try:
            from app.core.database import get_conn
            _c3 = get_conn()
            _row = _c3.execute("SELECT message, created_at FROM quality_logs WHERE log_type='backup' ORDER BY id DESC LIMIT 1").fetchone()
            if _row:
                checks["last_backup_result"] = f"{_row[0]} @ {_row[1]}"
                if '失败' in _row[0]:
                    checks["backup"] = "warning"
                    if status == "ok": status = "degraded"
        except Exception:
            pass
    except Exception as e:
        checks["last_backup"] = f"error: {e}"
    
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
        "timestamp": datetime.now(UTC).isoformat(),
        "checks": checks,
        "version": version,
    }


@router.get("/api/diag-orders")
def diag_orders():
    """诊断: orders 表真实状态（不过滤软删）"""
    import sqlite3
    from app.core.database import DB_PATH
    db_path = DB_PATH
    try:
        conn = sqlite3.connect(db_path)
        tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()]
        orders_exists = 'orders' in tables
        if not orders_exists:
            return {"orders_exists": False, "tables": tables, "db_path": db_path}
        total = conn.execute("SELECT COUNT(*) FROM orders").fetchone()[0]
        active = conn.execute("SELECT COUNT(*) FROM orders WHERE (deleted_at IS NULL OR deleted_at='')").fetchone()[0]
        soft_del = conn.execute("SELECT COUNT(*) FROM orders WHERE deleted_at IS NOT NULL AND deleted_at != ''").fetchone()[0]
        mmin = conn.execute("SELECT MIN(ordered_at) FROM orders").fetchone()[0]
        mmax = conn.execute("SELECT MAX(ordered_at) FROM orders").fetchone()[0]
        daily_stats = conn.execute("SELECT COUNT(*), COALESCE(SUM(order_count),0) FROM daily_stats").fetchone()
        conn.close()
        return {"total": total, "active": active, "soft_del": soft_del, "min_date": mmin, "max_date": mmax, "daily_stats_rows": daily_stats[0], "daily_stats_orders": daily_stats[1]}
    except Exception as e:
        return {"error": str(e)}
