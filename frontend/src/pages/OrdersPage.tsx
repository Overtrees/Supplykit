import React, { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import EmptyState from '../components/EmptyState'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'

const API = import.meta.env.VITE_API_BASE_URL || 'https://overtrees.pythonanywhere.com'

const STATUSES = ['','已完成','待发货','已发货','待确认','申请退款']

export default function OrdersPage() {
  const toast = useToast()
  const { orders, orderTotal, orderPage, setOrderPage, setOrderFilter, orderSearch, orderStatus } = useAppStore()
  const [sq, setSq] = useState(orderSearch)
  const [ss, setSs] = useState(orderStatus)
  const [confirmDel, setConfirmDel] = useState(null)
  const totalPages = Math.max(1, Math.ceil(orderTotal / 8))

  const doSearch = () => setOrderFilter(sq, ss)

  const delOrder = async () => {
    if (!confirmDel) return
    try {
      const r = await fetch(`${API}/api/orders/${confirmDel}`, {method:'DELETE'})
      if (r.ok) { toast.success('已删除'); setConfirmDel(null); setOrderPage(orderPage, sq, ss) }
      else toast.error('删除失败')
    } catch(e) { toast.error('删除失败: '+e.message) }
    setConfirmDel(null)
  }

  return <div className="card">
    <div className="section-title" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <span>订单 <span className="small muted">共 {orderTotal} 条</span></span>
    </div>

    {/* iOS 风格搜索栏 */}
    <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
      <div className="search-bar">
        <span style={{fontSize:16,color:'var(--muted2)',flexShrink:0}}>🔍</span>
        <input value={sq} onChange={e=>setSq(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')doSearch()}}
          placeholder="搜索单号/商品/SKU" enterKeyHint="search" inputMode="search" autoCorrect="off" />
        {sq && <span className="cancel" onClick={()=>{setSq('');doSearch()}}>清除</span>}
      </div>
      <select value={ss} onChange={e=>{setSs(e.target.value);setOrderFilter(sq,e.target.value)}} style={{fontSize:16,padding:'8px 12px',border:'1px solid var(--border)',borderRadius:10,outline:'none',background:'var(--card)'}}>
        {STATUSES.map(s => <option key={s} value={s}>{s||'全部状态'}</option>)}
      </select>
      {(orderSearch||orderStatus) && <button onClick={()=>{setSq('');setSs('');setOrderFilter('','')}} className="btn btn-ghost" style={{fontSize:14}}>重置</button>}
    </div>
    {/* 结果计数 */}
    {orderSearch && <div className="small muted" style={{marginBottom:8}}>搜索 "{orderSearch}" 共 {orderTotal} 条结果</div>}

    {orders.length === 0
      ? <EmptyState icon='📋' title={orderSearch?'无匹配订单':'暂无订单'} desc={orderSearch?'换个关键词试试':''} />
      : <div style={{overflowX:"auto"}}>
      <table><thead><tr>{['订单号','店铺','仓库','商品','金额','状态','日期',''].map(h=><th key={h}>{h}</th>)}</tr></thead>
      <tbody>
        {orders.map(x => <tr key={x.id}>
          <td className="mono col-sku">{x.order_no}</td>
          <td className="col-store">{x.store||'-'}</td><td className="col-store">{x.warehouse||'-'}</td><td className="col-name">{x.product_name}</td>
          <td className="col-price">¥{Number(x.total_amount).toLocaleString()}</td>
          <td><span className={`pill ${x.order_status==='已完成'?'success':x.order_status==='待发货'?'warning':x.order_status==='已发货'?'info':x.order_status==='申请退款'?'danger':''}`}>{x.order_status}</span></td>
          <td className="col-date">{x.ordered_at}</td>
          <td><span onClick={()=>setConfirmDel(x.id)} style={{cursor:'pointer',fontSize:18,opacity:0.4,padding:'8px'}} title='删除'>🗑️</span></td>
        </tr>)}
      </tbody></table>
    </div>}
    <ConfirmDialog open={!!confirmDel} title='删除订单' desc='删除后不可恢复' confirmLabel='删除' onConfirm={delOrder} onCancel={()=>setConfirmDel(null)} />

    {/* 分页 */}
    {orderTotal > 8 && <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,marginTop:12,flexWrap:'wrap'}}>
      <button onClick={()=>setOrderPage(1)} disabled={orderPage<=1} className="btn btn-ghost" style={{fontSize:11,padding:'4px 8px'}}>‹‹</button>
      <button onClick={()=>setOrderPage(orderPage-1)} disabled={orderPage<=1} className="btn btn-ghost" style={{fontSize:11,padding:'4px 8px'}}>‹</button>
      <span className="small muted" style={{fontSize:12}}>第 {orderPage}/{totalPages} 页</span>
      <button onClick={()=>setOrderPage(orderPage+1)} disabled={orderPage>=totalPages} className="btn btn-ghost" style={{fontSize:11,padding:'4px 8px'}}>›</button>
      <button onClick={()=>setOrderPage(totalPages)} disabled={orderPage>=totalPages} className="btn btn-ghost" style={{fontSize:11,padding:'4px 8px'}}>››</button>
      <span style={{display:'flex',alignItems:'center',gap:4}}>
        <span className="small muted">跳至</span>
        <input type="number" min={1} max={totalPages} defaultValue={orderPage}
          onKeyDown={e=>{if(e.key==='Enter'){const v=parseInt(e.target.value);if(v>=1&&v<=totalPages)setOrderPage(v)}}}
          style={{width:50,fontSize:12,padding:'4px 6px',border:'1px solid var(--border)',borderRadius:6,textAlign:'center'}} />
        <span className="small muted">页</span>
      </span>
    </div>}
  </div>
}
