from fastapi import APIRouter, Depends
from app.core.database import get_db
from app.core.response import ok, fail
from datetime import datetime, UTC

router = APIRouter(prefix="/api/products", tags=["products"])


def _emit_products_changed(payload=None):
    """商品变化 → 补货/采购/看板缓存失效（联动建议页即时去除）"""
    try:
        from app.core.events import bus
        bus.emit('products.changed', payload or {})
    except Exception as e:
        import logging; logging.warning(f"[products] event emit: {e}")


def _valid(q):
    """过滤软删除商品：deleted_at 为空（迁移默认值 ''）"""
    return q.eq("deleted_at", "")


@router.get("")
def list_products(db = get_db(), search: str = "", channel: str = 'jd', include_deleted: str = ''):
    if include_deleted:
        base = db.table("products").select("*").eq("channel", channel)
    else:
        base = _valid(db.table("products").select("*").eq("channel", channel))
    if search:
        like = f"%{search}%"
        # 独立构造两个带 channel+deleted 过滤的条件再 or_（避免 channel 被 AND 进 LIKE）
        q1 = _valid(db.table("products").select("*").eq("channel", channel)).ilike("product_name", like)
        q2 = _valid(db.table("products").select("*").eq("channel", channel)).ilike("sku", like)
        q = q1.or_(q2)
    else:
        q = base
    data = q.order("id", desc=True).execute().data
    # 注入批次总效期（SKU 维度最早批次）
    try:
        from app.core.database import get_conn
        _conn = get_conn()
        _brows = _conn.execute("SELECT sku, MIN(prod_date), MIN(exp_date) FROM batches WHERE channel=? GROUP BY sku", (channel,)).fetchall()
        _bmap = {}
        for _r in _brows:
            _s = str(_r[0]); _pd = str(_r[1] or '')[:10]; _ed = str(_r[2] or '')[:10]
            if _pd and _ed:
                _d1 = 0; _d2 = 0
                try:
                    _d1 = int((datetime.strptime(_ed, '%Y-%m-%d') - datetime.strptime(_pd, '%Y-%m-%d')).days)
                except Exception: pass
                _bmap[_s] = _d1
        for item in data:
            _b = _bmap.get(item.get('sku', ''))
            item['batch_days'] = _b or 0
    except Exception: pass
    return ok(data)


@router.post("")
def create_product(body: dict, db = get_db()):
    import json
    data = db.table("products").insert({
        "sku": body.get("sku"),
        "product_name": body.get("product_name"),
        "store": body.get("store", ""),
        "category": body.get("category", ""),
        "spec": body.get("spec", ""),
        "price": float(body.get("price", 0)),
        "status": body.get("status", "active"),
        "channel": body.get("channel", "jd"),
        "raw_data": json.dumps(body, ensure_ascii=False),
    }).execute().data
    _emit_products_changed({"action": "create", "sku": body.get("sku")})
    return ok(data[0]) if data else ok({})


@router.put("/{pid}")
def update_product(pid: int, body: dict, db = get_db()):
    db.table("products").update(body).eq("id", pid).execute()
    _emit_products_changed({"action": "update", "id": pid})
    return ok({})


@router.post("/{pid}/restore")
def restore_product(pid: int, db = get_db()):
    db.table("products").update({"deleted_at": ""}).eq("id", pid).execute()
    _emit_products_changed({"action": "restore", "id": pid})
    return ok({})


@router.post("/{pid}/permanent-delete")
def permanent_delete_product(pid: int, db = get_db()):
    db.table("products").delete().eq("id", pid).execute()
    _emit_products_changed({"action": "purge", "id": pid})
    return ok({})


@router.delete("/{pid}")
def delete_product(pid: int, db = get_db()):
    # 软删除（关联建议/看板通过 products.changed 事件联动剔除）
    from datetime import datetime, UTC
    db.table("products").update({"deleted_at": datetime.now(UTC).isoformat()}).eq("id", pid).execute()
    _emit_products_changed({"action": "delete", "id": pid})
    return ok({})


@router.post("/batch")
def batch_products(body: dict, db = get_db()):
    """批量操作: {action: 'delete'|'restore'|'active'|'inactive'|'purge', ids: [...]}"""
    from datetime import datetime, UTC
    action = body.get("action", "")
    ids = [int(x) for x in (body.get("ids") or []) if isinstance(x, int) or str(x).isdigit()]
    if not ids:
        return ok({"updated": 0})
    if action in ('delete', 'restore', 'purge'):
        if action == 'delete':
            val = {"deleted_at": datetime.now(UTC).isoformat()}
        elif action == 'restore':
            val = {"deleted_at": ""}
        else:
            # purge 硬删除
            db.table("products").delete().in_("id", ids).execute()
            _emit_products_changed({"action": "batch_purge", "ids": ids})
            return ok({"updated": len(ids)})
        db.table("products").update(val).in_("id", ids).execute()
    elif action in ('active', 'inactive'):
        db.table("products").update({"status": 'active' if action == 'active' else 'inactive'}).in_("id", ids).execute()
    else:
        return fail(f"未知操作: {action}")
    _emit_products_changed({"action": f"batch_{action}", "ids": ids})
    return ok({"updated": len(ids)})