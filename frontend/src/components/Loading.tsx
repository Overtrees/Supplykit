import React from 'react'
export default function Loading({text='加载中...'}) {
  return <div className="card" style={{textAlign:'center',padding:'60px 20px'}}>
    <div style={{fontSize:36,marginBottom:12,opacity:0.3}}>⏳</div>
    <div className="small muted">{text}</div>
  </div>
}
