import sqlite3
import os

db_path = os.path.expanduser("~/Supplykit/backend/app/supplykit.db")
# Also check other possible locations
for p in ["~/Supplykit/backend/app/supplykit.db", "~/Supplykit/supplykit.db"]:
    fp = os.path.expanduser(p)
    if os.path.exists(fp):
        db_path = fp
        break

print(f"Using db: {db_path}")
conn = sqlite3.connect(db_path)
c = conn.cursor()
c.execute("UPDATE alerts SET status = 'inactive' WHERE alert_type = 'storage_fee' AND status = 'active'")
print(f"Updated {c.rowcount} alerts")
conn.commit()
conn.close()
