"""APScheduler 定时任务"""
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime

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
            try:
                auto_adjust_inventory(o, 'cleansing', db)
                count += 1
            except: pass
        print(f"[Scheduler] Inventory sync: {count}/{len(orders)}")
    except Exception as e:
        print(f"[Scheduler] Inventory sync error: {e}")

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
                        except: pass
            print(f"[Scheduler] {table}: {before} → kept latest")
    except Exception as e:
        print(f"[Scheduler] Cleanup error: {e}")

def _task_backup():
    """每天凌晨 2 点备份数据库"""
    try:
        from app.core.database import backup_db
        path = backup_db()
        if path:
            print(f"[Scheduler] Backup: {path}")
        else:
            print("[Scheduler] Backup failed")
    except Exception as e:
        print(f"[Scheduler] Backup error: {e}")

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
        print(f"[Scheduler] Daily rules: checked {len(results)} items")
    except Exception as e:
        print(f"[Scheduler] Daily rules error: {e}")

def start():
    global _started
    if _started:
        return
    _started = True
    scheduler.add_job(_task_inventory_sync, IntervalTrigger(minutes=30), id='inventory_sync')
    scheduler.add_job(_task_cleanup_logs, CronTrigger(hour=3, minute=0), id='cleanup_logs')
    scheduler.add_job(_task_backup, CronTrigger(hour=2, minute=0), id='db_backup')
    scheduler.add_job(_task_daily_rules, CronTrigger(hour=4, minute=0), id='daily_rules')
    scheduler.start()
    print(f"[Scheduler] Started at {datetime.utcnow().isoformat()}")

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
