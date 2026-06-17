import React from 'react'
export default function EmptyState({icon='📭',title='暂无数据',desc='',action}) {
  return <div style={{textAlign:'center',padding:'60px 20px',color:'var(--muted2)'}}>
    <div style={{fontSize:48,marginBottom:12}}>{icon}</div>
    <div style={{fontWeight:600,fontSize:16,marginBottom:6,color:'var(--muted)'}}>{title}</div>
    {desc && <div style={{fontSize:13,marginBottom:16}}>{desc}</div>}
    {action}
  </div>
}
