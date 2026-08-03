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
      {hammerPanel === 'columns' && (...)}
      {hammerPanel === 'search' && (...)}
      {hammerPanel === 'filter' && (...)}
    </div>
  )
}
