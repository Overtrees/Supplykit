import React, { useState, useEffect, useCallback } from "react"
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
import PageShell from './components/PageShell'
import UploadPanel from './components/UploadPanel'
import useKeyboard from './hooks/useKeyboard'
import './version'

// 导航配置（也用于 Sidebar）
export const NAV = [
  { id:'dash',label:'总览',icon:'📊'},{id:'products',label:'商品',icon:'🏷️'},{id:'suppliers',label:'供应商',icon:'🏭'},
  { id:'orders',label:'订单',icon:'📋'},{id:'inv',label:'库存',icon:'📦'},{id:'insights',label:'建议',icon:'💡'},
  { id:'cleansing',label:'清洗',icon:'🧹'},{id:'rules',label:'规则',icon:'⚙️'},{id:'import',label:'导入数据',icon:'📤'},
  { id:'quality',label:'异常',icon:'⚠️'},
]

const TRANSITION_DURATION = 300 // ms

function renderPage(pageId, onNavigate, highlightSku) {
  const wrap = (el) => <ErrorBoundary key={pageId}>{el}</ErrorBoundary>
  switch (pageId) {
    case 'dash': return wrap(<DashboardPage onAlert={(s)=>{onNavigate('inv',s)}} />)
    case 'products': return wrap(<ProductPage />)
    case 'suppliers': return wrap(<SupplierPage />)
    case 'orders': return wrap(<OrdersPage />)
    case 'inv': return wrap(<InventoryPage highlightSku={highlightSku || ''} />)
    case 'insights': return wrap(<InsightsPage />)
    case 'cleansing': return wrap(<CleansingPage />)
    case 'rules': return wrap(<RulesPage />)
    case 'import': return wrap(<UploadPanel onImport={(t)=>onNavigate(t==='orders'?'orders':'inv')} />)
    case 'quality': return wrap(<QualityPage />)
    default: return null
  }
}

export default function App() {
  const [page, setPage] = useState('dash')
  const [leavingPage, setLeavingPage] = useState(null)
  const [transitioning, setTransitioning] = useState(false)
  const [highlightSku, setHighlightSku] = useState('')
  const { inventory, qualityLogs, startPolling, stopAll, setSidebarOpen } = useAppStore()
  useKeyboard({
    'meta+b': () => { const s = useAppStore.getState(); s.setSidebarOpen(!s.sidebarOpen) },
    'esc': () => setSidebarOpen(false)
  })
  useEffect(() => { startPolling(); return () => stopAll() }, [])

  const navigate = useCallback((newPage, sku) => {
    if (newPage === page || transitioning) return
    if (sku) setHighlightSku(sku)
    setLeavingPage(page)
    setPage(newPage)
    setTransitioning(true)
    setTimeout(() => {
      setTransitioning(false)
      setLeavingPage(null)
    }, TRANSITION_DURATION)
  }, [page, transitioning])

  const handleMenuClick = useCallback(() => setSidebarOpen(true), [])

  const lowStock = (inventory||[]).filter(x => Number(x.available_qty) < Number(x.safety_qty)).length
  const errCount = (qualityLogs||[]).length

  return (
    <ToastProvider>
      <Sidebar page={page} onNavigate={navigate} lowStock={lowStock} errCount={errCount} />
      <div style={{ position:'relative', minHeight:'100vh', background:'var(--bg)' }}>
        {/* 离开中的页面 — 向左滑出 */}
        {leavingPage && (
          <div key={`exit-${leavingPage}`} style={{
            position:'fixed', inset:0, zIndex:10, overflow:'hidden',
            animation: `slideOutLeft ${TRANSITION_DURATION}ms cubic-bezier(0.4,0,0.2,1) forwards`,
          }}>
            <PageShell onMenuClick={handleMenuClick}>
              {renderPage(leavingPage, navigate, '')}
            </PageShell>
          </div>
        )}
        {/* 当前页面 — 从右侧滑入 / 静态展示 */}
        <div key={`enter-${page}`} style={{
          position: transitioning ? 'fixed' : 'relative',
          inset:0, zIndex: transitioning ? 20 : 1,
          overflow: transitioning ? 'hidden' : 'visible',
          animation: transitioning
            ? `slideInRight ${TRANSITION_DURATION}ms cubic-bezier(0.4,0,0.2,1) forwards`
            : 'none',
        }}>
          <PageShell onMenuClick={handleMenuClick}>
            {renderPage(page, navigate, highlightSku)}
          </PageShell>
        </div>
      </div>
    </ToastProvider>
  )
}
