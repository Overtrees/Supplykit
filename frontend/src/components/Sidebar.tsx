import React from 'react'
import { NAV } from '../App'
import { useAppStore } from '../store/useAppStore'

export default function Sidebar({ page, onNavigate, lowStock, errCount }) {
  const sidebarOpen = useAppStore(s => s.sidebarOpen)
  const setSidebarOpen = useAppStore(s => s.setSidebarOpen)

  return (
    <>
      {/* 遮罩层：display 直切，无过渡，避免残留颜色帧 */}
      <div
        onClick={() => setSidebarOpen(false)}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999,
          background: 'rgba(0,0,0,0.45)',
          display: sidebarOpen ? 'block' : 'none',
        }}
      />
      {/* 面板层：只有 transform 做滑动动画，关闭时 visibility:hidden 退出合成层 */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          width: 'min(82vw, 320px)',
          zIndex: 1000,
          background: 'var(--sidebar, #1e293b)',
          color: '#fff',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          visibility: sidebarOpen ? 'visible' : 'hidden',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.08)', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'var(--primary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700 }}>供</div>
            <span style={{ fontWeight:700, fontSize:16, letterSpacing:'-0.02em' }}>SupplyChain</span>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setSidebarOpen(false) }} style={{
            width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center',
            borderRadius:8, cursor:'pointer', border:'none',
            background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.6)', fontSize:16,
          }}>✕</button>
        </div>
        <div style={{ flex:1, overflow:'auto', padding:'8px 0' }}>
          {NAV.map(item => {
            const active = page === item.id
            return <div key={item.id} onClick={() => { onNavigate(item.id); setSidebarOpen(false) }} style={{
              display:'flex', alignItems:'center', gap:12, padding:'12px 20px', margin:'2px 8px', borderRadius:10,
              fontSize:14, cursor:'pointer', fontWeight: active ? 600 : 400,
              color: active ? '#fff' : 'rgba(255,255,255,0.6)',
              background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
            }}>
              <span style={{ fontSize:20, flexShrink:0 }}>{item.icon}</span>
              <span style={{ flex:1 }}>{item.label}</span>
              {item.id === 'quality' && errCount > 0 && <span style={{ background:'var(--danger)', color:'#fff', fontSize:11, padding:'1px 7px', borderRadius:99, fontWeight:600 }}>{errCount}</span>}
              {item.id === 'inv' && lowStock > 0 && <span style={{ background:'var(--warning)', color:'#fff', fontSize:11, padding:'1px 7px', borderRadius:99, fontWeight:600 }}>{lowStock}</span>}
            </div>
          })}
        </div>
      </div>
    </>
  )
}
