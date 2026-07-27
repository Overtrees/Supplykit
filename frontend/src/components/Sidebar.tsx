import React from 'react'
import { NAV } from '../App'
import { NAV_ICONS } from './Icons'

export default function Sidebar({ page, onClose, onNavigate, lowStock, errCount, apiStatus }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, color:'var(--text)' }}>
      {/* 头部 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ color:'var(--text)', fontWeight:700, fontSize:17 }}>媒介</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--muted)' }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background: apiStatus==='ok' ? '#22c55e' : apiStatus==='slow' ? '#f59e0b' : '#ef4444', flexShrink:0 }} />
          {apiStatus==='ok' ? 'API正常' : apiStatus==='slow' ? '响应慢' : 'API异常'}
        </div>
      </div>

      {/* 导航项 */}
      <nav style={{ flex:1, padding:'8px 12px', overflow:'auto' }}>
        {NAV.map(item => {
          const active = page === item.id
          const IconComp = NAV_ICONS[item.id]
          return (
            <div key={item.id} onClick={() => onNavigate(item.id)} style={{
              display:'flex', alignItems:'center', gap:12,
              padding:'13px 16px', borderRadius:12, marginBottom:4,
              background: active ? 'var(--sidebar-active-bg)' : 'transparent',
              color: active ? 'var(--sidebar-active-text)' : 'var(--muted)',
              cursor:'pointer', fontWeight: active ? 600 : 400, fontSize:15,
            }}>
              {IconComp && <IconComp size={20} />}
              <span style={{ flex:1 }}>{item.label}</span>
              {item.id === 'quality' && errCount > 0 &&
                <span style={{ background:'var(--danger)', color:'#fff', borderRadius:99, fontSize:11, fontWeight:700, padding:'1px 7px', minWidth:20, textAlign:'center' }}>{errCount}</span>}
              {item.id === 'inv' && lowStock > 0 &&
                <span style={{ background:'var(--warning)', color:'#fff', borderRadius:99, fontSize:11, fontWeight:700, padding:'1px 7px', minWidth:20, textAlign:'center' }}>{lowStock}</span>}
            </div>
          )
        })}
      </nav>
    </div>
  )
}
