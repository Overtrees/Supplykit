import sqlite3, os
db_path = '/home/Overtrees/Supplykit/backend/app/supplykit.db'
conn = sqlite3.connect(db_path)
conn.execute('PRAGMA busy_timeout=60000')
conn.execute('PRAGMA journal_mode=DELETE')
try:
    qc = conn.execute('PRAGMA quick_check').fetchone()
    print('quick_check:', qc)
    if qc and qc[0] != 'ok':
        print('数据库损坏，需要恢复')
    else:
        print('数据库完整，执行 VACUUM...')
        conn.execute('VACUUM')
        new_size = os.path.getsize(db_path) / 1024 / 1024
        print(f'VACUUM 完成，数据库 {new_size:.0f}MB')
    conn.execute('PRAGMA wal_checkpoint(TRUNCATE)')
    conn.execute('PRAGMA journal_mode=WAL')
    print('WAL checkpoint 完成')
except Exception as e:
    print('错误:', e)
conn.close()
