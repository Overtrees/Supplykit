import React from 'react'
export default function ConfirmDialog({ open, title, desc, confirmLabel='确认', cancelLabel='取消', onConfirm, onCancel }) {
  return <>
    <div onClick={onCancel}
      style={{
        position:'fixed',inset:0,
        background:'var(--overlay)',
        zIndex: open ? 9998 : -1,
        display: open ? 'block' : 'none',
      }} />
    <div style={{
      position:'fixed',bottom:0,left:0,right:0,
      zIndex: open ? 9999 : -1,
      display: open ? 'block' : 'none',
      transform: open ? 'translateY(0)' : 'translateY(100%)',
      transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',
      padding:'0 16px',
      paddingBottom:'calc(16px + env(safe-area-inset-bottom, 20px))',
      background:'var(--card)',
      borderRadius:'32px 32px 0 0',
      boxShadow:'0 -2px 20px rgba(0,0,0,0.1)',
    }}>
      <div style={{padding:24,textAlign:'center'}}>
        {title && <div style={{fontWeight:700,fontSize:17,marginBottom:6}}>{title}</div>}
        {desc && <div className="small muted" style={{fontSize:13,marginBottom:16,lineHeight:1.4}}>{desc}</div>}
        <button onClick={onConfirm} className="clickable" style={{width:'100%',padding:'14px',background:'var(--danger)',color:'var(--card)',border:'none',borderRadius:32,cursor:'pointer',fontSize:16,fontWeight:600}}>{confirmLabel}</button>
      </div>
      <button onClick={onCancel} className="clickable" style={{width:'100%',padding:'14px',background:'var(--card)',border:'none',borderRadius:32,cursor:'pointer',fontSize:16,fontWeight:600,color:'var(--primary)',marginBottom:8}}>{cancelLabel}</button>
    </div>
  </>
}