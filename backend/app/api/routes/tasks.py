"""统一任务管理接口 — 查询所有异步任务状态（种子/清洗/导出），按渠道隔离"""
import sqlite3
import json
from fastapi import APIRouter
from app.core.database import get_conn, get_db, DB_PATH as _DB_PATH

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("")
def get_tasks(channel: str = 'jd', limit: int = 20):
    """返回指定渠道的异步任务列表（按创建时间倒序）"""
    try:
        # 用独立连接 + 更长 busy_timeout（避免与 seed 填充写锁冲突）
        conn = sqlite3.connect(_DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA busy_timeout=10000")
        # 过滤内部维护任务（vacuum/health_ 等系统自动任务，不显示给用户）
        # 直接用 * 查询 + 按列名取值（兼容表结构差异）
        _cols = [r[1] for r in conn.execute("PRAGMA table_info(sync_tasks)").fetchall()]
        _has_ch = 'channel' in _cols
        _sql = "SELECT * FROM sync_tasks"
        if _has_ch: _sql += " WHERE channel=? OR channel='all'"
        _sql += " ORDER BY id DESC LIMIT ?"
        _params = (channel, limit) if _has_ch else (limit,)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(_sql, _params).fetchall()
        tasks = []
        import logging
        logging.info(f'[tasks] rows={len(rows)} cols={_cols}')
        for r in rows:
            _tid = r['task_id'] if 'task_id' in r.keys() else ''
            _type = r['task_type'] if 'task_type' in r.keys() else ''
            _status = r['status'] if 'status' in r.keys() else ''
            _result = r['result'] if 'result' in r.keys() else ''
            _ch = r['channel'] if 'channel' in r.keys() else 'jd'
            _created = r['created_at'] if 'created_at' in r.keys() else ''
            _updated = r['updated_at'] if 'updated_at' in r.keys() else ''
            # 跳过内部维护任务（数据库 VACUUM 等）
            if _tid.startswith('vacuum') or _tid.startswith('health_') or _tid.startswith('inv_sync'):
                continue
            _steps = []
            try:
                _rj = json.loads(_result) if _result else {}
                if isinstance(_rj, dict):
                    _steps = _rj.get('steps', [])
                    # 兼容完成态：submit_task 结束时保存 result={"steps":[...]}，steps 嵌套在 result 里
                    if not _steps and isinstance(_rj.get('result'), dict):
                        _steps = _rj['result'].get('steps', [])
            except Exception:
                pass
            tasks.append({
                "task_id": _tid, "task_type": _type, "status": _status,
                "result": _result, "channel": _ch, "steps": _steps,
                "created_at": _created, "updated_at": _updated,
            })
        try: conn.close()
        except Exception: pass
        return {"ok": True, "data": tasks}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@router.get("/{task_id}")
def get_task_detail(task_id: str):
    """查询单个任务详情"""
    from app.core.database import get_task
    t = get_task(task_id)
    if t:
        return {"ok": True, "data": t}
    return {"ok": False, "error": "task not found"}