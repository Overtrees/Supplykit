import React, { useState, useEffect } from 'react'

export default function ConfirmDialog({ open, title, desc, confirmLabel='确认', cancelLabel='取消', onConfirm, onCancel }) {
  const [closing, setClosing] = useState(false)
  const [visible, setVisible] = useState(false)
  const [slideIn, setSlideIn] = useState(false)

  useEffect(() => {
    if (open) {
      setClosing(false)
      setVisible(true)
      requestAnimationFrame(() => requestAnimationFrame(() => setSlideIn(true)))
    } else if (visible) {
      setSlideIn(false)
      setClosing(true)
      const timer = setTimeout(() => { setClosing(false); setVisible(false) }, 220)
      return () => clearTimeout(timer)
    }
  }, [open])

  if (!visible && !closing) return null

  return <>
    <div onClick={onCancel}
      style={{
        position:'fixed',inset:0,
        background:'var(--overlay)',
        zIndex:9998,
        opacity: closing ? 0 : 1,
        transition: 'opacity 180ms ease',
      }} />
    {/* 安全区占位 — 让遮罩层透出 */}
    <div style={{
      position:'fixed',bottom:0,left:0,right:0,zIndex:9999,
      height:'env(safe-area-inset-bottom, 20px)',
      pointerEvents:'none',
    }} />
    {/* 面板 */}
    <div style={{
      position:'fixed',bottom:0,left:0,right:0,zIndex:9999,
      margin:'0 8px 8px',
      transform: closing ? 'translateY(calc(100% + 8px))' : (slideIn ? 'translateY(0)' : 'translateY(calc(100% + 8px))'),
      transition: 'transform 220ms cubic-bezier(0.34,1.56,0.64,1)',
    }}>
      <div style={{background:'var(--card)',borderRadius:26,padding:24,textAlign:'center',marginBottom:8}}>
        {title && <div style={{fontWeight:700,fontSize:17,marginBottom:6}}>{title}</div>}
        {desc && <div className="small muted" style={{fontSize:13,marginBottom:16,lineHeight:1.4}}>{desc}</div>}
        <button onClick={onConfirm} className="clickable" style={{width:'100%',padding:'14px',background:'var(--danger)',color:'var(--card)',border:'none',borderRadius:32,cursor:'pointer',fontSize:16,fontWeight:600}}>{confirmLabel}</button>
      </div>
      <button onClick={onCancel} className="clickable" style={{width:'100%',padding:'14px',background:'var(--card)',border:'none',borderRadius:32,cursor:'pointer',fontSize:16,fontWeight:600,color:'var(--primary)',boxShadow:'0 1px 4px rgba(0,0,0,0.08)'}}>{cancelLabel}</button>
    </div>
  </>
}