import React from 'react'
export default function Card({ title, value, sub, badge, borderRadius, valueColor }) {
  return (
    <div className="card" style={{
      containerType:'inline-size', aspectRatio:'1', display:'flex', flexDirection:'column',
      padding:12, borderRadius: borderRadius || 20
    }}>
      <div style={{fontSize:11,color:'var(--muted2)',lineHeight:1.2,display:'flex',justifyContent:'space-between',gap:4,flexShrink:0}}>
        <span>{title}</span>
        {badge || null}
      </div>
      <div style={{flex:1,display:'flex',alignItems:'flex-end',marginBottom:1}}>
        <div className="card-value" style={{color:valueColor || 'var(--text)'}}>{value}</div>
      </div>
      {sub ? <div className="card-sub" style={{color:'var(--text)',marginTop:0,flexShrink:0}}>{sub}</div> : null}
    </div>
  )
}
