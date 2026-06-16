import React from 'react'
export default function ConfirmDialog({ open, title, desc, confirmLabel='确认', cancelLabel='取消', onConfirm, onCancel }) {
  if (!open) return null
  return <>
    <div onClick={onCancel} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.35)',zIndex:9998}} />
    <div style={{position:'fixed',bottom:0,left:0,right:0,zIndex:9999,padding:'0 16px 40px',paddingBottom:'calc(40px + env(safe-area-inset-bottom, 20px))',animation:'slideUp 0.25s ease'}}>
      <div style={{background:'#fff',borderRadius:14,padding:24,textAlign:'center',marginBottom:8}}>
        {title && <div style={{fontWeight:700,fontSize:17,marginBottom:6}}>{title}</div>}
        {desc && <div className="small muted" style={{fontSize:13,marginBottom:16,lineHeight:1.4}}>{desc}</div>}
        <button onClick={onConfirm} style={{width:'100%',padding:'14px',background:'var(--danger)',color:'#fff',border:'none',borderRadius:12,cursor:'pointer',fontSize:16,fontWeight:600}}>{confirmLabel}</button>
      </div>
      <button onClick={onCancel} style={{width:'100%',padding:'14px',background:'#fff',border:'none',borderRadius:14,cursor:'pointer',fontSize:16,fontWeight:600,color:'var(--primary)',boxShadow:'0 1px 4px rgba(0,0,0,0.08)'}}>{cancelLabel}</button>
    </div>
    <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
  </>
}
