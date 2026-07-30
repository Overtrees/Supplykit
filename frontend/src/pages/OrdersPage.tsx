import React, { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'
import { api } from '../api/client'
import EmptyState from '../components/EmptyState'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'
import { IconSearch, IconTrash, IconExport } from '../components/Icons'

const API = import.meta.env.VITE_API_BASE_URL || 'https://overtrees.pythonanywhere.com'
const STATUSES = ['','已完成','待发货','已发货','待确认','申请退款']
const COLS = [
  {id:'order_no',label:'订单号'},{id:'barcode',label:'69码'},{id:'store',label:'店铺'},{id:'warehouse',label:'仓库'},
  {id:'product',label:'商品'},{id:'amount',label:'金额'},{id:'status',label:'状态'},
  {id:'date',label:'日期'},
]
const COL_KEY='c_cols_orders'
const getVis=()=>{try{return JSON.parse(localStorage.getItem(COL_KEY)||'null')}catch{return null}}

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
  const { orders, orderTotal, orderPage, orderLoading, setOrderPage, setOrderFilter, orderSearch, orderStatus, dataLoaded, channelVersion } = useAppStore()
  useEffect(() => { setOrderPage(1) }, [channelVersion])
  const [sq, setSq] = useState(orderSearch)
  const [ss, setSs] = useState(orderStatus)
  const [confirmDel, setConfirmDel] = useState(null)
  const [visCols, setVisCols] = useState(() => getVis() || COLS.map(c => c.id))
  const [showPicker, setShowPicker] = useState(false)
  const totalPages = Math.max(1, Math.ceil(orderTotal / 8))

  const doSearch = () => setOrderFilter(sq, ss)

  // 加载平台仓库存（按 SKU+仓库 维度）
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
    <div className="section-title" style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:6}}>
      <span>订单 <span className="small muted">共 {orderTotal} 条</span></span>
      <span style={{display:'flex',gap:6,alignItems:'center'}}>
        <span style={{position:'relative',display:'inline-block'}}>
          <span onClick={()=>setShowPicker(!showPicker)} className="btn btn-ghost" style={{fontSize:11,padding:'2px 10px',cursor:'pointer'}}>列 {visCols.length}/{COLS.length}</span>
          {showPicker && <div style={{position:'absolute',top:'100%',right:0,zIndex:10,background:'var(--card)',border:'1px solid var(--border)',borderRadius:16,padding:6,minWidth:180,boxShadow:'0 4px 12px rgba(0,0,0,0.15)'}}>
      <div style={{fontSize:10,color:'var(--muted2)',marginBottom:4,padding:'0 4px'}}>拖拽 ⠿ 调整列顺序</div>
      {(visCols.map(id=>COLS.find(c=>c.id===id)).filter(Boolean).concat(COLS.filter(c=>!visCols.includes(c.id)))).map((col,idx)=>{
        const isVis=visCols.includes(col.id)
        return <div key={col.id} draggable={isVis?true:undefined}
          onDragStart={isVis?e=>{e.dataTransfer.setData('text/plain',col.id);e.target.style.opacity='0.4';e.currentTarget.parentNode._dragId=col.id}:undefined}
          onDragEnd={isVis?e=>e.target.style.opacity='1':undefined}
          onDragOver={isVis?e=>{e.preventDefault();e.currentTarget.style.borderTop='2px solid var(--primary)';const from=e.currentTarget.parentNode._dragId;if(from&&from!==col.id){const nxt=visCols.filter(c=>c!==from);const toIdx=nxt.indexOf(col.id);nxt.splice(toIdx,0,from);setVisCols(nxt);localStorage.setItem(COL_KEY,JSON.stringify(nxt))}}:undefined}
          onDragLeave={isVis?e=>e.currentTarget.style.borderTop='1px solid transparent':undefined}
          onDrop={isVis?e=>{e.preventDefault();e.currentTarget.style.borderTop='1px solid transparent';const from=e.dataTransfer.getData('text/plain');if(from===col.id)return;const nxt=visCols.filter(c=>c!==from);const toIdx=nxt.indexOf(col.id);nxt.splice(toIdx,0,from);setVisCols(nxt);localStorage.setItem(COL_KEY,JSON.stringify(nxt));e.currentTarget.parentNode._dragId=null}:undefined}
          onTouchStart={isVis?e=>{const t=e.touches[0];e.currentTarget._dragStart={x:t.clientX,y:t.clientY,id:col.id}}:undefined}
          onTouchMove={isVis?e=>{e.preventDefault();const t=e.touches[0];const el=document.elementFromPoint(t.clientX,t.clientY);if(el&&el!==e.currentTarget&&el._dragStart)el.style.borderTop='2px solid var(--primary)'}:undefined}
          onTouchEnd={isVis?e=>{const start=e.currentTarget._dragStart;if(!start)return;const t=e.changedTouches[0];const dropEl=document.elementFromPoint(t.clientX,t.clientY);if(dropEl&&dropEl._dragStart&&dropEl._dragStart.id!==start.id){const from=start.id;const to=dropEl._dragStart.id;const nxt=visCols.filter(c=>c!==from);const toIdx=nxt.indexOf(to);nxt.splice(toIdx,0,from);setVisCols(nxt);localStorage.setItem(COL_KEY,JSON.stringify(nxt))}}:undefined}
          style={{display:'flex',alignItems:'center',gap:4,padding:'4px 6px',borderRadius:6,cursor:isVis?'grab':'default',fontSize:12,whiteSpace:'nowrap',borderTop:'1px solid transparent',background:isVis?'var(--card)':'transparent',opacity:isVis?1:0.4,userSelect:'none',WebkitUserSelect:'none'}}>
          <span style={{color:'var(--muted2)',fontSize:12,width:16,flexShrink:0,textAlign:'center',cursor:isVis?'grab':'default'}}>{isVis?'⠿':'○'}</span>
          <input type="checkbox" checked={isVis} onChange={e=>{const n=e.target.checked?[...visCols,col.id]:visCols.filter(c=>c!==col.id);setVisCols(n);localStorage.setItem(COL_KEY,JSON.stringify(n))}} style={{accentColor:'var(--primary)'}} />
          <span style={{flex:1}}>{col.label}</span>
          <span style={{fontSize:9,color:'var(--muted2)'}}>{isVis?'#'+(visCols.indexOf(col.id)+1):''}</span>
        </div>
      })}
      <div style={{borderTop:'1px solid var(--border)',marginTop:4,paddingTop:4}}>
        <span onClick={()=>{const d=COLS.map(c=>c.id);setVisCols(d);localStorage.setItem(COL_KEY,JSON.stringify(d));setShowPicker(false)}} className="btn btn-ghost" style={{fontSize:10,padding:'2px 8px',cursor:'pointer'}}>全部</span>
      </div>
    </div>}
        </span>
        <button onClick={async()=>{try{const r=await fetch(API+'/api/insights/export-orders');const b=await r.blob();const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='orders_'+new Date().toISOString().slice(0,10)+'.xlsx';document.body.appendChild(a);a.click();a.remove()}catch(e){toast.error('导出失败')}}}
          className="btn btn-ghost" style={{fontSize:12,padding:'4px 12px',display:'flex',alignItems:'center',gap:4}}><IconExport size={14} /> 导出</button>
      </span>
    </div>
    <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
      <div className="search-bar">
        <IconSearch size={16} style={{color:'var(--muted2)',flexShrink:0}} />
        <input value={sq} onChange={e=>setSq(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')doSearch()}}
          placeholder="搜索单号/商品/SKU" enterKeyHint="search" inputMode="search" autoCorrect="off" />
        {sq && <span className="cancel" onClick={()=>{setSq('');doSearch()}}>清除</span>}
      </div>
      <select value={ss} onChange={e=>{setSs(e.target.value);setOrderFilter(sq,e.target.value)}} style={{fontSize:16,padding:'8px 12px',border:'1px solid var(--border)',borderRadius:32,outline:'none',background:'var(--card)'}}>
        {STATUSES.map(s => <option key={s} value={s}>{s||'全部状态'}</option>)}
      </select>
      {(orderSearch||orderStatus) && <button onClick={()=>{setSq('');setSs('');setOrderFilter('','')}} className="btn btn-ghost" style={{fontSize:14}}>重置</button>}
    </div>
    {orderSearch && <div className="small muted" style={{marginBottom:8}}>搜索 "{orderSearch}" 共 {orderTotal} 条结果</div>}

    {orderLoading || !dataLoaded ? <OrderSkeleton />
    : orders.length === 0
      ? <EmptyState icon='clipboard' title={orderSearch?'无匹配订单':'暂无订单'} desc={orderSearch?'换个关键词试试':''} />
      : <div style={{overflowX:"auto"}}>
        <div style={{fontSize:11,color:'var(--muted2)',marginBottom:4}}>显示 {visCols.length}/{COLS.length} 列</div>
      <table><colgroup>{visCols.map(id=>{const col=COLS.find(c=>c.id===id);return col?<col key={col.id} />:null})}</colgroup>
      <thead><tr>{visCols.map(id=>{const col=COLS.find(c=>c.id===id);return col?<th key={col.id}>{col.label}</th>:null})}</tr></thead>
      <tbody>
        {orders.map(x => {
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
          style={{width:50,fontSize:12,padding:'4px 6px',border:'1px solid var(--border)',borderRadius:32,textAlign:'center'}} />
        <span className="small muted">页</span>
      </span>
    </div>}
  </div>
}
