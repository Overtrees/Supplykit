"""SQLite 数据库层，接口风格兼容 db-py，方便未来迁 PostgreSQL

用法：db = SQLiteDB("data.db")
      db.table("orders").select("*").eq("order_no","xxx").execute()
      db.table("orders").insert([{"order_no":"xxx"}]).execute()
"""
import sqlite3, json, os, threading
from datetime import datetime
from collections import defaultdict
from typing import Any, Optional

DB_PATH = os.getenv("SQLITE_PATH", os.path.join(os.path.dirname(__file__), "..", "supplykit.db"))

_local = threading.local()

def backup_db():
    """备份数据库到同目录下"""
    import shutil
    bak_path = DB_PATH + f".bak.{datetime.utcnow().strftime('%Y%m%d')}"
    try:
        shutil.copy2(DB_PATH, bak_path)
        return bak_path
    except Exception as e:
        return None

# ─── 轻量异步任务队列 ──────────────────────────────────────────────────────

_task_queue = []
_task_results = {}
_task_lock = threading.Lock()

def submit_task(task_id: str, fn, *args, **kwargs):
    """提交一个后台任务"""
    with _task_lock:
        _task_results[task_id] = {"status": "pending", "result": None, "error": None}
    def _run():
        try:
            with _task_lock:
                _task_results[task_id]["status"] = "running"
            result = fn(*args, **kwargs)
            with _task_lock:
                _task_results[task_id]["status"] = "done"
                _task_results[task_id]["result"] = result
        except Exception as e:
            with _task_lock:
                _task_results[task_id]["status"] = "error"
                _task_results[task_id]["error"] = str(e)
    t = threading.Thread(target=_run, daemon=True)
    t.start()
    return task_id

def get_task(task_id: str):
    with _task_lock:
        return _task_results.get(task_id)

def get_conn():
    if not hasattr(_local, "conn") or _local.conn is None:
        _local.conn = sqlite3.connect(DB_PATH)
        _local.conn.row_factory = sqlite3.Row
        _local.conn.execute("PRAGMA journal_mode=WAL")
        _local.conn.execute("PRAGMA foreign_keys=ON")
    return _local.conn

class QueryBuilder:
    def __init__(self, table, conn):
        self.table = table
        self.conn = conn
        self._where = []
        self._params = []
        self._order = ""
        self._limit = 0
        self._offset = 0
        self._select_cols = "*"

    def select(self, cols="*"):
        self._select_cols = cols
        return self

    def eq(self, col, val):
        self._where.append(f'"{col}" = ?')
        self._params.append(val)
        return self

    def neq(self, col, val):
        self._where.append(f'"{col}" != ?')
        self._params.append(val)
        return self

    def like(self, col, pattern):
        self._where.append(f'"{col}" LIKE ?')
        self._params.append(pattern.replace("%", "%"))
        return self

    def in_(self, col, vals):
        if not vals:
            self._where.append("1=0")
            return self
        placeholders = ",".join(["?"] * len(vals))
        self._where.append(f'"{col}" IN ({placeholders})')
        self._params.extend(vals)
        return self

    def gte(self, col, val):
        self._where.append(f'"{col}" >= ?')
        self._params.append(val)
        return self

    def lte(self, col, val):
        self._where.append(f'"{col}" <= ?')
        self._params.append(val)
        return self

    def order(self, col, desc=False):
        self._order = f'ORDER BY "{col}" {"DESC" if desc else "ASC"}'
        return self

    def limit(self, n):
        self._limit = n
        return self

    def offset(self, n):
        self._offset = n
        return self

    def _build_where(self):
        return " AND ".join(self._where) if self._where else "1=1"

    def execute(self):
        cursor = self.conn.execute
        if self._select_cols.startswith("count"):
            sql = f'SELECT {self._select_cols} FROM "{self.table}" WHERE {self._build_where()}'
            cur = cursor(sql, self._params)
            row = cur.fetchone()
            return ExecuteResult([], count=row[0] if row else 0)
        sql = f'SELECT {self._select_cols} FROM "{self.table}" WHERE {self._build_where()}'
        if self._order: sql += " " + self._order
        if self._limit: sql += f" LIMIT {self._limit}"
        if self._offset: sql += f" OFFSET {self._offset}"
        cur = cursor(sql, self._params)
        rows = [dict(r) for r in cur.fetchall()]
        return ExecuteResult(rows)

class ExecuteResult:
    def __init__(self, data, count=None):
        self.data = data
        self.count = count

class InsertBuilder:
    def __init__(self, table, conn):
        self.table = table
        self.conn = conn

    def execute(self):
        now = datetime.utcnow().isoformat()
        sql = f'INSERT INTO "{self.table}" ({self._cols}) VALUES ({self._vals})'
        cur = self.conn.execute(sql, self._params)
        self.conn.commit()
        return ExecuteResult([{"id": cur.lastrowid}])

class UpdateBuilder:
    def __init__(self, table, conn, data):
        self.table = table
        self.conn = conn
        self.data = data
        self._where = []
        self._params = []

    def eq(self, col, val):
        self._where.append(f'"{col}" = ?')
        self._params.append(val)
        return self

    def execute(self):
        if not self._where:
            raise Exception("UPDATE without WHERE is not allowed")
        sets = ", ".join(f'"{k}" = ?' for k in self.data)
        vals = list(self.data.values()) + self._params
        sql = f'UPDATE "{self.table}" SET {sets} WHERE {" AND ".join(self._where)}'
        self.conn.execute(sql, vals)
        self.conn.commit()
        return ExecuteResult([])

class DeleteBuilder:
    def __init__(self, table, conn):
        self.table = table
        self.conn = conn
        self._where = []
        self._params = []

    def eq(self, col, val):
        self._where.append(f'"{col}" = ?')
        self._params.append(val)
        return self

    def execute(self):
        sql = f'DELETE FROM "{self.table}" WHERE {" AND ".join(self._where)}'
        self.conn.execute(sql, self._params)
        self.conn.commit()
        return ExecuteResult([])

class TableRef:
    def __init__(self, table, conn):
        self.table = table
        self.conn = conn

    def select(self, cols="*"):
        return QueryBuilder(self.table, self.conn).select(cols)

    def insert(self, rows):
        if not rows: raise Exception("insert requires at least one row")
        if isinstance(rows, dict): rows = [rows]
        builder = InsertBuilder(self.table, self.conn)
        cols = list(rows[0].keys())
        builder._cols = ", ".join(f'"{c}"' for c in cols)
        all_vals = []
        all_params = []
        for row in rows:
            placeholders = ", ".join(["?"] * len(cols))
            all_vals.append(placeholders)
            all_params.extend([row.get(c) for c in cols])
        builder._vals = "), (".join(all_vals)
        builder._params = all_params
        builder._multi = len(rows)
        return builder

    def update(self, data):
        return UpdateBuilder(self.table, self.conn, data)

    def delete(self):
        return DeleteBuilder(self.table, self.conn)

class SQLiteDB:
    def __init__(self, path=None):
        global DB_PATH
        if path:
            DB_PATH = path

    def table(self, name):
        conn = get_conn()
        return TableRef(name, conn)

    def close(self):
        if hasattr(_local, "conn") and _local.conn:
            _local.conn.close()
            _local.conn = None

db = SQLiteDB()

def get_db():
    return db

def init_db(path=None):
    """初始化数据库表结构"""
    conn = sqlite3.connect(path or DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_no TEXT UNIQUE NOT NULL,
            store TEXT DEFAULT '',
            warehouse TEXT DEFAULT '',
            sku TEXT DEFAULT '',
            product_name TEXT DEFAULT '',
            quantity INTEGER DEFAULT 0,
            unit_price REAL DEFAULT 0,
            total_amount REAL DEFAULT 0,
            order_status TEXT DEFAULT '',
            ordered_at TEXT DEFAULT '',
            platform TEXT DEFAULT '',
            supplier TEXT DEFAULT '',
            remark TEXT DEFAULT '',
            parent_order_no TEXT DEFAULT '',
            raw_data TEXT DEFAULT '',
            source TEXT DEFAULT '',
            owner_id TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sku TEXT NOT NULL,
            product_name TEXT DEFAULT '',
            store TEXT DEFAULT '',
            warehouse TEXT DEFAULT '',
            available_qty INTEGER DEFAULT 0,
            locked_qty INTEGER DEFAULT 0,
            in_transit_qty INTEGER DEFAULT 0,
            safety_qty INTEGER DEFAULT 0,
            raw_data TEXT DEFAULT '',
            source TEXT DEFAULT '',
            owner_id TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sku TEXT UNIQUE NOT NULL,
            product_name TEXT DEFAULT '',
            store TEXT DEFAULT '',
            category TEXT DEFAULT '',
            price REAL DEFAULT 0,
            status TEXT DEFAULT 'active',
            owner_id TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS suppliers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            supplier_code TEXT UNIQUE NOT NULL,
            supplier_name TEXT DEFAULT '',
            contact_person TEXT DEFAULT '',
            contact_phone TEXT DEFAULT '',
            score INTEGER DEFAULT 0,
            status TEXT DEFAULT 'active',
            owner_id TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alert_type TEXT DEFAULT '',
            title TEXT DEFAULT '',
            description TEXT DEFAULT '',
            severity TEXT DEFAULT 'info',
            status TEXT DEFAULT 'active',
            source TEXT DEFAULT '',
            related_sku TEXT DEFAULT '',
            related_order_no TEXT DEFAULT '',
            owner_id TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS quality_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            log_type TEXT DEFAULT '',
            level TEXT DEFAULT '',
            message TEXT DEFAULT '',
            details TEXT DEFAULT '',
            source TEXT DEFAULT '',
            entity_type TEXT DEFAULT '',
            entity_id TEXT DEFAULT '',
            field_name TEXT DEFAULT '',
            owner_id TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            entity_type TEXT DEFAULT '',
            entity_id TEXT DEFAULT '',
            title TEXT DEFAULT '',
            payload TEXT DEFAULT '{}',
            owner_id TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS sync_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_type TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            params TEXT DEFAULT '{}',
            result TEXT DEFAULT '',
            owner_id TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS cleansing_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            doc_type TEXT DEFAULT 'order',
            mapping TEXT DEFAULT '{}',
            owner_id TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS custom_fields (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            target TEXT NOT NULL,
            key TEXT NOT NULL,
            label TEXT DEFAULT '',
            type TEXT DEFAULT 'string',
            owner_id TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_orders_order_no ON orders(order_no);
        CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory(sku);
        CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
        CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
        CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
        CREATE INDEX IF NOT EXISTS idx_quality_logs_level ON quality_logs(level);
    """)
    conn.commit()
    conn.close()
