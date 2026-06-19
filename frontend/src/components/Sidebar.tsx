import React, { useState, useMemo } from 'react'
import { NAV } from '../App'
import { useAppStore } from '../store/useAppStore'

const isIOS = typeof navigator !== 'undefined' && (
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
)

export default function Sidebar({ page, onNavigate, lowStock, errCount }) {
  const sidebarOpen = useAppStore(s => s.sidebarOpen)
  const setSidebarOpen = useAppStore(s => s.setSidebarOpen)
  const [animatingOut, setAnimatingOut] = useState(false)

  // iOS: 不用动画，state 变化直接控制 DOM 显现/销毁
  if (isIOS) {
    if (!sidebarOpen) return null
    return (
      <>
        <div onClick={() => setSidebarOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:999 }} />
        <div onClick={e => e.stopPropagation()} style={{
          position:'fixed', top:0, left:0, bottom:0,
          width:'80vw', maxWidth:320,
          background:'var(--sidebar,#1e293b)', color:'#fff',
          zIndex:1000,
          paddingTop:'env(safe-area-inset-top,0px)',
          paddingBottom:'env(safe-area-inset-bottom,0px)',
          display:'flex', flexDirection:'column',
          overflowY:'auto', WebkitOverflowScrolling:'touch',
        }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px 8px', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:'var(--primary)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:16 }}>供</div>
              <span style={{ color:'#fff', fontWeight:700, fontSize:17 }}>SupplyChain</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} aria-label="关闭菜单" style={{ background:'rgba(255,255,255,0.12)', border:'none', borderRadius:8, color:'#fff', width:32, height:32, cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
          </div>
          <nav style={{ flex:1, padding:'8px 12px' }}>
            {NAV.map(item => {
              const active = page === item.id
              return (
                <div key={item.id} onClick={() => { setSidebarOpen(false); onNavigate(item.id) }} style={{
                  display:'flex', alignItems:'center', gap:12, padding:'13px 16px', borderRadius:12, marginBottom:4,
                  background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                  color: active ? '#fff' : 'rgba(255,255,255,0.72)',
                  cursor:'pointer', fontWeight: active ? 600 : 400, fontSize:15,
                }}>
                  <span style={{ fontSize:20, width:24, textAlign:'center', flexShrink:0 }}>{item.icon}</span>
                  <span style={{ flex:1 }}>{item.label}</span>
                  {item.id === 'quality' && errCount > 0 && <span style={{ background:'var(--danger)', color:'#fff', borderRadius:99, fontSize:11, fontWeight:700, padding:'1px 7px', minWidth:20, textAlign:'center' }}>{errCount}</span>}
                  {item.id === 'inv' && lowStock > 0 && <span style={{ background:'var(--warning)', color:'#fff', borderRadius:99, fontSize:11, fontWeight:700, padding:'1px 7px', minWidth:20, textAlign:'center' }}>{lowStock}</span>}
                </div>
              )
            })}
          </nav>
        </div>
      </>
    )
  }

  // 非 iOS: 保留滑出动画
  const closeWithAnim = (e) => {
    e?.stopPropagation()
    setAnimatingOut(true)
    setSidebarOpen(false)
    setTimeout(() => setAnimatingOut(false), 260)
  }

  const closeInstant = (id) => {
    const go = () => { setSidebarOpen(false); onNavigate(id) }
    if (document.startViewTransition) document.startViewTransition(go)
    else go()
  }

  const showPanel = sidebarOpen || animatingOut
  if (!showPanel) return null
  const panelSlideOut = animatingOut && !sidebarOpen

  return (
    <>
      <div onClick={closeWithAnim} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:999 }} />
      <div onClick={e => e.stopPropagation()} style={{
        position:'fixed', top:0, left:0, bottom:0,
        width:'80vw', maxWidth:320,
        background:'var(--sidebar,#1e293b)', color:'#fff',
        zIndex:1000,
        paddingTop:'env(safe-area-inset-top,0px)',
        paddingBottom:'env(safe-area-inset-bottom,0px)',
        transform: panelSlideOut ? 'translateX(-100%)' : 'translateX(0)',
        transition: panelSlideOut ? 'transform 0.25s cubic-bezier(0.4,0,0.2,1)' : 'none',
        display:'flex', flexDirection:'column',
        overflowY:'auto', WebkitOverflowScrolling:'touch',
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px 8px', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'var(--primary)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:16 }}>供</div>
            <span style={{ color:'#fff', fontWeight:700, fontSize:17 }}>SupplyChain</span>
          </div>
          <button onClick={closeWithAnim} aria-label="关闭菜单" style={{ background:'rgba(255,255,255,0.12)', border:'none', borderRadius:8, color:'#fff', width:32, height:32, cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>
        <nav style={{ flex:1, padding:'8px 12px' }}>
          {NAV.map(item => {
            const active = page === item.id
            return (
              <div key={item.id} onClick={() => closeInstant(item.id)} style={{
                display:'flex', alignItems:'center', gap:12, padding:'13px 16px', borderRadius:12, marginBottom:4,
                background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: active ? '#fff' : 'rgba(255,255,255,0.72)',
                cursor:'pointer', fontWeight: active ? 600 : 400, fontSize:15,
              }}>
                <span style={{ fontSize:20, width:24, textAlign:'center', flexShrink:0 }}>{item.icon}</span>
                <span style={{ flex:1 }}>{item.label}</span>
                {item.id === 'quality' && errCount > 0 && <span style={{ background:'var(--danger)', color:'#fff', borderRadius:99, fontSize:11, fontWeight:700, padding:'1px 7px', minWidth:20, textAlign:'center' }}>{errCount}</span>}
                {item.id === 'inv' && lowStock > 0 && <span style={{ background:'var(--warning)', color:'#fff', borderRadius:99, fontSize:11, fontWeight:700, padding:'1px 7px', minWidth:20, textAlign:'center' }}>{lowStock}</span>}
              </div>
            )
          })}
        </nav>
      </div>
    </>
  )
}
