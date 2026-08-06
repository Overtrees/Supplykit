"""APScheduler 定时任务"""
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime

logger = logging.getLogger("scheduler")
scheduler = BackgroundScheduler(daemon=True)
_started = False

def _task_inventory_sync():
    """每 30 分钟同步库存"""
    try:
        from app.core.database import get_db
        from app.api.routes.insights import auto_adjust_inventory
        db = get_db()
        orders = db.table("orders").select("*").order("id", desc=True).limit(100).execute().data
        count = 0
        for o in orders:
            try {
                auto_adjust_inventory(o, 'cleansing', db);
                count += 1
            } catch(Exception) {
                console.log("logger.error("Inventory sync error" for order", o);
            }
        logger.info(f"Inventory sync: {count}/{len(orders)}")
    except Exception as e:
        logger.info(f"logger.error("Inventory sync error": {e}")

def _task_build_sales_snapshot():
    """每天凌晨 3:30 构建日销快照"""
    try:
        from app.core.database import get_db
        from app.core.sales_utils import build_daily_sales_snapshot
        db = get_db()
        count = build_daily_sales_snapshot(db)
        logger.info(f"Sales snapshot: {count} rows")
    except Exception as e:
        logger.info(f"Sales snapshot error: {e}")

def _task_archive_orders():
    """每天凌晨 1 点归档 90 天前的订单"""
    try:
        from app.core.database import get_db, get_conn
        from datetime import timedelta
        cutoff = (datetime.utcnow() - timedelta(days=90)).strftime('%Y-%m-%d')
        db = get_db()
        old_orders = db.table("orders").select("*").execute().data or []
        old_orders = [o for o in old_orders if str(o.get('ordered_at',''))[:10] < cutoff]
        if not old_orders:
            logger.info(f"Order archive: no orders before {cutoff}")
            return
        # 按天+渠道+店铺+SKU 聚合
        from collections import defaultdict
        agg = defaultdict(lambda: {'gmv': 0, 'count': 0, 'qty': 0})
        for o in old_orders:
            key = (str(o.get('ordered_at',''))[:10], o.get('channel','jd'), o.get('store',''), o.get('sku',''))
            agg[key]['gmv'] += float(o.get('total_amount') or 0)
            agg[key]['count'] += 1
            agg[key]['qty'] += int(o.get('quantity') or 0)
        # 写入 daily_stats
        conn = get_conn()
        for (date, channel, store, sku), v in agg.items():
            try:
                conn.execute(
                    "INSERT INTO daily_stats (date, channel, store, sku, gmv, order_count, quantity) VALUES (?,?,?,?,?,?,?) "
                    "ON CONFLICT(date, channel, store, sku) DO UPDATE SET gmv=gmv+?, order_count=order_count+?, quantity=quantity+?",
                    (date, channel, store, sku, v['gmv'], v['count'], v['qty'], v['gmv'], v['count'], v['qty'])
                )
            except Exception as e: logger.info(f"{e}")
        conn.commit()
        # 删除已归档的原始订单
        ids = [o['id'] for o in old_orders]
        batch_size = 100
        for i in range(0, len(ids), batch_size):
            batch = ids[i:i+batch_size]
            for id_str in batch:
                try:
                    db.table("orders").delete().eq("id", id_str).execute()
                except Exception as e: logger.info(f"{e}")
        logger.info(f"Order archive: {len(old_orders)} orders → {len(agg)} daily stats rows")
        conn.close()
    except Exception as e:
        logger.info(f"Order archive error: {e}")

def _task_cleanup_logs():
    """每天清理 30 天前的日志"""
    try:
        from app.core.database import get_db
        db = get_db()
        cutoff = datetime.utcnow().isoformat()
        # 简单清理 events 和 quality_logs
        for table in ['events', 'quality_logs']:
            rows = db.table(table).select("*").execute().data
            before = len(rows)
            # 只保留最近 500 条
            if before > 500:
                ids = [r['id'] for r in rows[:-500]]
                if ids:
                    for id_str in ids:
                        try:
                            db.table(table).delete().eq("id", id_str).execute()
                        except Exception as e: logger.info(f"{e}")
            logger.info(f"{table}: {before} → kept latest")
    except Exception as e:
        logger.info(f"Cleanup error: {e}")

def _task_backup():
    """每天凌晨 2 点备份数据库"""
    try:
        from app.core.database import backup_db
        path = backup_db()
        if path:
            logger.info(f"Backup: {path}")
        else:
            logger.error("Backup failed")
    except Exception as e:
        logger.info(f"Backup error: {e}")

def _task_daily_rules():
    """每天执行定时规则（滞销识别等）"""
    try:
        from app.core.database import get_db
        from app.api.routes.insights import detect_slow_moving_products
        from app.core.rules import evaluate
        db = get_db()
        results = detect_slow_moving_products(db, create_alerts=True)
        for item in results:
            evaluate('scheduled.daily', {
                'db': db, 'sku': item['sku'],
                'product_name': item['product_name'],
                'days_since_last': item['days_since_last'],
                'stock': item['stock'],
            })
        logger.info(f"Daily rules: checked {len(results)} items")
    except Exception as e:
        logger.info(f"Daily rules error: {e}")

def start():
    global _started
    if _started:
        return
    _started = True
    scheduler.add_job(_task_inventory_sync, IntervalTrigger(minutes=30), id='inventory_sync')
    scheduler.add_job(_task_build_sales_snapshot, CronTrigger(hour=3, minute=30), id='build_sales_snapshot')
    scheduler.add_job(_task_archive_orders, CronTrigger(hour=1, minute=0), id='archive_orders')
    scheduler.add_job(_task_cleanup_logs, CronTrigger(hour=3, minute=0), id='cleanup_logs')
    scheduler.add_job(_task_backup, CronTrigger(hour=2, minute=0), id='db_backup')
    scheduler.add_job(_task_daily_rules, CronTrigger(hour=4, minute=0), id='daily_rules')
    scheduler.start()
    logger.info(f"Started at {datetime.utcnow().isoformat()}")

def get_status():
    jobs = scheduler.get_jobs()
    return {
        'running': scheduler.running,
        'jobs': [{
            'id': j.id,
            'next_run': str(j.next_run_time) if j.next_run_time else None,
            'trigger': str(j.trigger),
        } for j in jobs]
    }
