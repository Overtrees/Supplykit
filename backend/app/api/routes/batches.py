"""批次效期管理 — 多批次明细查询（进销存页展开用）"""
from fastapi import APIRouter
from app.core.database import get_db
from app.core.response import ok

router = APIRouter(prefix="/api/batches", tags=["batches"])


@router.get("")
def get_batches(sku: str = '', warehouse: str = '', channel: str = 'jd', limit: int = 50, db = get_db()):
    """按 SKU×仓库 查询批次明细（按截止日升序，最早/最危险排最前）"""
    from app.core.database import get_conn
    conn = get_conn()
    q = "SELECT sku, warehouse, warehouse_type, channel, prod_date, exp_date, qty, created_at FROM batches WHERE channel=?"
    params = [channel]
    if sku:
        q += " AND sku=?"
        params.append(sku)
    if warehouse:
        q += " AND warehouse=?"
        params.append(warehouse)
    q += " ORDER BY exp_date ASC, prod_date ASC LIMIT ?"
    params.append(limit)
    try:
        rows = conn.execute(q, params).fetchall()
        items = [{"sku": str(r[0]), "warehouse": str(r[1] or ''), "warehouse_type": str(r[2] or ''),
                  "channel": str(r[3] or 'jd'), "prod_date": str(r[4] or '')[:10],
                  "exp_date": str(r[5] or '')[:10], "qty": int(r[6] or 0),
                  "created_at": str(r[7] or '')[:19]} for r in rows]
        return ok(items)
    except Exception as e:
        import logging; logging.warning(f"[batches] query: {e}")
        return ok([])