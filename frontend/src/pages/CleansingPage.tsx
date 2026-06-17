import React, { useState, useEffect } from 'react'
import { api } from '../api/client'
import { useToast } from '../components/Toast'

const API = import.meta.env.VITE_API_BASE_URL || 'https://overtrees.pythonanywhere.com'
const INV_FIELDS = [
  {t:'sku',l:'SKU',tp:'string'},{t:'product_name',l:'商品名称',tp:'string'},
  {t:'store',l:'店铺',tp:'string'},{t:'warehouse',l:'仓库',tp:'string'},
  {t:'available_qty',l:'可用库存',tp:'number'},{t:'locked_qty',l:'锁定库存',tp:'number'},
  {t:'in_transit_qty',l:'在途',tp:'number'},{t:'safety_qty',l:'安全线',tp:'number'},
]
const SYS_FIELDS = [
  {t:'order_no',l:'订单号',tp:'string'},{t:'source_order_id',l:'原始单号',tp:'string'},
  {t:'store',l:'店铺',tp:'string'},{t:'warehouse',l:'仓库',tp:'string'},
  {t:'sku',l:'SKU',tp:'string'},{t:'product_name',l:'商品名称',tp:'string'},
  {t:'quantity',l:'数量',tp:'number'},{t:'unit_price',l:'单价',tp:'number'},{t:'total_amount',l:'金额',tp:'number'},
  {t:'order_status',l:'状态',tp:'string'},{t:'ordered_at',l:'订购时间',tp:'date'},
  {t:'supplier',l:'供应商',tp:'string'},{t:'supplier_code',l:'供应商编码',tp:'string'},
  {t:'remark',l:'备注',tp:'string'},{t:'platform',l:'平台',tp:'string'},
  {t:'paid_at',l:'付款时间',tp:'date'},{t:'shipped_at',l:'发货时间',tp:'date'},
  {t:'sender',l:'收货人',tp:'string'},{t:'sender_phone',l:'收货电话',tp:'string'},
  {t:'currency',l:'币种',tp:'string'},{t:'discount',l:'折扣',tp:'number'},
  {t:'freight',l:'运费',tp:'number'},{t:'category',l:'分类',tp:'string'},
  {t:'brand',l:'品牌',tp:'string'},{t:'spec',l:'规格',tp:'string'},
]
const ALIAS = {
  "订单号":"order_no","订单编号":"order_no","采购单号":"order_no",
  "原始单号":"source_order_id","外部单号":"source_order_id","平台订单号":"source_order_id",
  "商品编号":"sku","货号":"sku","SKU":"sku",
  "商品名称":"product_name","产品名称":"product_name","名称":"product_name",
  "数量":"quantity","采购数量":"quantity","订货数量":"quantity","原始采购数量":"quantity",
  "单价":"unit_price","价格":"unit_price","采购价格":"unit_price",
  "金额":"total_amount","总金额":"total_amount","采购金额":"total_amount","实收金额":"total_amount",
  "店铺":"store","店铺名":"store","门店":"store",
  "仓库":"warehouse","京东仓库":"warehouse","发货仓":"warehouse",
  "状态":"order_status","订单状态":"order_status",
  "日期":"ordered_at","订购时间":"ordered_at","下单时间":"ordered_at","入库时间":"paid_at",
  "供应商":"supplier","供应商名称":"supplier","供应商简码":"supplier_code",
  "备注":"remark",
  "平台":"platform","订单来源":"platform","来源":"platform",
  "收货人":"sender","收货负责人":"sender",
  "收货电话":"sender_phone","电话":"sender_phone",
  "币种":"currency","货币":"currency",
  "品牌":"brand",
  "规格":"spec",
  "分类":"category","商品分类":"category",
}

export default function CleansingPage() {
  const toast = useToast()
  const [s,setS] = useState(0)
  const [f,setF] = useState(null)
  const [cols,setCols] = useState([])
  const [tr,setTr] = useState(0)
  const [tt,setTt] = useState('order')
  const [mp,setMp] = useState({})
  const [pv,setPv] = useState(null)
  const [res,setRes] = useState(null)
  const [bs,setBs] = useState('')
  const [cf,setCf] = useState(JSON.parse(localStorage.getItem('c_cf')||'[]'))
  const [templates, setTemplates] = useState([])
  const saveCf = (v) => { setCf(v); localStorage.setItem('c_cf', JSON.stringify(v)) }

  const loadTemplates = async () => { try { const r = await api.get('/api/cleansing/templates'); setTemplates(r.data || []) } catch(e) {} }
  useEffect(() => { loadTemplates() }, [])

  const addField = () => saveCf([...cf, {t:'field_'+Date.now(), l:'自定义字段', tp:'string'}])
  const delField = (i) => saveCf(cf.filter((_,k) => k !== i))

  const detect = async (file) => {
    setF(file); setBs('识别中')
    const fd = new FormData(); fd.append('file', file)
    try {
      const r = await api.post('/api/cleansing/detect', fd)
      const d = r.data
      if (!d.ok) { toast.error(d.error||'识别失败'); setBs(''); return }
      setCols(d.columns||[]); setTr(d.total||0)
      const a = {}
      let mappedCount = 0
      ;(d.columns||[]).forEach(c => {
        const key = ALIAS[c.name]
        if (key) { a[c.name] = { target: key, type: 'string' }; mappedCount++ }
      })
      if (Object.keys(a).length > 0) setMp(a)
      setS(1)
      // 所有列都自动匹配到 → 直接进预览（用 a 而非 mp，避免 state 闭包问题）
      if ((d.columns||[]).length > 0 && mappedCount === (d.columns||[]).length) {
        setMp(a)
        setBs('预览中')
        const fd2 = new FormData(); fd2.append('file', file); fd2.append('mapping', JSON.stringify(a)); fd2.append('target', tt)
        try {
          const r2 = await api.post('/api/cleansing/preview', fd2)
          const d2 = r2.data
          if (!d2.ok) { toast.error(d2.error||'预览失败'); setBs(''); return }
          setPv(d2); setS(2)
        } catch(e) { toast.error('请求异常: '+e.message) }
        setBs('')
      }
    } catch(e) { toast.error('请求异常: '+e.message) }
    setBs('')
  }

  const preview = async () => {
    setBs('预览中')
    const fd = new FormData(); fd.append('file', f); fd.append('mapping', JSON.stringify(mp)); fd.append('target', tt)
    try {
      const r = await api.post('/api/cleansing/preview', fd)
      const d = r.data
      if (!d.ok) { toast.error(d.error||'预览失败'); setBs(''); return }
      setPv(d); setS(2)
    } catch(e) { toast.error('请求异常: '+e.message) }
    setBs('')
  }

  const doExecute = async () => {
    setBs('清洗中...')
    const fd = new FormData(); fd.append('file', f); fd.append('mapping', JSON.stringify(mp)); fd.append('target', tt)
    try {
      const r = await api.post('/api/cleansing/execute-async', fd)
      const d = r.data
      if (!d.ok) { toast.error(d.error||'提交失败'); setBs(''); return }
      const totalRows = d.total_rows || '?'
      const poll = setInterval(async () => {
        try {
          const sr = await api.get('/api/cleansing/task/'+d.task_id)
          const sd = sr.data
          if (sd.status === 'done') { clearInterval(poll); setRes(sd.result); setS(3); setBs(''); toast.success('清洗完成') }
          else if (sd.status === 'error') { clearInterval(poll); toast.error('失败: '+sd.error); setBs('') }
          else if (sd.progress !== undefined) { setBs(`清洗中... ${sd.progress}% (${Math.round(sd.progress/100*totalRows)}/${totalRows}条)`) }
        } catch { clearInterval(poll); setBs('') }
      }, 1000)
    } catch(e) { toast.error('请求异常: '+e.message); setBs('') }
  }

  // 一键执行（跳过预览）
  const quickExecute = async () => {
    setBs('执行中')
    const fd = new FormData(); fd.append('file', f); fd.append('mapping', JSON.stringify(mp)); fd.append('target', tt)
    try {
      const r = await api.post('/api/cleansing/preview', fd)
      const d = r.data
      if (!d.ok) { toast.error(d.error||'提交失败'); setBs(''); return }
      setPv(d)
      // 确认预览正常后直接写入
      doExecute()
    } catch(e) { toast.error('请求异常: '+e.message); setBs('') }
  }

  // 记忆上次映射
  useEffect(() => {
    const saved = localStorage.getItem('c_last_tt')
    if (saved) setTt(saved)
  }, [])
  useEffect(() => {
    localStorage.setItem('c_last_tt', tt)
  }, [tt])

  const btn = (label, onClick, color='var(--primary)') => <button onClick={onClick} disabled={!!bs}
    style={{padding:'8px 20px',background:bs?'var(--muted2)':color,color:'var(--card)',border:'none',borderRadius:8,cursor:bs?'not-allowed':'pointer',fontSize:13,fontWeight:600}}>{label}</button>

  return <div className="card">
    <div className="step-indicator">
      {['上传文件','字段映射','预览确认','完成'].map((l,i) => <span key={i} className={'step'+(s===i?' active':'')+(s>i?' done':'')}>{s>i?'✓ ':''}{l}</span>)}
      {bs && <span className="step" style={{color:'var(--primary)'}}>⏳ {bs}...</span>}
    </div>

    {s === 0 && <div style={{textAlign:'center',padding:40}}>
      <div style={{fontSize:28,marginBottom:12,opacity:.3}}>🧹</div>
      <div style={{display:'flex',justifyContent:'center',gap:8,marginBottom:12}}>
        <button onClick={()=>setTt('order')} style={{padding:'6px 16px',fontSize:12,borderRadius:99,border:'1px solid',cursor:'pointer',background:tt==='order'?'var(--primary)':'var(--card)',color:tt==='order'?'#fff':'var(--muted)',borderColor:tt==='order'?'var(--primary)':'var(--border)',fontWeight:tt==='order'?600:400}}>📋 导入订单</button>
        <button onClick={()=>setTt('inventory')} style={{padding:'6px 16px',fontSize:12,borderRadius:99,border:'1px solid',cursor:'pointer',background:tt==='inventory'?'var(--success)':'var(--card)',color:tt==='inventory'?'#fff':'var(--muted)',borderColor:tt==='inventory'?'var(--success)':'var(--border)',fontWeight:tt==='inventory'?600:400}}>📦 导入库存</button>
      </div>
      <label style={{display:'inline-block',padding:'10px 24px',background:'var(--primary)',color:'var(--card)',borderRadius:10,cursor:'pointer',fontSize:14,fontWeight:600}}>
        {bs?'识别中...':'选择文件'}
        <input type="file" accept=".csv,.xlsx" style={{display:'none'}} onChange={e=>{const fi=e.target.files[0];if(fi)detect(fi)}} />
      </label>
      <div className="small muted" style={{marginTop:8}}>CSV / Excel · 中文列名自动匹配</div>
    </div>}

    {s === 1 && <div>
      <div style={{fontSize:13,marginBottom:12}}>已识别 {cols.length} 列 · {tr} 行 · 目标: {tt}{tt==='order' && <span style={{marginLeft:8,display:'inline-flex',gap:4,verticalAlign:'middle'}}>
        <span onClick={()=>setMp(p=>({...p,_meta:{data_source:'jdzx_sale'}}))} style={{padding:'2px 8px',fontSize:11,borderRadius:99,border:'1px solid',cursor:'pointer',background:mp?._meta?.data_source==='jdzx_sale'?'var(--primary)':'var(--card)',color:mp?._meta?.data_source==='jdzx_sale'?'#fff':'var(--muted)',borderColor:mp?._meta?.data_source==='jdzx_sale'?'var(--primary)':'var(--border)'}}>📈 商智日销</span>
        <span onClick={()=>setMp(p=>({...p,_meta:{data_source:'jd_po'}}))} style={{padding:'2px 8px',fontSize:11,borderRadius:99,border:'1px solid',cursor:'pointer',background:mp?._meta?.data_source==='jd_po'?'var(--primary)':'var(--card)',color:mp?._meta?.data_source==='jd_po'?'#fff':'var(--muted)',borderColor:mp?._meta?.data_source==='jd_po'?'var(--primary)':'var(--border)'}}>📦 京东采购单</span>
      </span>}</div>
      {/* 模板区域 */}
      <div style={{display:'flex',gap:8,marginBottom:12,alignItems:'center',flexWrap:'wrap'}}>
        <select id="tmplSelect" style={{flex:1,fontSize:12,padding:'6px 8px',border:'1px solid #e2e8f0',borderRadius:6,minWidth:140}}>
          <option value="">加载映射模板...</option>
          {Array.isArray(templates) && templates.filter(t => t.doc_type === tt).map(t => <option key={t.id} value={JSON.stringify(t.mapping)}>{t.name}</option>)}
          {Array.isArray(templates) && templates.filter(t => t.doc_type !== tt).length > 0 && <option disabled style={{color:'var(--muted2)',fontSize:11}}>── {tt==='order'?'库存':'订单'}模板（{templates.filter(t=>t.doc_type!==tt).length}个） ──</option>}
        </select>
        <button onClick={()=>{const s=document.getElementById('tmplSelect');if(s.value)try{setMp(JSON.parse(s.value))}catch(e){}}} style={{padding:'6px 14px',fontSize:12,border:'1px solid #e2e8f0',borderRadius:6,background:'var(--card)',cursor:'pointer'}}>应用</button>
        <input id="tmplName" placeholder="新模板名称" style={{width:120,fontSize:12,padding:'6px 8px',border:'1px solid #e2e8f0',borderRadius:6,outline:'none'}}/>
        <button onClick={async()=>{const n=document.getElementById('tmplName').value;if(!n)return toast.error('请输入模板名称');await api.post('/api/cleansing/templates',{name:n,doc_type:tt,mapping:mp});document.getElementById('tmplName').value='';loadTemplates();toast.success('模板已保存')}} style={{padding:'6px 14px',fontSize:12,background:'var(--primary)',color:'var(--card)',border:'none',borderRadius:6,cursor:'pointer'}}>保存</button>
      </div>
      {Array.isArray(cf) && <div style={{marginBottom:10,border:'1px solid #e2e8f0',borderRadius:12,padding:12,background:'var(--bg)'}}>
        <div style={{fontSize:12,fontWeight:600,marginBottom:8}}>自定义字段</div>
        {cf.map((f,i) => <div key={i} style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
          <input value={f.l} onChange={e=>{const v=e.target.value;setCf(p=>p.map((x,k)=>k===i?{...x,l:v}:x))}} placeholder="字段名" style={{flex:1,fontSize:12,padding:'5px 8px',border:'1px solid #e2e8f0',borderRadius:6,outline:'none'}}/>
          <select value={f.tp} onChange={e=>{const v=e.target.value;setCf(p=>p.map((x,k)=>k===i?{...x,tp:v}:x))}} style={{fontSize:11,padding:'5px',border:'1px solid #e2e8f0',borderRadius:6}}>
            <option value="string">文本</option><option value="number">数字</option><option value="date">日期</option>
          </select>
          <button onClick={()=>delField(i)} style={{background:'rgba(225,29,72,0.12)',border:'none',borderRadius:6,cursor:'pointer',padding:'4px 8px',fontSize:12,color:'var(--danger)'}}>删除</button>
        </div>)}
        <button onClick={addField} style={{padding:'5px 14px',fontSize:12,border:'1px dashed #94a3b8',borderRadius:8,background:'var(--card)',cursor:'pointer',color:'var(--muted)',width:'100%'}}>+ 添加自定义字段</button>
      </div>}
      {cols.map(c => {
        const matched = ALIAS[c.name]
        const sf = SYS_FIELDS.find(x => x.t === matched)
        return <div key={c.name} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',border:'1px solid #f1f5f9',borderRadius:10,marginBottom:4}}>
        <div style={{flex:1,fontSize:13,fontWeight:500}}>
          {c.name}
          {matched && sf && <span className="small muted" style={{display:'block',fontSize:11}}>→ {sf.l} ({sf.t})</span>}
        </div>
        <div style={{fontSize:11,color:'var(--muted2)',flexShrink:0}}>→</div>
        <select value={mp[c.name]?.target||''} onChange={e=>{const v=e.target.value;const matchedCf=cf.find(f=>f.t===v);setMp(p=>({...p,[c.name]:{target:v||c.name,type:matchedCf?matchedCf.tp:'string'}}))}} style={{flex:1,fontSize:12,padding:'6px 8px',border:'1px solid #e2e8f0',borderRadius:6}}>
          <option value="">不映射</option>
          <optgroup label="系统字段">{(tt==='inventory'?INV_FIELDS:SYS_FIELDS).map(sf => <option key={sf.t} value={sf.t}>{sf.l}</option>)}</optgroup>
          {cf.length > 0 && <optgroup label="自定义字段">{cf.map(f => <option key={f.t} value={f.t}>{f.l}</option>)}</optgroup>}
        </select>
        <select value={mp[c.name]?.type||''} onChange={e=>{const v=e.target.value;setMp(p=>({...p,[c.name]:{...p[c.name],type:v}}))}} style={{flexShrink:0,fontSize:11,padding:'5px',border:'1px solid #e2e8f0',borderRadius:6}}>
          <option value="string">文本</option><option value="number">数字</option><option value="date">日期</option>
        </select>
      </div>})}
      <div style={{marginTop:12,display:'flex',gap:8,justifyContent:'flex-end'}}>
        {btn('← 返回', ()=>{setS(0);setF(null);setCols([]);setMp({})}, 'var(--muted)')}
        <div style={{flex:1}}></div>
        {btn('一键执行 ⚡', quickExecute, 'var(--success)')}
        {btn('预览 →', preview)}
      </div>
    </div>}

    {s === 2 && pv && <div>
      <div className="section-title">清洗预览 · 前 {pv.preview?.length||0} 行{pv.total > 50 ? <span className="small muted"> · 共 {pv.total} 行，仅展示前 50 行</span> : ''}</div>
      {pv.preview?.length > 0 && <div style={{overflowX:"auto",marginBottom:12}}>
        {(() => { const keys = Object.keys(pv.preview[0]).filter(k => k !== '_source'); return <>
        <table><thead><tr>{keys.map(h=>{
          const sf = SYS_FIELDS.find(x => x.t === h) || cf.find(x => x.t === h)
          return <th key={h}>{sf ? sf.l : h}</th>
        })}</tr></thead>
        <tbody>{pv.preview.map((r,i)=><tr key={i}>{keys.map(k=><td key={k}>{String(r[k]||'')}</td>)}</tr>)}</tbody></table>
        </>})()}
      </div>}
      <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
        {btn('← 返回', ()=>setS(1), 'var(--muted)')}
        {btn('确认写入 ('+pv.total+' 条)', doExecute, 'var(--success)')}
      </div>
    </div>}

    {s === 3 && res && <div style={{textAlign:'center',padding:40}}>
      <div style={{fontSize:32,marginBottom:8}}>{res.success>0?'✅':'⚠️'}</div>
      <div style={{fontWeight:700,fontSize:18,marginBottom:4}}>{res.success>0?'清洗完成':'清洗完成（无新增）'}</div>
      <div className="small muted" style={{marginBottom:16}}>{res.message||'目标: '+res.target+' · 文件: '+res.file}</div>
      <div style={{display:'flex',justifyContent:'center',gap:24,marginBottom:16}}>
        <div><div style={{fontSize:24,fontWeight:700,color:'var(--success)'}}>{res.success}</div><div className="small muted">成功</div></div>
        <div><div style={{fontSize:24,fontWeight:700,color:res.failed>0?'var(--danger)':'var(--muted2)'}}>{res.failed}</div><div className="small muted">跳过</div></div>
      </div>
      <div style={{display:'flex',gap:8,justifyContent:'center'}}>
        <button onClick={()=>{setS(0);setF(null);setCols([]);setTr(0);setMp({});setPv(null);setRes(null)}}
          style={{padding:'8px 20px',background:'var(--muted)',color:'var(--card)',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600}}>重新开始</button>
        <label style={{display:'inline-block',padding:'8px 20px',background:'var(--success)',color:'var(--card)',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600}}>
          导入相同格式 📁
          <input type="file" accept=".csv,.xlsx" style={{display:'none'}} onChange={e=>{
            const fi=e.target.files[0]
            if(fi){setF(fi);setBs('识别中');setS(1);detect(fi)}
          }}/>
        </label>
      </div>
    </div>}
  </div>
}
