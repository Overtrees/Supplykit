from fastapi import APIRouter
from app.core.database import get_db
from app.core.response import ok, fail

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


@router.get("")
def list_inventory(db = get_db(), channel: str = 'jd', store: str = '', warehouse_type: str = '',
                   page: int = 0, page_size: int = 0):
    """库存列表 — 支持分页、渠道过滤、店铺过滤、仓库类型过滤"""
    q = db.table("inventory").select("*").eq("channel", channel)
    # B 仓（platform_b）是京东主体专属概念，其他渠道强制排除
    if channel != 'jd':
        q = q.neq("warehouse_type", "platform_b")
    # 联表查询商品价格
    products = {p['sku']: p for p in (db.table("products").select("*").eq("channel", channel).execute().data or [])}
    if store:
        q = q.eq("store", store)
    if warehouse_type:
        q = q.eq("warehouse_type", warehouse_type)

    if page > 0 and page_size > 0:
        count_q = db.table("inventory").select("count(*)")
        if store:
            count_q = count_q.eq("store", store)
        if warehouse_type:
            count_q = count_q.eq("warehouse_type", warehouse_type)
        cr = count_q.execute()
        total = cr.count if hasattr(cr, 'count') else len(cr.data or [])
        q = q.order("id", desc=True).limit(page_size).offset((page - 1) * page_size)
        data = q.execute().data or []
        # 注入商品价格
        for item in data:
            p = products.get(item.get('sku', ''))
            if p: item['price'] = p.get('price', 0)
        return ok({
            'items': data,
            'total': total,
            'page': page,
            'page_size': page_size,
            'total_pages': max(1, (total + page_size - 1) // page_size),
        })

    data = q.order("id", desc=True).execute().data or []
    for item in data:
        p = products.get(item.get('sku', ''))
        if p: item['price'] = p.get('price', 0)
    return data


@router.post("")
def create_inventory(body: dict, db = get_db()):
    data = db.table("inventory").insert({
        "sku": body.get("sku"),
        "product_name": body.get("product_name"),
        "store": body.get("store", ""),
        "warehouse": body.get("warehouse", ""),
        "warehouse_type": body.get("warehouse_type", "platform"),
        "available_qty": int(body.get("available_qty", 0)),
        "locked_qty": int(body.get("locked_qty", 0)),
        "in_transit_qty": int(body.get("in_transit_qty", 0)),
        "safety_qty": int(body.get("safety_qty", 10)),
    }).execute().data
    inv = data[0] if data else None
    if inv:
        try:
            from app.core.events import bus
            bus.emit('inventory.changed', {
                'inventory': inv,
                'action': 'create',
                'quantity': inv.get('available_qty'),
            })
        except Exception:
            pass
    return inv or {"ok": True}


@router.put("/{iid}")
def update_inventory(iid: int, body: dict, db = get_db()):
    db.table("inventory").update(body).eq("id", iid).execute()
    inv = db.table("inventory").select("*").eq("id", iid).execute().data
    inv = inv[0] if inv else None
    if inv:
        try:
            from app.core.events import bus
            bus.emit('inventory.changed', {
                'inventory': inv,
                'action': 'update',
                'quantity': inv.get('available_qty'),
            })
        except Exception:
            pass
        try:
            from app.api.routes.events import create_event
            create_event(db, 'stock.changed', 'inventory', str(inv['id']),
                         f"库存变动: {inv.get('product_name', inv.get('sku',''))}",
                         {'available_qty': inv.get('available_qty'), 'action': 'update'})
        except Exception:
            pass
        try:
            from app.core.rules import evaluate
            evaluate('inventory.changed', {'inv': inv, 'db': db, 'sku': inv.get('sku',''), 'channel': inv.get('channel', 'jd')})
        except Exception:
            pass
    return ok({})


@router.delete("/{iid}")
def delete_inventory(iid: int, db = get_db()):
    db.table("inventory").delete().eq("id", iid).execute()
    return ok({})


@router.post('/batch-type')
def batch_set_warehouse_type(ids: str = '', warehouse: str = '', warehouse_type: str = 'own', db = get_db()):
    """批量设置仓库类型，ids逗号分隔 / warehouse名 / 'all'全部"""
    if warehouse:
        db.table("inventory").update({"warehouse_type": warehouse_type}).eq("warehouse", warehouse).execute()
        return ok({"updated": warehouse, "warehouse": warehouse})
    if ids == 'all':
        db.table("inventory").update({"warehouse_type": warehouse_type}).eq("warehouse_type", "platform").execute()
        return ok({"updated": "all"})
    id_list = [int(x.strip()) for x in ids.split(',') if x.strip().isdigit()]
    if id_list:
        db.table("inventory").update({"warehouse_type": warehouse_type}).in_("id", id_list).execute()
    return ok({"updated": len(id_list)})


@router.post("/adjust")
def adjust_inventory(body: dict, db = get_db()):
    iid = body.get("id")
    action = body.get("action")
    qty = int(body.get("quantity", 0))
    inv = db.table("inventory").select("*").eq("id", iid).execute().data
    inv = inv[0] if inv else None
    if not inv:
        return fail("not found")
    avail = int(inv.get("available_qty") or 0)
    new_avail = avail
    if action == "in":
        new_avail = avail + qty
        db.table("inventory").update({"available_qty": new_avail}).eq("id", iid).execute()
    elif action == "out":
        new_avail = max(0, avail - qty)
        db.table("inventory").update({"available_qty": new_avail}).eq("id", iid).execute()
    elif action == "set":
        new_avail = qty
        db.table("inventory").update({"available_qty": new_avail}).eq("id", iid).execute()
    inv["available_qty"] = new_avail
    return ok({})
