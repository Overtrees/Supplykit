import React, { useState, useEffect, useCallback, useLayoutEffect } from "react"
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
import UploadPanel from './components/UploadPanel'
import useKeyboard from './hooks/useKeyboard'
import './version'

export const NAV = [
  { id:'dash',label:'总览',icon:'📊'},{id:'products',label:'商品',icon:'🏷️'},{id:'suppliers',label:'供应商',icon:'🏭'},
  { id:'orders',label:'订单',icon:'📋'},{id:'inv',label:'库存',icon:'📦'},{id:'insights',label:'建议',icon:'💡'},
  { id:'cleansing',label:'清洗',icon:'🧹'},{id:'rules',label:'规则',icon:'⚙️'},{id:'import',label:'导入数据',icon:'📤'},
  { id:'quality',label:'异常',icon:'⚠️'},
]

export default function App() {
  const [page, setPage] = useState('dash')
  const [highlightSku, setHighlightSku] = useState('')
  const { inventory, qualityLogs, startPolling, stopAll, setSidebarOpen, wsStatus } = useAppStore()
  useKeyboard({
    'meta+b': () => { const s = useAppStore.getState(); s.setSidebarOpen(!s.sidebarOpen) },
    'esc': () => setSidebarOpen(false)
  })
  useEffect(() => { startPolling(); return () => stopAll() }, [])

  // 同步锁定 html/body 背景色，消除首帧闪烁
  useLayoutEffect(() => {
    const bg = getComputedStyle(document.body).backgroundColor
    if (bg && bg !== 'transparent' && bg !== 'rgba(0,0,0,0)') {
      document.documentElement.style.backgroundColor = bg
      document.body.style.backgroundColor = bg
    }
    return () => {
      // 清理内联样式，让 CSS 变量跟媒体查询走
      document.documentElement.style.backgroundColor = ''
      document.body.style.backgroundColor = ''
    }
  }, [page])

  // 每页 mount 时锁定背景色，消除从 sidebar 进页面的闪烁
  function PageLock({ children }) {
    useLayoutEffect(() => {
      const bg = getComputedStyle(document.body).backgroundColor
      if (bg && bg !== 'transparent' && bg !== 'rgba(0,0,0,0)') {
        document.documentElement.style.backgroundColor = bg
        document.body.style.backgroundColor = bg
      }
      return () => {
        document.documentElement.style.backgroundColor = ''
        document.body.style.backgroundColor = ''
      }
    }, [])
    return children
  }

  const navigate = useCallback((newPage, sku) => {
    if (sku) setHighlightSku(sku)
    setPage(newPage)
  }, [])

  const lowStock = (inventory||[]).filter(x => Number(x.available_qty) < Number(x.safety_qty)).length
  const errCount = (qualityLogs||[]).length

  const renderPage = (pageId) => {
    const wrap = (el) => <ErrorBoundary key={pageId}><PageLock>{el}</PageLock></ErrorBoundary>
    switch (pageId) {
      case 'dash': return wrap(<DashboardPage onAlert={(s)=>{navigate('inv',s)}} />)
      case 'products': return wrap(<ProductPage />)
      case 'suppliers': return wrap(<SupplierPage />)
      case 'orders': return wrap(<OrdersPage />)
      case 'inv': return wrap(<InventoryPage highlightSku={highlightSku || ''} />)
      case 'insights': return wrap(<InsightsPage />)
      case 'cleansing': return wrap(<CleansingPage />)
      case 'rules': return wrap(<RulesPage />)
      case 'import': return wrap(<UploadPanel onImport={(t)=>navigate(t==='orders'?'orders':'inv')} />)
      case 'quality': return wrap(<QualityPage />)
      default: return null
    }
  }

  return (
    <ToastProvider>
      <Sidebar page={page} onNavigate={navigate} lowStock={lowStock} errCount={errCount} />
      <header>
        <div className="header-inner">
          <div className="header-left">
            <button className="menu-btn" onClick={() => setSidebarOpen(true)}>
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
