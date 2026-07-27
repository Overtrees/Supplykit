import React from 'react'
import { NAV } from '../App'
import { NAV_ICONS, IconClose } from './Icons'

export default function Sidebar({ page, onClose, onNavigate, lowStock, errCount }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1 }}>
      {/* 头部 */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ color:'#fff', fontWeight:700, fontSize:17 }}>媒介</span>
        </div>
        <button onClick={onClose} aria-label="关闭菜单" style={{ background:'rgba(255,255,255,0.12)', border:'none', borderRadius:8, color:'#fff', width:32, height:32, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <IconClose size={16} />
        </button>
      </div>

      {/* 导航项 */}
      <nav style={{ flex:1, padding:'8px 12px' }}>
        {NAV.map(item => {
          const active = page === item.id
          const IconComp = NAV_ICONS[item.id]
          return (
            <div key={item.id} onClick={() => onNavigate(item.id)} style={{
              display:'flex', alignItems:'center', gap:12,
              padding:'13px 16px', borderRadius:12, marginBottom:4,
              background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
              color: active ? '#fff' : 'rgba(255,255,255,0.72)',
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
