from fastapi import APIRouter
from app.core.database import get_db, QueryBuilder

router = APIRouter(prefix="/api/orders", tags=["orders"])


@router.get("")
def list_orders(db = get_db(), page: int = 1, page_size: int = 50,
                search: str = '', status: str = '', store: str = '',
                sort_by: str = 'id', sort_order: str = 'desc'):
    """订单列表 — 数据库级过滤+排序+分页"""
    # 白名单排序字段防注入
    allowed_sort = {'id','order_no','ordered_at','total_amount','quantity','order_status','store','sku'}
    sort_col = sort_by if sort_by in allowed_sort else 'id'

    # 构建查询
    q = db.table("orders").select("*")

    # 多字段搜索（OR）
    if search:
        s = search.strip()
        q1 = QueryBuilder("orders", db.table("orders").conn).ilike("order_no", f"%{s}%")
        q2 = QueryBuilder("orders", db.table("orders").conn).ilike("product_name", f"%{s}%")
        q3 = QueryBuilder("orders", db.table("orders").conn).ilike("sku", f"%{s}%")
        q_or = q1.or_(q2).or_(q3)
        q._where = q_or._where
        q._params = q_or._params

    if status:
        q = q.eq("order_status", status)
    if store:
        q = q.eq("store", store)

    # 总条数
    count_q = db.table("orders").select("count(*)")
    count_q._where = list(q._where)
    count_q._params = list(q._params)
    count_result = count_q.execute()
    total = count_result.count if hasattr(count_result, 'count') else len(count_result.data or [])

    # 分页 + 排序
    desc = sort_order == 'desc'
    q = q.order(sort_col, desc)
    q = q.limit(page_size).offset((page - 1) * page_size)

    items = q.execute().data or []

    return {
        'total': total,
        'page': page,
        'page_size': page_size,
        'total_pages': max(1, (total + page_size - 1) // page_size),
        'items': items,
    }


@router.post('/batch-delete')
def batch_delete_orders(ids: str = '', db = get_db()):
    if not ids or ids == 'auto':
        data = db.table("orders").delete().ilike("order_no", "AUTO-%").execute().data
        deleted = len(data)
    else:
        id_list = [int(x.strip()) for x in ids.split(',') if x.strip().isdigit()]
        data = db.table("orders").delete().in_("id", id_list).execute().data
        deleted = len(data)
    return {'ok': True, 'deleted': deleted}


@router.delete('/{oid}')
def delete_order(oid: int, db = get_db()):
    db.table("orders").delete().eq("id", oid).execute()
    return {'ok': True}
