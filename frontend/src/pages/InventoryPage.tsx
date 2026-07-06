import React, { useState, useMemo, useEffect } from 'react'
import { api } from '../api/client'
import EmptyState from '../components/EmptyState'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'

const API = import.meta.env.VITE_API_BASE_URL || 'https://overtrees.pythonanywhere.com'

export default function InventoryPage({ highlightSku }) {
  const toast = useToast()
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)
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
        <div className="search-bar" style={{maxWidth:200,flex:'none'}}>
          <span style={{fontSize:16,color:'var(--muted2)',flexShrink:0}}>🔍</span>
          <input value={s} onChange={e=>setS(e.target.value)} placeholder="搜索SKU/商品名" enterKeyHint="search" autoCorrect="off" />
        </div>
        <button onClick={async()=>{try{const r=await fetch(API+'/api/insights/export-inventory');const b=await r.blob();const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='inventory_'+new Date().toISOString().slice(0,10)+'.xlsx';document.body.appendChild(a);a.click();a.remove()}catch(e){toast.error('导出失败')}}}
          className="btn btn-ghost" style={{fontSize:12,padding:'4px 12px'}}>📥 导出</button>
      </div>
    </div>

    {loading ? <div>{[1,2,3,4].map(i=><div key={i} className="skeleton" style={{height:36,marginBottom:4}}/>)}</div>
    : fl.length === 0
      ? <EmptyState icon='📦' title={s?'无匹配':'暂无数据'} desc={s?'换个关键词试试':'通过清洗导入数据'} />
      : <div style={{overflowX:"auto"}}>
        <div style={{fontSize:11,color:'var(--muted2)',marginBottom:4}}>共 11 列 · 左右滑动查看</div>
      <table>
        <thead>
          <tr>{['仓库','SKU','商品','可用','在途','安全线','日销','当月采购入库','当月出库','在库周转',''].map(h => {
            if (h === '当月采购入库') return <th key={h}>{h}<br/><span className="small" style={{fontWeight:400}}>{monthRange}</span></th>
            if (h === '当月出库') return <th key={h}>{h}<br/><span className="small" style={{fontWeight:400}}>{monthRange}</span></th>
            return <th key={h}>{h}</th>
          })}</tr>
      </thead>
      <tbody>{fl.map(x => {
        const isHL = highlightSku && x.sku === highlightSku
        return <tr key={x.id} id={'hl-'+x.sku} style={isHL ? {background:'rgba(245,158,11,0.15)',outline:'2px solid #f59e0b'} : {}}>
        <td className="col-store">{x.warehouse||'-'}</td>
        <td className="mono col-sku">{x.sku}</td><td className="col-name">{x.product_name}</td>
        <td className="col-qty" style={{fontWeight:600}}>{x.available_qty}</td>
        <td className="col-qty">{x.in_transit_qty}</td>
        <td className="col-qty">{x.safety_qty}</td>
        <td className="col-qty" style={{fontSize:12,fontWeight:600}}>{x.daily_sales}</td>
        <td className="col-qty">{x.month_inbound ?? 0}</td>
        <td className="col-qty" style={{fontWeight:600}}>{x.month_outbound ?? 0}</td>
        <td className="col-qty" style={{fontWeight:600,color:x.turnover_days != null && x.turnover_days > 30 ? '#ef4444' : x.turnover_days != null && x.turnover_days > 15 ? 'var(--warning)' : 'var(--text)'}}>{x.turnover_days != null ? x.turnover_days+'天' : '∞'}</td>
        <td><span onClick={()=>setConfirmDel(x.id)} className="btn btn-ghost" style={{fontSize:16,padding:'4px 8px',opacity:0.5,minHeight:0}} title='删除'>🗑️</span></td>
      </tr>})}</tbody>
      {totalTurnover != null && <tfoot>
        <tr style={{fontWeight:700,borderTop:'2px solid var(--border)'}}>
          <td colSpan={7} style={{textAlign:'right',fontSize:12}}>合计</td>
          <td>{inventory.reduce((s,x)=>s+(x.month_inbound||0),0)}</td>
          <td>{inventory.reduce((s,x)=>s+(x.month_outbound||0),0)}</td>
          <td style={{fontSize:13}}>{totalTurnover} 天</td>
          <td></td>
        </tr>
      </tfoot>}
    </div>}
    <ConfirmDialog open={!!confirmDel} title='删除库存记录' desc='删除后不可恢复' confirmLabel='删除' onConfirm={delInv} onCancel={()=>setConfirmDel(null)} />
  </div>
}