import React, { useState } from "react"
import { useAppStore } from "../../store/useAppStore"
export default HammerDashboard({ channel }) {
  const { hammerDashPeriod, setHammerDashPeriod, dashboard } = useAppStore()
  const periodLabel = { today:'今日', week:'本周', month:'本月' }
  const periodMeta = dashboard?.periods?.[hammerDashPeriod] || {}
  return (
    <div>
      <div style={{fontSize:11,color:'var(--muted2)',marginBottom:8,textAlign:'center'}}>
        {channel === 'jd' ? '京东' : '其他'} · 看板
      </div>
      <div style={{fontSize:10,color:'var(--muted2)',marginBottom:4,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
        聚合时间维度
        {periodMeta.date && <span style={{marginLeft:'auto'}}>{periodMeta.date}</span>}
      </div>
      <div style={{display:'flex',gap:4}}>
        {['today','week','month'].map(k => (
          <span key={k} onClick={() => setHammerDashPeriod(k)}
            style={{flex:1,fontSize:12,minHeight:32,padding:'4px 6px',borderRadius:99,cursor:'pointer',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',boxSizing:'border-box',
              background: hammerDashPeriod === k ? 'var(--primary)' : 'var(--gray)',
              color: hammerDashPeriod === k ? '#fff' : 'var(--text)',fontWeight: hammerDashPeriod === k ? 600 : 400}}>
            {periodLabel[k]}
          </span>
        ))}
      </div>
    </div>
  )
}

/* 变更历史底部弹窗 — 独立组件避免 App 大范围重渲染 */
