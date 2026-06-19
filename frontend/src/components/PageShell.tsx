import React from 'react'
import { useAppStore } from '../store/useAppStore'

export default function PageShell({ children, onMenuClick }) {
  const wsStatus = useAppStore(s => s.wsStatus)

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Helvetica Neue",sans-serif',
      color: 'var(--text)',
      WebkitFontSmoothing: 'antialiased',
    }}>
      <div style={{
        paddingTop: 'env(safe-area-inset-top,0)',
        background: 'var(--bg)',
        flexShrink: 0,
      }}>
        <div style={{
          background: 'transparent', color: 'var(--text)',
          padding: '14px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={onMenuClick} style={{
              width: 32, height: 32, display: 'flex', alignItems: 'center',
              justifyContent: 'center', borderRadius: 8, cursor: 'pointer',
              border: 'none', background: 'rgba(0,0,0,0.06)', color: 'var(--text)',
              fontSize: 18, flexShrink: 0,
            }}>☰</button>
            <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.3 }}>SupplyChain</div>
          </div>
          <div style={{
            fontSize: 12,
            color: wsStatus === 'connected' ? '#86efac' : wsStatus === 'polling' ? '#fcd34d' : '#f87171',
          }}>
            {wsStatus === 'connected' ? '🟢 实时' : wsStatus === 'polling' ? '🟡 轮询' : '🔴 断开'}
          </div>
        </div>
      </div>
      <div style={{
        flex: 1,
        maxWidth: 1200, margin: '0 auto', width: '100%',
        padding: '20px 20px calc(20px + env(safe-area-inset-bottom, 0px))',
        overflowY: 'auto',
      }}>
        {children}
      </div>
    </div>
  )
}
