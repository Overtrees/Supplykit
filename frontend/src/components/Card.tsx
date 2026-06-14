import React from 'react'
export default function Card({ title, value, sub, badge }) {
  return (
    <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:16, padding:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', gap:8 }}>
        <div style={{ fontSize:12, color:'#94a3b8', marginBottom:6 }}>{title}</div>
        {badge || null}
      </div>
      <div style={{ fontSize:28, fontWeight:700, color:'#0f172a' }}>{value}</div>
      {sub ? <div style={{ fontSize:12, color:'#94a3b8', marginTop:4 }}>{sub}</div> : null}
    </div>
  )
}
