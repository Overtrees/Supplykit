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
  { id:'cleansing',label:'数据清洗及导入'},{id:'rules',label:'规则搭建'},
  { id:'quality',label:'操作异常记录'},{id:'settings',label:'设置'},
]

/* 商品页: 锤子菜单列选择器 + 搜索 */
const PRODUCT_COLS = [
  {id:'barcode',label:'69码'},{id:'channel',label:'平台'},{id:'sku',label:'SKU'},{id:'name',label:'名称'},{id:'store',label:'店铺'},
  {id:'cat',label:'分类'},{id:'price',label:'单价'},{id:'box',label:'箱规'},{id:'unit',label:'单位'},{id:'weight',label:'箱重/KG'},{id:'volume',label:'体积/方'},{id:'status',label:'状态'},
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
  {id:'date',label:'下单日期'},{id:'order_no',label:'订单号'},{id:'barcode',label:'69码'},{id:'store',label:'店铺'},{id:'warehouse',label:'仓库'},{id:'product',label:'商品'},{id:'amount',label:'金额'},{id:'status',label:'状态'},{id:'paid_at',label:'入库日期'},
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
      const r = await fetch(API + '/api/insights/export-orders?channel=' + channel)
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
            <span className="clickable btn btn-ghost" onClick={()=>setHammerSearch('')} style={{fontSize:10,padding:'2px 8px',cursor:'pointer'}}>清除</span>
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

/* 进销存页: 锤子菜单列选择器 + 搜索 + 仓库筛选 + 导出 */
const INV_COLS = {
  own: [
    {id:'warehouse',label:'仓库'},{id:'sku',label:'SKU'},{id:'barcode',label:'69码'},{id:'name',label:'商品'},
    {id:'begin',label:'期初库存'},{id:'transit',label:'在途'},{id:'month_in',label:'当月采购入库'},
    {id:'month_out',label:'当月出库'},{id:'avail',label:'可用'},{id:'turnover',label:'在库周转'},
  ],
  platform: [
    {id:'channel',label:'平台'},{id:'warehouse',label:'仓库'},{id:'sku',label:'SKU'},{id:'barcode',label:'69码'},{id:'name',label:'商品'},
    {id:'transit',label:'在途'},{id:'avail',label:'可用'},
  ],
  platform_b: [
    {id:'channel',label:'平台'},{id:'warehouse',label:'仓库'},{id:'sku',label:'SKU'},{id:'barcode',label:'69码'},{id:'name',label:'商品'},
    {id:'transit',label:'供应商-B仓'},{id:'c_transit',label:'B-C调拨在途'},{id:'avail',label:'可用'},
  ],
}
const INV_COL_KEY = 'c_cols_inventory'
const getInvVis = (wt) => { try { return JSON.parse(localStorage.getItem(INV_COL_KEY + '_' + wt) || 'null') } catch{return null} }
const INV_WH_LABEL = { own:'自有仓', platform:'平台仓', platform_b:'B仓' }

function HammerInventory({ channel }) {
  const toast = useToast()
  const { hammerPanel, setHammerPanel, hammerSearch, setHammerSearch, setHammerCols, hammerWhType, setHammerWhType } = useAppStore()
  const [visCols, setVisCols] = useState(() => getInvVis(hammerWhType) || INV_COLS[hammerWhType].map(c => c.id))

  useEffect(() => {
    const saved = getInvVis(hammerWhType) || INV_COLS[hammerWhType].map(c => c.id)
    setVisCols(saved)
    setHammerCols('inventory_' + hammerWhType, saved)
  }, [hammerWhType])

  const saveCols = (cols) => {
    setVisCols(cols)
    localStorage.setItem(INV_COL_KEY + '_' + hammerWhType, JSON.stringify(cols))
    setHammerCols('inventory_' + hammerWhType, cols)
  }

  const switchWh = (v) => {
    setHammerWhType(v)
    const saved = getInvVis(v) || INV_COLS[v].map(c => c.id)
    setVisCols(saved)
    setHammerCols('inventory_' + v, saved)
  }

  const doExport = async () => {
    try {
      const API = import.meta.env.VITE_API_BASE_URL || 'https://overtrees.pythonanywhere.com'
      const r = await fetch(API + '/api/insights/export-inventory?channel=' + channel + '&wh_type=' + hammerWhType)
      const b = await r.blob()
      const u = URL.createObjectURL(b)
      const a = document.createElement('a')
      a.href = u
      a.download = 'inventory_' + new Date().toISOString().slice(0,10) + '.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch(e) { toast.error('导出失败') }
  }

  return (
    <div>
      <div style={{fontSize:11,color:'var(--muted2)',marginBottom:8,textAlign:'center'}}>
        {channel === 'jd' ? '京东' : '其他'} · 进销存
      </div>
      {/* 功能按钮行 */}
      <div style={{display:'flex',gap:6,marginBottom:hammerPanel?8:0,flexWrap:'wrap'}}>
        <button onClick={() => setHammerPanel(hammerPanel === 'columns' ? null : 'columns')}
          className="btn btn-ghost" style={{flex:1,fontSize:12,minHeight:32,padding:'4px 8px'}}>
          列选择 ({visCols.length}/{INV_COLS[hammerWhType].length})
        </button>
        <button onClick={() => setHammerPanel(hammerPanel === 'search' ? null : 'search')}
          className="btn btn-ghost" style={{flex:1,fontSize:12,minHeight:32,padding:'4px 8px'}}>
          搜索
        </button>
        <button onClick={() => setHammerPanel(hammerPanel === 'wh' ? null : 'wh')}
          className="btn btn-ghost" style={{flex:1,fontSize:12,minHeight:32,padding:'4px 8px'}}>
          仓库 {INV_WH_LABEL[hammerWhType]}
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
          {(visCols.map(id=>INV_COLS[hammerWhType].find(c=>c.id===id)).filter(Boolean).concat(INV_COLS[hammerWhType].filter(c=>!visCols.includes(c.id)))).map((col,idx)=>{
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
            <span onClick={()=>saveCols(INV_COLS[hammerWhType].map(c=>c.id))} className="btn btn-ghost" style={{fontSize:10,padding:'2px 8px',cursor:'pointer'}}>全部</span>
          </div>
        </div>
      )}
      {/* 搜索面板 */}
      {hammerPanel === 'search' && (
        <div style={{borderTop:'1px solid var(--border)',paddingTop:8}}>
          <input id="hm-search-inv" value={hammerSearch} onChange={e=>setHammerSearch(e.target.value)}
            placeholder="搜索SKU/商品名..."
            style={{width:'100%',padding:'6px 10px',fontSize:16,border:'1px solid var(--border)',borderRadius:32,outline:'none',boxSizing:'border-box',background:'var(--card)',color:'var(--text)'}} />
          {hammerSearch && <div style={{marginTop:4,textAlign:'right'}}>
            <span className="clickable btn btn-ghost" onClick={()=>setHammerSearch('')} style={{fontSize:10,padding:'2px 8px',cursor:'pointer'}}>清除</span>
          </div>}
        </div>
      )}
      {/* 仓库类型面板 */}
      {hammerPanel === 'wh' && (
        <div style={{borderTop:'1px solid var(--border)',paddingTop:8}}>
          <div style={{fontSize:10,color:'var(--muted2)',marginBottom:4}}>仓库类型</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
            {Object.keys(INV_COLS).map(k => {
              if (k === 'platform_b' && channel !== 'jd') return null
              const active = hammerWhType === k
              return <span key={k} onClick={() => switchWh(k)}
                style={{fontSize:12,padding:'4px 10px',borderRadius:99,cursor:'pointer',
                  background: active ? 'var(--primary)' : 'var(--gray)',
                  color: active ? '#fff' : 'var(--text)',
                  fontWeight: active ? 600 : 400
                }}>
                {INV_WH_LABEL[k]}
              </span>
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* 建议页: 锤子菜单 tab入口 + 模式 + 列选择 + 导出 */
const INS_BBCC_COLS = [
  {id:'seq',label:''},{id:'sku',label:'SKU'},{id:'barcode',label:'69码'},{id:'name',label:'商品'},{id:'warehouse',label:'仓库'},
  {id:'b_stock',label:'B仓可用库存'},{id:'b_turn',label:'B仓周转'},{id:'c_stock',label:'C仓总和可用'},
  {id:'transit',label:'B-C调拨在途'},{id:'sales',label:'C仓日销'},{id:'c_turn',label:'C仓周转'},
  {id:'transit_turn',label:'B→C调拨周转'},{id:'suggest',label:'C仓建议补'},{id:'b_suggest',label:'B仓需补'},
  {id:'cur_turn',label:'当前综转'},{id:'after_turn',label:'补后综转'},{id:'note',label:'备注'},{id:'action',label:'标记操作'},
]
const INS_TRAD_COLS = [
  {id:'seq',label:''},{id:'sku',label:'SKU'},{id:'barcode',label:'69码'},{id:'name',label:'商品'},{id:'store',label:'仓库'},
  {id:'avail',label:'现有'},{id:'transit',label:'在途'},{id:'sales',label:'日销'},
  {id:'safety',label:'安全线'},{id:'turn',label:'在库周转'},{id:'after_turn',label:'补后周转'},
  {id:'suggest',label:'建议补'},{id:'note',label:'备注'},
]
const INS_PURCHASE_COLS = [
  {id:'barcode',label:'69码'},{id:'sku',label:'SKU'},{id:'name',label:'商品'},{id:'warehouse',label:'仓库'},
  {id:'sys_total',label:'系统总库存'},{id:'daily_sales',label:'日销(融合/14/28)'},
  {id:'actual_purchase',label:'建议采购'},{id:'after_turnover',label:'补后周转'},
  {id:'note',label:'备注'},{id:'timing',label:'采购时机'},
]
const INS_SLOW_COLS = [
  {id:'barcode',label:'69码'},{id:'sku',label:'SKU'},{id:'name',label:'商品'},{id:'store',label:'店铺'},{id:'category',label:'分类'},
  {id:'last_order_date',label:'最近下单'},{id:'days',label:'天数'},{id:'stock',label:'库存'},{id:'level',label:'状态'},
]
const insColKey = (m) => 'c_cols_' + m
const getInsVis = (m) => { try { return JSON.parse(localStorage.getItem(insColKey(m)) || 'null') } catch{return null} }
function insDefVis(cols){return cols.map(c=>c.id).filter((_,i)=>[0,1,2,3,4,8,11,12,15].includes(i))}
function insDefVisTrad(cols){return cols.map(c=>c.id).filter((_,i)=>[0,1,2,3,4,5,6,10,11].includes(i))}

function HammerInsights({ channel }) {
  const toast = useToast()
  const { hammerPanel, setHammerPanel, setHammerCols, hammerInsightsTab, setHammerInsightsTab, hammerReplenMode, setHammerReplenMode } = useAppStore()
  const mode = (channel !== 'jd' && hammerReplenMode === 'bbcc') ? 'traditional' : hammerReplenMode
  const isPurchase = hammerInsightsTab === 'purchase'
  const isSlow = hammerInsightsTab === 'slow'
  const cols = isSlow ? INS_SLOW_COLS : (isPurchase ? INS_PURCHASE_COLS : (mode === 'bbcc' ? INS_BBCC_COLS : INS_TRAD_COLS))
  const [visCols, setVisCols] = useState(() => {
    if (isSlow) return INS_SLOW_COLS.map(c => c.id)
    if (isPurchase) return INS_PURCHASE_COLS.map(c => c.id)
    return getInsVis(mode) || (mode==='bbcc'?insDefVis(INS_BBCC_COLS):insDefVisTrad(INS_TRAD_COLS))
  })

  useEffect(() => {
    if (isSlow) {
      const saved = JSON.parse(localStorage.getItem('c_cols_' + channel + '_slow') || 'null')
      const cols = saved || INS_SLOW_COLS.map(c => c.id)
      setVisCols(cols); setHammerCols('insights_' + channel + '_slow', cols)
    } else if (isPurchase) {
      const saved = JSON.parse(localStorage.getItem('c_cols_' + channel + '_purchase') || 'null')
      const cols = saved || INS_PURCHASE_COLS.map(c => c.id)
      setVisCols(cols); setHammerCols('insights_' + channel + '_purchase', cols)
    } else {
      const saved = getInsVis(mode) || (mode==='bbcc'?insDefVis(INS_BBCC_COLS):insDefVisTrad(INS_TRAD_COLS))
      setVisCols(saved); setHammerCols('insights_' + mode, saved)
    }
  }, [mode, hammerInsightsTab, channel])

  const saveCols = (c) => {
    setVisCols(c)
    if (isSlow) {
      localStorage.setItem('c_cols_' + channel + '_slow', JSON.stringify(c))
      setHammerCols('insights_' + channel + '_slow', c)
    } else if (isPurchase) {
      localStorage.setItem('c_cols_' + channel + '_purchase', JSON.stringify(c))
      setHammerCols('insights_' + channel + '_purchase', c)
    } else {
      localStorage.setItem(insColKey(mode), JSON.stringify(c))
      setHammerCols('insights_' + mode, c)
    }
  }

  const doExport = async (type) => {
    try {
      const API = import.meta.env.VITE_API_BASE_URL || 'https://overtrees.pythonanywhere.com'
      const isPurchase = type === 'purchase'
      // 补货导出跟随当前模式；采购建议只按全局主体(渠道)区分
      const params = isPurchase
        ? '?days=28&channel=' + channel
        : '?days=28&mode=' + mode + '&channel=' + channel
      const ep = isPurchase ? '/api/insights/export-purchase-suggestions' : '/api/insights/export-purchase'
      const r = await fetch(API + ep + params)
      if (!r.ok) throw new Error('HTTP ' + r.status)
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = (isPurchase ? '采购建议_' : '补货建议_') + new Date().toISOString().slice(0,10).replace(/-/g,'') + '.xlsx'
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
      setHammerPanel(null)
    } catch(e) { toast.error('导出失败: ' + e.message) }
  }

  return (
    <div>
      <div style={{fontSize:11,color:'var(--muted2)',marginBottom:8,textAlign:'center'}}>
        {channel === 'jd' ? '京东' : '其他'} · 建议
      </div>
      {/* tab 入口 */}
      <div style={{display:'flex',gap:4,marginBottom:8,flexWrap:'wrap'}}>
        {[['replen','补货建议'],['purchase','采购建议'],['slow','滞销预警']].map(([id,label]) => (
          <span key={id} onClick={() => setHammerInsightsTab(id)}
            style={{flex:1,fontSize:12,minHeight:32,padding:'4px 6px',borderRadius:99,cursor:'pointer',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',boxSizing:'border-box',
              background: hammerInsightsTab === id ? 'var(--primary)' : 'var(--gray)',
              color: hammerInsightsTab === id ? '#fff' : 'var(--text)',fontWeight: hammerInsightsTab === id ? 600 : 400}}>
            {label}
          </span>
        ))}
      </div>
      {/* 补货模式行（单独一行） */}
      {hammerInsightsTab === 'replen' && (
        <div style={{display:'flex',gap:4,marginBottom:6}}>
          {channel === 'jd' && (
            <span onClick={() => setHammerReplenMode('bbcc')}
              style={{flex:1,fontSize:12,minHeight:32,padding:'4px 8px',borderRadius:99,cursor:'pointer',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',boxSizing:'border-box',
                background: mode==='bbcc'?'var(--primary)':'var(--gray)',color: mode==='bbcc'?'#fff':'var(--text)',fontWeight: mode==='bbcc'?600:400}}>
              BBCC
            </span>
          )}
          <span onClick={() => setHammerReplenMode('traditional')}
            style={{flex:1,fontSize:12,minHeight:32,padding:'4px 8px',borderRadius:99,cursor:'pointer',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',boxSizing:'border-box',
              background: mode==='traditional'?'var(--primary)':'var(--gray)',color: mode==='traditional'?'#fff':'var(--text)',fontWeight: mode==='traditional'?600:400}}>
            传统多仓
          </span>
        </div>
      )}
      {/* 操作行（列选择+导出，单独一行） */}
      <div style={{display:'flex',gap:6}}>
        <button onClick={() => setHammerPanel(hammerPanel === 'columns' ? null : 'columns')}
            className="btn btn-ghost" style={{flex:1,fontSize:12,minHeight:32,padding:'4px 8px'}}>
            列选择 ({visCols.length}/{cols.length})
          </button>
        <button onClick={() => setHammerPanel(hammerPanel === 'export' ? null : 'export')}
          className="btn btn-ghost" style={{flex:1,fontSize:12,minHeight:32,padding:'4px 8px',display:'flex',alignItems:'center',gap:4,justifyContent:'center'}}>
          <IconExport size={13} /> 导出
        </button>
      </div>
      {/* 导出面板 */}
      {hammerPanel === 'export' && (
        <div style={{borderTop:'1px solid var(--border)',paddingTop:8,marginTop:8}}>
          <div style={{fontSize:10,color:'var(--muted2)',marginBottom:4}}>选择导出类型 · {channel === 'jd' ? '京东' : '其他'}渠道</div>
          <div style={{display:'flex',gap:4}}>
            <span onClick={() => doExport('replen')}
              style={{flex:1,fontSize:12,padding:'6px 8px',borderRadius:99,cursor:'pointer',textAlign:'center',background:'var(--gray)',color:'var(--text)'}}>
              补货建议{mode === 'bbcc' ? ' (BBCC)' : ''}
            </span>
            <span onClick={() => doExport('purchase')}
              style={{flex:1,fontSize:12,padding:'6px 8px',borderRadius:99,cursor:'pointer',textAlign:'center',background:'var(--gray)',color:'var(--text)'}}>
              采购建议
            </span>
          </div>
        </div>
      )}
      {/* 列选择面板 */}
      {hammerPanel === 'columns' && (
        <div style={{borderTop:'1px solid var(--border)',paddingTop:8,marginTop:8,maxHeight:260,overflowY:'auto'}}>
          <div style={{fontSize:10,color:'var(--muted2)',marginBottom:4,padding:'0 4px'}}>拖拽 ⠿ 调整列顺序</div>
          {(visCols.map(id=>cols.find(c=>c.id===id)).filter(Boolean).concat(cols.filter(c=>!visCols.includes(c.id)))).map((col,idx)=>{
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
              <span style={{flex:1}}>{col.label || '(序号)'}</span>
              <span style={{fontSize:9,color:'var(--muted2)'}}>{isVis?'#'+(visCols.indexOf(col.id)+1):''}</span>
            </div>
          })}
          <div style={{borderTop:'1px solid var(--border)',marginTop:4,paddingTop:4,display:'flex',gap:6}}>
            <span onClick={()=>saveCols(isSlow ? INS_SLOW_COLS.map(c=>c.id) : (isPurchase ? INS_PURCHASE_COLS.map(c=>c.id) : (mode==='bbcc'?insDefVis(INS_BBCC_COLS):insDefVisTrad(INS_TRAD_COLS))))} className="btn btn-ghost" style={{fontSize:10,padding:'2px 8px',cursor:'pointer'}}>默认</span>
            <span onClick={()=>saveCols(cols.map(c=>c.id))} className="btn btn-ghost" style={{fontSize:10,padding:'2px 8px',cursor:'pointer'}}>全部</span>
          </div>
        </div>
      )}
    </div>
  )
}

/* 清洗页: 锤子菜单渠道标注 */
function HammerCleansing({ channel }) {
  const { hammerPanel, setHammerPanel, hammerCleansingChannel, setHammerCleansingChannel } = useAppStore()
  return (
    <div>
      <div style={{fontSize:11,color:'var(--muted2)',marginBottom:8,textAlign:'center'}}>
        {channel === 'jd' ? '京东' : '其他'} · 清洗导入
      </div>
      <div style={{display:'flex',gap:4}}>
        {[['jd','京东'],['other','其他渠道']].map(([id,label]) => (
          <span key={id} onClick={() => setHammerCleansingChannel(id)}
            style={{flex:1,fontSize:12,minHeight:32,padding:'4px 8px',borderRadius:99,cursor:'pointer',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',boxSizing:'border-box',
              background: hammerCleansingChannel === id ? 'var(--primary)' : 'var(--gray)',
              color: hammerCleansingChannel === id ? '#fff' : 'var(--text)',fontWeight: hammerCleansingChannel === id ? 600 : 400}}>
            {label}
          </span>
        ))}
      </div>
      <div style={{marginTop:8,borderTop:'1px solid var(--border)',paddingTop:8}}>
        <div style={{fontSize:10,color:'var(--muted2)',textAlign:'center'}}>导入时按此渠道标注数据</div>
      </div>
    </div>
  )
}

/* 规则页: 锤子菜单 tab入口 + 新建 + 模式切换 + 变更历史 */
function HammerRules({ channel, onShowHistory }) {
  const { hammerRulesTab, setHammerRulesTab, bumpHammerRuleNew, hammerRulesMode, setHammerRulesMode } = useAppStore()

  return (
    <div>
      <div style={{fontSize:11,color:'var(--muted2)',marginBottom:8,textAlign:'center'}}>
        {channel === 'jd' ? '京东' : '其他'} · 规则参数
      </div>
      {/* tab 入口 */}
      <div style={{display:'flex',gap:4}}>
        {[['rules','规则'],['params','补货参数'],['purchase','采购参数']].map(([id,label]) => (
          <span key={id} onClick={() => setHammerRulesTab(id)}
            style={{flex:1,fontSize:12,minHeight:32,padding:'4px 6px',borderRadius:99,cursor:'pointer',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',boxSizing:'border-box',
              background: hammerRulesTab === id ? 'var(--primary)' : 'var(--gray)',
              color: hammerRulesTab === id ? '#fff' : 'var(--text)',fontWeight: hammerRulesTab === id ? 600 : 400}}>
            {label}
          </span>
        ))}
      </div>
      {/* 规则 tab: 新建 + 变更历史 */}
      {hammerRulesTab === 'rules' && <>
        <button onClick={() => { setHammerRulesTab('rules'); bumpHammerRuleNew() }} className="btn btn-primary"
          style={{width:'100%',marginTop:8,fontSize:12,minHeight:34,padding:'4px 8px',display:'flex',alignItems:'center',justifyContent:'center',gap:4,boxSizing:'border-box'}}>
          + 新建规则
        </button>
        <button onClick={() => { onShowHistory && onShowHistory(channel) }} className="btn btn-ghost"
          style={{width:'100%',marginTop:6,fontSize:12,minHeight:34,padding:'4px 8px',display:'flex',alignItems:'center',justifyContent:'center',gap:4,boxSizing:'border-box'}}>
          变更历史
        </button>
      </>}
      {/* 补货参数 tab: 模式切换 */}
      {hammerRulesTab === 'params' && (
        <div style={{display:'flex',gap:4,marginTop:8}}>
          {channel === 'jd' && (
            <span onClick={() => setHammerRulesMode('bbcc')}
              style={{flex:1,fontSize:12,minHeight:32,padding:'4px 6px',borderRadius:99,cursor:'pointer',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',boxSizing:'border-box',
                background: hammerRulesMode==='bbcc'?'var(--primary)':'var(--gray)',color: hammerRulesMode==='bbcc'?'#fff':'var(--text)',fontWeight: hammerRulesMode==='bbcc'?600:400}}>
              BBCC 送仓
            </span>
          )}
          <span onClick={() => setHammerRulesMode('traditional')}
            style={{flex:1,fontSize:12,minHeight:32,padding:'4px 6px',borderRadius:99,cursor:'pointer',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',boxSizing:'border-box',
              background: hammerRulesMode==='traditional'?'var(--primary)':'var(--gray)',color: hammerRulesMode==='traditional'?'#fff':'var(--text)',fontWeight: hammerRulesMode==='traditional'?600:400}}>
            传统多仓
          </span>
        </div>
      )}

      </div>
  )
}

/* 看板页: 锤子菜单 时间维度(今日/本周/本月) */
function HammerDashboard({ channel }) {
  const { hammerDashPeriod, setHammerDashPeriod, dashboard } = useAppStore()
  const periodLabel = { today:'今日', week:'本周', month:'本月' }
  const periodMeta = dashboard?.periods?.[hammerDashPeriod] || {}
  return (
    <div>
      <div style={{fontSize:11,color:'var(--muted2)',marginBottom:8,textAlign:'center'}}>
        {channel === 'jd' ? '京东' : '其他'} · 看板
      </div>
      <div style={{fontSize:10,color:'var(--muted2)',marginBottom:4,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
        聚合时间维度
        {periodMeta.date && <span style={{marginLeft:'auto'}}>{periodMeta.date}</span>}
      </div>
      <div style={{display:'flex',gap:4}}>
        {['today','week','month'].map(k => (
          <span key={k} onClick={() => setHammerDashPeriod(k)}
            style={{flex:1,fontSize:12,minHeight:32,padding:'4px 6px',borderRadius:99,cursor:'pointer',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',boxSizing:'border-box',
              background: hammerDashPeriod === k ? 'var(--primary)' : 'var(--gray)',
              color: hammerDashPeriod === k ? '#fff' : 'var(--text)',fontWeight: hammerDashPeriod === k ? 600 : 400}}>
            {periodLabel[k]}
          </span>
        ))}
      </div>
    </div>
  )
}

/* 变更历史底部弹窗 — 独立组件避免 App 大范围重渲染 */
const HistorySheet = React.memo(({ show, loading, data, onClose }) => {
  if (!show) return null
  return <>
    <div onPointerDown={(e) => { e.stopPropagation(); onClose() }} style={{position:'fixed',inset:0,zIndex:4000,background:'transparent'}} />
    <div style={{
      position:'fixed',left:0,right:0,
      bottom:'calc(env(safe-area-inset-bottom) + 14px)',
      zIndex:4001,display:'flex',justifyContent:'center',
      padding:'0 14px',pointerEvents:'none',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width:'100%',maxWidth:600,
        background:'var(--glass-bg)',
        backdropFilter:'blur(40px) saturate(2.5) brightness(1.15)',
        WebkitBackdropFilter:'blur(40px) saturate(2.5) brightness(1.15)',
        border:'0.5px solid var(--glass-border)',
        borderRadius:32,
        padding:'18px 14px calc(14px + env(safe-area-inset-bottom))',
        boxShadow:'0 -8px 24px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.25)',
        pointerEvents:'auto',
        maxHeight:'70vh',overflowY:'auto',
      }}>
        <div style={{fontSize:18,fontWeight:700,marginBottom:12,textAlign:'center',color:'var(--text)'}}>配置变更历史</div>
        {loading ? (
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {[1,2,3].map(i => (
              <div key={i} style={{padding:'10px 12px',background:'var(--card)',borderRadius:16,fontSize:12}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                  <div className="skeleton" style={{width:'40%',height:12,borderRadius:6}} />
                  <div className="skeleton" style={{width:'20%',height:12,borderRadius:6}} />
                </div>
                <div className="skeleton" style={{width:'70%',height:12,borderRadius:6}} />
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div style={{padding:20,textAlign:'center',color:'var(--muted2)'}}>暂无变更记录</div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {data.map((h, i) => {
              const key = h.key.replace(/^mode_(bbcc|traditional)_/, '')
              const modeInfo = h.mode ? (h.mode === 'bbcc' ? 'BBCC' : '传统') : ''
              return <div key={h.id || i} style={{padding:'10px 12px',background:'var(--card)',borderRadius:16,fontSize:12}}>
                <div style={{display:'flex',justifyContent:'space-between',gap:6,marginBottom:4}}>
                  <span style={{fontWeight:600,fontSize:11}}>
                    {key}{modeInfo ? ` (${modeInfo})` : ''}
                    <span style={{fontWeight:400,fontSize:10,color:'var(--muted2)',marginLeft:4}}>{h.channel === 'jd' ? '京东' : '其他'}</span>
                  </span>
                  <span style={{fontSize:10,color:'var(--muted2)',flexShrink:0}}>{h.created_at?.slice(5,16) || ''}</span>
                </div>
                <div style={{fontSize:11,color:'var(--muted2)',display:'flex',gap:4,flexWrap:'wrap'}}>
                  <span style={{color:'var(--danger)',textDecoration:'line-through'}}>{h.old_value || '(空)'}</span>
                  <span style={{color:'var(--muted2)'}}>→</span>
                  <span style={{color:'var(--success)'}}>{h.new_value || '(空)'}</span>
                </div>
              </div>
            })}
          </div>
        )}
        {!loading && <div style={{flexShrink:0,marginTop:10}}>
          <div onClick={(e) => { e.stopPropagation(); onClose() }} className="clickable" style={{
            borderRadius:22,padding:14,
            background:'var(--primary)',
            cursor:'pointer',textAlign:'center',
          }}>
            <span style={{fontSize:15,fontWeight:600,color:'#fff'}}>关闭</span>
          </div>
        </div>}
      </div>
    </div>
  </>
})

export default function App() {
  const [page, setPage] = useState('dash')
  const [highlightSku, setHighlightSku] = useState('')
  const { inventory, qualityLogs, startPolling, stopAll, wsStatus, channel, setChannel, hammerData, setHammerPanel } = useAppStore()
  const [apiStatus, setApiStatus] = useState('checking')
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState([])
  const [histLoading, setHistLoading] = useState(false)
  const loadHistory = useCallback(async (ch) => {
    setShowHistory(true)
    setHistLoading(true)
    setShowHistory(true)
    setHistLoading(true)
    try {
      const API = import.meta.env.VITE_API_BASE_URL || 'https://overtrees.pythonanywhere.com'
      const r = await fetch(API + '/api/replenishment-config/history?channel=' + (ch||channel) + '&limit=50')
      const d = await r.json()
      setHistory(d.data || [])
    } catch(e) { setHistory([]) }
    setHistLoading(false)
  }, [channel])
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
            /* 看板页：左侧渠道筛选+锤子按钮，右侧菜单按钮 */
            <>
              <div className="header-left">
                <span className="header-status">
                  <select value={channel} onChange={e=>setChannel(e.target.value)} style={{background:'transparent',border:'none',outline:'none',color:'inherit',fontSize:'inherit',fontWeight:'inherit',cursor:'pointer',padding:0,margin:0,appearance:'none',WebkitAppearance:'none',MozAppearance:'none'}}>
                    <option value='jd'>京东渠道</option>
                    <option value='other'>其他渠道</option>
                  </select>
                </span>
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
              width: 240,
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturate)) brightness(var(--glass-brightness))',
              WebkitBackdropFilter: 'blur(var(--glass-blur)) saturate(var(--glass-saturate)) brightness(var(--glass-brightness))',
              border: '0.5px solid var(--glass-border)',
              boxShadow: '0 2px 20px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.25)',
              borderRadius: 26,
              overflow: 'hidden',
              opacity: hammerMenuClosing ? 0 : 1,
              transform: hammerMenuClosing ? 'translateY(-10px) scale(0.92)' : 'translateY(0) scale(1)',
              transformOrigin: '85% -18px',
              transition: 'opacity 180ms ease, transform 220ms cubic-bezier(0.34,1.56,0.64,1)',
              willChange: 'opacity, transform',
              padding: 16
            }}
          >
            {page === 'dash' ? <HammerDashboard channel={channel} /> :
            page === 'products' ? <HammerProducts channel={channel} /> :
             page === 'suppliers' ? <HammerSuppliers channel={channel} /> :
             page === 'orders' ? <HammerOrders channel={channel} /> :
             page === 'inv' ? <HammerInventory channel={channel} /> :
             page === 'insights' ? <HammerInsights channel={channel} /> :
             page === 'cleansing' ? <HammerCleansing channel={channel} /> :
             page === 'rules' ? <HammerRules channel={channel} onShowHistory={loadHistory} /> : (
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

      {/* 变更历史底部弹窗 */}
      <HistorySheet
        show={showHistory}
        loading={histLoading}
        data={history}
        onClose={() => setShowHistory(false)}
      />
    </ToastProvider>
  )
}
