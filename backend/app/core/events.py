from collections import defaultdict
from app.core.supabase_client import get_supabase

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

    # ─── order.created ──────────────────────────────────────────────
    def _handle_inventory_adjust(data):
        from app.api.routes.insights import auto_adjust_inventory
        supabase = get_supabase()
        items = data.get('items', [])
        order_type = data.get('order_type', 'sales')
        for item in items:
            auto_adjust_inventory(item, order_type, supabase)

    def _handle_event_log(data):
        from app.api.routes.events import create_event
        supabase = get_supabase()
        create_event(supabase,
                     event_type=data.get('event_type', 'unknown'),
                     entity_type=data.get('entity_type', ''),
                     entity_id=data.get('entity_id'),
                     title=data.get('title', ''),
                     payload=data.get('payload', {}))

    def _handle_broadcast(data):
        from app.api.routes.ws import broadcast
        import asyncio
        asyncio.ensure_future(broadcast(data.get('ws_message', {})))

    bus.on('order.created', _handle_inventory_adjust)
    bus.on('order.created', _handle_event_log)
    bus.on('order.created', _handle_broadcast)

    # ─── inventory.changed ──────────────────────────────────────────
    def _handle_inventory_alert(data):
        supabase = get_supabase()
        inv = data.get('inventory', {})
        avail = int(inv.get('available_qty') or 0)
        safety = int(inv.get('safety_qty') or 0)
        if 0 < safety and avail < safety:
            existing = supabase.table("alerts").select("id").eq("entity_type", "inventory")\
                .eq("entity_id", str(inv.get('id'))).eq("status", "active").execute().data
            if not existing:
                supabase.table("alerts").insert({
                    "title": f"低库存预警: {inv.get('product_name', inv.get('sku', ''))}",
                    "content": f"可用 {avail} < 安全线 {safety}",
                    "level": "warning",
                    "entity_type": "inventory",
                    "entity_id": str(inv.get('id')),
                    "status": "active",
                    "source": "event_bus",
                }).execute()

    def _handle_inventory_event(data):
        from app.api.routes.events import create_event
        supabase = get_supabase()
        inv = data.get('inventory', {})
        create_event(supabase, 'stock.changed', 'inventory', str(inv.get('id')),
                     f"库存变动: {inv.get('product_name', inv.get('sku', ''))}",
                     {'available_qty': inv.get('available_qty'),
                      'safety_qty': inv.get('safety_qty'),
                      'action': data.get('action')})

    bus.on('inventory.changed', _handle_inventory_alert)
    bus.on('inventory.changed', _handle_inventory_event)

    # ─── data.cleaned ───────────────────────────────────────────────
    def _handle_cleansed_event(data):
        from app.api.routes.events import create_event
        supabase = get_supabase()
        create_event(supabase, f"{data.get('target', 'data')}.cleansed", 'data', None,
                     f"清洗导入 {data.get('success', 0)} 条", data)

    bus.on('data.cleaned', _handle_cleansed_event)
    bus.on('data.cleaned', _handle_broadcast)
