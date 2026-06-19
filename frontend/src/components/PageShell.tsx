import React from 'react'
import { useAppStore } from '../store/useAppStore'

export default function PageShell({ children, onMenuClick }) {
  const wsStatus = useAppStore(s => s.wsStatus)

  return (
    <div className="page-shell">
      <div className="ps-header-safe">
        <div className="ps-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="ps-menu-btn" onClick={onMenuClick}>☰</button>
            <div className="ps-title">SupplyChain</div>
          </div>
          <div className="ps-status">
            {wsStatus === 'connected' ? '🟢 实时' : wsStatus === 'polling' ? '🟡 轮询' : '🔴 断开'}
          </div>
        </div>
      </div>
      <div className="ps-content">
        {children}
      </div>
    </div>
  )
}
