from fastapi import APIRouter, Depends
from app.core.database import get_db
from app.core.response import ok, fail
import time

router = APIRouter(prefix="/api/alerts", tags=["alerts"])
_alerts_cache = {}
_ALERTS_TTL = 300


@router.get("")
def list_alerts(channel: str = 'jd', status: str = 'active', limit: int = 200, db = get_db()):
    # 300s 缓存 + 双版本号校验:
    # _rules_version(规则启用/停用变更) + _replen_version(库存/订单/清洗/配置变更)
    # 规则操作递增 _rules_version, 库存/订单递增 _replen_version —— 缺一 alerts 缓存不失效
    try:
        _r1 = db.table("replenishment_config").select("*").eq("key", "_rules_version").execute().data
        _r2 = db.table("replenishment_config").select("*").eq("key", "_replen_version").execute().data
        _ver = f"{_r1[0]['value'] if _r1 else 0}|{_r2[0]['value'] if _r2 else 0}"
    except Exception:
        _ver = "0|0"
    _key = f"alerts_{channel}_{status}"
    _cached = _alerts_cache.get(_key)
    if _cached and _cached.get('ver') == _ver and time.time() - _cached.get('ts', 0) < _ALERTS_TTL:
        return _cached['data']
    q = db.table("alerts").select("*").eq("channel", channel).eq("status", status)
    data = q.order("id", desc=True).limit(limit).execute().data
    try:
        _alerts_cache[_key] = {'data': ok(data), 'ts': time.time(), 'ver': _ver}
    except Exception:
        pass
    return ok(data)
