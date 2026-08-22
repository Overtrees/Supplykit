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
        for o in (orders or []):
            try:
                auto_adjust_inventory(o, 'cleansing', db)
                count += 1
            except Exception as e:
                logger.warning(f"Inventory sync error for order {o.get('id')}: {e}")
        logger.info(f"Inventory sync: {count}/{len(orders or [])}")
    except Exception as e:
        logger.error(f"Inventory sync error: {e}")

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
        cutoff = (datetime.utcnow() - timedelta(days=60)).strftime('%Y-%m-%d')
        db = get_db()
        # 用 SQL 只取超期订单（避免全表加载）
        conn = get_conn()
        old_orders = [dict(r) for r in conn.execute("SELECT * FROM orders WHERE substr(ordered_at,1,10) < ?", (cutoff,)).fetchall()]
        if not old_orders:
            logger.info(f"Order archive: no orders before {cutoff}")
            return
        # 按天+渠道+店铺+SKU+状态 聚合
        from collections import defaultdict
        agg = defaultdict(lambda: {'gmv': 0, 'count': 0, 'qty': 0})
        for o in old_orders:
            key = (str(o.get('ordered_at',''))[:10], o.get('channel','jd'), o.get('store',''), o.get('sku',''), o.get('order_status','')[:10])
            agg[key]['gmv'] += float(o.get('total_amount') or 0)
            agg[key]['count'] += 1
            agg[key]['qty'] += int(o.get('quantity') or 0)
        # 写入 daily_stats
        conn = get_conn()
        for (date, channel, store, sku, order_status), v in agg.items():
            try:
                conn.execute(
                    "INSERT INTO daily_stats (date, channel, store, sku, order_status, gmv, order_count, quantity) VALUES (?,?,?,?,?,?,?,?) "
                    "ON CONFLICT(date, channel, store, sku, order_status) DO UPDATE SET gmv=gmv+?, order_count=order_count+?, quantity=quantity+?",
                    (date, channel, store, sku, order_status, v['gmv'], v['count'], v['qty'], v['gmv'], v['count'], v['qty'])
                )
            except Exception as e: logger.info(f"{e}")
        conn.commit()
        # 删除已归档的原始订单（分批）
        ids = [o['id'] for o in old_orders]
        batch_size = 100
        for i in range(0, len(ids), batch_size):
            batch = ids[i:i+batch_size]
            try:
                conn.execute(f"DELETE FROM orders WHERE id IN ({','.join(['?']*len(batch))})", batch)
                conn.commit()
            except Exception as e: logger.info(f"{e}")
        logger.info(f"Order archive: {len(old_orders)} orders → {len(agg)} daily stats rows")
        conn.close()
        # 归档后立即增量回收空间（不需要独占锁）
        try:
            from app.core.database import incremental_vacuum
            incremental_vacuum()
        except Exception: pass
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
    """每天凌晨 2 点备份数据库（自动检查配额，只保留最近 2 个备份）"""
    try:
        from app.core.database import backup_db, DB_PATH
        import glob, os
        # 备份前检查配额：如果已有 2 个备份，先删最旧的再备份
        baks = sorted(glob.glob(DB_PATH + ".bak.*.gz"), key=os.path.getmtime, reverse=True)
        while len(baks) >= 2:
            old = baks.pop()
            try:
                os.remove(old)
                logger.info(f"Pre-backup cleanup: removed {old}")
            except Exception as e:
                logger.info(f"Pre-backup cleanup error: {e}")
        # 备份
        path = backup_db()
        if path:
            logger.info(f"Backup: {path}")
            try:
                from app.core.database import get_conn
                _c = get_conn()
                _c.execute("INSERT INTO quality_logs(log_type,level,message,details,source) VALUES(?,?,?,?,?)",
                    ("backup", "info", f"数据库备份成功: {path}", "", "scheduler"))
                _c.commit()
            except Exception as _e:
                logger.warning(f"Backup log write error: {_e}")
        else:
            logger.error("Backup failed")
            try:
                from app.core.database import get_conn
                _c = get_conn()
                _c.execute("INSERT INTO quality_logs(log_type,level,message,details,source) VALUES(?,?,?,?,?)",
                    ("backup", "error", "数据库备份失败", "backup_db 返回 None（VACUUM INTO 与复制均失败）", "scheduler"))
                _c.commit()
            except Exception as _e:
                logger.warning(f"Backup log write error: {_e}")
        # 备份后复查配额，超限则继续清理
        baks = sorted(glob.glob(DB_PATH + ".bak.*.gz"), key=os.path.getmtime, reverse=True)
        while len(baks) > 2:
            old = baks.pop()
            try:
                os.remove(old)
                logger.info(f"Post-backup cleanup: removed {old}")
            except Exception as e:
                logger.info(f"Post-backup cleanup error: {e}")
        # 备份后 VACUUM 压缩数据库（使用 db_maintenance 模块，带重试和降级）
        try:
            from app.core.db_maintenance import vacuum_database
            r = vacuum_database()
            if r.get('ok'):
                logger.info(f"VACUUM: {r.get('size_before')}MB → {r.get('size_after')}MB ({r.get('method','')})")
            elif r.get('skipped'):
                logger.info(f"VACUUM: 跳过（{r.get('size_before')}MB < 阈值）")
        except Exception as e:
            logger.info(f"VACUUM error: {e}")
    except Exception as e:
        logger.info(f"Backup error: {e}")

def _task_disk_cleanup():
    """每日磁盘自检：清理旧备份/临时文件 + WAL checkpoint，防止撑爆存储配额"""
    try:
        from app.core.database import DB_PATH
        import glob, os
        cleaned = []
        # 1. 旧备份只保留 2 个
        baks = sorted(glob.glob(DB_PATH + ".bak.*.gz"), key=os.path.getmtime, reverse=True)
        for old in baks[2:]:
            try:
                os.remove(old)
                cleaned.append(os.path.basename(old))
            except Exception: pass
        # 2. 清理临时文件（tmp* / .nfs*）
        app_dir = os.path.dirname(DB_PATH)
        for f in glob.glob(os.path.join(app_dir, "tmp*")) + glob.glob(os.path.join(app_dir, ".nfs*")):
            try:
                if os.path.isfile(f):
                    os.remove(f)
                    cleaned.append(os.path.basename(f))
            except Exception: pass
        # 3. WAL checkpoint 防膨胀（合并 WAL 到主库）
        try:
            import sqlite3
            conn = sqlite3.connect(DB_PATH)
            conn.execute("PRAGMA busy_timeout=30000")
            conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
            conn.close()
            cleaned.append("wal_checkpoint")
        except Exception as e:
            logger.info(f"WAL checkpoint error: {e}")
        # 4. 增量回收空间（不需要独占锁，auto_vacuum=INCREMENTAL 生效）
        try:
            from app.core.database import incremental_vacuum
            if incremental_vacuum():
                cleaned.append("vacuum(incremental)")
        except Exception as e:
            logger.info(f"VACUUM error: {e}")
        # 5. 报告数据库和 WAL 大小
        db_size = os.path.getsize(DB_PATH) / 1024 / 1024
        wal_path = DB_PATH + "-wal"
        wal_size = os.path.getsize(wal_path) / 1024 / 1024 if os.path.exists(wal_path) else 0
        logger.info(f"Disk cleanup: {cleaned} | db={db_size:.1f}MB wal={wal_size:.1f}MB")
    except Exception as e:
        logger.info(f"Disk cleanup error: {e}")

def _task_daily_rules():
    """每天执行定时规则（滞销识别等，已通过 detect_slow_moving_products 直接处理，无需 evaluate）"""
    try:
        from app.core.database import get_db
        from app.api.routes.insights import detect_slow_moving_products
        db = get_db()
        results = detect_slow_moving_products(db, create_alerts=True)
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
    scheduler.add_job(_task_disk_cleanup, CronTrigger(hour=3, minute=20), id='disk_cleanup')
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
