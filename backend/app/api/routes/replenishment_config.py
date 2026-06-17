
from fastapi import APIRouter
from app.core.database import get_db
from datetime import datetime, timedelta
from collections import defaultdict

router = APIRouter(prefix="/api/replenishment-config", tags=["replenishment"])

@router.get("")
def get_config(db=get_db()):
    rows = db.table("replenishment_config").select("*").execute().data
    return {r['key']: r['value'] for r in rows}

@router.put("")
def update_config(data: dict, db=get_db()):
    for k, v in data.items():
        db.table("replenishment_config").update({"value": str(v)}).eq("key", k).execute()
    return get_config(db)


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
    from app.core.database import get_conn
    conn = get_conn()
    conn.execute("INSERT OR REPLACE INTO replenishment_config (key,value,updated_at) VALUES (?,?,datetime('now'))",
                 [key, val])
    conn.commit()
    return items
@router.get('/calculate')
def calculate(db=get_db()):
    rows = db.table("replenishment_config").select("*").execute().data
    cfg = {r['key']: r['value'] for r in rows}
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
