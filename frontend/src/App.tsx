import React, { useState, useEffect, useCallback, useRef } from "react"
import { useAppStore } from './store/useAppStore'
import { ToastProvider } from './components/Toast'
import ProductPage from './pages/ProductPage'
import SupplierPage from './pages/SupplierPage'
import InsightsPage from './pages/InsightsPage'
import CleansingPage from './pages/CleansingPage'
import RulesPage from './pages/RulesPage'
import DashboardPage from './pages/DashboardPage'
import ErrorBoundary from './components/ErrorBoundary'
import OrdersPage from './pages/OrdersPage'
import InventoryPage from './pages/InventoryPage'
import QualityPage from './pages/QualityPage'
import Sidebar from './components/Sidebar'
import useKeyboard from './hooks/useKeyboard'
import { IconStatusOnline, IconStatusWarning, IconStatusOffline } from './components/Icons'
import './version'

export const NAV = [
  { id:'dash',label:'多维数据看板'},{id:'products',label:'货品信息'},{id:'suppliers',label:'供应商管理'},
  { id:'orders',label:'订单明细'},{id:'inv',label:'进销存台账'},{id:'insights',label:'货品供应建议'},
  { id:'cleansing',label:'数据清洗及导入'},{id:'rules',label:'模块联动规则引擎'},
  { id:'quality',label:'操作异常记录'},
]

export default function App() {
  const [page, setPage] = useState('dash')
  const [highlightSku, setHighlightSku] = useState('')
  const { inventory, qualityLogs, startPolling, stopAll, sidebarOpen, setSidebarOpen, wsStatus } = useAppStore()
  const [apiStatus, setApiStatus] = useState('checking')
  const checkApi = useCallback(async() => {
    try {
      const ctrl = new AbortController(); setTimeout(() => ctrl.abort(), 5000)
      const r = await fetch('https://overtrees.pythonanywhere.com/api/insights/ping', {signal: ctrl.signal})
      const d = await r.json()
      setApiStatus(d.ok ? 'ok' : 'slow')
    } catch { setApiStatus('error') }
  }, [])
  useEffect(() => { checkApi(); const t = setInterval(checkApi, 15000); return () => clearInterval(t) }, [checkApi])

  // View Transition 包装器：任何状态变更都走快照过渡
  const withTransition = useCallback((fn) => {
    return (...args) => {
      const go = () => fn(...args)
      if (document.startViewTransition) {
        document.startViewTransition(go)
      } else {
        go()
      }
    }
  }, [])

  const openSidebar = withTransition(() => setSidebarOpen(true))
  const closeSidebar = withTransition(() => setSidebarOpen(false))
  const navAndClose = withTransition((id, sku) => {
    setSidebarOpen(false)
    if (sku) setHighlightSku(sku)
    setPage(id)
  })

  useKeyboard({
    'meta+b': () => { const s = useAppStore.getState(); s.setSidebarOpen(!s.sidebarOpen) },
    'esc': () => setSidebarOpen(false)
  })
  useEffect(() => { startPolling(); return () => stopAll() }, [])

  // 同步 html/body 背景色 + browser chrome 色，监听系统主题变化
  useEffect(() => {
    const syncBg = () => {
      const resolvedBg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#f2f2f7'
      const resolvedSidebar = getComputedStyle(document.documentElement).getPropertyValue('--sidebar').trim() || resolvedBg
      const bg = sidebarOpen ? resolvedSidebar : resolvedBg
      document.documentElement.style.backgroundColor = bg
      document.body.style.backgroundColor = bg
      const themeMeta = document.querySelector('meta[name="theme-color"]')
      if (themeMeta) themeMeta.setAttribute('content', bg)
    }
    syncBg()
    // 监听系统暗/亮模式切换，重新同步背景色
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', syncBg)
    return () => mq.removeEventListener('change', syncBg)
  }, [sidebarOpen])

  const navigate = useCallback((newPage, sku) => {
    if (sku) setHighlightSku(sku)
    setPage(newPage)
  }, [])

  const lowStock = (inventory||[]).filter(x => Number(x.available_qty) < Number(x.safety_qty)).length
  const errCount = (qualityLogs||[]).length

  const renderPage = (pageId) => {
    const wrap = (el) => <ErrorBoundary key={pageId}>{el}</ErrorBoundary>
    switch (pageId) {
      case 'dash': return wrap(<DashboardPage onAlert={(s)=>{navigate('inv',s)}} />)
      case 'products': return wrap(<ProductPage />)
      case 'suppliers': return wrap(<SupplierPage />)
      case 'orders': return wrap(<OrdersPage />)
      case 'inv': return wrap(<InventoryPage highlightSku={highlightSku || ''} />)
      case 'insights': return wrap(<InsightsPage />)
      case 'cleansing': return wrap(<CleansingPage />)
      case 'rules': return wrap(<RulesPage />)
      case 'quality': return wrap(<QualityPage />)
      default: return null
    }
  }

  return (
    <ToastProvider>
      {/* 侧边栏覆盖层 — 用 position:fixed + View Transition 切换 */}
      {sidebarOpen && (
        <div style={{
          position:'fixed', inset:0, zIndex:100,
          background:'var(--sidebar)',
          display:'flex', flexDirection:'column',
          paddingTop:'env(safe-area-inset-top,0px)',
          overflowY:'auto', WebkitOverflowScrolling:'touch',
        }}>
          <Sidebar page={page} onClose={closeSidebar} onNavigate={navAndClose} lowStock={lowStock} errCount={errCount} apiStatus={apiStatus} />
        </div>
      )}

      {/* 主内容 */}
      <header>
        <div className="header-inner">
          <div className="header-left">
            <button className="menu-btn" onClick={openSidebar}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="4" width="16" height="1.5" rx=".75" fill="currentColor"/><rect x="2" y="9.25" width="16" height="1.5" rx=".75" fill="currentColor"/><rect x="2" y="14.5" width="16" height="1.5" rx=".75" fill="currentColor"/></svg>
            </button>
          </div>
          <span className="header-status" style={{display:'flex',alignItems:'center',gap:4}}>
            {wsStatus === 'connected' ? <><IconStatusOnline size={10} /> 实时</> : wsStatus === 'polling' ? <><IconStatusWarning size={10} /> 轮询</> : <><IconStatusOffline size={10} /> 断开</>}
          </span>
        </div>
      </header>
      <main className="container">
        {renderPage(page)}
      </main>
    </ToastProvider>
  )
}
