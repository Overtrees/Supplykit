"""统一任务管理接口 — 查询所有异步任务状态（种子/清洗/导出），按渠道隔离"""
from fastapi import APIRouter
from app.core.database import get_conn, get_db

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("")
def get_tasks(channel: str = 'jd', limit: int = 20):
    """返回指定渠道的异步任务列表（按创建时间倒序）"""
    try:
        conn = get_conn()
        # 过滤内部维护任务（vacuum/health_ 等系统自动任务，不显示给用户）
        rows = conn.execute(
            "SELECT task_id, task_type, status, result, channel, created_at, updated_at "
            "FROM sync_tasks WHERE channel=? ORDER BY id DESC LIMIT ?",
            (channel, limit)
        ).fetchall()
        tasks = []
        for r in rows:
            _tid = r[0] or ''
            # 跳过内部维护任务（数据库 VACUUM 等）
            if _tid.startswith('vacuum') or _tid.startswith('health_') or _tid.startswith('inv_sync'):
                continue
            tasks.append({
                "task_id": _tid, "task_type": r[1], "status": r[2],
                "result": r[3], "channel": r[4],
                "created_at": r[5], "updated_at": r[6],
            })
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