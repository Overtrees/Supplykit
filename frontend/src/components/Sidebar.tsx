import React from 'react'
import { NAV } from '../App'
export default function Sidebar({ open, onClose, page, onNavigate, lowStock, errCount }) {
  return (
    <>
      {/* 侧边栏 — 全屏 */}
      <div onClick={onClose} style={{
        position:'fixed', inset:0, width:'100%',
        background:'var(--sidebar)', color:'#fff',
        zIndex: open ? 99999999 : -1,
        display:'flex', flexDirection:'column', overflow:'hidden',
        paddingTop:'env(safe-area-inset-top,0)', paddingBottom:'env(safe-area-inset-bottom,0)',
        pointerEvents: open ? 'auto' : 'none',
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.08)', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'#3b82f6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700 }}>供</div>
            <span style={{ fontWeight:700, fontSize:16, letterSpacing:'-0.02em' }}>SupplyChain</span>
          </div>
          <button onClick={onClose} style={{
            width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center',
            borderRadius:8, cursor:'pointer', border:'none',
            background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.6)',
            fontSize:16, transition:'all 0.15s',
          }}>✕</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'12px 8px' }}>
          {NAV.map(item => {
            const active = page === item.id
            return (
              <div key={item.id} onClick={() => { onNavigate(item.id); onClose() }} style={{
                display:'flex', alignItems:'center', gap:12, padding:'12px 16px', margin:'2px 4px',
                borderRadius:10, cursor:'pointer', fontSize:14, transition:'all 0.12s',
                color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                background: active ? 'rgba(59,130,246,0.2)' : 'transparent',
                fontWeight: active ? 600 : 400,
              }}>
                <span style={{ fontSize:18, width:24, textAlign:'center', flexShrink:0 }}>{item.icon}</span>
                <span>{item.label}</span>
                {item.id === 'quality' && errCount > 0 && (
                  <span style={{ marginLeft:'auto', background:'#ef4444', color:'#fff', fontSize:10, borderRadius:99, padding:'1px 7px', minWidth:18, textAlign:'center' }}>{errCount}</span>
                )}
                {item.id === 'inv' && lowStock > 0 && (
                  <span style={{ marginLeft:'auto', background:'#f59e0b', color:'#fff', fontSize:10, borderRadius:99, padding:'1px 7px', minWidth:18, textAlign:'center' }}>{lowStock}</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ─── 主应用 ──────────────────────────────────────────────────────────────────
