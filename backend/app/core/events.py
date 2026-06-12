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
        try:
            import asyncio
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(broadcast(data.get('ws_message', {})))
        except Exception:
            pass

    def _handle_order_rules(data):
        from app.core.rules import evaluate
        for item in data.get('items', []):
            evaluate('order.created', {
                'order_qty': int(item.get('quantity',0)),
                'sku': item.get('sku',''),
                'order': item,
                'db': get_db(),
            })

    bus.on('order.created', _handle_inventory_adjust)
    bus.on('order.created', _handle_event_log)
    bus.on('order.created', _handle_broadcast)
    bus.on('order.created', lambda _: invalidate_dashboard())

    # ─── inventory.changed ──────────────────────────────────────────
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

    bus.on('inventory.changed', _handle_inventory_event)
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

    # ─── 规则引擎 ──────────────────────────────────────────────────────
    def _handle_rules_engine(data):
        from app.core.rules import evaluate
        evaluate('inventory.changed', {'inv': data.get('inventory', {}), 'db': get_db(), 'sku': data.get('inventory', {}).get('sku','')})
    bus.on('inventory.changed', _handle_rules_engine)
