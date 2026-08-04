import React, { useState } from "react"
import { useAppStore } from "../../store/useAppStore"
export default function HammerDashboard({ channel }) {
  const { hammerDashPeriod, setHammerDashPeriod, setCustomDate, customDateStart, customDateEnd, dashboard } = useAppStore()
  const periodLabel = { today:'今日', week:'本周', month:'本月', custom:'自定义' }
  const periodMeta = dashboard?.periods?.[hammerDashPeriod] || {}
  const [showCustom, setShowCustom] = useState(false)
  const [startVal, setStartVal] = useState(customDateStart || '')
  const [endVal, setEndVal] = useState(customDateEnd || '')

  // 默认日期范围：最近30天
  if (!startVal) {
    var d = new Date(); d.setDate(d.getDate() - 29)
    setStartVal(d.toISOString().slice(0,10))
  }
  if (!endVal) {
    setEndVal(new Date().toISOString().slice(0,10))
  }

  return (
    <div>
      <div style={{fontSize:11,color:'var(--muted2)',marginBottom:8,textAlign:'center'}}>
        {channel === 'jd' ? '京东' : '其他'} · 看板
      </div>
      <div style={{fontSize:10,color:'var(--muted2)',marginBottom:4,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
        聚合时间维度
        {hammerDashPeriod === 'custom' && customDateStart && customDateEnd &&
          <span style={{marginLeft:'auto',fontSize:11,fontWeight:600,color:'var(--primary)'}}>{customDateStart.slice(5)}/{customDateEnd.slice(5)}</span>}
        {periodMeta.date && <span style={{marginLeft:'auto'}}>{periodMeta.date}</span>}
      </div>
      <div style={{display:'flex',gap:4}}>
        {['today','week','month','custom'].map(k => (
          <span key={k} onClick={() => {
            if (k === 'custom') setShowCustom(!showCustom)
            else { setShowCustom(false); setHammerDashPeriod(k) }
          }}
            style={{flex:1,fontSize:12,minHeight:32,padding:'4px 6px',borderRadius:99,cursor:'pointer',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',boxSizing:'border-box',
              background: (k === 'custom' ? hammerDashPeriod === 'custom' : hammerDashPeriod === k) ? 'var(--primary)' : 'var(--gray)',
              color: (k === 'custom' ? hammerDashPeriod === 'custom' : hammerDashPeriod === k) ? '#fff' : 'var(--text)',
              fontWeight: (k === 'custom' ? hammerDashPeriod === 'custom' : hammerDashPeriod === k) ? 600 : 400}}>
            {periodLabel[k]}
          </span>
        ))}
      </div>
      {showCustom && <div style={{borderTop:'1px solid var(--border)',paddingTop:8,marginTop:8,overflow:'hidden'}}>
        <div style={{marginBottom:6}}>
          <div style={{fontSize:10,color:'var(--muted2)',marginBottom:3,padding:'0 2px'}}>开始</div>
          <input type="date" value={startVal} onChange={e=>setStartVal(e.target.value)}
            style={{width:'100%',padding:'6px 10px',fontSize:14,border:'1px solid var(--border)',borderRadius:99,outline:'none',background:'var(--card)',color:'var(--text)',boxSizing:'border-box'}} />
        </div>
        <div style={{marginBottom:8}}>
          <div style={{fontSize:10,color:'var(--muted2)',marginBottom:3,padding:'0 2px'}}>结束</div>
          <input type="date" value={endVal} onChange={e=>setEndVal(e.target.value)}
            style={{width:'100%',padding:'6px 10px',fontSize:14,border:'1px solid var(--border)',borderRadius:99,outline:'none',background:'var(--card)',color:'var(--text)',boxSizing:'border-box'}} />
        </div>
        <button onClick={() => {
          if (startVal && endVal && startVal <= endVal) {
            setCustomDate(startVal, endVal)
            setShowCustom(false)
          }
        }} className="btn btn-primary" style={{width:'100%',fontSize:12,minHeight:32,padding:'4px 8px'}}>确定</button>
      </div>}
    </div>
  )
}