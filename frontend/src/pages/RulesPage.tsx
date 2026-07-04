import React, { useState, useEffect } from 'react'
import { api } from '../api/client'
import { useToast } from '../components/Toast'

const API = import.meta.env.VITE_API_BASE_URL || 'https://overtrees.pythonanywhere.com'
const EVENTS = [
  {value:'inventory.changed',label:'库存变动'},
  {value:'order.created',label:'订单创建'},
  {value:'scheduled.daily',label:'每日定时'},
]

export default function RulesPage() {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const IS={width:'100%',padding:'6px 8px',fontSize:16,border:'1px solid #e2e8f0',borderRadius:6,marginTop:4,outline:'none',background:'var(--card)',boxSizing:'border-box'}
  const [tab,setTab] = useState('rules')
  const [rules,setRules] = useState([])
  const [editing,setEditing] = useState(null)
  const [cfg,setCfg] = useState({})
  const [seasons,setSeasons] = useState([])
  const [f,setF] = useState({name:'',event:'inventory.changed',alert_type:'',alert_title:'',alert_desc:'',severity:'warning',condition_json:'{}'})

  const load=async()=>{try{const r=await fetch(API+'/api/rules');setRules(await r.json())}catch(e){}}
  const loadCfg=async(mode)=>{try{const m=mode||cfg.replenishment_mode||'bbcc';const r=await api.get('/api/replenishment-config?mode='+m);setCfg({...r.data,replenishment_mode:m});return r.data||{}}catch(e){return {}}}
  const loadSeasons=async(mode)=>{try{const m=mode||cfg.replenishment_mode||'bbcc';const r=await api.get('/api/replenishment-config/seasons?mode='+m);setSeasons(r.data||[])}catch(e){}}
  useEffect(()=>{load();loadCfg().then(d=>loadSeasons()).finally(()=>setLoading(false))},[])

  const save=async()=>{const cj=JSON.stringify({left:cond.left,op:cond.op,right:cond.rightType==='field'?cond.right:parseFloat(cond.right)||0})
    const isNew = !editing || !editing.id
    const url=isNew ? API+'/api/rules' : API+'/api/rules/'+editing.id
    const m=isNew?'POST':'PUT'
    await fetch(url,{method:m,headers:{'Content-Type':'application/json'},body:JSON.stringify({...f,condition_json:cj})})
    setEditing(null);setF({name:'',event:'inventory.changed',alert_type:'',alert_title:'',alert_desc:'',severity:'warning',condition_json:'{}'});load()
  }
  const del=async id=>{await fetch(API+'/api/rules/'+id,{method:'DELETE'});load()}

  const sevCls=s=>s==='error'?'danger':s==='info'?'info':'warning'
const[cond,setCond]=useState({left:'inv.available_qty',op:'<',right:'inv.safety_qty',rightType:'field'})
const LF=[{l:'可用库存',v:'inv.available_qty'},{l:'安全库存',v:'inv.safety_qty'},{l:'在途库存',v:'inv.in_transit_qty'},{l:'距上次销售(天)',v:'inv.days_since_last'},{l:'库存量',v:'inv.stock'},{l:'订单数量',v:'order.quantity'},{l:'订单金额',v:'order.total_amount'},{l:'单价',v:'order.unit_price'}]
const OPS=[{l:'< 小于',v:'<'},{l:'≤ 小于等于',v:'<='},{l:'> 大于',v:'>'},{l:'≥ 大于等于',v:'>='},{l:'== 等于',v:'=='}]
const pc=j=>{try{const c=JSON.parse(j);return{left:c.left||'inv.available_qty',op:c.op||'<',right:c.right||'inv.safety_qty',rightType:LF.find(x=>x.v===c.right)?'field':'number'}}catch{return{left:'inv.available_qty',op:'<',right:'inv.safety_qty',rightType:'field'}}}
  const sevLbl=s=>s==='error'?'严重':s==='info'?'提示':'警告'

  const ruleFields=[
    {k:'name',l:'规则名称',h:'唯一标识名称',pl:'低库存预警'},
    {k:'event',l:'触发事件',h:'选择何时触发此规则',tp:'select'},
    {k:'alert_type',l:'告警标识',h:'内部代号：low_stock/replenish/oversell',pl:'low_stock'},
    {k:'severity',l:'严重级别',h:'告警显示颜色',tp:'sev'},
    {k:'alert_title',l:'告警标题',h:'可用变量：{product_name} {sku}',pl:'低库存预警: {product_name}'},
    {k:'alert_desc',l:'告警描述',h:'可用变量：{avail} {safety} {sku}',pl:'可用 {avail} < 安全线 {safety}'},
  ]

  const L = (cfg.replenishment_mode||'bbcc')==='bbcc' ? '供应商生产+送货到我司仓总天数' : '供应商生产+送货到我司仓+我司发往全国仓总天数'
  const paramFields=[
    {k:'lead_time_days',l:'前置期(天)',h:L},
    {k:'ship_to_b_days',l:'发B仓时效(天)',h:'BBCC：我司发往京东B仓时效'},
    {k:'b_to_c_days',l:'B→C调拨(天)',h:'BBCC：京东B仓→C仓调拨时效'},
    {k:'c_safety_days',l:'C仓缓冲(天)',h:'BBCC：C仓防止调拨断货储备天数'},
    {k:'safety_multiplier',l:'安全库存天数',h:'预留N天日销作为安全库存'},
    {k:'max_turnover_days',l:'目标周转(天)',h: (cfg.replenishment_mode||'bbcc')==='bbcc' ? 'B仓免费存15天' : '平台仓货品在库周转'},
  ]
  const purchaseFields=[
    {k:'purchase_lead_days',l:'采购前置(天)',h:'供应商生产+送货到我司总天数'},
    {k:'moq',l:'MOQ最小起订(件)',h:'供应商最小起订量'},
    {k:'max_turnover_days',l:'目标周转(天)',h:'我司货品在自有/三方仓'},
  ]

  if (loading) return <div className='card'>
    <div className='section-title'><div className="skeleton" style={{width:200,height:20}}/></div>
    {[1,2,3].map(i=><div key={i} className="skeleton" style={{width:'100%',height:36,marginBottom:8}}/>)}
  </div>

  return <div className='card'>
    <div className='section-title' style={{display:'flex',flexWrap:'wrap',gap:6}}>
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
        <button onClick={()=>setTab('rules')} className="btn btn-ghost" style={{fontSize:13,background:tab==='rules'?'var(--primary)':'transparent',color:tab==='rules'?'#fff':''}}>⚙️ 规则</button>
        <button onClick={()=>{loadCfg(cfg.replenishment_mode||'bbcc');setTab('params')}} className="btn btn-ghost" style={{fontSize:13,background:tab==='params'?'var(--success)':'transparent',color:tab==='params'?'#fff':''}}>📊 补货参数</button>
        <button onClick={async()=>{try{const r=await api.get('/api/replenishment-config');if(r.data)setCfg(p=>({...r.data,replenishment_mode:p.replenishment_mode||'bbcc'}))}catch(e){};setTab('purchase')}} className="btn btn-ghost" style={{fontSize:13,background:tab==='purchase'?'var(--primary)':'transparent',color:tab==='purchase'?'#fff':''}}>🛒 采购参数</button>
      </div>
      {tab==='rules'&&<button onClick={()=>{setEditing({});setF({name:'',event:'inventory.changed',alert_type:'',alert_title:'',alert_desc:'',severity:'warning',condition_json:'{}'})}} className="btn btn-primary">+ 新建</button>}
    </div>

    {tab==='rules'&&<>
      {editing!==null&&<div style={{background:'var(--bg)',border:'1px solid #e2e8f0',borderRadius:12,padding:16,marginBottom:16}}>
        <div style={{fontWeight:600,marginBottom:12}}>{editing.id?'编辑规则':'新建规则'}</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          {ruleFields.map(({k,l,h,pl,tp})=><label key={k} style={{fontSize:12,display:'block'}}>
            {l}
            {tp==='select'?<select value={f.event} onChange={e=>setF({...f,event:e.target.value})} style={IS}>{EVENTS.map(ev=><option key={ev.value} value={ev.value}>{ev.label}</option>)}</select>
            :tp==='sev'?<select value={f.severity} onChange={e=>setF({...f,severity:e.target.value})} style={IS}><option value='warning'>🟡 警告</option><option value='error'>🔴 严重</option><option value='info'>🔵 提示</option></select>
            :<input value={f[k]} onChange={e=>setF({...f,[k]:e.target.value})} style={IS} placeholder={pl||''}/>}
            <div className='small muted' style={{fontSize:11,marginTop:2}}>{h}</div>
          </label>)}
        </div>
        <div style={{marginTop:12}}>
          <div style={{fontWeight:600,fontSize:13,marginBottom:8}}>⚖️ 触发条件</div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            <select value={cond.left} onChange={e=>setCond(p=>({...p,left:e.target.value}))} style={IS}>{LF.map(f=><option key={f.v} value={f.v}>{f.l}</option>)}</select>
            <select value={cond.op} onChange={e=>setCond(p=>({...p,op:e.target.value}))} style={IS}>{OPS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select>
            <div style={{display:'flex',gap:6}}>
              <select value={cond.rightType} onChange={e=>setCond(p=>({...p,rightType:e.target.value,right:e.target.value==='field'?'inv.safety_qty':'0'}))} style={{...IS,flex:1}}><option value='field'>字段</option><option value='number'>数值</option></select>
              {cond.rightType==='field'
                ?<select value={cond.right} onChange={e=>setCond(p=>({...p,right:e.target.value}))} style={{...IS,flex:3}}>{LF.map(f=><option key={f.v} value={f.v}>{f.l}</option>)}</select>
                :<input type='number' value={cond.right} onChange={e=>setCond(p=>({...p,right:e.target.value}))} style={{...IS,flex:3}}/>}
            </div>
          </div>
          <div className='small muted' style={{marginTop:6,fontSize:11}}>当满足此条件时触发告警</div>
        </div>
        <div style={{marginTop:12,display:'flex',gap:8}}>
          <button onClick={save} className="btn btn-primary">保存</button>
          <button onClick={()=>{setEditing(null);setF({name:'',event:'inventory.changed',alert_type:'',alert_title:'',alert_desc:'',severity:'warning',condition_json:'{}'})}} className="btn btn-ghost">取消</button>
        </div>
      </div>}

      {rules.map(rule=><div key={rule.id} style={{padding:'10px 14px',border:'1px solid #e5e7eb',borderRadius:10,marginBottom:6,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><div style={{fontWeight:600,fontSize:14}}>{rule.name}</div>
          <div style={{fontSize:12,color:'var(--muted2)',marginTop:2}}>
            <span className={'pill '+(rule.is_active?'success':'warning')}>{rule.is_active?'启用':'停用'}</span>
            <span className={'pill '+sevCls(rule.severity)}>{sevLbl(rule.severity)}</span>
            <span className='small muted' style={{marginLeft:6}}>{rule.event}</span>
          </div></div>
        <div style={{display:'flex',gap:6}}>
          <button onClick={()=>{setEditing(rule);setF({name:rule.name,event:rule.event,alert_type:rule.alert_type||'',alert_title:rule.alert_title||'',alert_desc:rule.alert_desc||'',severity:rule.severity||'warning',condition_json:rule.condition_json||'{}'})}} className="btn btn-ghost" style={{fontSize:12,padding:'4px 10px',minHeight:0}}>编辑</button>
          <button onClick={()=>del(rule.id)} className="btn btn-danger" style={{fontSize:12,padding:'4px 10px',minHeight:0}}>删除</button>
        </div>
      </div>)}
      {rules.length===0&&<div className='small muted' style={{textAlign:'center',padding:40}}>暂无规则</div>}
    </>}

    {tab==='params'&&<div>
      <div style={{display:'flex',gap:8,marginBottom:12}}>
        <span onClick={()=>{loadCfg('bbcc');loadSeasons('bbcc')}} className="btn btn-ghost" style={{fontSize:12,padding:'4px 14px',background:(cfg.replenishment_mode||'bbcc')==='bbcc'?'var(--primary)':'transparent',color:(cfg.replenishment_mode||'bbcc')==='bbcc'?'#fff':''}}>📦 BBCC 送仓</span>
        <span onClick={()=>{loadCfg('traditional');loadSeasons('traditional')}} className="btn btn-ghost" style={{fontSize:12,padding:'4px 14px',background:cfg.replenishment_mode==='traditional'?'var(--primary)':'transparent',color:cfg.replenishment_mode==='traditional'?'#fff':''}}>🏭 传统多仓</span>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:16}}>
        {paramFields.filter(f => (cfg.replenishment_mode||'bbcc')==='bbcc' || !['b_to_c_days','c_safety_days','ship_to_b_days'].includes(f.k)).map(({k,l,h})=><label key={k} style={{fontSize:12}}>
          {l}<input value={cfg[k]||''} onChange={e=>setCfg(p=>({...p,[k]:e.target.value}))} style={IS}/>
          <div className='small muted' style={{fontSize:11}}>{h}</div>
        </label>)}
      </div>
    </div>}

      {tab === 'purchase' && <div className='card' style={{padding:16,display:'flex',flexDirection:'column',gap:12}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:16}}>
          {purchaseFields.map(({k,l,h})=><label key={k} style={{fontSize:12}}>
            {l}<input value={cfg[k]||''} onChange={e=>setCfg(p=>({...p,[k]:e.target.value}))} style={IS}/>
            <div className='small muted' style={{fontSize:11}}>{h}</div>
          </label>)}
        </div>
        <button disabled={saving} onClick={async()=>{setSaving(true);try{
          const toSave = {}; purchaseFields.forEach(f => { if (cfg[f.k] !== undefined) toSave[f.k] = cfg[f.k] })
          await api.put('/api/replenishment-config', toSave)
          const r = await api.get('/api/replenishment-config'); setCfg({...r.data,replenishment_mode:cfg.replenishment_mode});
          toast.success('采购参数已保存')
        }catch(e){toast.error('保存失败: '+e.message)}setSaving(false)}} className='btn btn-primary'>{saving?'⏳ 保存中...':'💾 保存参数'}</button>
      </div>}
      {tab === 'params' && <><div className='section-title' style={{marginTop:16,marginBottom:8}}>🏷️ 活动系数</div>
      {seasons.map((s,i)=><div key={s.key||i} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',border:'1px solid #e5e7eb',borderRadius:10,marginBottom:6}}>
        <input value={s.name} onChange={e=>setSeasons(p=>p.map((x,j)=>j===i?{...x,name:e.target.value}:x))} placeholder='活动名称' style={{width:110,fontSize:16,padding:'5px 8px',border:'1px solid #e2e8f0',borderRadius:6,outline:'none'}}/>
        <span className='small muted' style={{fontSize:11}}>×</span>
        <input type='number' value={s.factor} onChange={e=>setSeasons(p=>p.map((x,j)=>j===i?{...x,factor:parseFloat(e.target.value)||1}:x))} step='0.1' min='1' max='3' style={{width:70,fontSize:16,padding:'5px 8px',border:'1px solid #e2e8f0',borderRadius:6,outline:'none'}}/>
        <span className='small muted' style={{fontSize:11}}>倍销售</span>
        <label style={{fontSize:12,display:'flex',alignItems:'center',gap:4}}>
          <input type='checkbox' checked={s.enabled!==false} onChange={e=>setSeasons(p=>p.map((x,j)=>j===i?{...x,enabled:e.target.checked}:x))} style={{accentColor:'var(--primary)'}}/>
          启用
        </label>
        <button onClick={()=>setSeasons(p=>p.filter((_,j)=>j!==i))} className="btn btn-danger" style={{fontSize:12,padding:'4px 10px',minHeight:0}}>删除</button>
      </div>)}
      <button onClick={()=>setSeasons(p=>[...p,{key:'new',name:'新活动',factor:1.2,enabled:true}])} className="btn btn-ghost" style={{fontSize:12,padding:'4px 12px',width:'100%'}}>+ 添加活动</button>

      <button disabled={saving} onClick={async()=>{setSaving(true);const m=cfg.replenishment_mode||'bbcc';try{
        const toSave = {}
        paramFields.forEach(f => { if (cfg[f.k] !== undefined) toSave[f.k] = cfg[f.k] })
        await api.put('/api/replenishment-config?mode='+m, toSave)
        await api.put('/api/replenishment-config/seasons?mode='+m,{items:seasons})
        await loadCfg(m);toast.success('参数已保存')}catch(e){toast.error('保存失败: '+e.message)}setSaving(false)}} className="btn btn-primary" style={{opacity:saving?0.6:1}}>{saving?'⏳ 保存中...':'💾 保存参数'}</button>
      <span className='small muted' style={{marginLeft:8,fontSize:11}}>更新后补货建议 & 规则引擎适用</span>
    </>
    }
  </div>
}
