import React, { useState, useEffect } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useToast } from '../../components/Toast'
import { ORDER_COLS, ORDER_STATUSES, orderColKey, getOrderVis } from './configs'
import { IconExport } from '../Icons'
import { t } from '../../locale'

interface HammerOrdersProps { channel: string }

export default function HammerOrders({ channel }: HammerOrdersProps) {
  const toast = useToast()
  const { hammerPanel, setHammerPanel, hammerSearch, setHammerSearch, setHammerCols, setOrderFilterLocal, orderStatus } = useAppStore()
  const [visCols, setVisCols] = useState(() => getOrderVis(channel) || ORDER_COLS.map(c => c.id))
  const [exporting, setExporting] = useState(false)

  useEffect(() => { setVisCols(getOrderVis(channel) || ORDER_COLS.map(c => c.id)) }, [channel])

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
      a.href = u; a.download = 'orders_' + new Date().toISOString().slice(0,10) + '.xlsx'
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(u)
      toast.success(t('export.order_success'))
    } catch(e) { toast.error(t('export.failed')) }
    setExporting(false)
  }

  return (
    <div>
      <div className="hammer-header">{channel === 'jd' ? t('channel.jd') : t('channel.other')} · {t('nav.orders')}</div>
      <div className="flex gap-6 flex-wrap" style={{marginBottom:hammerPanel?8:0}}>
        <button onClick={() => setHammerPanel(hammerPanel === 'columns' ? null : 'columns')}
          className="btn-ghost hammer-btn">{t('common.columns')} ({visCols.length}/{ORDER_COLS.length})</button>
        <button onClick={() => setHammerPanel(hammerPanel === 'search' ? null : 'search')}
          className="btn-ghost hammer-btn">{t('common.search')}</button>
        <button onClick={() => setHammerPanel(hammerPanel === 'filter' ? null : 'filter')}
          className="btn-ghost hammer-btn">{t('common.filter')}{orderStatus ? ' ✓' : ''}</button>
        <button onClick={doExport} disabled={exporting}
          className="clickable btn-ghost hammer-btn" style={{opacity:exporting?0.5:1}}>
          {exporting ? <span className="inline-block" style={{width:12,height:12,border:'2px solid var(--primary)',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.6s linear infinite'}} /> : <IconExport size={13} />} {exporting ? t('common.exporting') : t('common.export')}
        </button>
      </div>
      {hammerPanel === 'columns' && (
        <div className="hammer-panel hammer-panel-scroll">
          <div className="muted2 text-10" style={{marginBottom:4,padding:'0 4px'}}>{t('common.drag_hint')}</div>
          {(visCols.map(id=>ORDER_COLS.find(c=>c.id===id)).filter(Boolean).concat(ORDER_COLS.filter(c=>!visCols.includes(c.id)))).map((col,idx)=>{
            const isVis=visCols.includes(col.id)
            return <div key={col.id} draggable={isVis?true:undefined}
              onDragStart={isVis?e=>{e.dataTransfer.setData('text/plain',col.id);e.target.style.opacity='0.4';e.currentTarget.parentNode._dragId=col.id}:undefined}
              onDragEnd={isVis?e=>e.target.style.opacity='1':undefined}
              onDragOver={isVis?e=>{e.preventDefault();e.currentTarget.style.borderTop='2px solid var(--primary)';const from=e.currentTarget.parentNode._dragId;if(from&&from!==col.id){const nxt=visCols.filter(c=>c!==from);const toIdx=nxt.indexOf(col.id);nxt.splice(toIdx,0,from);saveCols(nxt)}}:undefined}
              onDragLeave={isVis?e=>e.currentTarget.style.borderTop='1px solid transparent':undefined}
              onDrop={isVis?e=>{e.preventDefault();e.currentTarget.style.borderTop='1px solid transparent';const from=e.dataTransfer.getData('text/plain');if(from===col.id)return;const nxt=visCols.filter(c=>c!==from);const toIdx=nxt.indexOf(col.id);nxt.splice(toIdx,0,from);saveCols(nxt);e.currentTarget.parentNode._dragId=null}:undefined}
              className={'col-drag' + (isVis ? ' visible' : ' hidden')}>
              <span className="muted2 text-12" style={{width:16,flexShrink:0,textAlign:'center',cursor:isVis?'grab':'default'}}>{isVis?'⠿':'○'}</span>
              <input type="checkbox" checked={isVis} onChange={e=>{const n=e.target.checked?[...visCols,col.id]:visCols.filter(c=>c!==col.id);saveCols(n)}} className="accent-primary" />
              <span className="flex-1 text-12">{col.label}</span>
              <span className="muted2 text-9">{isVis?'#'+(visCols.indexOf(col.id)+1):''}</span>
            </div>
          })}
          <div className="border-bottom mt-4" style={{paddingTop:4}}>
            <span onClick={()=>saveCols(ORDER_COLS.map(c=>c.id))} className="btn-ghost text-10" style={{padding:'2px 8px',cursor:'pointer'}}>{t('common.all')}</span>
          </div>
        </div>
      )}
      {hammerPanel === 'search' && (
        <div className="hammer-panel">
          <input id="hm-search-orders" value={hammerSearch} onChange={e=>setHammerSearch(e.target.value)}
            placeholder="搜索单号/商品/SKU..." className="hammer-input" />
          {hammerSearch && <div className="text-right mt-8">
            <span className="clickable btn-ghost text-10" onClick={()=>setHammerSearch('')} style={{padding:'2px 8px',cursor:'pointer'}}>{t('common.clear')}</span>
          </div>}
        </div>
      )}
      {hammerPanel === 'filter' && (
        <div className="hammer-panel">
          <div className="muted2 text-10 mb-4">{t('common.order_status')}</div>
          <div className="flex flex-wrap gap-4">
            {ORDER_STATUSES.map(s => (
              <span key={s} onClick={() => setOrderFilterLocal('', s)}
                style={{fontSize:12,padding:'4px 10px',borderRadius:99,cursor:'pointer',
                  background: (orderStatus === s || (!orderStatus && !s)) ? 'var(--primary)' : 'var(--gray)',
                  color: (orderStatus === s || (!orderStatus && !s)) ? '#fff' : 'var(--text)',
                  fontWeight: orderStatus === s ? 600 : 400
                }}>
                {s || t('common.all')}
              </span>
            ))}
          </div>
          {orderStatus && <div className="text-right mt-8">
            <span onClick={()=>setOrderFilterLocal('','')} className="btn-ghost text-10" style={{padding:'2px 8px',cursor:'pointer'}}>{t('common.clear_filter')}</span>
          </div>}
        </div>
      )}
    </div>
  )
}