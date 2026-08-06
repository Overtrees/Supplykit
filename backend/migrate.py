"""数据库迁移工具 — 手动管理表结构变更

用法：
  python migrate.py check          # 检查当前版本
  python migrate.py create "描述"  # 创建新的迁移文件
  python migrate.py apply          # 应用所有未执行的迁移
  python migrate.py list           # 列出所有迁移

迁移文件存放在 backend/migrations/ 目录下，按时间戳命名。
"""
import os, sys, json, sqlite3, time
from datetime import datetime

MIGRATIONS_DIR = os.path.join(os.path.dirname(__file__), "migrations")
DB_PATH = os.getenv("SQLITE_PATH", os.path.join(os.path.dirname(__file__), "app", "supplykit.db"))


def get_current_version():
    """获取当前数据库版本"""
    conn = sqlite3.connect(DB_PATH)
    try:
        cur = conn.execute("SELECT version FROM _migrations ORDER BY applied_at DESC LIMIT 1")
        row = cur.fetchone()
        return row[0] if row else None
    except:
        return None
    finally:
        conn.close()


def ensure_migrations_table():
    """确保 _migrations 表存在"""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS _migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            version TEXT NOT NULL UNIQUE,
            description TEXT NOT NULL,
            applied_at TEXT NOT NULL DEFAULT (datetime('now')),
            checksum TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()


def create_migration(description):
    """创建新的迁移文件"""
    os.makedirs(MIGRATIONS_DIR, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    version = f"v{timestamp}"
    filename = f"{version}_{description.replace(' ', '_')}.sql"
    filepath = os.path.join(MIGRATIONS_DIR, filename)
    
    content = f"""-- Migration: {description}
-- Created: {datetime.utcnow().isoformat()}
-- Version: {version}

-- UP: 应用迁移
-- 在此处写 SQL 变更语句

-- DOWN: 回滚迁移
-- 在此处写回滚 SQL 语句
"""
    with open(filepath, "w") as f:
        f.write(content)
    print(f"✅ 迁移文件已创建: {filename}")
    return version


def apply_migrations():
    """应用所有未执行的迁移"""
    os.makedirs(MIGRATIONS_DIR, exist_ok=True)
    ensure_migrations_table()
    current = get_current_version()
    conn = sqlite3.connect(DB_PATH)
    
    # 获取所有迁移文件
    files = sorted([f for f in os.listdir(MIGRATIONS_DIR) if f.endswith(".sql")])
    applied = 0
    
    for filename in files:
        # 提取版本号
        version = filename.split("_", 1)[0]
        if current and version <= current:
            continue
        
        filepath = os.path.join(MIGRATIONS_DIR, filename)
        with open(filepath) as f:
            content = f.read()
        
        # 提取 UP 部分
        up_start = content.find("-- UP:")
        down_start = content.find("-- DOWN:")
        if up_start < 0:
            continue
        sql = content[up_start:down_start] if down_start > 0 else content[up_start:]
        # 去掉注释行
        sql_lines = [l for l in sql.split("\n") if not l.strip().startswith("--")]
        sql = "\n".join(sql_lines).strip()
        
        if not sql:
            print(f"⏭️ 跳过 {filename}: 无 SQL 语句")
            continue
        
        try:
            conn.executescript(sql)
            import hashlib
            checksum = hashlib.md5(content.encode()).hexdigest()
            conn.execute(
                "INSERT INTO _migrations (version, description, checksum) VALUES (?, ?, ?)",
                (version, filename, checksum)
            )
            conn.commit()
            print(f"✅ 已应用: {filename}")
            applied += 1
        except Exception as e:
            conn.rollback()
            print(f"❌ 迁移失败: {filename}")
            print(f"   错误: {e}")
            conn.close()
            return False
    
    conn.close()
    if applied == 0:
        print("✅ 所有迁移已是最新")
    return True


def list_migrations():
    """列出所有迁移"""
    os.makedirs(MIGRATIONS_DIR, exist_ok=True)
    ensure_migrations_table()
    conn = sqlite3.connect(DB_PATH)
    applied = {}
    try:
        rows = conn.execute("SELECT version, description, applied_at FROM _migrations ORDER BY version").fetchall()
        for r in rows:
            applied[r[0]] = r[2]
    except:
        pass
    conn.close()
    
    files = sorted([f for f in os.listdir(MIGRATIONS_DIR) if f.endswith(".sql")])
    print(f"{'状态':>6} {'版本':<20} {'描述':<40}")
    print("-" * 70)
    for f in files:
        version = f.split("_", 1)[0]
        desc = f[len(version)+1:].replace(".sql", "")
        status = "✅" if version in applied else "⏳"
        print(f"{status:>6} {version:<20} {desc:<40}")
    print(f"\n当前版本: {get_current_version() or '无'}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python migrate.py [check|create|apply|list]")
        sys.exit(1)
    
    cmd = sys.argv[1]
    if cmd == "check":
        v = get_current_version()
        print(f"当前数据库版本: {v or '无'}")
    elif cmd == "create":
        desc = " ".join(sys.argv[2:]) if len(sys.argv) > 2 else "unnamed"
        create_migration(desc)
    elif cmd == "apply":
        apply_migrations()
    elif cmd == "list":
        list_migrations()
    else:
        print(f"未知命令: {cmd}")