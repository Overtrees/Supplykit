"""补货建议缓存 — 持久化到数据库，避免每次全量计算"""
from datetime import datetime, timedelta
import json, hashlib

CACHE_TTL = 300  # 5 分钟

def get_cache_key(mode, channel, days, db):
    """生成缓存 key：基于数据版本号和参数"""
    # 计算数据版本号（订单数+库存数+产品数+配置版本）
    ver = db.table("replenishment_config").select("*").eq("key", "_cache_version").execute().data
    db_ver = ver[0]["value"] if ver else "0"
    order_count = len(db.table("orders").select("id").execute().data or [])
    inv_count = len(db.table("inventory").select("id").execute().data or [])
    raw = f"{mode}|{channel}|{days}|{db_ver}|{order_count}|{inv_count}"
    return hashlib.md5(raw.encode()).hexdigest()


def get_cached(mode, channel, days, db):
    """读取缓存，返回 (data, hit)"""
    key = get_cache_key(mode, channel, days, db)
    rows = db.table("replenishment_config").select("*").eq("key", f"_cache_replen_{key}").execute().data
    if not rows:
        return None, False
    row = rows[0]
    try:
        cached = json.loads(row["value"])
        cached_time = datetime.fromisoformat(row.get("updated_at", "")) if row.get("updated_at") else datetime.min
        if (datetime.utcnow() - cached_time).total_seconds() < CACHE_TTL:
            return cached.get("data"), True
    except:
        pass
    return None, False


def set_cache(mode, channel, days, data, db):
    """写入缓存"""
    key = get_cache_key(mode, channel, days, db)
    value = json.dumps({"data": data, "ts": datetime.utcnow().isoformat()})
    # UPSERT
    existing = db.table("replenishment_config").select("id").eq("key", f"_cache_replen_{key}").execute().data
    payload = {"key": f"_cache_replen_{key}", "value": value, "channel": channel, "updated_at": datetime.utcnow().isoformat()}
    if existing:
        db.table("replenishment_config").update(payload).eq("id", existing[0]["id"]).execute()
    else:
        db.table("replenishment_config").insert(payload).execute()


def invalidate_cache(db):
    """使缓存失效 — 递增版本号"""
    ver = db.table("replenishment_config").select("*").eq("key", "_cache_version").execute().data
    new_ver = str(int(ver[0]["value"]) + 1) if ver else "1"
    if ver:
        db.table("replenishment_config").update({"value": new_ver}).eq("key", "_cache_version").execute()
    else:
        db.table("replenishment_config").insert({"key": "_cache_version", "value": new_ver, "channel": "jd"}).execute()