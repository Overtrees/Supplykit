import React, { useState, useEffect } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useToast } from '../../components/Toast'
import { ORDER_COLS, ORDER_STATUSES, orderColKey, getOrderVis } from './configs'
import { IconExport } from '../Icons'

export default function HammerOrders({ channel }) {
  const toast = useToast()
  const { hammerPanel, setHammerPanel, hammerSearch, setHammerSearch, setHammerCols, setOrderFilterLocal, orderStatus } = useAppStore()
  const [visCols, setVisCols] = useState(() => getOrderVis(channel) || ORDER_COLS.map(c => c.id))
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    setVisCols(getOrderVis(channel) || ORDER_COLS.map(c => c.id))
  }, [channel])

  const saveCols = (cols) => {
    setVisCols(cols)
    localStorage.setItem(orderColKey(channel), JSON.stringify(cols))
    setHammerCols('orders', cols)
  }

  const doExport = async () => {
    setExporting(true)
    try {
      const API = import.meta.env.VITE_API_BASE_URL || 'https://overtrees.pythonanywhere.com'
      const r = await fetch(API + '/api/insights/export-orders?channel=' + channel)
      if (!r.ok) throw new Error('HTTP ' + r.status)
      const b = await r.blob()
      const u = URL.createObjectURL(b)
      const a = document.createElement('a')
      a.href = u
      a.download = 'orders_' + new Date().toISOString().slice(0,10) + '.xlsx'
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(u)
      toast.success('订单导出完成')
    } catch(e) { toast.error('导出失败') }
    setExporting(false)
  }

  return (
    <div>
      <div style={{fontSize:11,color:'var(--muted2)',marginBottom:8,textAlign:'center'}}>
        {channel === 'jd' ? '京东' : '其他'} · 订单
      </div>
      <div style={{display:'flex',gap:6,marginBottom:hammerPanel?8:0,flexWrap:'wrap'}}>
        <button onClick={() => setHammerPanel(hammerPanel === 'columns' ? null : 'columns')}
          className="btn btn-ghost" style={{flex:1,fontSize:12,minHeight:32,padding:'4px 8px'}}>
          列选择 ({visCols.length}/{ORDER_COLS.length})
        </button>
        <button onClick={() => setHammerPanel(hammerPanel === 'search' ? null : 'search')}
          className="btn btn-ghost" style={{flex:1,fontSize:12,minHeight:32,padding:'4px 8px'}}>
          搜索
        </button>
        <button onClick={() => setHammerPanel(hammerPanel === 'filter' ? null : 'filter')}
          className="btn btn-ghost" style={{flex:1,fontSize:12,minHeight:32,padding:'4px 8px'}}>
          筛选{orderStatus ? ' ✓' : ''}
        </button>
        <button onClick={doExport} disabled={exporting}
          className="clickable btn btn-ghost" style={{flex:1,fontSize:12,minHeight:32,padding:'4px 8px',display:'flex',alignItems:'center',gap:4,justifyContent:'center',opacity:exporting?0.5:1}}>
          {exporting ? <span style={{display:'inline-block',width:12,height:12,border:'2px solid var(--primary)',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.6s linear infinite'}} /> : <IconExport size={13} />} {exporting ? '导出中...' : '导出'}
        </button>
      </div>
      {/* 列选择面板 */}
      {hammerPanel === 'columns' && (
        <div style={{borderTop:'1px solid var(--border)',paddingTop:8,marginTop:0,maxHeight:260,overflowY:'auto'}}>
          <div style={{fontSize:10,color:'var(--muted2)',marginBottom:4,padding:'0 4px'}}>拖拽 ⠿ 调整列顺序</div>
          {(visCols.map(id=>ORDER_COLS.find(c=>c.id===id)).filter(Boolean).concat(ORDER_COLS.filter(c=>!visCols.includes(c.id)))).map((col,idx)=>{
            const isVis=visCols.includes(col.id)
            return <div key={col.id} draggable={isVis?true:undefined}
              onDragStart={isVis?e=>{e.dataTransfer.setData('text/plain',col.id);e.target.style.opacity='0.4';e.currentTarget.parentNode._dragId=col.id}:undefined}
              onDragEnd={isVis?e=>e.target.style.opacity='1':undefined}
              onDragOver={isVis?e=>{e.preventDefault();e.currentTarget.style.borderTop='2px solid var(--primary)';const from=e.currentTarget.parentNode._dragId;if(from&&from!==col.id){const nxt=visCols.filter(c=>c!==from);const toIdx=nxt.indexOf(col.id);nxt.splice(toIdx,0,from);saveCols(nxt)}}:undefined}
              onDragLeave={isVis?e=>e.currentTarget.style.borderTop='1px solid transparent':undefined}
              onDrop={isVis?e=>{e.preventDefault();e.currentTarget.style.borderTop='1px solid transparent';const from=e.dataTransfer.getData('text/plain');if(from===col.id)return;const nxt=visCols.filter(c=>c!==from);const toIdx=nxt.indexOf(col.id);nxt.splice(toIdx,0,from);saveCols(nxt);e.currentTarget.parentNode._dragId=null}:undefined}
              style={{display:'flex',alignItems:'center',gap:4,padding:'4px 6px',borderRadius:6,cursor:isVis?'grab':'default',fontSize:12,whiteSpace:'nowrap',borderTop:'1px solid transparent',background:isVis?'var(--card)':'transparent',opacity:isVis?1:0.4,userSelect:'none',WebkitUserSelect:'none'}}>
              <span style={{color:'var(--muted2)',fontSize:12,width:16,flexShrink:0,textAlign:'center',cursor:isVis?'grab':'default'}}>{isVis?'⠿':'○'}</span>
              <input type="checkbox" checked={isVis} onChange={e=>{const n=e.target.checked?[...visCols,col.id]:visCols.filter(c=>c!==col.id);saveCols(n)}} style={{accentColor:'var(--primary)'}} />
              <span style={{flex:1}}>{col.label}</span>
              <span style={{fontSize:9,color:'var(--muted2)'}}>{isVis?'#'+(visCols.indexOf(col.id)+1):''}</span>
            </div>
          })}
          <div style={{borderTop:'1px solid var(--border)',marginTop:4,paddingTop:4}}>
            <span onClick={()=>saveCols(ORDER_COLS.map(c=>c.id))} className="btn btn-ghost" style={{fontSize:10,padding:'2px 8px',cursor:'pointer'}}>全部</span>
          </div>
        </div>
      )}
      {/* 搜索面板 */}
      {hammerPanel === 'search' && (
        <div style={{borderTop:'1px solid var(--border)',paddingTop:8}}>
          <input id="hm-search-orders" value={hammerSearch} onChange={e=>setHammerSearch(e.target.value)}
            placeholder="搜索单号/商品/SKU..."
            style={{width:'100%',padding:'6px 10px',fontSize:16,border:'1px solid var(--border)',borderRadius:32,outline:'none',boxSizing:'border-box',background:'var(--card)',color:'var(--text)'}} />
          {hammerSearch && <div style={{marginTop:4,textAlign:'right'}}>
            <span className="clickable btn btn-ghost" onClick={()=>setHammerSearch('')} style={{fontSize:10,padding:'2px 8px',cursor:'pointer'}}>清除</span>
          </div>}
        </div>
      )}
      {/* 筛选面板 */}
      {hammerPanel === 'filter' && (
        <div style={{borderTop:'1px solid var(--border)',paddingTop:8}}>
          <div style={{fontSize:10,color:'var(--muted2)',marginBottom:4}}>订单状态</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
            {ORDER_STATUSES.map(s => (
              <span key={s} onClick={() => setOrderFilterLocal('', s)}
                style={{fontSize:12,padding:'4px 10px',borderRadius:99,cursor:'pointer',
                  background: (orderStatus === s || (!orderStatus && !s)) ? 'var(--primary)' : 'var(--gray)',
                  color: (orderStatus === s || (!orderStatus && !s)) ? '#fff' : 'var(--text)',
                  fontWeight: orderStatus === s ? 600 : 400
                }}>
                {s || '全部'}
              </span>
            ))}
          </div>
          {orderStatus && <div style={{marginTop:4,textAlign:'right'}}>
            <span onClick={()=>setOrderFilterLocal('','')} className="btn btn-ghost" style={{fontSize:10,padding:'2px 8px',cursor:'pointer'}}>清除筛选</span>
          </div>}
        </div>
      )}
    </div>
  )
}