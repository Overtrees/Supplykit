import React from 'react'

export default function ConfirmDialog({ open, title, desc, confirmLabel='确认', cancelLabel='取消', onConfirm, onCancel }) {
  if (!open) return null

  return <>
    {/* 遮罩 */}
    <div onClick={onCancel} style={{
      position:'fixed',inset:0,zIndex:4000,
      background:'transparent',
    }} />

    {/* 面板容器 — 底部居中 */}
    <div style={{
      position:'fixed',left:0,right:0,
      bottom:'calc(env(safe-area-inset-bottom) + 14px)',
      zIndex:4001,
      display:'flex',justifyContent:'center',
      padding:'0 14px',
      pointerEvents:'none',
    }}>
      {/* 面板本体 */}
      <div onClick={e => e.stopPropagation()} style={{
        width:'100%',maxWidth:600,
        background:'var(--glass-bg)',
        backdropFilter:'blur(40px) saturate(2.5) brightness(1.15)',
        WebkitBackdropFilter:'blur(40px) saturate(2.5) brightness(1.15)',
        border:'0.5px solid var(--glass-border)',
        borderRadius:32,
        padding:'18px 14px calc(14px + env(safe-area-inset-bottom))',
        boxShadow:'0 -8px 24px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.25)',
        pointerEvents:'auto',
      }}>
        {/* 标题 */}
        {title && <div style={{
          textAlign:'center',fontSize:18,fontWeight:700,marginBottom:12,
          color:'var(--text)',
        }}>{title}</div>}

        {/* 描述 */}
        {desc && <div style={{
          fontSize:13,lineHeight:1.45,color:'var(--muted2)',
          textAlign:'center',marginBottom:16,padding:'0 4px',
        }}>{desc}</div>}

        {/* 按钮行 */}
        <div style={{display:'flex',gap:8}}>
          {/* 取消按钮 */}
          <div onClick={onCancel} className="clickable" style={{
            flex:1,
            border:'0.5px solid var(--glass-border)',
            borderRadius:22,padding:14,
            background:'var(--glass-bg)',
            backdropFilter:'blur(40px) saturate(2.5) brightness(1.15)',
            WebkitBackdropFilter:'blur(40px) saturate(2.5) brightness(1.15)',
            cursor:'pointer',textAlign:'center',
          }}>
            <span style={{fontSize:15,fontWeight:600,color:'var(--muted)'}}>{cancelLabel}</span>
          </div>
          {/* 确认按钮 */}
          <div onClick={onConfirm} className="clickable" style={{
            flex:1,
            border:'0.5px solid rgba(255,69,58,0.2)',
            borderRadius:22,padding:14,
            background:'var(--glass-bg)',
            backdropFilter:'blur(40px) saturate(2.5) brightness(1.15)',
            WebkitBackdropFilter:'blur(40px) saturate(2.5) brightness(1.15)',
            cursor:'pointer',textAlign:'center',
          }}>
            <span style={{fontSize:15,fontWeight:700,color:'#ff3b30'}}>{confirmLabel}</span>
          </div>
        </div>
      </div>
    </div>
  </>
}