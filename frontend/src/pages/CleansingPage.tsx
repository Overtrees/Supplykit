import React, { useState } from 'react'
import { api } from '../api/client'

const API = import.meta.env.VITE_API_BASE_URL || 'https://overtrees.pythonanywhere.com'
const SYS_FIELDS = [
  {t:'order_no',l:'订单号',tp:'string'},{t:'store',l:'店铺',tp:'string'},{t:'warehouse',l:'仓库',tp:'string'},
  {t:'sku',l:'SKU',tp:'string'},{t:'product_name',l:'商品名称',tp:'string'},{t:'quantity',l:'数量',tp:'number'},
  {t:'unit_price',l:'单价',tp:'number'},{t:'total_amount',l:'金额',tp:'number'},{t:'order_status',l:'状态',tp:'string'},
  {t:'ordered_at',l:'订购时间',tp:'date'},{t:'supplier',l:'供应商',tp:'string'},{t:'remark',l:'备注',tp:'string'},
]
const ALIAS = {
  "订单号":"order_no","订单编号":"order_no","采购单号":"order_no",
  "商品编号":"sku","货号":"sku","SKU":"sku",
  "商品名称":"product_name","产品名称":"product_name","名称":"product_name",
  "数量":"quantity","采购数量":"quantity","订货数量":"quantity",
  "单价":"unit_price","价格":"unit_price","采购价格":"unit_price",
  "金额":"total_amount","总金额":"total_amount","采购金额":"total_amount",
  "店铺":"store","店铺名":"store","门店":"store",
  "状态":"order_status","订单状态":"order_status",
  "日期":"ordered_at","订购时间":"ordered_at","下单时间":"ordered_at",
}

export default function CleansingPage() {
  const [s,setS] = useState(0)
  const [f,setF] = useState(null)
  const [cols,setCols] = useState([])
  const [tr,setTr] = useState(0)
  const [tt,setTt] = useState('order')
  const [mp,setMp] = useState({})
  const [pv,setPv] = useState(null)
  const [res,setRes] = useState(null)
  const [bs,setBs] = useState('')

  const detect = async (file) => {
    setF(file); setBs('识别中')
    const fd = new FormData(); fd.append('file', file)
    try {
      const r = await api.post('/api/cleansing/detect', fd)
      const d = r.data
      if (!d.ok) { alert(d.error||'识别失败'); setBs(''); return }
      setCols(d.columns||[]); setTr(d.total||0)
      const a = {}
      ;(d.columns||[]).forEach(c => {
        const key = ALIAS[c.name]
        if (key) a[c.name] = { target: key, type: 'string' }
      })
      if (Object.keys(a).length > 0) setMp(a)
      setS(1)
    } catch(e) { alert('请求异常: '+e.message) }
    setBs('')
  }

  const preview = async () => {
    setBs('预览中')
    const fd = new FormData(); fd.append('file', f); fd.append('mapping', JSON.stringify(mp)); fd.append('target', tt)
    try {
      const r = await api.post('/api/cleansing/preview', fd)
      const d = r.data
      if (!d.ok) { alert(d.error||'预览失败'); setBs(''); return }
      setPv(d); setS(2)
    } catch(e) { alert('请求异常: '+e.message) }
    setBs('')
  }

  const execute = async () => {
    setBs('执行中')
    const fd = new FormData(); fd.append('file', f); fd.append('mapping', JSON.stringify(mp)); fd.append('target', tt)
    try {
      const r = await api.post('/api/cleansing/execute-async', fd)
      const d = r.data
      if (!d.ok) { alert(d.error||'提交失败'); setBs(''); return }
      setBs('清洗中...')
      const poll = setInterval(async () => {
        try {
          const sr = await api.get('/api/cleansing/task/'+d.task_id)
          const sd = sr.data
          if (sd.status === 'done') { clearInterval(poll); setRes(sd.result); setS(3); setBs('') }
          else if (sd.status === 'error') { clearInterval(poll); alert('失败: '+sd.error); setBs('') }
        } catch { clearInterval(poll); setBs('') }
      }, 1000)
    } catch(e) { alert('请求异常: '+e.message); setBs('') }
  }

  const btn = (label, onClick, color='#1d4ed8') => <button onClick={onClick} disabled={!!bs}
    style={{padding:'8px 20px',background:bs?'#94a3b8':color,color:'#fff',border:'none',borderRadius:8,cursor:bs?'not-allowed':'pointer',fontSize:13,fontWeight:600}}>{label}</button>

  return <div className="card">
    <div className="step-indicator">
      {['上传文件','字段映射','预览确认','完成'].map((l,i) => <span key={i} className={'step'+(s===i?' active':'')+(s>i?' done':'')}>{s>i?'✓ ':''}{l}</span>)}
      {bs && <span className="step" style={{color:'#1d4ed8'}}>⏳ {bs}...</span>}
    </div>

    {s === 0 && <div style={{textAlign:'center',padding:40}}>
      <div style={{fontSize:28,marginBottom:12,opacity:.3}}>🧹</div>
      <label style={{display:'inline-block',padding:'10px 24px',background:'#1d4ed8',color:'#fff',borderRadius:10,cursor:'pointer',fontSize:14,fontWeight:600}}>
        {bs?'识别中...':'选择文件'}
        <input type="file" accept=".csv,.xlsx" style={{display:'none'}} onChange={e=>{const fi=e.target.files[0];if(fi)detect(fi)}} />
      </label>
      <div className="small muted" style={{marginTop:8}}>CSV / Excel · 中文列名自动匹配</div>
    </div>}

    {s === 1 && <div>
      <div style={{fontSize:13,marginBottom:12}}>已识别 {cols.length} 列 · {tr} 行 · 目标: {tt}</div>
      {cols.map(c => {
        const matched = ALIAS[c.name]
        const sf = SYS_FIELDS.find(x => x.t === matched)
        return <div key={c.name} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',border:'1px solid #f1f5f9',borderRadius:10,marginBottom:4}}>
        <div style={{flex:1,fontSize:13,fontWeight:500}}>
          {c.name}
          {matched && sf && <span className="small muted" style={{display:'block',fontSize:11}}>→ {sf.l} ({sf.t})</span>}
        </div>
        <div style={{fontSize:11,color:'#94a3b8',flexShrink:0}}>→</div>
        <select value={mp[c.name]?.target||''} onChange={e=>{const v=e.target.value;setMp(p=>({...p,[c.name]:{target:v||c.name,type:'string'}}))}} style={{flex:1,fontSize:12,padding:'6px 8px',border:'1px solid #e2e8f0',borderRadius:6}}>
          <option value="">不映射</option>
          {SYS_FIELDS.map(sf => <option key={sf.t} value={sf.t}>{sf.l}</option>)}
        </select>
        <select value={mp[c.name]?.type||'string'} onChange={e=>{const v=e.target.value;setMp(p=>({...p,[c.name]:{...p[c.name],type:v}}))}} style={{flexShrink:0,fontSize:11,padding:'5px',border:'1px solid #e2e8f0',borderRadius:6}}>
          <option value="string">文本</option><option value="number">数字</option><option value="date">日期</option>
        </select>
      </div>)}
      <div style={{marginTop:12,display:'flex',gap:8,justifyContent:'flex-end'}}>
        {btn('← 返回', ()=>{setS(0);setF(null);setCols([]);setMp({})}, '#64748b')}
        {btn('预览 →', preview)}
      </div>
    </div>}

    {s === 2 && pv && <div>
      <div className="section-title">清洗预览 · 前 {pv.preview?.length||0} 行 · 共 {pv.total} 行</div>
      {pv.preview?.length > 0 && <div style={{overflowX:'auto',marginBottom:12}}>
        <table><thead><tr>{Object.keys(pv.preview[0]).map(h=><th key={h}>{h}</th>)}</tr></thead>
        <tbody>{pv.preview.map((r,i)=><tr key={i}>{Object.values(r).map((v,j)=><td key={j}>{String(v||'')}</td>)}</tr>)}</tbody></table>
      </div>}
      <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
        {btn('← 返回', ()=>setS(1), '#64748b')}
        {btn('确认写入 ('+pv.total+' 条)', execute, '#059669')}
      </div>
    </div>}

    {s === 3 && res && <div style={{textAlign:'center',padding:40}}>
      <div style={{fontSize:32,marginBottom:8}}>{res.success>0?'✅':'⚠️'}</div>
      <div style={{fontWeight:700,fontSize:18,marginBottom:4}}>{res.success>0?'清洗完成':'清洗完成（无新增）'}</div>
      <div className="small muted" style={{marginBottom:16}}>{res.message||'目标: '+res.target+' · 文件: '+res.file}</div>
      <div style={{display:'flex',justifyContent:'center',gap:24,marginBottom:16}}>
        <div><div style={{fontSize:24,fontWeight:700,color:'#059669'}}>{res.success}</div><div className="small muted">成功</div></div>
        <div><div style={{fontSize:24,fontWeight:700,color:res.failed>0?'#e11d48':'#94a3b8'}}>{res.failed}</div><div className="small muted">跳过</div></div>
      </div>
      <button onClick={()=>{setS(0);setF(null);setCols([]);setTr(0);setMp({});setPv(null);setRes(null)}}
        style={{padding:'8px 20px',background:'#1d4ed8',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600}}>继续清洗下一份文件</button>
    </div>}
  </div>
}
