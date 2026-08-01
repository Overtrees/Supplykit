import React, { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'
import EmptyState from '../components/EmptyState'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'

const COLS = [
  {id:'order_no',label:'订单号'},{id:'barcode',label:'69码'},{id:'store',label:'店铺'},{id:'warehouse',label:'仓库'},
  {id:'product',label:'商品'},{id:'amount',label:'金额'},{id:'status',label:'状态'},
  {id:'date',label:'日期'},
]
const COL_KEY = () => 'c_cols_orders_' + (useAppStore.getState().channel || 'jd')
const getVis=()=>{try{return JSON.parse(localStorage.getItem(COL_KEY())||'null')}catch{return null}}

function OrderSkeleton() {
  return <div>
    {[1,2,3,4,5].map(i => <div key={i} style={{display:'flex',gap:8,padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
      <div className="skeleton" style={{width:80,height:14}}/><div className="skeleton" style={{width:60,height:14}}/>
      <div className="skeleton" style={{width:40,height:14}}/><div className="skeleton" style={{flex:1,height:14}}/>
      <div className="skeleton" style={{width:36,height:14}}/><div className="skeleton" style={{width:36,height:14}}/>
      <div className="skeleton" style={{width:50,height:14}}/>
    </div>)}
  </div>
}

export default function OrdersPage() {
  const toast = useToast()
  const { orders, orderPage, orderLoading, setOrderPage, orderStatus, dataLoaded, channel, hammerCols, hammerSearch } = useAppStore()
  useEffect(() => { useAppStore.getState().loadAll() }, [channel])
  const [confirmDel, setConfirmDel] = useState(null)
  const [visCols, setVisCols] = useState(() => getVis(COL_KEY()) || COLS.map(c => c.id))
  useEffect(() => { if (hammerCols?.orders) setVisCols(hammerCols.orders) }, [hammerCols])
  // 搜索/筛选变化时重置到第1页
  useEffect(() => { setOrderPage(1) }, [hammerSearch, orderStatus, setOrderPage])
  const PAGE_SIZE = 8
  const s = hammerSearch || ''
  const st = orderStatus || ''
  const filtered = orders.filter(x =>
    (!s || (x.order_no||'').includes(s) || (x.product_name||'').includes(s) || (x.sku||'').includes(s)) &&
    (!st || x.order_status === st)
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageData = filtered.slice((orderPage-1)*PAGE_SIZE, orderPage*PAGE_SIZE)

  // 加载平台仓库存（按 SKU+仓库 维度）
  const delOrder = async () => {
    if (!confirmDel) return
    try {
      const API = import.meta.env.VITE_API_BASE_URL || 'https://overtrees.pythonanywhere.com'
      const r = await fetch(`${API}/api/orders/${confirmDel}`, {method:'DELETE'})
      if (r.ok) { toast.success('已删除'); setConfirmDel(null); useAppStore.getState().loadAll() }
      else toast.error('删除失败')
    } catch(e) { toast.error('删除失败: '+e.message) }
    setConfirmDel(null)
  }

  return <div>
    {s !== '' && <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:8,flexWrap:'wrap'}}>
      <span className="small muted">搜索 "{s}"</span>
      {st && <span className="pill info">{st}</span>}
    </div>}

    <div className="card">
    <div style={{fontSize:18,fontWeight:700,marginBottom:8}}>订单 <span className="small muted" style={{fontWeight:400}}>共 {filtered.length} 条</span></div>
    {orderLoading || !dataLoaded ? <OrderSkeleton />
    : filtered.length === 0
      ? <EmptyState icon='clipboard' title={s?'无匹配订单':'暂无订单'} desc={s?'换个关键词试试':''} />
      : <div style={{overflowX:"auto"}}>
        <div style={{fontSize:11,color:'var(--muted2)',marginBottom:4}}>显示 {visCols.length}/{COLS.length} 列</div>
      <table><colgroup>{visCols.map(id=>{const col=COLS.find(c=>c.id===id);return col?<col key={col.id} />:null})}</colgroup>
      <thead><tr>{visCols.map(id=>{const col=COLS.find(c=>c.id===id);return col?<th key={col.id}>{col.label}</th>:null})}</tr></thead>
      <tbody>
        {pageData.map(x => {
          return <tr key={x.id}>{visCols.map(id=>{const col=COLS.find(c=>c.id===id);if(!col)return null;
            if(col.id==='order_no')return <td key={col.id} className="mono col-sku">{x.order_no}</td>
            if(col.id==='store')return <td key={col.id} className="col-store">{x.store||'-'}</td>
            if(col.id==='warehouse')return <td key={col.id} className="col-store">{x.warehouse||'-'}</td>
            if(col.id==='product')return <td key={col.id} className="col-name">{x.product_name}</td>
            if(col.id==='amount')return <td key={col.id} className="col-price">¥{Number(x.total_amount).toLocaleString()}</td>
            if(col.id==='status')return <td key={col.id}><span className={`pill ${x.order_status==='已完成'?'success':x.order_status==='待发货'?'warning':x.order_status==='已发货'?'info':x.order_status==='申请退款'?'danger':''}`}>{x.order_status}</span></td>
            if(col.id==='date')return <td key={col.id} className="col-date">{x.ordered_at}</td>

            return <td key={col.id} className="small muted" style={{fontSize:11}}>-</td>
          })}</tr>
        })}
      </tbody></table>
    </div>}
    </div>  {/* end card */}
    <ConfirmDialog open={!!confirmDel} title='删除订单' desc='删除后不可恢复' confirmLabel='删除' onConfirm={delOrder} onCancel={()=>setConfirmDel(null)} />

    {filtered.length > PAGE_SIZE && <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,marginTop:12,flexWrap:'wrap'}}>
      <button onClick={()=>setOrderPage(1)} disabled={orderPage<=1} style={{width:32,height:32,borderRadius:'50%',border:'none',cursor:'pointer',background:'var(--card)',color:'var(--text)',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',opacity:orderPage<=1?0.35:1,boxSizing:'border-box'}}>‹‹</button>
      <button onClick={()=>setOrderPage(orderPage-1)} disabled={orderPage<=1} style={{width:32,height:32,borderRadius:'50%',border:'none',cursor:'pointer',background:'var(--card)',color:'var(--text)',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',opacity:orderPage<=1?0.35:1,boxSizing:'border-box'}}>‹</button>
      <span className="small muted" style={{fontSize:12}}>第 {orderPage}/{totalPages} 页</span>
      <button onClick={()=>setOrderPage(orderPage+1)} disabled={orderPage>=totalPages} style={{width:32,height:32,borderRadius:'50%',border:'none',cursor:'pointer',background:'var(--card)',color:'var(--text)',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',opacity:orderPage>=totalPages?0.35:1,boxSizing:'border-box'}}>›</button>
      <button onClick={()=>setOrderPage(totalPages)} disabled={orderPage>=totalPages} style={{width:32,height:32,borderRadius:'50%',border:'none',cursor:'pointer',background:'var(--card)',color:'var(--text)',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',opacity:orderPage>=totalPages?0.35:1,boxSizing:'border-box'}}>››</button>
      <span style={{display:'flex',alignItems:'center',gap:4}}>
        <span className="small muted">跳至</span>
        <input type="number" min={1} max={totalPages} defaultValue={orderPage}
          onKeyDown={e=>{if(e.key==='Enter'){const v=parseInt(e.target.value);if(v>=1&&v<=totalPages)setOrderPage(v)}}}
          style={{width:50,fontSize:12,padding:'4px 6px',border:'1px solid var(--border)',borderRadius:32,textAlign:'center',background:'var(--card)',color:'var(--text)',boxSizing:'border-box'}} />
        <span className="small muted">页</span>
      </span>
    </div>}
  </div>
}
