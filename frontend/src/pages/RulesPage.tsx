import React, { useState, useEffect } from 'react'
import { api } from '../api/client'

const API = import.meta.env.VITE_API_BASE_URL || 'https://overtrees.pythonanywhere.com'
const EVENTS = [
  {value:'inventory.changed',label:'库存变动'},
  {value:'order.created',label:'订单创建'},
  {value:'scheduled.daily',label:'每日定时'},
]

export default function RulesPage() {
  const [tab,setTab] = useState('rules')
  const [rules,setRules] = useState([])
  const [editing,setEditing] = useState(null)
  const [cfg,setCfg] = useState({})
  const [seasons,setSeasons] = useState([])
  const [f,setF] = useState({name:'',event:'inventory.changed',alert_type:'',alert_title:'',alert_desc:'',severity:'warning',condition_json:'{}'})

  const load=async()=>{try{const r=await fetch(API+'/api/rules');setRules(await r.json())}catch(e){}}
  const loadCfg=async()=>{try{const r=await api.get('/api/replenishment-config');setCfg(r.data||{})}catch(e){}}
  const loadSeasons=async()=>{try{const r=await api.get('/api/replenishment-config/seasons');setSeasons(r.data||[])}catch(e){}}
  useEffect(()=>{load();loadCfg();loadSeasons()},[])

  const save=async()=>{
    const url=editing?API+'/api/rules/'+editing.id:API+'/api/rules'
    const m=editing?'PUT':'POST'
    await fetch(url,{method:m,headers:{'Content-Type':'application/json'},body:JSON.stringify(f)})
    setEditing(null);setF({name:'',event:'inventory.changed',alert_type:'',alert_title:'',alert_desc:'',severity:'warning',condition_json:'{}'});load()
  }
  const del=async id=>{await fetch(API+'/api/rules/'+id,{method:'DELETE'});load()}

  const sevCls=s=>s==='error'?'danger':s==='info'?'info':'warning'
  const sevLbl=s=>s==='error'?'严重':s==='info'?'提示':'警告'

  const ruleFields=[
    {k:'name',l:'规则名称',h:'唯一标识名称',pl:'低库存预警'},
    {k:'event',l:'触发事件',h:'选择何时触发此规则',tp:'select'},
    {k:'alert_type',l:'告警标识',h:'内部代号：low_stock/replenish/oversell',pl:'low_stock'},
    {k:'severity',l:'严重级别',h:'告警显示颜色',tp:'sev'},
    {k:'alert_title',l:'告警标题',h:'可用变量：{product_name} {sku}',pl:'低库存预警: {product_name}'},
    {k:'alert_desc',l:'告警描述',h:'可用变量：{avail} {safety} {sku}',pl:'可用 {avail} < 安全线 {safety}'},
  ]

  const paramFields=[
    {k:'lead_time_days',l:'前置期(天)',h:'物流平均4.5天+生产平均5.5天'},
    {k:'safety_multiplier',l:'安全线倍数',h:'基础安全库存的放大倍数'},
    {k:'max_turnover_days',l:'最大周转(天)',h:'补货后不能超过此天数'},
  ]

  return <div className='card'>
    <div className='section-title' style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <div style={{display:'flex',gap:8}}>
        <button onClick={()=>setTab('rules')} style={{fontSize:13,fontWeight:tab==='rules'?700:400,padding:'4px 12px',border:'none',borderRadius:6,background:tab==='rules'?'#1d4ed8':'transparent',color:tab==='rules'?'#fff':'#64748b',cursor:'pointer'}}>⚙️ 规则</button>
        <button onClick={()=>setTab('params')} style={{fontSize:13,fontWeight:tab==='params'?700:400,padding:'4px 12px',border:'none',borderRadius:6,background:tab==='params'?'#059669':'transparent',color:tab==='params'?'#fff':'#64748b',cursor:'pointer'}}>📊 补货参数</button>
      </div>
      {tab==='rules'&&<button onClick={()=>{setEditing({});setF({name:'',event:'inventory.changed',alert_type:'',alert_title:'',alert_desc:'',severity:'warning',condition_json:'{}'})}} style={ST.primary}>+ 新建</button>}
    </div>

    {tab==='rules'&&<>
      {editing!==null&&<div style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:12,padding:16,marginBottom:16}}>
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
        <div style={{marginTop:12,display:'flex',gap:8}}>
          <button onClick={save} style={ST.primary}>保存</button>
          <button onClick={()=>{setEditing(null);setF({name:'',event:'inventory.changed',alert_type:'',alert_title:'',alert_desc:'',severity:'warning',condition_json:'{}'})}} style={ST.secondary}>取消</button>
        </div>
      </div>}

      {rules.map(rule=><div key={rule.id} style={{padding:'10px 14px',border:'1px solid #e5e7eb',borderRadius:10,marginBottom:6,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><div style={{fontWeight:600,fontSize:14}}>{rule.name}</div>
          <div style={{fontSize:12,color:'#94a3b8',marginTop:2}}>
            <span className={'pill '+(rule.is_active?'success':'warning')}>{rule.is_active?'启用':'停用'}</span>
            <span className={'pill '+sevCls(rule.severity)}>{sevLbl(rule.severity)}</span>
            <span className='small muted' style={{marginLeft:6}}>{rule.event}</span>
          </div></div>
        <div style={{display:'flex',gap:6}}>
          <button onClick={()=>{setEditing(rule);setF({name:rule.name,event:rule.event,alert_type:rule.alert_type||'',alert_title:rule.alert_title||'',alert_desc:rule.alert_desc||'',severity:rule.severity||'warning',condition_json:rule.condition_json||'{}'})}} style={ST.edit}>编辑</button>
          <button onClick={()=>del(rule.id)} style={ST.danger}>删除</button>
        </div>
      </div>)}
      {rules.length===0&&<div className='small muted' style={{textAlign:'center',padding:40}}>暂无规则</div>}
    </>}

    {tab==='params'&&<div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:16}}>
        {paramFields.map(({k,l,h})=><label key={k} style={{fontSize:12}}>
          {l}<input value={cfg[k]||''} onChange={e=>setCfg(p=>({...p,[k]:e.target.value}))} style={IS}/>
          <div className='small muted' style={{fontSize:11}}>{h}</div>
        </label>)}
      </div>

      <div className='section-title' style={{marginTop:16,marginBottom:8}}>🏷️ 活动系数</div>
      {seasons.map((s,i)=><div key={s.key||i} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',border:'1px solid #e5e7eb',borderRadius:10,marginBottom:6}}>
        <input value={s.name} onChange={e=>setSeasons(p=>p.map((x,j)=>j===i?{...x,name:e.target.value}:x))} placeholder='活动名称' style={{width:110,fontSize:12,padding:'5px 8px',border:'1px solid #e2e8f0',borderRadius:6,outline:'none'}}/>
        <span className='small muted' style={{fontSize:11}}>×</span>
        <input type='number' value={s.factor} onChange={e=>setSeasons(p=>p.map((x,j)=>j===i?{...x,factor:parseFloat(e.target.value)||1}:x))} step='0.1' min='1' max='3' style={{width:70,fontSize:12,padding:'5px 8px',border:'1px solid #e2e8f0',borderRadius:6,outline:'none'}}/>
        <span className='small muted' style={{fontSize:11}}>倍销售</span>
        <label style={{fontSize:12,display:'flex',alignItems:'center',gap:4}}>
          <input type='checkbox' checked={s.enabled!==false} onChange={e=>setSeasons(p=>p.map((x,j)=>j===i?{...x,enabled:e.target.checked}:x))} style={{accentColor:'#1d4ed8'}}/>
          启用
        </label>
        <button onClick={()=>setSeasons(p=>p.filter((_,j)=>j!==i))} style={{background:'#fee2e2',border:'none',borderRadius:6,cursor:'pointer',padding:'4px 8px',fontSize:12,color:'#dc2626'}}>删除</button>
      </div>)}
      <button onClick={()=>setSeasons(p=>[...p,{key:'new',name:'新活动',factor:1.2,enabled:true}])} style={{padding:'4px 12px',fontSize:12,border:'1px dashed #94a3b8',borderRadius:8,background:'#fff',cursor:'pointer',color:'#64748b',width:'100%',marginBottom:16}}>+ 添加活动</button>

      <button onClick={async()=>{try{await api.put('/api/replenishment-config',cfg);await api.put('/api/replenishment-config/seasons',seasons);loadCfg();loadSeasons()}catch(e){alert('保存失败: '+e.message)}}} style={ST.primary}>💾 保存所有参数</button>
      <span className='small muted' style={{marginLeft:8,fontSize:11}}>更新后补货建议 & 规则引擎适用</span>
    </div>}
  </div>
}

const ST={primary:{padding:'6px 16px',background:'#1d4ed8',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13},secondary:{padding:'6px 16px',background:'#fff',border:'1px solid #e2e8f0',borderRadius:8,cursor:'pointer',fontSize:13},edit:{fontSize:12,padding:'4px 10px',border:'1px solid #e2e8f0',borderRadius:6,cursor:'pointer',background:'#fff'},danger:{fontSize:12,padding:'4px 10px',border:'1px solid #ef4444',borderRadius:6,cursor:'pointer',background:'#fff',color:'#ef4444'}}
const IS={width:'100%',padding:'6px 8px',fontSize:12,border:'1px solid #e2e8f0',borderRadius:6,marginTop:4,outline:'none',background:'#fff',boxSizing:'border-box'}
