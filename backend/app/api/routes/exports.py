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
                from app.api.routes.replenishment import export_orders_excel
                resp = export_orders_excel(channel=channel, db=get_db())
                items = resp.get("data") if isinstance(resp, dict) and "data" in resp else resp
                if isinstance(items, list):
                    ws.append(["订单号", "SKU", "商品", "数量", "金额", "日期"])
                    for r in items:
                        ws.append([r.get('order_no',''), r.get('sku',''), r.get('product_name',''), r.get('quantity',0), r.get('total_amount',0), str(r.get('ordered_at',''))[:10]])
            elif type == 'inventory':
                from app.api.routes.replenishment import export_inventory_excel
                resp = export_inventory_excel(channel=channel, db=get_db())
                items = resp.get("data") if isinstance(resp, dict) and "data" in resp else resp
                if isinstance(items, list):
                    ws.append(["SKU", "商品", "仓库", "可用", "在途", "安全线"])
                    for r in items:
                        ws.append([r.get('sku',''), r.get('product_name',''), r.get('warehouse',''), r.get('available_qty',0), r.get('in_transit_qty',0), r.get('safety_qty',0)])
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