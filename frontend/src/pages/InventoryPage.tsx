import React, { useState, useMemo, useEffect, useRef } from 'react'
import { api } from '../api/client'
import EmptyState from '../components/EmptyState'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'
import { IconSearch, IconTrash, IconExport } from '../components/Icons'

const API = import.meta.env.VITE_API_BASE_URL || 'https://overtrees.pythonanywhere.com'
const COLS = [
  {id:'warehouse',label:'仓库'},{id:'sku',label:'SKU'},{id:'name',label:'商品'},
  {id:'begin',label:'期初库存'},{id:'transit',label:'在途'},{id:'month_in',label:'当月采购入库'},
  {id:'month_out',label:'当月出库'},{id:'avail',label:'可用'},{id:'turnover',label:'在库周转'},
]
const COL_KEY='c_cols_inventory'
const getVis=()=>{try{return JSON.parse(localStorage.getItem(COL_KEY)||'null')}catch{return null}}

export default function InventoryPage({ highlightSku }) {
  const toast = useToast()
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)
  const [visCols, setVisCols] = useState(() => getVis() || COLS.map(c => c.id))
  const [showPicker, setShowPicker] = useState(false)
  const [s, setS] = useState('')
  const [confirmDel, setConfirmDel] = useState(null)
  const [monthRange, setMonthRange] = useState('')

  const loadInv = async () => {
    setLoading(true)
    try {
      const r = await api.get('/api/insights/with-sales')
      const data = r.data || []
      setInventory(data)
      if (data.length > 0) {
        const s = data[0].month_start?.slice(5) || ''
        const e = data[0].month_end?.slice(5) || ''
        setMonthRange(`${s}至${e}`)
      }
    } catch(e) { setInventory([]) }
    setLoading(false)
  }
  useEffect(() => { loadInv() }, [])

  const fl = useMemo(() => {
    if (!s) return inventory
    const q = s.toLowerCase()
    return inventory.filter(x => (x.sku||'').toLowerCase().includes(q) || (x.product_name||'').toLowerCase().includes(q) || (x.store||'').toLowerCase().includes(q))
  }, [inventory, s])

  const totalTurnover = useMemo(() => {
    const valid = inventory.filter(x => x.turnover_days != null)
    return valid.length > 0
      ? (valid.reduce((s,x) => s + x.turnover_days, 0) / valid.length).toFixed(1)
      : null
  }, [inventory])

  const delInv = async () => {
    if (!confirmDel) return
    try {
      const r = await fetch(`${API}/api/inventory/${confirmDel}`, {method:'DELETE'})
      if (r.ok) { toast.success('已删除'); setConfirmDel(null); loadInv() }
      else toast.error('删除失败')
    } catch(e) { toast.error('删除失败: '+e.message) }
    setConfirmDel(null)
  }

  return <div className="card">
    <div className="section-title" style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
      <span>进销存 <span className="small muted">共 {inventory.length} 条</span></span>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <span onClick={()=>setShowPicker(!showPicker)} className="btn btn-ghost" style={{fontSize:11,padding:'2px 10px',cursor:'pointer'}}>列 {visCols.length}/{COLS.length}</span>
        <div className="search-bar" style={{maxWidth:200,flex:'none'}}>
          <IconSearch size={16} style={{color:'var(--muted2)',flexShrink:0}} />
          <input value={s} onChange={e=>setS(e.target.value)} placeholder="搜索SKU/商品名" enterKeyHint="search" autoCorrect="off" />
        </div>
        <button onClick={async()=>{try{const r=await fetch(API+'/api/insights/export-inventory');const b=await r.blob();const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='inventory_'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(a);a.click();a.remove()}catch(e){toast.error('导出失败')}}}
          className="btn btn-ghost" style={{fontSize:12,padding:'4px 12px',display:'flex',alignItems:'center',gap:4}}><IconExport size={14} /> 导出</button>
      </div>
    </div>
    {showPicker && <div style={{position:'absolute',zIndex:10,background:'var(--card)',border:'1px solid var(--border)',borderRadius:16,padding:8,minWidth:140,boxShadow:'0 4px 12px rgba(0,0,0,0.15)',right:0}}>
      {COLS.map(col=><label key={col.id} style={{display:'flex',alignItems:'center',gap:6,padding:'3px 4',fontSize:12,cursor:'pointer',whiteSpace:'nowrap'}}>
        <input type="checkbox" checked={visCols.includes(col.id)} onChange={e=>{const n=e.target.checked?[...visCols,col.id]:visCols.filter(c=>c!==col.id);setVisCols(n);localStorage.setItem(COL_KEY,JSON.stringify(n))}} style={{accentColor:'var(--primary)'}} />
        {col.label}
      </label>)}
      <div style={{borderTop:'1px solid var(--border)',marginTop:4,paddingTop:4}}>
        <span onClick={()=>{const d=COLS.map(c=>c.id);setVisCols(d);localStorage.setItem(COL_KEY,JSON.stringify(d));setShowPicker(false)}} className="btn btn-ghost" style={{fontSize:10,padding:'2px 8px',cursor:'pointer'}}>全部</span>
      </div>
    </div>}

    {loading ? <div>{[1,2,3,4].map(i=><div key={i} className="skeleton" style={{height:36,marginBottom:4}}/>)}</div>
    : fl.length === 0
      ? <EmptyState icon='package' title={s?'无匹配':'暂无数据'} desc={s?'换个关键词试试':'通过清洗导入数据'} />
      : <div style={{overflowX:"auto"}}>
        <div style={{fontSize:11,color:'var(--muted2)',marginBottom:4}}>显示 {visCols.length}/{COLS.length} 列</div>
      <table><colgroup>{COLS.map(col=><col key={col.id} style={visCols.includes(col.id)?{}:{display:'none'}} />)}</colgroup>
        <thead>
          <tr>{COLS.filter(c=>visCols.includes(c.id)).map(h => {
            if (h.id === 'month_in') return <th key={h.id}>{h.label}<br/><span className="small" style={{fontWeight:400}}>{monthRange}</span></th>
            if (h.id === 'month_out') return <th key={h.id}>{h.label}<br/><span className="small" style={{fontWeight:400}}>{monthRange}</span></th>
            return <th key={h.id}>{h.label}</th>
          })}</tr>
      </thead>
      <tbody>{fl.map(x => {
        const isHL = highlightSku && x.sku === highlightSku
        return <tr key={x.id} id={'hl-'+x.sku} style={isHL ? {background:'rgba(245,158,11,0.15)',outline:'2px solid #f59e0b'} : {}}>
        {COLS.filter(c=>visCols.includes(c.id)).map(c=>{
          if(c.id==='warehouse')return <td key={c.id} className="col-store">{x.warehouse||'-'}</td>
          if(c.id==='sku')return <td key={c.id} className="mono col-sku">{x.sku}</td>
          if(c.id==='name')return <td key={c.id} className="col-name">{x.product_name}</td>
          if(c.id==='begin')return <td key={c.id} className="col-qty" style={{fontWeight:600}}>{x.beginning_stock ?? '-'}</td>
          if(c.id==='transit')return <td key={c.id} className="col-qty">{x.in_transit_qty}</td>
          if(c.id==='month_in')return <td key={c.id} className="col-qty">{x.month_inbound ?? 0}</td>
          if(c.id==='month_out')return <td key={c.id} className="col-qty" style={{fontWeight:600}}>{x.month_outbound ?? 0}</td>
          if(c.id==='avail')return <td key={c.id} className="col-qty" style={{fontWeight:600}}>{x.available_qty}</td>
          if(c.id==='turnover')return <td key={c.id} className="col-qty" style={{fontWeight:600,color:x.turnover_days != null && x.turnover_days > 30 ? '#ef4444' : x.turnover_days != null && x.turnover_days > 15 ? 'var(--warning)' : 'var(--text)'}}>{x.turnover_days != null ? x.turnover_days+'天' : '∞'}</td>
          return null
        })}</tr>
      {totalTurnover != null && <tfoot>
        <tr style={{fontWeight:700,borderTop:'2px solid var(--border)'}}>
          <td colSpan={5} style={{textAlign:'right',fontSize:12}}>合计</td>
          <td>{inventory.reduce((s,x)=>s+(x.month_inbound||0),0)}</td>
          <td>{inventory.reduce((s,x)=>s+(x.month_outbound||0),0)}</td>
          <td>{inventory.reduce((s,x)=>s+(x.available_qty||0),0)}</td>
          <td style={{fontSize:13}}>{totalTurnover} 天</td>
          <td></td>
        </tr>
      </tfoot>}
              </table>
    </div>}
    <ConfirmDialog open={!!confirmDel} title='删除库存记录' desc='删除后不可恢复' confirmLabel='删除' onConfirm={delInv} onCancel={()=>setConfirmDel(null)} />
  </div>
}
