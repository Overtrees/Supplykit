"""异步导出 — 后台生成 Excel，持久化导出记录到文件，支持下载"""
import os, json, uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from app.core.database import get_db

router = APIRouter(prefix="/api/exports", tags=["exports"])

# 导出文件目录
EXPORT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'exports')
os.makedirs(EXPORT_DIR, exist_ok=True)


@router.post("")
def create_export_task(type: str = 'purchase', mode: str = 'bbcc', days: int = 28,
                       channel: str = 'jd', limit: int = 5000, db=get_db()):
    """提交导出任务，后台异步生成 Excel"""
    from app.core.database import submit_task
    task_id = f"export_{uuid.uuid4().hex[:8]}"
    params = {"type": type, "mode": mode, "days": days, "channel": channel, "limit": limit}

    def _run():
        try:
            from openpyxl import Workbook
            from app.api.routes.purchase import get_purchase_suggestions
            from app.api.routes.replenishment import get_replenishment_suggestions
            from app.api.routes.insights import detect_slow_moving_products
            wb = Workbook(); ws = wb.active
            if type == 'purchase_suggestions':
                data = get_purchase_suggestions(days=days, channel=channel, db=get_db())
                items = data.get("data") if isinstance(data, dict) else data
                ws.append(["SKU", "商品", "建议采购量", "日销"])
                for r in (items or []):
                    ws.append([r.get('sku',''), r.get('product_name',''), r.get('purchase_qty',0), r.get('daily_sales',0)])
            elif type == 'purchase':
                data = get_purchase_suggestions(days=days, mode=mode, channel=channel, db=get_db())
                items = data.get("data") if isinstance(data, dict) else data
                ws.append(["SKU", "商品", "建议补货量", "日销"])
                for r in (items or []):
                    ws.append([r.get('sku',''), r.get('product_name',''), r.get('suggested_qty',0), r.get('daily_sales',0)])
            elif type == 'slow':
                data = detect_slow_moving_products(db=get_db(), create_alerts=False)
                items = data.get("data") if isinstance(data, dict) else data
                ws.append(["SKU", "商品", "库存", "无销售天数"])
                for r in (items or []):
                    ws.append([r.get('sku',''), r.get('product_name',''), r.get('stock',0), r.get('days_since_last',0)])
            elif type == 'orders':
                from app.core.database import get_conn
                _conn = get_conn()
                _barcodes = {}
                try:
                    for _r in _conn.execute("SELECT sku, channel, barcode FROM products WHERE barcode!=''").fetchall():
                        _barcodes[(_r[0], _r[1])] = _r[2] or ''
                except Exception: pass
                _rows = _conn.execute("SELECT ordered_at,order_no,store,warehouse,product_name,sku,quantity,unit_price,total_amount,order_status,supplier,data_source,channel FROM orders WHERE channel=? ORDER BY id DESC LIMIT 2000", (channel,)).fetchall()
                ws.append(["下单日期","订单号","店铺","仓库","商品","SKU","数量","单价","金额","状态","69码","入库日期","供应商","来源"])
                for r in _rows:
                    _bc = _barcodes.get((r[5], r[12]), '')
                    ws.append([str(r[0] or '')[:10], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], _bc, str(r[0] or '')[:10], r[10], r[11]])
            elif type == 'inventory':
                from app.core.database import get_conn
                _conn = get_conn()
                _rows = _conn.execute("SELECT sku, product_name, warehouse, warehouse_type, available_qty, in_transit_qty, safety_qty FROM inventory WHERE channel=?", (channel,)).fetchall()
                ws.append(["SKU","商品","仓库","类型","可用","在途","安全线"])
                for r in _rows:
                    ws.append([r[0], r[1], r[2], r[3], r[4], r[5], r[6]])
            filename = f"{type}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.xlsx"
            filepath = os.path.join(EXPORT_DIR, filename)
            wb.save(filepath)
            return {"filepath": filepath, "filename": filename, "size": os.path.getsize(filepath), "type": type}
        except Exception as e:
            import logging; logging.warning(f"[export] {type}: {e}")
            raise

    submit_task(task_id, _run, channel=channel, task_type='export')
    return {"ok": True, "task_id": task_id, "data": {"type": type, "channel": channel}}


@router.get("/download/{path:path}")
def download_export(path: str):
    """下载导出文件"""
    filepath = os.path.join(EXPORT_DIR, os.path.basename(path))
    if not os.path.exists(filepath):
        raise HTTPException(404, "导出文件不存在或已过期")
    return FileResponse(filepath, filename=os.path.basename(filepath),
                        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")