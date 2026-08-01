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
import { useToast } from './components/Toast'
import { IconStatusOnline, IconStatusWarning, IconStatusOffline, IconExport } from './components/Icons'
import { api } from './api/client'
import './version'

export const NAV = [
  { id:'dash',label:'多维数据看板'},{id:'products',label:'货品信息'},{id:'suppliers',label:'供应商管理'},
  { id:'orders',label:'订单明细'},{id:'inv',label:'进销存台账'},{id:'insights',label:'货品供应建议'},
  { id:'cleansing',label:'数据清洗及导入'},{id:'rules',label:'模块联动规则引擎'},
  { id:'quality',label:'操作异常记录'},{id:'settings',label:'设置'},
]

/* 商品页: 锤子菜单列选择器 + 搜索 */
const PRODUCT_COLS = [
  {id:'barcode',label:'69码'},{id:'channel',label:'平台'},{id:'sku',label:'SKU'},{id:'name',label:'名称'},{id:'store',label:'店铺'},
  {id:'cat',label:'分类'},{id:'price',label:'单价'},{id:'box',label:'箱规'},{id:'weight',label:'箱重/KG'},{id:'volume',label:'体积/方'},{id:'status',label:'状态'},
]
const prodColKey = (ch) => 'c_cols_products_' + ch
const getProdVis = (ch) => { try { return JSON.parse(localStorage.getItem(prodColKey(ch)) || 'null') } catch{return null} }

function HammerProducts({ channel }) {
  const { hammerPanel, setHammerPanel, hammerSearch, setHammerSearch, setHammerCols } = useAppStore()
  const [visCols, setVisCols] = useState(() => getProdVis(channel) || PRODUCT_COLS.map(c => c.id))

  useEffect(() => {
    setVisCols(getProdVis(channel) || PRODUCT_COLS.map(c => c.id))
  }, [channel])

  const saveCols = (cols) => {
    setVisCols(cols)
    localStorage.setItem(prodColKey(channel), JSON.stringify(cols))
    setHammerCols('products', cols)
  }

  return (
    <div>
      <div style={{fontSize:11,color:'var(--muted2)',marginBottom:8,textAlign:'center'}}>
        {channel === 'jd' ? '京东' : '其他'} · 商品
      </div>
      {/* 功能按钮 */}
      <div style={{display:'flex',gap:6,marginBottom:hammerPanel?8:0}}>
        <button onClick={() => setHammerPanel(hammerPanel === 'columns' ? null : 'columns')}
          className="btn btn-ghost" style={{flex:1,fontSize:12,minHeight:32,padding:'4px 8px'}}>
          列选择 ({visCols.length}/{PRODUCT_COLS.length})
        </button>
        <button onClick={() => { setHammerPanel(hammerPanel === 'search' ? null : 'search'); if (hammerPanel !== 'search') setTimeout(() => document.getElementById('hm-search-prod')?.focus(), 100) }}
          className="btn btn-ghost" style={{flex:1,fontSize:12,minHeight:32,padding:'4px 8px'}}>
          搜索
        </button>
      </div>
      {/* 列选择面板 */}
      {hammerPanel === 'columns' && (
        <div style={{borderTop:'1px solid var(--border)',paddingTop:8,marginTop:0,maxHeight:260,overflowY:'auto'}}>
          <div style={{fontSize:10,color:'var(--muted2)',marginBottom:4,padding:'0 4px'}}>拖拽 ⠿ 调整列顺序</div>
          {(visCols.map(id=>PRODUCT_COLS.find(c=>c.id===id)).filter(Boolean).concat(PRODUCT_COLS.filter(c=>!visCols.includes(c.id)))).map((col,idx)=>{
            const isVis=visCols.includes(col.id)
            return <div key={col.id} draggable={isVis?true:undefined}
              onDragStart={isVis?e=>{e.dataTransfer.setData('text/plain',col.id);e.target.style.opacity='0.4';e.currentTarget.parentNode._dragId=col.id}:undefined}
              onDragEnd={isVis?e=>e.target.style.opacity='1':undefined}
              onDragOver={isVis?e=>{e.preventDefault();e.currentTarget.style.borderTop='2px solid var(--primary)';const from=e.currentTarget.parentNode._dragId;if(from&&from!==col.id){const nxt=visCols.filter(c=>c!==from);const toIdx=nxt.indexOf(col.id);nxt.splice(toIdx,0,from);saveCols(nxt)}}:undefined}
              onDragLeave={isVis?e=>e.currentTarget.style.borderTop='1px solid transparent':undefined}
              onDrop={isVis?e=>{e.preventDefault();e.currentTarget.style.borderTop='1px solid transparent';const from=e.dataTransfer.getData('text/plain');if(from===col.id)return;const nxt=visCols.filter(c=>c!==from);const toIdx=nxt.indexOf(col.id);nxt.splice(toIdx,0,from);saveCols(nxt);e.currentTarget.parentNode._dragId=null}:undefined}
              style={{display:'flex',alignItems:'center',gap:4,padding:'4px 6px',borderRadius:6,cursor:isVis?'grab':'default',fontSize:12,whiteSpace:'nowrap',borderTop:'1px solid transparent',background:isVis?'var(--card)':'transparent',opacity:isVis?1:0.4,userSelect:'none',WebkitUserSelect:'none'}}>
              <span style={{color:'var(--muted2)',fontSize:12,width:16,flexShrink:0,textAlign:'center',cursor:isVis?'grab':'default'}}>{isVis?'⠿':'○'}</span>
              <input type="checkbox" checked={isVis} onChange={e=>{const n=e.target.checked?[...visCols,col.id]:visCols.filter(c=>c!==col.id);saveCols(n)}} style={{accentColor:'var(--primary)'}} />
              <span style={{flex:1}}>{col.label}</span>
              <span style={{fontSize:9,color:'var(--muted2)'}}>{isVis?'#'+(visCols.indexOf(col.id)+1):''}</span>
            </div>
          })}
          <div style={{borderTop:'1px solid var(--border)',marginTop:4,paddingTop:4}}>
            <span onClick={()=>saveCols(PRODUCT_COLS.map(c=>c.id))} className="btn btn-ghost" style={{fontSize:10,padding:'2px 8px',cursor:'pointer'}}>全部</span>
          </div>
        </div>
      )}
      {/* 搜索面板 */}
      {hammerPanel === 'search' && (
        <div style={{borderTop:'1px solid var(--border)',paddingTop:8}}>
          <input id="hm-search-prod" value={hammerSearch} onChange={e=>setHammerSearch(e.target.value)}
            placeholder="搜索SKU/名称/店铺..."
            style={{width:'100%',padding:'6px 10px',fontSize:16,border:'1px solid var(--border)',borderRadius:32,outline:'none',boxSizing:'border-box',background:'var(--card)',color:'var(--text)'}} />
          {hammerSearch && (
            <div style={{fontSize:11,color:'var(--muted2)',marginTop:4,textAlign:'center'}}>
              按 Enter 搜索
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* 供应商页: 锤子菜单列选择器 + 搜索 */
const SUPPLIER_COLS = [{id:'code',label:'编号'},{id:'name',label:'名称'},{id:'contact',label:'联系人'},{id:'phone',label:'手机'},{id:'score',label:'评分'}]
const suppColKey = (ch) => 'c_cols_suppliers_' + ch
const getSuppVis = (ch) => { try { return JSON.parse(localStorage.getItem(suppColKey(ch)) || 'null') } catch{return null} }

function HammerSuppliers({ channel }) {
  const { hammerPanel, setHammerPanel, hammerSearch, setHammerSearch, setHammerCols } = useAppStore()
  const [visCols, setVisCols] = useState(() => getSuppVis(channel) || SUPPLIER_COLS.map(c => c.id))

  useEffect(() => {
    setVisCols(getSuppVis(channel) || SUPPLIER_COLS.map(c => c.id))
  }, [channel])

  const saveCols = (cols) => {
    setVisCols(cols)
    localStorage.setItem(suppColKey(channel), JSON.stringify(cols))
    setHammerCols('suppliers', cols)
  }

  return (
    <div>
      <div style={{fontSize:11,color:'var(--muted2)',marginBottom:8,textAlign:'center'}}>
        {channel === 'jd' ? '京东' : '其他'} · 供应商
      </div>
      <div style={{display:'flex',gap:6,marginBottom:hammerPanel?8:0}}>
        <button onClick={() => setHammerPanel(hammerPanel === 'columns' ? null : 'columns')}
          className="btn btn-ghost" style={{flex:1,fontSize:12,minHeight:32,padding:'4px 8px'}}>
          列选择 ({visCols.length}/{SUPPLIER_COLS.length})
        </button>
        <button onClick={() => { setHammerPanel(hammerPanel === 'search' ? null : 'search'); if (hammerPanel !== 'search') setTimeout(() => document.getElementById('hm-search-supp')?.focus(), 100) }}
          className="btn btn-ghost" style={{flex:1,fontSize:12,minHeight:32,padding:'4px 8px'}}>
          搜索
        </button>
      </div>
      {hammerPanel === 'columns' && (
        <div style={{borderTop:'1px solid var(--border)',paddingTop:8,marginTop:0,maxHeight:260,overflowY:'auto'}}>
          <div style={{fontSize:10,color:'var(--muted2)',marginBottom:4,padding:'0 4px'}}>拖拽 ⠿ 调整列顺序</div>
          {(visCols.map(id=>SUPPLIER_COLS.find(c=>c.id===id)).filter(Boolean).concat(SUPPLIER_COLS.filter(c=>!visCols.includes(c.id)))).map((col,idx)=>{
            const isVis=visCols.includes(col.id)
            return <div key={col.id} draggable={isVis?true:undefined}
              onDragStart={isVis?e=>{e.dataTransfer.setData('text/plain',col.id);e.target.style.opacity='0.4';e.currentTarget.parentNode._dragId=col.id}:undefined}
              onDragEnd={isVis?e=>e.target.style.opacity='1':undefined}
              onDragOver={isVis?e=>{e.preventDefault();e.currentTarget.style.borderTop='2px solid var(--primary)';const from=e.currentTarget.parentNode._dragId;if(from&&from!==col.id){const nxt=visCols.filter(c=>c!==from);const toIdx=nxt.indexOf(col.id);nxt.splice(toIdx,0,from);saveCols(nxt)}}:undefined}
              onDragLeave={isVis?e=>e.currentTarget.style.borderTop='1px solid transparent':undefined}
              onDrop={isVis?e=>{e.preventDefault();e.currentTarget.style.borderTop='1px solid transparent';const from=e.dataTransfer.getData('text/plain');if(from===col.id)return;const nxt=visCols.filter(c=>c!==from);const toIdx=nxt.indexOf(col.id);nxt.splice(toIdx,0,from);saveCols(nxt);e.currentTarget.parentNode._dragId=null}:undefined}
              style={{display:'flex',alignItems:'center',gap:4,padding:'4px 6px',borderRadius:6,cursor:isVis?'grab':'default',fontSize:12,whiteSpace:'nowrap',borderTop:'1px solid transparent',background:isVis?'var(--card)':'transparent',opacity:isVis?1:0.4,userSelect:'none',WebkitUserSelect:'none'}}>
              <span style={{color:'var(--muted2)',fontSize:12,width:16,flexShrink:0,textAlign:'center',cursor:isVis?'grab':'default'}}>{isVis?'⠿':'○'}</span>
              <input type="checkbox" checked={isVis} onChange={e=>{const n=e.target.checked?[...visCols,col.id]:visCols.filter(c=>c!==col.id);saveCols(n)}} style={{accentColor:'var(--primary)'}} />
              <span style={{flex:1}}>{col.label}</span>
              <span style={{fontSize:9,color:'var(--muted2)'}}>{isVis?'#'+(visCols.indexOf(col.id)+1):''}</span>
            </div>
          })}
          <div style={{borderTop:'1px solid var(--border)',marginTop:4,paddingTop:4}}>
            <span onClick={()=>saveCols(SUPPLIER_COLS.map(c=>c.id))} className="btn btn-ghost" style={{fontSize:10,padding:'2px 8px',cursor:'pointer'}}>全部</span>
          </div>
        </div>
      )}
      {hammerPanel === 'search' && (
        <div style={{borderTop:'1px solid var(--border)',paddingTop:8}}>
          <input id="hm-search-supp" value={hammerSearch} onChange={e=>setHammerSearch(e.target.value)}
            placeholder="搜索供应商..."
            style={{width:'100%',padding:'6px 10px',fontSize:16,border:'1px solid var(--border)',borderRadius:32,outline:'none',boxSizing:'border-box',background:'var(--card)',color:'var(--text)'}} />
        </div>
      )}
    </div>
  )
}

/* 订单页: 锤子菜单列选择器 + 搜索 + 筛选 + 导出 */
const ORDER_COLS = [
  {id:'order_no',label:'订单号'},{id:'barcode',label:'69码'},{id:'store',label:'店铺'},{id:'warehouse',label:'仓库'},
  {id:'product',label:'商品'},{id:'amount',label:'金额'},{id:'status',label:'状态'},{id:'date',label:'日期'},
]
const ORDER_STATUSES = ['','已完成','待发货','已发货','待确认','申请退款']
const orderColKey = (ch) => 'c_cols_orders_' + ch
const getOrderVis = (ch) => { try { return JSON.parse(localStorage.getItem(orderColKey(ch)) || 'null') } catch{return null} }

function HammerOrders({ channel }) {
  const toast = useToast()
  const { hammerPanel, setHammerPanel, hammerSearch, setHammerSearch, setHammerCols, setOrderFilterLocal, orderStatus } = useAppStore()
  const [visCols, setVisCols] = useState(() => getOrderVis(channel) || ORDER_COLS.map(c => c.id))

  useEffect(() => {
    setVisCols(getOrderVis(channel) || ORDER_COLS.map(c => c.id))
  }, [channel])

  const saveCols = (cols) => {
    setVisCols(cols)
    localStorage.setItem(orderColKey(channel), JSON.stringify(cols))
    setHammerCols('orders', cols)
  }

  const doExport = async () => {
    try {
      const API = import.meta.env.VITE_API_BASE_URL || 'https://overtrees.pythonanywhere.com'
      const r = await fetch(API + '/api/insights/export-orders')
      const b = await r.blob()
      const u = URL.createObjectURL(b)
      const a = document.createElement('a')
      a.href = u
      a.download = 'orders_' + new Date().toISOString().slice(0,10) + '.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch(e) { toast.error('导出失败') }
  }

  return (
    <div>
      <div style={{fontSize:11,color:'var(--muted2)',marginBottom:8,textAlign:'center'}}>
        {channel === 'jd' ? '京东' : '其他'} · 订单
      </div>
      {/* 功能按钮行 */}
      <div style={{display:'flex',gap:6,marginBottom:hammerPanel?8:0,flexWrap:'wrap'}}>
        <button onClick={() => setHammerPanel(hammerPanel === 'columns' ? null : 'columns')}
          className="btn btn-ghost" style={{flex:1,fontSize:12,minHeight:32,padding:'4px 8px'}}>
          列选择 ({visCols.length}/{ORDER_COLS.length})
        </button>
        <button onClick={() => setHammerPanel(hammerPanel === 'search' ? null : 'search')}
          className="btn btn-ghost" style={{flex:1,fontSize:12,minHeight:32,padding:'4px 8px'}}>
          搜索
        </button>
        <button onClick={() => setHammerPanel(hammerPanel === 'filter' ? null : 'filter')}
          className="btn btn-ghost" style={{flex:1,fontSize:12,minHeight:32,padding:'4px 8px'}}>
          筛选{orderStatus ? ' ✓' : ''}
        </button>
        <button onClick={doExport}
          className="btn btn-ghost" style={{flex:1,fontSize:12,minHeight:32,padding:'4px 8px',display:'flex',alignItems:'center',gap:4,justifyContent:'center'}}>
          <IconExport size={13} /> 导出
        </button>
      </div>
      {/* 列选择面板 */}
      {hammerPanel === 'columns' && (
        <div style={{borderTop:'1px solid var(--border)',paddingTop:8,marginTop:0,maxHeight:260,overflowY:'auto'}}>
          <div style={{fontSize:10,color:'var(--muted2)',marginBottom:4,padding:'0 4px'}}>拖拽 ⠿ 调整列顺序</div>
          {(visCols.map(id=>ORDER_COLS.find(c=>c.id===id)).filter(Boolean).concat(ORDER_COLS.filter(c=>!visCols.includes(c.id)))).map((col,idx)=>{
            const isVis=visCols.includes(col.id)
            return <div key={col.id} draggable={isVis?true:undefined}
              onDragStart={isVis?e=>{e.dataTransfer.setData('text/plain',col.id);e.target.style.opacity='0.4';e.currentTarget.parentNode._dragId=col.id}:undefined}
              onDragEnd={isVis?e=>e.target.style.opacity='1':undefined}
              onDragOver={isVis?e=>{e.preventDefault();e.currentTarget.style.borderTop='2px solid var(--primary)';const from=e.currentTarget.parentNode._dragId;if(from&&from!==col.id){const nxt=visCols.filter(c=>c!==from);const toIdx=nxt.indexOf(col.id);nxt.splice(toIdx,0,from);saveCols(nxt)}}:undefined}
              onDragLeave={isVis?e=>e.currentTarget.style.borderTop='1px solid transparent':undefined}
              onDrop={isVis?e=>{e.preventDefault();e.currentTarget.style.borderTop='1px solid transparent';const from=e.dataTransfer.getData('text/plain');if(from===col.id)return;const nxt=visCols.filter(c=>c!==from);const toIdx=nxt.indexOf(col.id);nxt.splice(toIdx,0,from);saveCols(nxt);e.currentTarget.parentNode._dragId=null}:undefined}
              style={{display:'flex',alignItems:'center',gap:4,padding:'4px 6px',borderRadius:6,cursor:isVis?'grab':'default',fontSize:12,whiteSpace:'nowrap',borderTop:'1px solid transparent',background:isVis?'var(--card)':'transparent',opacity:isVis?1:0.4,userSelect:'none',WebkitUserSelect:'none'}}>
              <span style={{color:'var(--muted2)',fontSize:12,width:16,flexShrink:0,textAlign:'center',cursor:isVis?'grab':'default'}}>{isVis?'⠿':'○'}</span>
              <input type="checkbox" checked={isVis} onChange={e=>{const n=e.target.checked?[...visCols,col.id]:visCols.filter(c=>c!==col.id);saveCols(n)}} style={{accentColor:'var(--primary)'}} />
              <span style={{flex:1}}>{col.label}</span>
              <span style={{fontSize:9,color:'var(--muted2)'}}>{isVis?'#'+(visCols.indexOf(col.id)+1):''}</span>
            </div>
          })}
          <div style={{borderTop:'1px solid var(--border)',marginTop:4,paddingTop:4}}>
            <span onClick={()=>saveCols(ORDER_COLS.map(c=>c.id))} className="btn btn-ghost" style={{fontSize:10,padding:'2px 8px',cursor:'pointer'}}>全部</span>
          </div>
        </div>
      )}
      {/* 搜索面板 */}
      {hammerPanel === 'search' && (
        <div style={{borderTop:'1px solid var(--border)',paddingTop:8}}>
          <input id="hm-search-orders" value={hammerSearch} onChange={e=>setHammerSearch(e.target.value)}
            placeholder="搜索单号/商品/SKU..."
            style={{width:'100%',padding:'6px 10px',fontSize:16,border:'1px solid var(--border)',borderRadius:32,outline:'none',boxSizing:'border-box',background:'var(--card)',color:'var(--text)'}} />
          {hammerSearch && <div style={{marginTop:4,textAlign:'right'}}>
            <span onClick={()=>setHammerSearch('')} className="btn btn-ghost" style={{fontSize:10,padding:'2px 8px',cursor:'pointer'}}>清除</span>
          </div>}
        </div>
      )}
      {/* 筛选面板 */}
      {hammerPanel === 'filter' && (
        <div style={{borderTop:'1px solid var(--border)',paddingTop:8}}>
          <div style={{fontSize:10,color:'var(--muted2)',marginBottom:4}}>订单状态</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
            {ORDER_STATUSES.map(s => (
              <span key={s} onClick={() => setOrderFilterLocal('', s)}
                style={{fontSize:12,padding:'4px 10px',borderRadius:99,cursor:'pointer',
                  background: (orderStatus === s || (!orderStatus && !s)) ? 'var(--primary)' : 'var(--gray)',
                  color: (orderStatus === s || (!orderStatus && !s)) ? '#fff' : 'var(--text)',
                  fontWeight: orderStatus === s ? 600 : 400
                }}>
                {s || '全部'}
              </span>
            ))}
          </div>
          {orderStatus && <div style={{marginTop:4,textAlign:'right'}}>
            <span onClick={()=>setOrderFilterLocal('','')} className="btn btn-ghost" style={{fontSize:10,padding:'2px 8px',cursor:'pointer'}}>清除筛选</span>
          </div>}
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState('dash')
  const [highlightSku, setHighlightSku] = useState('')
  const { inventory, qualityLogs, startPolling, stopAll, wsStatus, channel, setChannel, hammerData, setHammerPanel } = useAppStore()
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
  const [showHammerMenu, setShowHammerMenu] = useState(false)
  const [hammerMenuClosing, setHammerMenuClosing] = useState(false)
  const hammerMenuTimerRef = useRef(null)

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

  const openHammerMenu = useCallback(() => {
    clearTimeout(hammerMenuTimerRef.current)
    setHammerMenuClosing(true)
    setShowHammerMenu(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setHammerMenuClosing(false))
    })
  }, [])

  const closeHammerMenu = useCallback(() => {
    clearTimeout(hammerMenuTimerRef.current)
    setHammerMenuClosing(true)
    setHammerPanel(null)
    hammerMenuTimerRef.current = setTimeout(() => {
      setShowHammerMenu(false)
      setHammerMenuClosing(false)
    }, 220)
  }, [setHammerPanel])

  const toggleHammerMenu = useCallback(() => {
    if (showHammerMenu && !hammerMenuClosing) closeHammerMenu()
    else openHammerMenu()
  }, [showHammerMenu, hammerMenuClosing, closeHammerMenu, openHammerMenu])

  const hammerMenuRef = useRef(null)

  useEffect(() => {
    if (!showHammerMenu) return
    const handler = (e) => {
      if (hammerMenuRef.current && !hammerMenuRef.current.contains(e.target) && !e.target.closest('.hammer-btn')) {
        closeHammerMenu()
      }
    }
    setTimeout(() => document.addEventListener('pointerdown', handler), 0)
    return () => document.removeEventListener('pointerdown', handler)
  }, [showHammerMenu, closeHammerMenu])

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
          {page === 'dash' ? (
            /* 看板页：左侧渠道筛选，右侧菜单按钮 */
            <>
              <div className="header-left">
                <span className="header-status">
                  <select value={channel} onChange={e=>setChannel(e.target.value)} style={{background:'transparent',border:'none',outline:'none',color:'inherit',fontSize:'inherit',fontWeight:'inherit',cursor:'pointer',padding:0,margin:0,appearance:'none',WebkitAppearance:'none',MozAppearance:'none'}}>
                    <option value='jd'>京东渠道</option>
                    <option value='other'>其他渠道</option>
                  </select>
                </span>
              </div>
              <button className="menu-btn" onClick={toggleEditorMenu}>
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none"><rect x="2" y="4" width="16" height="1.5" rx=".75" fill="currentColor"/><rect x="2" y="9.25" width="16" height="1.5" rx=".75" fill="currentColor"/><rect x="2" y="14.5" width="16" height="1.5" rx=".75" fill="currentColor"/></svg>
              </button>
            </>
          ) : (
            /* 其他页：左侧返回按钮，右侧锤子按钮 + 渠道筛选 */
            <>
              <div className="header-left">
                <button className="back-btn" onClick={() => setPage('dash')}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="19 12 5 12"/><polyline points="11 18 5 12 11 6"/></svg>
                </button>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <button className="hammer-btn" onClick={toggleHammerMenu}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 12a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v4a4 4 0 0 0 4 4h5a4 4 0 0 0 4-4v-4Z"/>
                    <path d="M12 12h9"/>
                    <path d="m22 3-3 3"/>
                    <path d="m19 3-3 3"/>
                    <path d="M12 3v3"/>
                    <path d="M12 18v3"/>
                  </svg>
                </button>
                <span className="header-status">
                  <select value={channel} onChange={e=>setChannel(e.target.value)} style={{background:'transparent',border:'none',outline:'none',color:'inherit',fontSize:'inherit',fontWeight:'inherit',cursor:'pointer',padding:0,margin:0,appearance:'none',WebkitAppearance:'none',MozAppearance:'none'}}>
                    <option value='jd'>京东渠道</option>
                    <option value='other'>其他渠道</option>
                  </select>
                </span>
              </div>
            </>
          )}
        </div>
      </header>
      {showHammerMenu && (
        <>
          <div
            onPointerDown={closeHammerMenu}
            style={{
              position: 'fixed', inset: 0, zIndex: 3001,
              background: 'transparent',
              transition: 'background 220ms ease'
            }}
          />
          <div
            ref={hammerMenuRef}
            onPointerDown={e => e.stopPropagation()}
            style={{
              position: 'fixed', zIndex: 3002,
              right: 16,
              top: 'calc(env(safe-area-inset-top, 0px) + 7px + 46px + 6px)',
              width: 220,
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturate)) brightness(var(--glass-brightness))',
              WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturate)) brightness(var(--glass-brightness))',
              border: '0.5px solid var(--glass-border)',
              boxShadow: '0 2px 20px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.25)',
              borderRadius: 22,
              overflow: 'hidden',
              opacity: hammerMenuClosing ? 0 : 1,
              transform: hammerMenuClosing ? 'translateY(-10px) scale(0.92)' : 'translateY(0) scale(1)',
              transformOrigin: '85% -18px',
              transition: 'opacity 180ms ease, transform 220ms cubic-bezier(0.34,1.56,0.64,1)',
              willChange: 'opacity, transform',
              padding: 16
            }}
          >
            {page === 'products' ? <HammerProducts channel={channel} /> :
             page === 'suppliers' ? <HammerSuppliers channel={channel} /> :
             page === 'orders' ? <HammerOrders channel={channel} /> : (
            <div style={{color:'var(--muted)',fontSize:13,textAlign:'center'}}>
              <div style={{fontSize:11,color:'var(--muted2)',marginBottom:4}}>
                {channel === 'jd' ? '京东' : '其他'} · {page}
              </div>
              <div style={{fontSize:13,color:'var(--text)',marginBottom:4}}>
                {hammerData[channel]?.[page] ? `${(hammerData[channel]?.[page]?.length ?? 0)} 条记录` : '暂无数据'}
              </div>
              <div style={{fontSize:11,color:'var(--muted2)',marginTop:8}}>
                功能待添加
              </div>
            </div>
          )}
          </div>
        </>
      )}
      <Sidebar page={page} onClose={closeEditorMenu} onNavigate={navAndClose} lowStock={lowStock} errCount={errCount} apiStatus={apiStatus} open={showMenu} menuClosing={menuClosing} onBackdrop={closeEditorMenu} />
      <main className="container">
        {renderPage(page)}
      </main>
    </ToastProvider>
  )
}
