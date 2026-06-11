from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean
from app.core.database import Base

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(String, default="demo")
    order_no = Column(String, unique=True, index=True)
    parent_order_no = Column(String, nullable=True)
    store = Column(String, index=True)
    sku = Column(String, index=True)
    product_name = Column(String)
    quantity = Column(Integer, default=0)
    unit_price = Column(Float, default=0)
    total_amount = Column(Float, default=0)
    order_status = Column(String, index=True)
    platform = Column(String, default="jd")
    source = Column(String, default="seed")
    source_id = Column(String, nullable=True)
    ordered_at = Column(String)
    raw_data = Column(Text, default="{}")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Inventory(Base):
    __tablename__ = "inventory"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(String, default="demo")
    store = Column(String, index=True)
    sku = Column(String, index=True)
    product_name = Column(String)
    available_qty = Column(Integer, default=0)
    locked_qty = Column(Integer, default=0)
    in_transit_qty = Column(Integer, default=0)
    safety_qty = Column(Integer, default=0)
    status = Column(String, default="active")
    source = Column(String, default="seed")
    source_id = Column(String, nullable=True)
    snapshot_at = Column(String, nullable=True)
    raw_data = Column(Text, default="{}")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class QualityLog(Base):
    __tablename__ = "quality_logs"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(String, default="demo")
    entity_type = Column(String)
    entity_id = Column(String, nullable=True)
    field_name = Column(String, nullable=True)
    issue_type = Column(String)
    issue_message = Column(String)
    severity = Column(String, default="warning")
    raw_data = Column(Text, default="{}")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(String, default="demo")
    event_type = Column(String, index=True)
    entity_type = Column(String)
    entity_id = Column(String, nullable=True)
    title = Column(String)
    payload = Column(Text, default="{}")
    level = Column(String, default="info")
    status = Column(String, default="new")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class SyncTask(Base):
    __tablename__ = "sync_tasks"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(String, default="demo")
    task_type = Column(String)
    platform = Column(String, default="manual_import")
    status = Column(String, default="success")
    started_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime, default=datetime.utcnow)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    message = Column(String, default="")
    raw_data = Column(Text, default="{}")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(String, default="demo")
    sku = Column(String, unique=True, index=True)
    product_name = Column(String)
    store = Column(String, default="")
    category = Column(String, default="")
    unit = Column(String, default="件")
    price = Column(Float, default=0)
    status = Column(String, default="active")
    raw_data = Column(Text, default="{}")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Supplier(Base):
    __tablename__ = "suppliers"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(String, default="demo")
    supplier_code = Column(String, unique=True, index=True)
    supplier_name = Column(String)
    contact_person = Column(String, default="")
    contact_phone = Column(String, default="")
    score = Column(Integer, default=0)
    status = Column(String, default="active")
    raw_data = Column(Text, default="{}")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(String, default="demo")
    alert_type = Column(String, index=True)
    title = Column(String)
    content = Column(String)
    level = Column(String, default="warning")
    entity_type = Column(String, nullable=True)
    entity_id = Column(String, nullable=True)
    is_read = Column(Boolean, default=False)
    status = Column(String, default="active")
    raw_data = Column(Text, default="{}")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
