
from fastapi import APIRouter
from app.core.database import get_db
from app.core.response import ok, fail
from datetime import datetime, timedelta
from collections import defaultdict

router = APIRouter(prefix="/api/replenishment-config", tags=["replenishment"])

@router.get("")
def get_config(mode: str = None, channel: str = 'jd', db=get_db()):
    rows = db.table("replenishment_config").select("*").eq("channel", channel).execute().data
    all_config = {r['key']: r['value'] for r in rows}
    if mode:
        prefix = f'mode_{mode}_'
        return ok({k[len(prefix):]: v for k, v in all_config.items() if k.startswith(prefix)})
    return ok(all_config)

@router.put("")
def update_config(data: dict, mode: str = '', channel: str = 'jd', db=get_db()):
    now = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    if mode:
        prefix = f'mode_{mode}_'
        for k, v in data.items():
            full_key = prefix + k
            existing = db.table("replenishment_config").select('value').eq('key', full_key).eq('channel', channel).execute().data
            old_val = existing[0]['value'] if existing else ''
            if str(old_val) != str(v):
                db.table("replenishment_config_history").insert({
                    'key': full_key, 'old_value': str(old_val), 'new_value': str(v),
                    'channel': channel, 'mode': mode, 'created_at': now
                })
            db.table("replenishment_config").upsert({"key": full_key, "value": str(v), "channel": channel, "updated_at": now}, conflict_col='key')
    else:
        for k, v in data.items():
            existing = db.table("replenishment_config").select('value').eq('key', k).eq('channel', channel).execute().data
            old_val = existing[0]['value'] if existing else ''
            if str(old_val) != str(v):
                db.table("replenishment_config_history").insert({
                    'key': k, 'old_value': str(old_val), 'new_value': str(v),
                    'channel': channel, 'mode': '', 'created_at': now
                })
            db.table("replenishment_config").upsert({"key": k, "value": str(v), "channel": channel, "updated_at": now}, conflict_col='key')
    return ok({'mode': mode, 'channel': channel})


@router.get('/history')
def get_config_history(channel: str = 'jd', mode: str = '', limit: int = 50, db=get_db()):
    query = db.table("replenishment_config_history").select('*').eq('channel', channel).order('created_at', desc=True).limit(limit)
    if mode:
        query = query.eq('mode', mode)
    return ok(query.execute().data)


@router.get('/seasons')
def get_seasons(mode: str = 'bbcc', channel: str = 'jd', db=get_db()):
    import json
    key = f'season_config_{mode}'
    val = db.table('replenishment_config').select('*').eq('key', key).eq('channel', channel).execute().data
    if val and val[0].get('value'):
        return json.loads(val[0]['value'])
    return [
        {'key':'618','name':'618','factor':1.5,'enabled':False},
        {'key':'1111','name':'双11','factor':1.8,'enabled':False},
        {'key':'cny','name':'年货节','factor':1.6,'enabled':False},
    ]

@router.put('/seasons')
def update_seasons(data: dict, mode: str = 'bbcc', channel: str = 'jd', db=get_db()):
    import json
    items = data.get('items', data.get('seasons', []))
    val = json.dumps(list(items), ensure_ascii=False)
    key = f'season_config_{mode}'
    existing = db.table("replenishment_config").select('value').eq('key', key).eq('channel', channel).execute().data
    old_val = existing[0]['value'] if existing else ''
    if old_val != val:
        db.table("replenishment_config_history").insert({
            'key': key, 'old_value': old_val, 'new_value': val,
            'channel': channel, 'mode': mode, 'created_at': datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
        })
    db.table("replenishment_config").upsert({"key": key, "value": val, "channel": channel, "updated_at": datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}, conflict_col='key')
    return ok(items)
@router.get('/calculate')
def calculate(mode: str = 'bbcc', db=get_db()):
    prefix = f'mode_{mode}_'
    rows = db.table("replenishment_config").select("*").execute().data
    raw = {r['key']: r['value'] for r in rows}
    cfg = {}
    for k, v in raw.items():
        if k.startswith(prefix):
            cfg[k[len(prefix):]] = v
    lt = int(cfg.get('lead_time_days','10'))
    sm = float(cfg.get('safety_multiplier','1.0'))
    cutoff = (datetime.utcnow()-timedelta(days=30)).strftime('%Y-%m-%d')
    sku_s = defaultdict(int)
    for o in db.table("orders").select("*").execute().data:
        s = o.get('sku','')
        if s and str(o.get('ordered_at',''))[:10] >= cutoff:
            sku_s[s] += int(o.get('quantity',0) or 0)
    invs = db.table("inventory").select("*").execute().data
    sku_i = defaultdict(lambda: {'a':0,'t':0,'sf':0})
    for inv in invs:
        s = inv.get('sku','')
        if not s: continue
        sku_i[s]['a'] += int(inv.get('available_qty',0) or 0)
        sku_i[s]['t'] += int(inv.get('in_transit_qty',0) or 0)
        sku_i[s]['sf'] = max(sku_i[s]['sf'], int(inv.get('safety_qty',0) or 0))
    res = []
    for s,v in sku_i.items():
        d = round(sku_s.get(s,0)/30,1)
        sf = round(v['sf']*sm) if v['sf']>0 else round(d*(lt+2))
        sug = max(round(d*lt+sf-v['a']-v['t']),0)
        tot = v['a']+v['t']+sug
        td = round(tot/d,1) if d>0 else 999
        res.append({'sku':s,'daily':d,'stock':v['a'],'transit':v['t'],'safety':sf,'suggested':sug,'after':tot,'turnover':td})
    return ok({'config': cfg, 'items': sorted(res, key=lambda x: x['turnover'])})
