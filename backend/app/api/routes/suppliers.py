from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import json
from app.core.database import get_db
from app.models.entities import Supplier
from app.services.dashboard_service import seed_suppliers

router = APIRouter(prefix="/api/suppliers", tags=["suppliers"])

@router.get("")
def list_suppliers(db: Session = Depends(get_db)):
    q = db.query(Supplier).order_by(Supplier.id.desc()).all()
    return [{
        'id': x.id, 'supplier_code': x.supplier_code,
        'supplier_name': x.supplier_name, 'contact_person': x.contact_person,
        'contact_phone': x.contact_phone, 'score': x.score,
        'status': x.status,
        'created_at': x.created_at.isoformat() if x.created_at else None,
    } for x in q]

@router.post("")
def create_supplier(data: dict, db: Session = Depends(get_db)):
    exists = db.query(Supplier).filter(Supplier.supplier_code == data.get('supplier_code', '')).first()
    if exists:
        raise HTTPException(status_code=400, detail='供应商编码已存在')
    s = Supplier(
        supplier_code=str(data.get('supplier_code', ''))[:50],
        supplier_name=str(data.get('supplier_name', ''))[:200],
        contact_person=str(data.get('contact_person', ''))[:50],
        contact_phone=str(data.get('contact_phone', ''))[:50],
        score=int(data.get('score', 0)),
        raw_data=json.dumps(data, ensure_ascii=False),
    )
    db.add(s)
    db.commit()
    return {'ok': True, 'id': s.id}

@router.delete("/{supplier_id}")
def delete_supplier(supplier_id: int, db: Session = Depends(get_db)):
    s = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not s:
        raise HTTPException(status_code=404, detail='供应商不存在')
    db.delete(s)
    db.commit()
    return {'ok': True}

@router.post("/seed")
def seed_suppliers_endpoint(db: Session = Depends(get_db)):
    seed_suppliers(db)
    return {'ok': True}
