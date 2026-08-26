from fastapi import APIRouter, Depends
from app.core.database import get_db
from app.core.response import ok, fail
import time

router = APIRouter(prefix="/api/alerts", tags=["alerts"])
_alerts_cache = {}
_ALERTS_TTL = 300


@router.get("")
def list_alerts(channel: str = 'jd', status: str = 'active', limit: int = 200, db = get_db()):
    # 300s 缓存 + _replen_version 校验（规则/库存/订单变更即时失效）
    try:
        _v = db.table("replenishment_config").select("*").eq("key", "_replen_version").execute().data
        _ver = int(_v[0]["value"]) if _v and _v[0].get("value") else 0
    except Exception:
        _ver = 0
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
