import React, { useEffect, useRef, useCallback } from 'react'
import { NAV } from '../App'
import { NAV_ICONS } from './Icons'

export default function Sidebar({ page, onClose, onNavigate, lowStock, errCount, apiStatus, open, menuClosing, onBackdrop }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target) && !e.target.closest('.menu-btn')) {
        onBackdrop()
      }
    }
    setTimeout(() => document.addEventListener('pointerdown', handler), 0)
    return () => document.removeEventListener('pointerdown', handler)
  }, [open])

  if (!open) return null

  return (
    <>
      {/* 遮罩 */}
      <div
        onPointerDown={onBackdrop}
        style={{
          position: 'fixed', inset: 0, zIndex: 3001,
          background: 'transparent',
          transition: 'background 220ms ease'
        }}
      />
      {/* 菜单面板 */}
      <div
        ref={ref}
        onPointerDown={e => e.stopPropagation()}
        style={{
          position: 'fixed', zIndex: 3002,
          right: 16,
          top: 'calc(env(safe-area-inset-top) + 7px + 46px + 6px)',
          width: 246,
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturate)) brightness(var(--glass-brightness))',
          WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturate)) brightness(var(--glass-brightness))',
          border: '0.5px solid var(--glass-border)',
          boxShadow: '0 2px 20px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.25)',
          borderRadius: 22,
          overflow: 'hidden',
          opacity: menuClosing ? 0 : 1,
          transform: menuClosing ? 'translateY(-10px) scale(0.92)' : 'translateY(0) scale(1)',
          transformOrigin: '85% -18px',
          transition: 'opacity 180ms ease, transform 220ms cubic-bezier(0.34,1.56,0.64,1)',
          willChange: 'opacity, transform'
        }}
      >
        <div style={{ padding: 7 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 10px 12px', borderBottom:'0.5px solid var(--glass-border)', marginBottom:4 }}>
            <span style={{ fontWeight:700, fontSize:15, color:'var(--text)' }}>菜单</span>
            <span style={{ fontSize:11, color:'var(--muted2)' }}>
              <span style={{ width:8, height:8, borderRadius:'50%', display:'inline-block', background: apiStatus==='ok' ? '#22c55e' : apiStatus==='slow' ? '#f59e0b' : '#ef4444', marginRight:4 }} />
              {apiStatus==='ok' ? 'API正常' : apiStatus==='slow' ? '响应慢' : 'API异常'}
            </span>
          </div>
          {NAV.map(item => {
            const active = page === item.id
            const IconComp = NAV_ICONS[item.id]
            return (
              <button key={item.id} onClick={() => onNavigate(item.id)}
                style={{
                  width:'100%', minHeight:50, border:'none',
                  background: active ? 'rgba(29,78,216,0.1)' : 'transparent',
                  borderRadius:17, display:'flex', alignItems:'center', gap:11,
                  padding:'8px 10px', color:'var(--text)', fontSize:14,
                  fontFamily:'inherit', cursor:'pointer', textAlign:'left',
                  fontWeight: active ? 600 : 400, marginBottom:2
                }}>
                {IconComp && <span style={{ width:24, height:24, display:'flex', alignItems:'center', justifyContent:'center', flex:'none', color:'var(--primary)' }}>
                  <IconComp size={20} />
                </span>}
                <span style={{ minWidth:0, flex:1 }}>
                  <span style={{ display:'block', fontSize:15, fontWeight: active ? 650 : 400, letterSpacing:'-0.1px' }}>
                    {item.label}
                  </span>
                  <span style={{ display:'block', fontSize:11, color:'var(--muted2)', marginTop:2 }}>
                    {item.id === 'dash' && '数据概览'}
                    {item.id === 'insights' && '补货/采购建议'}
                    {item.id === 'orders' && '订单明细'}
                    {item.id === 'inv' && '进销存台账'}
                    {item.id === 'products' && '商品管理'}
                    {item.id === 'suppliers' && '供应商管理'}
                    {item.id === 'cleansing' && '数据清洗导入'}
                    {item.id === 'rules' && '规则与参数配置'}
                    {item.id === 'quality' && '数据异常记录'}
                  </span>
                </span>
                {item.id === 'quality' && errCount > 0 &&
                  <span style={{ background:'var(--danger)', color:'#fff', borderRadius:99, fontSize:11, fontWeight:700, padding:'1px 7px', minWidth:20, textAlign:'center' }}>{errCount}</span>}
                {item.id === 'inv' && lowStock > 0 &&
                  <span style={{ background:'var(--warning)', color:'#fff', borderRadius:99, fontSize:11, fontWeight:700, padding:'1px 7px', minWidth:20, textAlign:'center' }}>{lowStock}</span>}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}