import React, { useState, useEffect } from 'react'
import { api, clearCache, clearInflight } from '../api/client'
import { useToast } from '../components/Toast'
import { useAppStore } from '../store/useAppStore'
import { IconPackage, IconTag, IconFactory, IconClipboard, IconScale, IconSave, IconLoading, IconAlert } from '../components/Icons'

const API = import.meta.env.VITE_API_BASE_URL || 'https://overtrees.pythonanywhere.com'
const EVENTS = [
  {value:'inventory.changed',label:'库存变动'},
  {value:'order.created',label:'订单创建'},
  {value:'scheduled.daily',label:'每日定时'},
]

const VARS = {product_name:'商品名',sku:'SKU',avail:'可用量',safety:'安全线',days:'天数',stock:'库存量',order_qty:'订单数',store:'店铺',warehouse:'仓库'}
const renderTmpl = (text) => {
  if (!text) return null
  const parts = text.split(/(\{(\w+)\})/g)
  return parts.map((p,i) => {
    if (i%3===1) return <span key={i} style={{display:'inline-block',background:'rgba(29,78,216,0.1)',color:'var(--primary)',padding:'0 4px',borderRadius:4,fontWeight:600,fontSize:10}}>{VARS[parts[i+1]]||parts[i+1]}</span>
    if (i%3===2) return null
    return <span key={i}>{p}</span>
  })
}
const IS = {width:'100%',padding:'8px 12px',fontSize:16,border:'1px solid var(--border)',borderRadius:32,marginTop:4,outline:'none',background:'var(--card)',boxSizing:'border-box'}

const LF = [
  {l:'可用库存',v:'inv.available_qty'},{l:'安全库存',v:'inv.safety_qty'},{l:'在途库存',v:'inv.in_transit_qty'},
  {l:'距上次销售(天)',v:'inv.days_since_last'},{l:'库存量',v:'inv.stock'},{l:'仓库类型',v:'inv.warehouse_type'},
  {l:'订单数量',v:'order.quantity'},{l:'订单金额',v:'order.total_amount'},{l:'单价',v:'order.unit_price'}]
const OPS = [{l:'小于',v:'<'},{l:'小于等于',v:'<='},{l:'大于',v:'>'},{l:'大于等于',v:'>='},{l:'等于',v:'=='},{l:'不等于',v:'!='}]
const WHS = [{l:'全部',v:''},{l:'B仓',v:'platform_b'},{l:'C仓',v:'platform'},{l:'自有仓',v:'own'}]
const MODES = [{l:'全部',v:''},{l:'BBCC',v:'bbcc'},{l:'传统多仓',v:'traditional'}]
const fieldLbl = v => {const f=LF.find(x=>x.v===v);return f?f.l:v}
const opLbl = v => {const o=OPS.find(x=>x.v===v);return o?o.l:v}
const sevCls = s => s==='error'?'danger':s==='info'?'info':'warning'
const sevLbl = s => s==='error'?'严重':s==='info'?'提示':'警告'

const pc = j => {
  try {
    const c = JSON.parse(j); let rt = c.rightType||'field'; let r = c.right||'inv.safety_qty'; let pct = 100; let wh = c.warehouse||''
    const m = typeof r==='string'?r.match(/^max\(1,\s*(\w+(?:\.\w+)*)\s*\*\s*([\d.]+)\)$/):null
    if (m) { r=m[1]; rt='pct'; pct=Math.round(parseFloat(m[2])*100) }
    if (!rt||rt==='field') { const f=LF.find(x=>x.v===r); if(!f&&typeof r==='string'&&!r.replace('.','').match(/^\d+$/))rt='text'; else if(!f)rt='number' }
    return {left:c.left||'inv.available_qty', op:c.op||'<', right:r, rightType:rt, pctValue:pct, warehouse:wh}
  } catch { return {left:'inv.available_qty', op:'<', right:'inv.safety_qty', rightType:'field', pctValue:100, warehouse:''} }
}

export default function RulesPage() {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [seasonsSaving, setSeasonsSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [rules, setRules] = useState([])
  const [editing, setEditing] = useState(null)
  const [cfg, setCfg] = useState({})
  const [seasons, setSeasons] = useState([])

  const defaultF = {name:'', event:'inventory.changed', alert_type:'low_stock', alert_title:'', alert_desc:'', severity:'warning', condition_json:'{}'}
  const [f, setF] = useState(defaultF)
  const [cond, setCond] = useState({left:'inv.available_qty', op:'<', right:'inv.safety_qty', rightType:'field', pctValue:100, warehouse:''})
  const { channel: globalChannel, setChannel: setGlobalChannel, hammerRulesTab: tab, hammerRuleNewVersion, hammerRulesMode } = useAppStore()

  const load = async (ch) => { try { const c=ch||globalChannel; const r = await api.get('/api/rules?channel='+c); setRules(r.data||[]) } catch(e) {} }
  const loadCfg = async (mode, ch) => { try { clearCache(); clearInflight(); const m=mode||cfg.replenishment_mode||'bbcc'; const c=ch||globalChannel; const r=await api.get('/api/replenishment-config?mode='+m+'&channel='+c);if(r.data&&Object.keys(r.data).length>0)setCfg(p=>({...p, ...r.data, replenishment_mode:m}));else if(c!=='jd'){const fallback=await api.get('/api/replenishment-config?mode='+m+'&channel=jd');if(fallback.data)setCfg(p=>({...p,...fallback.data,replenishment_mode:m}))}setCfg(p => ({...p, replenishment_mode: m}));return r.data||{} } catch(e) { return {} } }
  const loadSeasons = async (mode, ch) => { try { clearCache(); clearInflight(); const m=mode||cfg.replenishment_mode||'bbcc'; const c=ch||globalChannel; const r=await api.get('/api/replenishment-config/seasons?mode='+m+'&channel='+c); setSeasons(r.data||[]) } catch(e) {} }
  const loadAll = async (ch) => { setLoading(true); const c=ch||globalChannel; const savedMode=localStorage.getItem('c_replen_mode_'+c); const m=c!=='jd'?'traditional':(savedMode||'bbcc'); await load(c); try{const flat=await api.get('/api/replenishment-config?channel='+c);if(flat.data)setCfg(p=>({...p,...flat.data,replenishment_mode:m}))}catch(e){} await loadCfg(m,c); await loadSeasons(m,c); setLoading(false) }
  useEffect(() => { loadAll() }, [globalChannel])
  // tab/模式切换时加载配置，补货参数页加骨架过渡
  useEffect(() => {
    if (tab === 'params') {
      setLoading(true)
      Promise.all([loadCfg(hammerRulesMode), loadSeasons(hammerRulesMode)])
        .catch(() => {})
        .finally(() => setLoading(false))
    } else if (tab === 'purchase') {
      loadCfg(hammerRulesMode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, hammerRulesMode])
  // 锤子菜单"新建规则"触发
  useEffect(() => {
    if (hammerRuleNewVersion > 0) resetForm()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hammerRuleNewVersion])

  const resetForm = () => { setEditing({}); setF(defaultF); setCond({left:'inv.available_qty', op:'<', right:'inv.safety_qty', rightType:'field', pctValue:100, warehouse:''}) }
  const cancelEdit = () => { setEditing(null); setF(defaultF); setCond({left:'inv.available_qty', op:'<', right:'inv.safety_qty', rightType:'field', pctValue:100, warehouse:''}) }

  const save = async () => {
    let rv = cond.right
    if (cond.rightType === 'number') rv = parseFloat(cond.right) || 0
    else if (cond.rightType === 'field') rv = cond.right
    else if (cond.rightType === 'pct') rv = `max(1,${cond.right}*${(cond.pctValue||100)/100})`
    const cj = JSON.stringify({left:cond.left, op:cond.op, right:rv, rightType:cond.rightType, warehouse:cond.warehouse})
    const isNew = !editing || !editing.id
    const url = isNew ? API+'/api/rules' : API+'/api/rules/'+editing.id
    await fetch(url, {method: isNew?'POST':'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...f, mode: f.mode||'', channel:globalChannel, condition_json:cj})})
    cancelEdit(); load(globalChannel)
  }
  const del = async id => { await fetch(API+'/api/rules/'+id, {method:'DELETE'}); load(globalChannel) }

  const isBBCC = (cfg.replenishment_mode||'bbcc')==='bbcc'
  const cParams = isBBCC ? [{k:'b_to_c_days',l:'B→C调拨(天)',h:'京东B仓→C仓调拨时效'},{k:'c_safety_days',l:'C仓缓冲(天)',h:'C仓安全储备'}] : []
  const bParams = isBBCC ? [{k:'ship_to_b_days',l:'自有仓→B仓时效(天)'},{k:'safety_multiplier',l:'安全库存天数'},{k:'turnover_warning_15',l:'仓储费阈值(天)'},{k:'turnover_warning_90',l:'周转考核红线(天)'}] : []
  const paramFields = isBBCC ? [] : [{k:'lead_time_days',l:'前置期(天)'},{k:'safety_multiplier',l:'安全库存天数'},{k:'turnover_warning_90',l:'周转考核红线(天)'}]
  const purchaseFields = [{k:'purchase_lead_days',l:'采购前置(天)'},{k:'purchase_safety_days',l:'采购安全库存(天)'},{k:'moq',l:'MOQ最小起订(件)'},{k:'max_turnover_days',l:'目标周转(天)'}]

  if (loading) return <div className='card'><div className='section-title'><div className="skeleton" style={{width:120,height:20}}/></div><div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>{[1,2,3,4,5,6].map(i=><div key={i}><div className="skeleton" style={{width:64,height:12,marginBottom:6}}/><div className="skeleton" style={{width:'100%',height:36}}/></div>)}</div><div style={{marginTop:16}}><div className="skeleton" style={{width:80,height:36,borderRadius:99}}/></div></div>

  return <div className='card'>
    <div className='section-title' style={{display:'flex',flexWrap:'wrap',gap:6}}>
    </div>

    {/* ── 规则列表 ── */}
    {tab==='rules' && <>
      {editing !== null && <div style={{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:32,padding:16,marginBottom:16}}>
        <div style={{fontWeight:600,marginBottom:12}}>{editing.id?'编辑规则':'新建规则'}</div>

        {/* 名称 + 级别 + 补货模式 */}
        <div style={{display:'flex',gap:12,alignItems:'flex-end',marginBottom:14,flexWrap:'wrap'}}>
          <label style={{flex:1,minWidth:140,fontSize:12}}>规则名称<input value={f.name} onChange={e=>setF({...f,name:e.target.value})} style={IS} placeholder='例：低库存预警'/></label>
          <label style={{fontSize:12}}>级别
            <div style={{display:'flex',gap:4,marginTop:4}}>
              {[{v:'warning',l:'⚠️',t:'警告',c:'var(--warning)'},{v:'error',l:'🔴',t:'紧急',c:'var(--danger)'},{v:'info',l:'💡',t:'提示',c:'var(--primary)'}].map(({v,l,t,c}) =>
                <span key={v} onClick={()=>setF({...f,severity:v})} className="clickable" style={{padding:'5px 12px',borderRadius:32,fontSize:13,fontWeight:600,cursor:'pointer',background:f.severity===v?c:'transparent',color:f.severity===v?'#fff':'var(--muted)',border:'1px solid',borderColor:f.severity===v?c:'var(--border)',display:'flex',alignItems:'center',gap:3}}>{l}{t}</span>
              )}
            </div>
          </label>
          <label style={{fontSize:12}}>补货模式
            <select value={f.mode||''} onChange={e=>setF({...f,mode:e.target.value})} style={{...IS,fontSize:13,marginTop:4,width:100}}>{MODES.map(m=><option key={m.v} value={m.v}>{m.l}</option>)}</select>
          </label>
        </div>

        {/* 触发条件 — 一句话 */}
        <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:32,padding:14,marginBottom:14}}>
          <div style={{fontWeight:600,fontSize:13,marginBottom:10,display:'flex',alignItems:'center',gap:4}}><IconScale size={14} /> 触发条件</div>
          <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
            <span style={{fontSize:14,fontWeight:500}}>当</span>
            <select value={cond.warehouse} onChange={e=>setCond(p=>({...p,warehouse:e.target.value}))} style={{...IS,flex:1,minWidth:60,fontSize:13}}>{WHS.map(w=><option key={w.v} value={w.v}>{w.l}</option>)}</select>
            <select value={cond.left} onChange={e=>setCond(p=>({...p,left:e.target.value}))} style={{...IS,flex:2,minWidth:120,fontSize:14}}>{LF.map(f=><option key={f.v} value={f.v}>{f.l}</option>)}</select>
            <select value={cond.op} onChange={e=>setCond(p=>({...p,op:e.target.value}))} style={{...IS,width:70,fontSize:14,textAlign:'center'}}>{OPS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select>
            <span style={{display:'flex',alignItems:'center',gap:4,flex:2,minWidth:100}}>
              <input type='number' value={cond.pctValue||0} onChange={e=>setCond(p=>({...p,pctValue:parseInt(e.target.value)||0,rightType:'pct',right:'inv.safety_qty'}))} min={1} max={200} style={{...IS,width:'auto',flex:1,fontSize:14,textAlign:'center'}}/>
              <span style={{fontSize:14,color:'var(--muted2)',fontWeight:500,whiteSpace:'nowrap'}}>
                {cond.left==='inv.days_since_last' ? '天' : cond.left==='inv.available_qty' ? '%（安全库存的百分比）' : cond.left==='order.quantity' ? '件' : cond.left==='order.total_amount' ? '元' : '%'}
              </span>
            </span>
          </div>
          <div className='small' style={{marginTop:8,padding:'6px 10px',background:'var(--bg)',borderRadius:32,fontSize:13,color:'var(--primary)'}}>
            <IconClipboard size={12} style={{display:'inline',verticalAlign:'middle',marginRight:4}} />
            当 <b>{WHS.find(w=>w.v===cond.warehouse)?.l||'全部'}</b> <b>{fieldLbl(cond.left)}</b> {opLbl(cond.op)} <b>{cond.pctValue||0}{cond.left==='inv.days_since_last'?'天':cond.left==='inv.available_qty'?'%':'件'}</b>
            {cond.left==='inv.available_qty' ? <span style={{color:'var(--muted2)',fontSize:11}}>（安全库存的 {cond.pctValue||0}%）</span> : ''}
            时
          </div>
        </div>

        {/* 告警内容 */}
        <div style={{background:'var(--card)',border:'1px solid var(--border)',borderRadius:32,padding:14}}>
          <div style={{fontWeight:600,fontSize:13,marginBottom:10,display:'flex',alignItems:'center',gap:4}}><IconAlert size={14} /> 告警内容</div>
          <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:8}}>
            <label style={{flex:1,minWidth:180,fontSize:12}}>
              告警标题
              <div style={{marginTop:4,padding:'8px 12px',background:'var(--bg)',borderRadius:32,fontSize:14,minHeight:36,border:'1px solid var(--border)',display:'flex',alignItems:'center',flexWrap:'wrap',gap:3}}>
                {renderTmpl(f.alert_title) || <span className="muted" style={{fontSize:12}}>输入文字或点击下方按钮插入变量</span>}
              </div>
              <input value={f.alert_title} onChange={e=>setF({...f,alert_title:e.target.value})} style={{...IS,fontSize:13,marginTop:4}} placeholder='输入文字，点击下方按钮插入变量'/>
              <div style={{display:'flex',gap:4,marginTop:4,flexWrap:'wrap'}}>
                {[{v:'{product_name}',l:'商品名'},{v:'{sku}',l:'SKU'}].map(t=>
                  <span key={t.v} onClick={()=>setF({...f,alert_title:f.alert_title+t.v})} className="clickable" style={{padding:'4px 12px',borderRadius:99,fontSize:12,background:'rgba(29,78,216,0.1)',color:'var(--primary)',cursor:'pointer',border:'1px solid rgba(29,78,216,0.2)',display:'inline-flex',alignItems:'center',gap:3}}>➕{t.l}</span>
                )}
              </div>
            </label>
            <label style={{flex:1,minWidth:180,fontSize:12}}>
              告警描述
              <div style={{marginTop:4,padding:'8px 12px',background:'var(--bg)',borderRadius:32,fontSize:14,minHeight:36,border:'1px solid var(--border)',display:'flex',alignItems:'center',flexWrap:'wrap',gap:3}}>
                {renderTmpl(f.alert_desc) || <span className="muted" style={{fontSize:12}}>输入文字或点击下方按钮插入变量</span>}
              </div>
              <input value={f.alert_desc} onChange={e=>setF({...f,alert_desc:e.target.value})} style={{...IS,fontSize:13,marginTop:4}} placeholder='输入文字，点击下方按钮插入变量'/>
              <div style={{display:'flex',gap:4,marginTop:4,flexWrap:'wrap'}}>
                {[{v:'{avail}',l:'可用量'},{v:'{safety}',l:'安全线'},{v:'{sku}',l:'SKU'}].map(t=>
                  <span key={t.v} onClick={()=>setF({...f,alert_desc:f.alert_desc+t.v})} className="clickable" style={{padding:'4px 12px',borderRadius:99,fontSize:12,background:'rgba(29,78,216,0.1)',color:'var(--primary)',cursor:'pointer',border:'1px solid rgba(29,78,216,0.2)',display:'inline-flex',alignItems:'center',gap:3}}>➕{t.l}</span>
                )}
              </div>
            </label>
          </div>
        </div>

        <div style={{marginTop:16,display:'flex',gap:10}}>
          <button onClick={save} className="btn btn-primary" style={{flex:1,display:'inline-flex',alignItems:'center',gap:4,justifyContent:'center',minHeight:40}}><IconSave size={14} /> 保存</button>
          <button onClick={cancelEdit} className="btn btn-ghost" style={{flex:1,background:'var(--warning)',color:'#fff',minHeight:40}}>取消</button>
        </div>
      </div>}

      {rules.map(rule => {
        const condInfo = pc(rule.condition_json||'{}')
        const whLbl = WHS.find(w=>w.v===condInfo.warehouse)?.l||'全部'
        const modeLbl = MODES.find(m=>m.v===(rule.mode||''))?.l||'全部'
        const condText = `当 ${whLbl} ${fieldLbl(condInfo.left)} ${opLbl(condInfo.op)} ${condInfo.rightType==='pct'?fieldLbl(condInfo.right)+'的'+condInfo.pctValue+'%':(condInfo.rightType==='field'?fieldLbl(condInfo.right):condInfo.right)}`
        return <div key={rule.id} style={{padding:'14px 16px',border:'1px solid var(--border)',borderRadius:32,marginBottom:8}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:600,fontSize:15,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
            {rule.name}
            <span className={'pill '+(rule.is_active?'success':'warning')} style={{fontSize:10,padding:'2px 8px',minHeight:'auto',lineHeight:'18px'}}>{rule.is_active?'启用':'停用'}</span>
            <span className={'pill '+sevCls(rule.severity)} style={{fontSize:10,padding:'2px 8px',minHeight:'auto',lineHeight:'18px'}}>{sevLbl(rule.severity)}</span>
            {rule.mode && <span style={{fontSize:10,color:'var(--muted2)',background:'var(--bg)',padding:'2px 8px',borderRadius:99}}>{modeLbl}</span>}
          </div>
          <div style={{marginTop:6,padding:'8px 12px',background:'var(--bg)',borderRadius:32,fontSize:13,color:'var(--primary)',display:'block'}}>
            <IconScale size={12} style={{display:'inline',verticalAlign:'middle',marginRight:4}} /> {condText}
          </div>
          <div style={{fontSize:12,color:'var(--muted)',marginTop:4,display:'flex',flexWrap:'wrap',gap:3,alignItems:'center'}}>
            {renderTmpl(rule.alert_title) || <span className="small muted">无标题</span>}
            {rule.alert_desc ? <><span style={{color:'var(--muted2)',margin:'0 3px'}}>·</span>{renderTmpl(rule.alert_desc)}</> : ''}
          </div>
        </div>
        <div style={{display:'flex',gap:8,flexShrink:0,alignItems:'flex-start'}}>
          <button onClick={()=>{const c=pc(rule.condition_json||'{}');setEditing(rule);setF({name:rule.name,event:rule.event,alert_type:rule.alert_type||'low_stock',alert_title:rule.alert_title||'',alert_desc:rule.alert_desc||'',severity:rule.severity||'warning',mode:rule.mode||'',condition_json:rule.condition_json||'{}'});setCond(c)}} className="clickable" style={{fontSize:13,padding:'6px 14px',minHeight:36,borderRadius:99,border:'none',background:'var(--primary)',color:'#fff',cursor:'pointer',fontWeight:600}}>编辑</button>
          <button onClick={()=>del(rule.id)} className="clickable" style={{fontSize:13,padding:'6px 14px',minHeight:36,borderRadius:99,border:'none',background:'var(--danger)',color:'#fff',cursor:'pointer',fontWeight:600}}>删除</button>
        </div>
        </div>
      </div>})}
      {rules.length===0 && <div className='small muted' style={{textAlign:'center',padding:40}}>暂无规则</div>}
    </>}

    {/* ── 补货参数 ── */}
    {tab==='params' && <div>
      {isBBCC ? <>
        <div className='section-title' style={{fontSize:13,marginBottom:8,display:'flex',alignItems:'center',gap:4}}><IconPackage size={14} /> C 仓</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>{cParams.map(({k,l,h})=><label key={k} style={{fontSize:12}}>{l}<input value={cfg[k]||''} onChange={e=>setCfg(p=>({...p,[k]:e.target.value}))} style={IS}/>{h && <div className='small muted' style={{fontSize:11}}>{h}</div>}</label>)}</div>
        <div className='section-title' style={{fontSize:13,marginBottom:8,display:'flex',alignItems:'center',gap:4}}><IconFactory size={14} /> B 仓</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:16}}>{bParams.map(({k,l})=><label key={k} style={{fontSize:12}}>{l}<input value={cfg[k]||''} onChange={e=>setCfg(p=>({...p,[k]:e.target.value}))} style={IS}/></label>)}</div>
      </> : <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:16}}>{paramFields.map(({k,l})=><label key={k} style={{fontSize:12}}>{l}<input value={cfg[k]||''} onChange={e=>setCfg(p=>({...p,[k]:e.target.value}))} style={IS}/></label>)}</div>}
      <button disabled={saving} onClick={async()=>{setSaving(true);const m=cfg.replenishment_mode||'bbcc';const ch=globalChannel;try{const toSave={};[...cParams,...bParams,...paramFields].forEach(f=>{if(cfg[f.k]!==undefined)toSave[f.k]=cfg[f.k]});await api.put('/api/replenishment-config?mode='+m+'&channel='+ch,toSave);setCfg(p=>({...p,...toSave}));toast.success('已保存')}catch(e){toast.error('保存失败: '+e.message)}setSaving(false)}} className="btn btn-primary" style={{display:'inline-flex',alignItems:'center',gap:4}}>{saving?<><IconLoading size={14} /> 保存中...</>:<><IconSave size={14} /> 保存</>}</button>
    </div>}

    {/* ── 采购参数 ── */}
    {tab === 'purchase' && <div className='card' style={{padding:16,display:'flex',flexDirection:'column',gap:12}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>{purchaseFields.map(({k,l})=><label key={k} style={{fontSize:12}}>{l}<input value={cfg[k]||''} onChange={e=>setCfg(p=>({...p,[k]:e.target.value}))} style={IS}/></label>)}</div>
      <button disabled={saving} onClick={async()=>{setSaving(true);const ch=globalChannel;try{const toSave={};purchaseFields.forEach(f=>{if(cfg[f.k]!==undefined)toSave[f.k]=cfg[f.k]});await api.put('/api/replenishment-config?channel='+ch,toSave);setCfg(p=>({...p,...toSave}));toast.success('已保存')}catch(e){toast.error('保存失败: '+e.message)}setSaving(false)}} className="btn btn-primary" style={{display:'inline-flex',alignItems:'center',gap:4}}>{saving?<><IconLoading size={14} /> 保存中...</>:<><IconSave size={14} /> 保存</>}</button>
    </div>}

    {/* ── 活动系数 ── */}
    {tab === 'params' && <><div className='section-title' style={{marginTop:16,marginBottom:8,display:'flex',alignItems:'center',gap:4}}><IconTag size={14} /> 活动系数</div>
      {seasons.map((s,i)=><div key={s.key||i} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',border:'1px solid var(--border)',borderRadius:32,marginBottom:6}}>
        <input value={s.name} onChange={e=>setSeasons(p=>p.map((x,j)=>j===i?{...x,name:e.target.value}:x))} placeholder='618大促' style={{width:110,fontSize:16,padding:'5px 8px',border:'1px solid var(--border)',borderRadius:32,outline:'none'}}/>
        <span className='small muted'>×</span>
        <input type='number' value={s.factor} onChange={e=>setSeasons(p=>p.map((x,j)=>j===i?{...x,factor:parseFloat(e.target.value)||1}:x))} step='0.1' min='1' max='3' style={{width:70,fontSize:16,padding:'5px 8px',border:'1px solid var(--border)',borderRadius:32,outline:'none'}}/>
        <span className='small muted'>倍</span>
        <label style={{fontSize:12,display:'flex',alignItems:'center',gap:4,cursor:'pointer'}} onClick={()=>setSeasons(p=>p.map((x,j)=>j===i?{...x,enabled:!(x.enabled!==false)}:x))}>
          <svg width="18" height="18" viewBox="0 0 18 18" style={{flexShrink:0}}>
            {s.enabled!==false ? (
              <>
                <circle cx="9" cy="9" r="8" fill="var(--primary)" />
                <path d="M5.5 9.5l2 2 3.5-3.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </>
            ) : (
              <circle cx="9" cy="9" r="8" fill="none" stroke="var(--border)" strokeWidth="1.5" />
            )}
          </svg>
          启用
        </label>
        <button onClick={()=>setSeasons(p=>p.filter((_,j)=>j!==i))} className="btn btn-danger" style={{fontSize:12,padding:'4px 10px',minHeight:0}}>删除</button>
      </div>)}
      <button onClick={()=>setSeasons(p=>[...p,{key:'new',name:'新活动',factor:1.2,enabled:true}])} className="btn btn-ghost" style={{fontSize:12,padding:'4px 12px',width:'100%'}}>+ 添加活动</button>
      <div style={{display:'flex',justifyContent:'flex-end',marginTop:10}}>
        <button disabled={seasonsSaving} onClick={async()=>{setSeasonsSaving(true);const m=cfg.replenishment_mode||'bbcc';const ch=globalChannel;try{await api.put('/api/replenishment-config/seasons?mode='+m+'&channel='+ch,{items:seasons});await loadCfg(m,ch);toast.success('已保存')}catch(e){toast.error('保存失败: '+e.message)}setSeasonsSaving(false)}} className="btn btn-primary" style={{opacity:seasonsSaving?0.6:1,display:'inline-flex',alignItems:'center',gap:4}}>{seasonsSaving?<><IconLoading size={14} /> 保存中...</>:<><IconSave size={14} /> 保存</>}</button>
      </div>
    </>}
  </div>
}