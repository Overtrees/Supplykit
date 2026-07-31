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
import SettingsPage from './pages/SettingsPage'
import Sidebar from './components/Sidebar'
import useKeyboard from './hooks/useKeyboard'
import { IconStatusOnline, IconStatusWarning, IconStatusOffline } from './components/Icons'
import './version'

export const NAV = [
  { id:'dash',label:'多维数据看板'},{id:'products',label:'货品信息'},{id:'suppliers',label:'供应商管理'},
  { id:'orders',label:'订单明细'},{id:'inv',label:'进销存台账'},{id:'insights',label:'货品供应建议'},
  { id:'cleansing',label:'数据清洗及导入'},{id:'rules',label:'模块联动规则引擎'},
  { id:'quality',label:'操作异常记录'},{id:'settings',label:'设置'},
]

export default function App() {
  const [page, setPage] = useState('dash')
  const [highlightSku, setHighlightSku] = useState('')
  const { inventory, qualityLogs, startPolling, stopAll, wsStatus, channel, setChannel } = useAppStore()
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

  const [showMenu, setShowMenu] = useState(false)
  const [menuClosing, setMenuClosing] = useState(false)
  const menuCloseTimerRef = useRef(null)

  const openEditorMenu = useCallback(() => {
    clearTimeout(menuCloseTimerRef.current)
    setMenuClosing(true)
    setShowMenu(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setMenuClosing(false))
    })
  }, [])

  const closeEditorMenu = useCallback(() => {
    clearTimeout(menuCloseTimerRef.current)
    setMenuClosing(true)
    menuCloseTimerRef.current = setTimeout(() => {
      setShowMenu(false)
      setMenuClosing(false)
    }, 220)
  }, [])

  const toggleEditorMenu = useCallback(() => {
    if (showMenu && !menuClosing) closeEditorMenu()
    else openEditorMenu()
  }, [showMenu, menuClosing, closeEditorMenu, openEditorMenu])

  useEffect(() => {
    if (!showMenu) return
    const close = () => closeEditorMenu()
    window.addEventListener('scroll', close, { passive: true })
    return () => window.removeEventListener('scroll', close)
  }, [showMenu, closeEditorMenu])

  const navAndClose = useCallback((id, sku) => {
    closeEditorMenu()
    if (sku) setHighlightSku(sku)
    setPage(id)
  }, [closeEditorMenu])

  useKeyboard({
    'meta+b': () => toggleEditorMenu(),
    'esc': () => { if (showMenu) closeEditorMenu() },
  })
  useEffect(() => { startPolling(); return () => stopAll() }, [])

  // 同步 html/body 背景色 + browser chrome 色
  useEffect(() => {
    const themeMeta = document.querySelector('meta[name="theme-color"]')
    if (themeMeta) {
      const resolved = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
      themeMeta.setAttribute('content', resolved)
    }
  }, [])
  // 监听系统主题变化，更新 theme-color
  useEffect(() => {
    const syncMeta = () => {
      const themeMeta = document.querySelector('meta[name="theme-color"]')
      if (themeMeta) {
        const resolved = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
        themeMeta.setAttribute('content', resolved)
      }
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', syncMeta)
    return () => mq.removeEventListener('change', syncMeta)
  }, [])

  const navigate = useCallback((newPage, sku) => {
    if (sku) setHighlightSku(sku)
    setPage(newPage)
  }, [])

  const lowStock = (inventory||[]).filter(x => Number(x.available_qty) < Number(x.safety_qty)).length
  const errCount = (qualityLogs||[]).length

  const renderPage = (pageId) => {
    const wrap = (el) => <ErrorBoundary key={pageId}>{el}</ErrorBoundary>
    switch (pageId) {
      case 'dash': return wrap(<DashboardPage key={pageId} onAlert={(s)=>{navigate('inv',s)}} />)
      case 'products': return wrap(<ProductPage key={pageId} />)
      case 'suppliers': return wrap(<SupplierPage key={pageId} />)
      case 'orders': return wrap(<OrdersPage key={pageId} />)
      case 'inv': return wrap(<InventoryPage key={pageId} highlightSku={highlightSku || ''} />)
      case 'insights': return wrap(<InsightsPage key={pageId} />)
      case 'cleansing': return wrap(<CleansingPage key={pageId} />)
      case 'rules': return wrap(<RulesPage key={pageId} />)
      case 'quality': return wrap(<QualityPage key={pageId} />)
      case 'settings': return wrap(<SettingsPage key={pageId} />)
      default: return null
    }
  }

  return (
    <ToastProvider>
      {/* 主内容 — 侧边栏打开时显示菜单，关闭时显示页面 */}
      <header>
        <div className="header-inner">
          <div className="header-left">
            <span className="header-status">
              <select value={channel} onChange={e=>setChannel(e.target.value)} style={{background:'transparent',border:'none',outline:'none',color:'inherit',fontSize:'inherit',fontWeight:'inherit',cursor:'pointer',padding:0,margin:0,appearance:'none',WebkitAppearance:'none',MozAppearance:'none'}}>
                <option value='jd'>京东</option>
                <option value='other'>其他渠道</option>
              </select>
            </span>
          </div>
          <button className="menu-btn" onClick={toggleEditorMenu}>
            <svg width="26" height="26" viewBox="0 0 20 20" fill="none"><rect x="2" y="4" width="16" height="1.5" rx=".75" fill="currentColor"/><rect x="2" y="9.25" width="16" height="1.5" rx=".75" fill="currentColor"/><rect x="2" y="14.5" width="16" height="1.5" rx=".75" fill="currentColor"/></svg>
          </button>
        </div>
      </header>
      <Sidebar page={page} onClose={closeEditorMenu} onNavigate={navAndClose} lowStock={lowStock} errCount={errCount} apiStatus={apiStatus} open={showMenu} menuClosing={menuClosing} onBackdrop={closeEditorMenu} />
      <main className="container">
        {renderPage(page)}
      </main>
    </ToastProvider>
  )
}
