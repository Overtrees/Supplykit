import React, { useState, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { api } from '../api/client'
import EmptyState from '../components/EmptyState'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'

const API = import.meta.env.VITE_API_BASE_URL || 'https://overtrees.pythonanywhere.com'
const STATUSES = ['','已完成','待发货','已发货','待确认','申请退款']

function OrderSkeleton() {
  return <div>
    {[1,2,3,4,5].map(i => <div key={i} style={{display:'flex',gap:8,padding:'8px 0',borderBottom:'1px solid #f1f5f9'}}>
      <div className="skeleton" style={{width:80,height:14}}/><div className="skeleton" style={{width:60,height:14}}/>
      <div className="skeleton" style={{width:40,height:14}}/><div className="skeleton" style={{flex:1,height:14}}/>
      <div className="skeleton" style={{width:36,height:14}}/><div className="skeleton" style={{width:36,height:14}}/>
      <div className="skeleton" style={{width:50,height:14}}/>
    </div>)}
  </div>
}

export default function OrdersPage() {
  const toast = useToast()
  const { orders, orderTotal, orderPage, orderLoading, setOrderPage, setOrderFilter, orderSearch, orderStatus } = useAppStore()
  const [sq, setSq] = useState(orderSearch)
  const [ss, setSs] = useState(orderStatus)
  const [confirmDel, setConfirmDel] = useState(null)
  const [platformInv, setPlatformInv] = useState({})
  const totalPages = Math.max(1, Math.ceil(orderTotal / 8))

  const doSearch = () => setOrderFilter(sq, ss)

  // 加载平台仓库存（按 SKU+仓库 维度）
  useEffect(() => {
    api.get('/api/inventory?warehouse_type=platform').then(r => {
      const data = r.data?.items || r.data || []
      const map = {}
      data.forEach(i => {
        const key = i.sku + '|' + i.warehouse
        map[key] = { available: Number(i.available_qty || 0), transit: Number(i.in_transit_qty || 0) }
      })
      setPlatformInv(map)
    }).catch(() => {})
  }, [])

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
      <button onClick={async()=>{try{const r=await fetch(API+'/api/insights/export-orders');const b=await r.blob();const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='orders_'+new Date().toISOString().slice(0,10)+'.xlsx';document.body.appendChild(a);a.click();a.remove()}catch(e){toast.error('导出失败')}}}
        className="btn btn-ghost" style={{fontSize:12,padding:'4px 12px'}}>📥 导出</button>
    </div>

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
    {orderSearch && <div className="small muted" style={{marginBottom:8}}>搜索 "{orderSearch}" 共 {orderTotal} 条结果</div>}

    {orderLoading ? <OrderSkeleton />
    : orders.length === 0
      ? <EmptyState icon='📋' title={orderSearch?'无匹配订单':'暂无订单'} desc={orderSearch?'换个关键词试试':''} />
      : <div style={{overflowX:"auto"}}>
        <div style={{fontSize:11,color:'var(--muted2)',marginBottom:4}}>共 9 列 · 左右滑动查看</div>
      <table><thead><tr>{['订单号','店铺','仓库','商品','金额','状态','日期','平台可用','平台在途',''].map(h=><th key={h}>{h}</th>)}</tr></thead>
      <tbody>
        {orders.map(x => {
          const pi = platformInv[x.sku + '|' + x.warehouse] || {}
          return <tr key={x.id}>
          <td className="mono col-sku">{x.order_no}</td>
          <td className="col-store">{x.store||'-'}</td><td className="col-store">{x.warehouse||'-'}</td><td className="col-name">{x.product_name}</td>
          <td className="col-price">¥{Number(x.total_amount).toLocaleString()}</td>
          <td><span className={`pill ${x.order_status==='已完成'?'success':x.order_status==='待发货'?'warning':x.order_status==='已发货'?'info':x.order_status==='申请退款'?'danger':''}`}>{x.order_status}</span></td>
          <td className="col-date">{x.ordered_at}</td>
          <td className="col-qty" style={{fontWeight:600,color:pi.available>0?'var(--text)':'var(--muted2)'}} title={pi.available===undefined?'该仓库无库存数据':''}>{pi.available===undefined?'—':pi.available}</td>
          <td className="col-qty" style={{color:pi.transit>0?'var(--text)':'var(--muted2)'}} title={pi.transit===undefined?'该仓库无库存数据':''}>{pi.transit===undefined?'—':pi.transit}</td>
          <td><span onClick={()=>setConfirmDel(x.id)} className="btn btn-ghost" style={{fontSize:16,padding:'4px 8px',opacity:0.5,minHeight:0}} title='删除'>🗑️</span></td>
        </tr>
        })}
      </tbody></table>
    </div>}
    <ConfirmDialog open={!!confirmDel} title='删除订单' desc='删除后不可恢复' confirmLabel='删除' onConfirm={delOrder} onCancel={()=>setConfirmDel(null)} />

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