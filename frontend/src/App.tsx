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
import './version'

export const NAV = [
  { id:'dash',label:'总览',icon:'📊'},{id:'products',label:'商品',icon:'🏷️'},{id:'suppliers',label:'供应商',icon:'🏭'},
  { id:'orders',label:'订单',icon:'📋'},{id:'inv',label:'进销存',icon:'📦'},{id:'insights',label:'建议',icon:'💡'},
  { id:'cleansing',label:'清洗',icon:'🧹'},{id:'rules',label:'规则',icon:'⚙️'},
  { id:'quality',label:'异常',icon:'⚠️'},
]

export default function App() {
  const [page, setPage] = useState('dash')
  const [highlightSku, setHighlightSku] = useState('')
  const { inventory, qualityLogs, startPolling, stopAll, sidebarOpen, setSidebarOpen, wsStatus } = useAppStore()

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

  // 同步 html/body 背景色 + browser chrome 色到当前视图
  useEffect(() => {
    const pageBg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#f8fafc'
    const bg = sidebarOpen ? '#1e293b' : pageBg
    document.documentElement.style.backgroundColor = bg
    document.body.style.backgroundColor = bg
    const themeMeta = document.querySelector('meta[name="theme-color"]')
    if (themeMeta) themeMeta.setAttribute('content', bg)
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
          background:'#1e293b', color:'#fff',
          display:'flex', flexDirection:'column',
          paddingTop:'env(safe-area-inset-top,0px)',
          paddingBottom:'env(safe-area-inset-bottom,0px)',
          overflowY:'auto', WebkitOverflowScrolling:'touch',
        }}>
          <Sidebar page={page} onClose={closeSidebar} onNavigate={navAndClose} lowStock={lowStock} errCount={errCount} />
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
          <span className="header-status">{wsStatus === 'connected' ? '🟢 实时' : wsStatus === 'polling' ? '🟡 轮询' : '🔴 断开'}</span>
        </div>
      </header>
      <main className="container">
        {renderPage(page)}
      </main>
    </ToastProvider>
  )
}
