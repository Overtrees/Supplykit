import json
from datetime import datetime
from app.models.entities import Event, Alert, Inventory


def create_event(db, event_type, entity_type, entity_id, title, payload, level="info"):
    db.add(Event(
        event_type=event_type,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        title=title,
        payload=json.dumps(payload, ensure_ascii=False),
        level=level,
        status="new",
    ))


def rebuild_low_stock_alerts(db):
    db.query(Alert).filter(Alert.alert_type == "low_stock").delete()
    rows = db.query(Inventory).all()
    for x in rows:
        if int(x.available_qty or 0) < int(x.safety_qty or 0):
            db.add(Alert(
                alert_type="low_stock",
                title=f"低库存预警：{x.sku}",
                content=f"{x.store} / {x.product_name} 可用 {x.available_qty}，安全线 {x.safety_qty}",
                level="warning",
                entity_type="inventory",
                entity_id=str(x.id),
                raw_data=json.dumps({"sku": x.sku, "store": x.store}, ensure_ascii=False),
            ))
