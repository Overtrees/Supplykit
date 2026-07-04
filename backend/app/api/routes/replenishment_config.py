
from fastapi import APIRouter
from app.core.database import get_db
from datetime import datetime, timedelta
from collections import defaultdict

router = APIRouter(prefix="/api/replenishment-config", tags=["replenishment"])

@router.get("")
def get_config(mode: str = None, db=get_db()):
    rows = db.table("replenishment_config").select("*").execute().data
    all_config = {r['key']: r['value'] for r in rows}
    if mode:
        prefix = f'mode_{mode}_'
        return {k[len(prefix):]: v for k, v in all_config.items() if k.startswith(prefix)}
    return all_config

@router.put("")
def update_config(data: dict, mode: str = '', db=get_db()):
    if mode:
        prefix = f'mode_{mode}_'
        for k, v in data.items():
            db.table("replenishment_config").upsert({"key": prefix + k, "value": str(v), "updated_at": datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}, conflict_col='key')
    else:
        for k, v in data.items():
            db.table("replenishment_config").upsert({"key": k, "value": str(v), "updated_at": datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}, conflict_col='key')
    return {'ok': True, 'mode': mode}


@router.get('/seasons')
def get_seasons(mode: str = 'bbcc', db=get_db()):
    import json
    key = f'season_config_{mode}'
    val = db.table('replenishment_config').select('*').eq('key', key).execute().data
    if val and val[0].get('value'):
        return json.loads(val[0]['value'])
    return [
        {'key':'618','name':'618','factor':1.5,'enabled':True},
        {'key':'1111','name':'双11','factor':1.8,'enabled':True},
        {'key':'cny','name':'年货节','factor':1.6,'enabled':True},
    ]

@router.put('/seasons')
def update_seasons(data: dict, mode: str = 'bbcc', db=get_db()):
    import json
    items = data.get('items', data.get('seasons', []))
    val = json.dumps(list(items), ensure_ascii=False)
    key = f'season_config_{mode}'
    db.table("replenishment_config").upsert({"key": key, "value": val, "updated_at": datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}, conflict_col='key')
    return items
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
    return {'config':cfg,'items':sorted(res,key=lambda x:x['turnover'])}
