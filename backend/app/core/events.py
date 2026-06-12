from collections import defaultdict
from app.core.database import get_db

class EventBus:
    def __init__(self):
        self.listeners = defaultdict(list)

    def on(self, event_name, handler):
        self.listeners[event_name].append(handler)

    def emit(self, event_name, payload=None):
        for handler in self.listeners.get(event_name, []):
            handler(payload or {})

bus = EventBus()


def register_core_handlers():
    """Register core event handlers at startup.
    Called once from main.py. Handlers use lazy imports to avoid circular deps.
    """
    from app.core.dashboard_cache import invalidate as invalidate_dashboard

    # ─── order.created ──────────────────────────────────────────────
    def _handle_inventory_adjust(data):
        from app.api.routes.insights import auto_adjust_inventory
        db = get_db()
        items = data.get('items', [])
        order_type = data.get('order_type', 'sales')
        for item in items:
            auto_adjust_inventory(item, order_type, db)

    def _handle_event_log(data):
        from app.api.routes.events import create_event
        db = get_db()
        try:
            create_event(db,
                         event_type=data.get('event_type', 'unknown'),
                         entity_type=data.get('entity_type', ''),
                         entity_id=data.get('entity_id'),
                         title=data.get('title', ''),
                         payload=data.get('payload', {}))
        except Exception:
            pass

    def _handle_broadcast(data):
        from app.api.routes.ws import broadcast
        import asyncio
        asyncio.ensure_future(broadcast(data.get('ws_message', {})))

    bus.on('order.created', _handle_inventory_adjust)
    bus.on('order.created', _handle_event_log)
    bus.on('order.created', _handle_broadcast)
    bus.on('order.created', lambda _: invalidate_dashboard())

    # ─── inventory.changed ──────────────────────────────────────────
    def _handle_inventory_alert(data):
        db = get_db()
        inv = data.get('inventory', {})
        avail = int(inv.get('available_qty') or 0)
        safety = int(inv.get('safety_qty') or 0)
        sku = inv.get('sku', '')
        product_name = inv.get('product_name', sku)
        if 0 < safety and avail < safety:
            existing = db.table("alerts").select("id").eq("alert_type", "low_stock")\
                .eq("related_sku", sku).eq("status", "active").execute().data
            if not existing:
                db.table("alerts").insert({
                    "alert_type": "low_stock",
                    "title": f"低库存预警: {product_name}",
                    "description": f"可用 {avail} < 安全线 {safety}",
                    "severity": "warning",
                    "source": "event_bus",
                    "related_sku": sku,
                    "status": "active",
                }).execute()

    def _handle_inventory_event(data):
        from app.api.routes.events import create_event
        db = get_db()
        inv = data.get('inventory', {})
        try:
            create_event(db, 'stock.changed', 'inventory', str(inv.get('id')),
                         f"库存变动: {inv.get('product_name', inv.get('sku', ''))}",
                         {'available_qty': inv.get('available_qty'),
                          'safety_qty': inv.get('safety_qty'),
                          'action': data.get('action')})
        except Exception:
            pass

    bus.on('inventory.changed', _handle_inventory_alert)
    bus.on('inventory.changed', _handle_inventory_event)

    # ─── inventory.changed → 补货建议 ──────────────────────────────
    def _handle_replenishment_check(data):
        db = get_db()
        inv = data.get('inventory', {})
        avail = int(inv.get('available_qty') or 0)
        safety = int(inv.get('safety_qty') or 0)
        sku = inv.get('sku', '')
        if not sku or safety <= 0:
            return
        # Only trigger when seriously low (≤30% safety or ≤0)
        if avail <= max(1, int(safety * 0.3)):
            suggested = max(safety * 2 - avail - int(inv.get('in_transit_qty') or 0), safety - avail)
            existing = db.table("alerts").select("id").eq("alert_type", "replenish")\
                .eq("related_sku", sku).eq("status", "active").execute().data
            if not existing:
                db.table("alerts").insert({
                    "alert_type": "replenish",
                    "title": f"紧急补货: {inv.get('product_name', sku)}",
                    "description": f"可用 {avail}，建议补货 {suggested} 件 (安全线 {safety})",
                    "severity": "error",
                    "source": "event_bus",
                    "related_sku": sku,
                    "status": "active",
                }).execute()

    bus.on('inventory.changed', _handle_replenishment_check)
    bus.on('inventory.changed', lambda _: invalidate_dashboard())

    # ─── data.cleaned ───────────────────────────────────────────────
    def _handle_cleansed_event(data):
        from app.api.routes.events import create_event
        db = get_db()
        try:
            create_event(db, f"{data.get('target', 'data')}.cleansed", 'data', None,
                         f"清洗导入 {data.get('success', 0)} 条", data)
        except Exception:
            pass

    bus.on('data.cleaned', _handle_cleansed_event)
    bus.on('data.cleaned', _handle_broadcast)
    bus.on('data.cleaned', lambda _: invalidate_dashboard())
