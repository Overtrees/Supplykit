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
  const { inventory, qualityLogs, startPolling, stopAll, sidebarOpen, setSidebarOpen, wsStatus, channel, setChannel, channelVersion } = useAppStore()
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

  // 状态变更直接执行，不使用 View Transition（避免过渡色块问题）
  const withTransition = useCallback((fn) => {
    return (...args) => fn(...args)
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

  // 同步 html/body 背景色 + browser chrome 色
  useEffect(() => {
    document.documentElement.classList.toggle('sidebar-open', sidebarOpen)
    document.body.classList.toggle('sidebar-open', sidebarOpen)
    const themeMeta = document.querySelector('meta[name="theme-color"]')
    if (themeMeta) {
      const resolved = getComputedStyle(document.documentElement).getPropertyValue(sidebarOpen ? '--sidebar' : '--bg').trim()
      themeMeta.setAttribute('content', resolved)
    }
  }, [sidebarOpen])
  // 监听系统主题变化，更新 theme-color
  useEffect(() => {
    const syncMeta = () => {
      const themeMeta = document.querySelector('meta[name="theme-color"]')
      if (themeMeta) {
        const resolved = getComputedStyle(document.documentElement).getPropertyValue(sidebarOpen ? '--sidebar' : '--bg').trim()
        themeMeta.setAttribute('content', resolved)
      }
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', syncMeta)
    return () => mq.removeEventListener('change', syncMeta)
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
      case 'dash': return wrap(<DashboardPage key={channelVersion} onAlert={(s)=>{navigate('inv',s)}} />)
      case 'products': return wrap(<ProductPage key={channelVersion} />)
      case 'suppliers': return wrap(<SupplierPage key={channelVersion} />)
      case 'orders': return wrap(<OrdersPage key={channelVersion} />)
      case 'inv': return wrap(<InventoryPage key={channelVersion} highlightSku={highlightSku || ''} />)
      case 'insights': return wrap(<InsightsPage key={channelVersion} />)
      case 'cleansing': return wrap(<CleansingPage key={channelVersion} />)
      case 'rules': return wrap(<RulesPage key={channelVersion} />)
      case 'quality': return wrap(<QualityPage key={channelVersion} />)
      default: return null
    }
  }

  return (
    <ToastProvider>
      {/* 主内容 — 侧边栏打开时显示菜单，关闭时显示页面 */}
      <header>
        <div className="header-inner">
          <div className="header-left">
            <button className="menu-btn" onClick={sidebarOpen ? closeSidebar : openSidebar}>
              <svg width="26" height="26" viewBox="0 0 20 20" fill="none"><rect x="2" y="4" width="16" height="1.5" rx=".75" fill="currentColor"/><rect x="2" y="9.25" width="16" height="1.5" rx=".75" fill="currentColor"/><rect x="2" y="14.5" width="16" height="1.5" rx=".75" fill="currentColor"/></svg>
            </button>
            <select value={channel} onChange={e=>{localStorage.setItem('c_channel', e.target.value); window.location.reload()}} style={{marginLeft:8,fontSize:13,padding:'3px 8px',border:'1px solid var(--border)',borderRadius:32,outline:'none',background:'var(--sidebar)',color:'var(--text)',cursor:'pointer'}}>
              <option value='jd'>京东</option>
              <option value='other'>其他渠道</option>
            </select>
          </div>
          <span className="header-status">
            {wsStatus === 'connected' ? <><IconStatusOnline size={14} /> 实时</> : wsStatus === 'polling' ? <><IconStatusWarning size={14} /> 轮询</> : <><IconStatusOffline size={14} /> 断开</>}
          </span>
        </div>
      </header>
      <main className="container">
        {sidebarOpen ? (
          <Sidebar page={page} onClose={closeSidebar} onNavigate={navAndClose} lowStock={lowStock} errCount={errCount} apiStatus={apiStatus} />
        ) : (
          renderPage(page)
        )}
      </main>
    </ToastProvider>
  )
}
