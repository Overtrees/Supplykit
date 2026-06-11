from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import json
from app.core.database import get_db
from app.models.entities import Product
from app.services.dashboard_service import seed_products

router = APIRouter(prefix="/api/products", tags=["products"])

@router.get("")
def list_products(db: Session = Depends(get_db)):
    q = db.query(Product).order_by(Product.id.desc()).all()
    return [{
        'id': x.id, 'sku': x.sku, 'product_name': x.product_name,
        'store': x.store, 'category': x.category, 'unit': x.unit,
        'price': x.price, 'status': x.status,
        'created_at': x.created_at.isoformat() if x.created_at else None,
    } for x in q]

@router.get("/{sku}")
def get_product(sku: str, db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.sku == sku).first()
    if not p:
        raise HTTPException(status_code=404, detail='商品不存在')
    return p

@router.post("")
def create_product(data: dict, db: Session = Depends(get_db)):
    exists = db.query(Product).filter(Product.sku == data.get('sku', '')).first()
    if exists:
        raise HTTPException(status_code=400, detail='SKU 已存在')
    p = Product(
        sku=str(data.get('sku', ''))[:100],
        product_name=str(data.get('product_name', ''))[:200],
        store=str(data.get('store', ''))[:100],
        category=str(data.get('category', ''))[:100],
        unit=str(data.get('unit', '件'))[:20],
        price=float(data.get('price', 0)),
        raw_data=json.dumps(data, ensure_ascii=False),
    )
    db.add(p)
    db.commit()
    return {'ok': True, 'id': p.id}

@router.delete("/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail='商品不存在')
    db.delete(p)
    db.commit()
    return {'ok': True}

@router.post("/seed")
def seed_products_endpoint(db: Session = Depends(get_db)):
    seed_products(db)
    return {'ok': True}
