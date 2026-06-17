import React from 'react'
export default function Card({ title, value, sub, badge }) {
  return (
    <div className="card" style={{containerType:'inline-size'}}>
      <div style={{ display:'flex', justifyContent:'space-between', gap:8 }}>
        <div style={{ fontSize:12, color:'var(--muted2)', marginBottom:6 }}>{title}</div>
        {badge || null}
      </div>
      <div className="card-value" style={{color:'var(--text)'}}>{value}</div>
      {sub ? <div className="card-sub" style={{color:'var(--muted)'}}>{sub}</div> : null}
    </div>
  )
}
