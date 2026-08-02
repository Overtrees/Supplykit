import React from 'react'
export default function ConfirmDialog({ open, title, desc, confirmLabel='确认', cancelLabel='取消', onConfirm, onCancel }) {
  return <>
    {/* 遮罩层 — 始终在 DOM 中，opacity 控制显隐，避免固定定位移除延迟 */}
    <div onClick={onCancel}
      style={{
        position:'fixed',inset:0,
        background:'var(--overlay)',
        zIndex:9998,
        opacity: open ? 1 : 0,
        transition: 'opacity 0.15s ease',
        pointerEvents: open ? 'auto' : 'none',
      }} />
    {/* 面板 */}
    <div style={{
      position:'fixed',bottom:0,left:0,right:0,zIndex:9999,
      transform: open ? 'translateY(0)' : 'translateY(100%)',
      transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',
      padding:'0 16px 40px',
      paddingBottom:'calc(40px + env(safe-area-inset-bottom, 20px))',
    }}>
      <div style={{background:'var(--card)',borderRadius:32,padding:24,textAlign:'center',marginBottom:8}}>
        {title && <div style={{fontWeight:700,fontSize:17,marginBottom:6}}>{title}</div>}
        {desc && <div className="small muted" style={{fontSize:13,marginBottom:16,lineHeight:1.4}}>{desc}</div>}
        <button onClick={onConfirm} style={{width:'100%',padding:'14px',background:'var(--danger)',color:'var(--card)',border:'none',borderRadius:32,cursor:'pointer',fontSize:16,fontWeight:600}}>{confirmLabel}</button>
      </div>
      <button onClick={onCancel} className="clickable" style={{width:'100%',padding:'14px',background:'var(--card)',border:'none',borderRadius:32,cursor:'pointer',fontSize:16,fontWeight:600,color:'var(--primary)',boxShadow:'0 1px 4px rgba(0,0,0,0.08)'}}>{cancelLabel}</button>
    </div>
  </>
}