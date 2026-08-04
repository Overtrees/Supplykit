import React, { useState } from "react"
import { t } from "../../locale"
import { useAppStore } from "../../store/useAppStore"
interface HammerDashboardProps { channel: string }

export default function HammerDashboard({ channel }: HammerDashboardProps) {
  const { hammerDashPeriod, setHammerDashPeriod, setCustomDate, customDateStart, customDateEnd, dashboard } = useAppStore()
  const periodLabel = { today:'今日', week:'本周', month:'本月', custom:'自定义' }
  const periodMeta = dashboard?.periods?.[hammerDashPeriod] || {}
  const [showCustom, setShowCustom] = useState(false)
  const [startVal, setStartVal] = useState(customDateStart || '')
  const [endVal, setEndVal] = useState(customDateEnd || '')

  if (!startVal) { var d = new Date(); d.setDate(d.getDate() - 29); setStartVal(d.toISOString().slice(0,10)) }
  if (!endVal) { setEndVal(new Date().toISOString().slice(0,10)) }

  return (
    <div>
      <div className="hammer-header">{channel === 'jd' ? t('channel.jd') : t('channel.other')} · {t('nav.dash')}</div>
      <div className="flex flex-center gap-6 muted2" style={{fontSize:10,marginBottom:4,flexWrap:'wrap'}}>
        聚合时间维度
        {hammerDashPeriod === 'custom' && customDateStart && customDateEnd &&
          <span className="font-600" style={{marginLeft:'auto',fontSize:11,color:'var(--primary)'}}>{customDateStart.slice(5)}/{customDateEnd.slice(5)}</span>}
        {periodMeta.date && <span style={{marginLeft:'auto'}}>{periodMeta.date}</span>}
      </div>
      <div className="flex gap-4">
        {['today','week','month','custom'].map(k => (
          <span key={k} onClick={() => {
            if (k === 'custom') setShowCustom(!showCustom)
            else { setShowCustom(false); setHammerDashPeriod(k) }
          }}
            className={'hammer-tab' + ((k === 'custom' ? hammerDashPeriod === 'custom' : hammerDashPeriod === k) ? ' active' : '')}>
            {periodLabel[k]}
          </span>
        ))}
      </div>
      {showCustom && <div className="hammer-panel" style={{overflow:'hidden'}}>
        <div className="mb-8">
          <div className="muted2" style={{fontSize:10,marginBottom:3,padding:'0 2px'}}>{t('common.start_date')}</div>
          <input type="date" value={startVal} onChange={e=>setStartVal(e.target.value)} className="hammer-input" style={{fontSize:14,padding:'6px 10px'}} />
        </div>
        <div className="mb-8">
          <div className="muted2" style={{fontSize:10,marginBottom:3,padding:'0 2px'}}>{t('common.end_date')}</div>
          <input type="date" value={endVal} onChange={e=>setEndVal(e.target.value)} className="hammer-input" style={{fontSize:14,padding:'6px 10px'}} />
        </div>
        <button onClick={() => {
          if (startVal && endVal && startVal <= endVal) { setCustomDate(startVal, endVal); setShowCustom(false) }
        }} className="btn btn-primary w-full" style={{fontSize:12,minHeight:32,padding:'4px 8px'}}>{t('common.confirm')}</button>
      </div>}
    </div>
  )
}