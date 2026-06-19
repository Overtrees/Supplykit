import React from 'react'
import { NAV } from '../App'
import { useAppStore } from '../store/useAppStore'

export default function Sidebar({ page, onNavigate, lowStock, errCount }) {
  const sidebarOpen = useAppStore(s => s.sidebarOpen)
  const setSidebarOpen = useAppStore(s => s.setSidebarOpen)

  return (
    <div style={{
      position:'fixed', inset:0, width:'100%', color:'#fff',
      zIndex:99999999, display:'flex', flexDirection:'column', overflow:'hidden',
      paddingTop:'env(safe-area-inset-top,0)', paddingBottom:'env(safe-area-inset-bottom,0)',
      ...(sidebarOpen ? { background:'var(--sidebar)' } : { pointerEvents:'none' }),
    }}>
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
  )
}
