import React, { useState, useEffect } from "react"
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

// 导航配置（也用于 Sidebar）
export const NAV = [
  { id:'dash',label:'总览',icon:'📊'},{id:'products',label:'商品',icon:'🏷️'},{id:'suppliers',label:'供应商',icon:'🏭'},
  { id:'orders',label:'订单',icon:'📋'},{id:'inv',label:'库存',icon:'📦'},{id:'insights',label:'建议',icon:'💡'},
  { id:'cleansing',label:'清洗',icon:'🧹'},{id:'rules',label:'规则',icon:'⚙️'},{id:'import',label:'导入数据',icon:'📤'},
  { id:'quality',label:'异常',icon:'⚠️'},
]

export default function App() {
  const [page, setPage] = useState('dash')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [highlightSku, setHighlightSku] = useState('')
  const { inventory, qualityLogs, startPolling, stopAll, wsStatus } = useAppStore()
  useKeyboard({ 'meta+b': () => setSidebarOpen(o=>!o), 'esc': () => setSidebarOpen(false) })
  useEffect(() => { startPolling(); return () => stopAll() }, [])
  const lowStock = (inventory||[]).filter(x => Number(x.available_qty) < Number(x.safety_qty)).length
  const errCount = (qualityLogs||[]).length
  return <ToastProvider>
    <Sidebar open={sidebarOpen} onClose={()=>setSidebarOpen(false)} page={page} onNavigate={setPage} lowStock={lowStock} errCount={errCount} />
    <div style={{minHeight:'100vh',background:'#f8fafc',fontFamily:'system-ui, sans-serif',color:'#0f172a'}}>
      <div style={{background:'linear-gradient(135deg,#0f172a,#1d4ed8)',color:'#fff',padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',position:'relative',zIndex:1}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button onClick={()=>setSidebarOpen(true)} style={{width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:8,cursor:'pointer',border:'none',background:'rgba(255,255,255,0.12)',color:'#fff',fontSize:18,flexShrink:0}}>☰</button>
          <div><div style={{fontSize:20,fontWeight:800,lineHeight:1.3}}>SupplyChain V1</div><div style={{fontSize:12,color:'rgba(255,255,255,0.6)'}}>React + ECharts</div></div>
        </div>
        <div style={{fontSize:12,color:wsStatus==='connected'?'#86efac':wsStatus==='polling'?'#fcd34d':'#f87171'}}>{wsStatus==='connected'?'🟢 实时':wsStatus==='polling'?'🟡 轮询':'🔴 断开'}</div>
      </div>
      <div style={{maxWidth:1200,margin:'0 auto',padding:20}}>
        {page==='dash' && <ErrorBoundary><DashboardPage onAlert={(s)=>{setHighlightSku(s);setPage('inv')}} /></ErrorBoundary>}
        {page==='products' && <ErrorBoundary><ProductPage /></ErrorBoundary>}
        {page==='suppliers' && <ErrorBoundary><SupplierPage /></ErrorBoundary>}
        {page==='orders' && <ErrorBoundary><OrdersPage /></ErrorBoundary>}
        {page==='inv' && <ErrorBoundary><InventoryPage highlightSku={highlightSku} /></ErrorBoundary>}
        {page==='insights' && <ErrorBoundary><InsightsPage /></ErrorBoundary>}
        {page==='cleansing' && <ErrorBoundary><CleansingPage /></ErrorBoundary>}
        {page==='rules' && <ErrorBoundary><RulesPage /></ErrorBoundary>}
        {page==='import' && <ErrorBoundary><UploadPanel onImport={(t)=>setPage(t==='orders'?'orders':'inv')} /></ErrorBoundary>}
        {page==='quality' && <ErrorBoundary><QualityPage /></ErrorBoundary>}
      </div>
    </div>
  </ToastProvider>
}
