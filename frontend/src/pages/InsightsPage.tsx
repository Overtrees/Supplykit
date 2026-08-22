import React, { useEffect, useState, useRef } from 'react'
import { api } from '../api/client'
import { useToast } from '../components/Toast'
import { useAppStore } from '../store/useAppStore'
import { IconTrendUp, IconTrendDown, IconTrendFlat, IconUndo } from '../components/Icons'
import { t } from "../locale"

// 备注中 emoji 转 SVG 图标
const EMOJI_MAP = {
  '🔴': <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{display:'inline',verticalAlign:'middle',marginRight:2}}><circle cx="7" cy="7" r="6" fill="#ef4444"/></svg>,
  '⚠️': <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{display:'inline',verticalAlign:'middle',marginRight:2}}><path d="M7 1.5L1 12.5h12L7 1.5z" fill="#f59e0b"/><rect x="6.3" y="5.5" width="1.4" height="4" rx=".7" fill="#fff"/><circle cx="7" cy="11" r=".7" fill="#fff"/></svg>,
  '⚪': <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{display:'inline',verticalAlign:'middle',marginRight:2}}><circle cx="7" cy="7" r="6" fill="#94a3b8"/></svg>,
  '✅': <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{display:'inline',verticalAlign:'middle',marginRight:2}}><circle cx="7" cy="7" r="6" fill="#22c55e"/><path d="M4.5 7l2 2 3.5-3.5" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  '📈': <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{display:'inline',verticalAlign:'middle',marginRight:1}}><path d="M2 10l3.5-4 3 2.5L12 3" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M8.5 3H12v3.5" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  '📉': <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{display:'inline',verticalAlign:'middle',marginRight:1}}><path d="M2 4l3.5 4 3-2.5L12 11" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M8.5 11H12V7.5" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  '➡️': <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{display:'inline',verticalAlign:'middle',marginRight:1}}><path d="M1 7h12M9 3.5L12.5 7 9 10.5" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
}
// ── 列配置 ──────────────────────────────────────────────────────────────
const BBCC_COLS = [
  {id:'seq',label:''},{id:'sku',label:'SKU'},{id:'barcode',label:'69码'},{id:'name',label:'商品'},{id:'warehouse',label:'仓库'},
  {id:'b_stock',label: t("inv.warehouse_b") + '可用库存'},{id:'b_turn',label:'B仓周转'},{id:'c_stock',label: t("inv.warehouse_c") + '总和可用'},
  {id:'transit',label:'B-C调拨在途'},{id:'sales',label:'C仓日销'},{id:'c_turn',label:'C仓周转'},
  {id:'transit_turn',label:'B→C调拨周转'},{id:'suggest',label:'C仓建议补'},{id:'b_suggest',label:'B仓需补'},
  {id:'cur_turn',label:'当前综转'},{id:'after_turn',label:'补后综转'},{id:'note',label:'备注'},{id:'action',label: t("insights.mark_action") + '（用于B仓统计入库批次）'},
]
const TRAD_COLS = [
  {id:'seq',label:''},{id:'sku',label:'SKU'},{id:'barcode',label:'69码'},{id:'name',label:'商品'},{id:'store',label:'仓库'},
  {id:'avail',label:'现有'},{id:'transit',label:'在途'},{id:'sales',label:'日销'},
  {id:'safety',label:'安全线'},{id:'turn',label:'在库周转'},{id:'after_turn',label:'补后周转'},
  {id:'suggest',label:'建议补'},{id:'note',label:'备注'},
]
const colKey = (m, ch) => 'c_cols_' + ch + '_' + m
function getVis(m, ch) {try{return JSON.parse(localStorage.getItem(colKey(m, ch))||'null')}catch{return null}}
function defVis(cols){return cols.map(c=>c.id).filter((_,i)=>[0,1,2,3,4,8,11,12,15].includes(i))} // 默认9列(BBCC)
function defVisTrad(cols){return cols.map(c=>c.id).filter((_,i)=>[0,1,2,3,4,5,6,10,11].includes(i))} // 默认9列(TRAD)
const PURCHASE_COLS = [
  {id:'barcode',label:'69码'},{id:'sku',label:'SKU'},{id:'name',label:'商品'},{id:'warehouse',label:'仓库'},
  {id:'sys_total',label:'系统总库存'},{id:'daily_sales',label:'日销(融合/14/28)'},
  {id:'actual_purchase',label:'建议采购(含箱规取整)'},{id:'after_turnover',label:'补后周转'},
  {id:'note',label:'备注'},{id:'timing',label:'采购时机'},
]
const SLOW_COLS = [
  {id:'barcode',label:'69码'},{id:'sku',label:'SKU'},{id:'name',label:'商品'},{id:'store',label:'店铺'},{id:'category',label:'分类'},
  {id:'last_order_date',label:'最近下单'},{id:'days',label:'天数'},{id:'stock',label:'库存'},{id:'level',label:'状态'},
]

function renderNote(text) {
  if (!text) return '-'
  const parts = []
  let i = 0
  while (i < text.length) {
    // 检测多字符 emoji（如 ⚠️ 是 2 个字符）
    const c = text[i]
    const c2 = c + (text[i+1] || '')
    if (EMOJI_MAP[c2]) {
      parts.push(<React.Fragment key={i}>{EMOJI_MAP[c2]}</React.Fragment>)
      i += 2
    } else if (EMOJI_MAP[c]) {
      parts.push(<React.Fragment key={i}>{EMOJI_MAP[c]}</React.Fragment>)
      i += 1
    } else {
      // 收集连续的非 emoji 文本
      let j = i
      while (j < text.length && !EMOJI_MAP[text[j]] && !EMOJI_MAP[text[j] + (text[j+1] || '')]) j++
      parts.push(<React.Fragment key={i}>{text.slice(i, j)}</React.Fragment>)
      i = j
    }
  }
  return parts.length === 1 ? parts[0] : parts
}

const API = import.meta.env.VITE_API_BASE_URL || 'https://overtrees.pythonanywhere.com'
const safeGet = (key, def) => { try { return localStorage.getItem(key) ?? def } catch { return def } }
const safeSet = (key, val) => { try { localStorage.setItem(key, val) } catch {} }

const pillStyle = (cond, yes = 'danger', no = 'info') => ({
  display: 'inline-block', padding: '2px 8px', borderRadius: 99,
  fontSize: 12, fontWeight: 600,
  background: cond ? 'rgba(225,29,72,0.08)' : 'rgba(29,78,216,0.08)',
  color: cond ? 'var(--danger)' : 'var(--primary)',
})

function Skeleton({ height = 16, width = '100%', style }) {
  return <div className="skeleton" style={{ height, width, ...style }} />
}

export default function InsightsPage() {
  const toast = useToast()
  const [replen, setReplen] = useState([])
  const [purchase, setPurchase] = useState([])
  const [slowMoving, setSlowMoving] = useState([])
  // 滞销处置建议（SKU×仓库粒度 + 批量处置）
  const [disposals, setDisposals] = useState([])
  const [disposalsLoading, setDisposalsLoading] = useState(true)
  const [dispSel, setDispSel] = useState([])
  const [dispAction, setDispAction] = useState('return')
  const [dispNote, setDispNote] = useState('')
  const [dispBusy, setDispBusy] = useState(false)
  const [showDisposed, setShowDisposed] = useState(false)

  const { channel: globalChannel, hammerInsightsTab: tab, hammerReplenMode, setHammerReplenMode, hammerCols, hammerData } = useAppStore()
  useEffect(() => { setDispSel([]) }, [globalChannel, tab])
  const replenMode = (globalChannel !== 'jd' && hammerReplenMode === 'bbcc') ? 'traditional' : hammerReplenMode
  const currentCols = replenMode === 'bbcc' ? BBCC_COLS : TRAD_COLS
  const [visCols, setVisCols] = useState(() => {
    var saved = getVis(replenMode, globalChannel)
    var defaultCols = replenMode==='bbcc'?defVis(BBCC_COLS):defVisTrad(TRAD_COLS)
    if (saved) {
      // 过滤掉已不存在的列ID（如旧版 combined_turn → cur_turn）
      var validIds = currentCols.map(function(c) { return c.id })
      saved = saved.filter(function(id) { return validIds.includes(id) })
      if (saved.length === 0) saved = defaultCols
    } else {
      saved = defaultCols
    }
    return saved
  })
  // 搜索：按 tab 和模式隔离
  const searchKey = tab === 'purchase' ? 'insights_search_purchase' : (tab === 'slow' ? 'insights_search_slow' : 'insights_search_' + replenMode)
  const insightSearch = hammerData?.[globalChannel]?.[searchKey] || ''
  // 搜索时重置分页
  useEffect(function() { setReplenLimit(50); setPurchaseLimit(50); setSlowLimit(50) }, [insightSearch])
  const filterBySearch = (items) => {
    if (!insightSearch) return items
    const q = insightSearch.toLowerCase()
    return items.filter(x => (x.sku||'').toLowerCase().includes(q) || (x.product_name||'').toLowerCase().includes(q) || (x.barcode||'').toLowerCase().includes(q))
  }
  const filteredReplen = filterBySearch(Array.isArray(replen) ? replen : [])
  const filteredPurchase = filterBySearch(Array.isArray(purchase) ? purchase : [])
  const filteredSlow = filterBySearch(Array.isArray(slowMoving) ? slowMoving : [])
  const [purchaseVisCols, setPurchaseVisCols] = useState(() => PURCHASE_COLS.map(c => c.id))
  const [slowVisCols, setSlowVisCols] = useState(() => SLOW_COLS.map(c => c.id))
  const reqSeq = useRef(0)
  const replenSeq = useRef(0)

  useEffect(() => {
    const saved = hammerCols?.['insights_'+replenMode]
    if (saved) {
      var validIds = currentCols.map(function(c) { return c.id })
      var filtered = saved.filter(function(id) { return validIds.includes(id) })
      setVisCols(filtered.length > 0 ? filtered : (replenMode==='bbcc'?defVis(BBCC_COLS):defVisTrad(TRAD_COLS)))
    } else {
      const ls = getVis(replenMode, globalChannel)
      if (ls) setVisCols(ls)
      else setVisCols(replenMode==='bbcc'?defVis(BBCC_COLS):defVisTrad(TRAD_COLS))
    }
  }, [hammerCols, replenMode])
  // {t("insights.purchase")}列同步
  useEffect(() => {
    const saved = hammerCols?.['insights_' + globalChannel + '_purchase']
    if (saved) setPurchaseVisCols(saved)
    else setPurchaseVisCols(PURCHASE_COLS.map(c => c.id))
  }, [hammerCols, globalChannel])
  // {t("insights.slow")}列同步
  useEffect(() => {
    const saved = hammerCols?.['insights_' + globalChannel + '_slow']
    if (saved) setSlowVisCols(saved)
    else setSlowVisCols(SLOW_COLS.map(c => c.id))
  }, [hammerCols, globalChannel])
  const [replenError, setReplenError] = useState('')
  const loadReplen = async (mode, ch) => {
    const seq = ++replenSeq.current
    setReplenLoading(true)
    setReplenError('')
    try {
      const r = await api.get('/api/insights/replenishment?days=28&mode=' + mode, {timeout: 90000})
      if (seq !== replenSeq.current) return
      let data = r.data
      // 防双重包装兜底：{ok,data:{...}} 或 {data:[...]} 结构再解一层
      if (!Array.isArray(data) && data && typeof data === 'object') {
        if (Array.isArray(data.data)) data = data.data
        else if (Array.isArray(data.data && data.data.data)) data = data.data.data
      }
      setReplen(Array.isArray(data) ? data : [])
      if (!Array.isArray(data)) setReplenError('返回数据格式异常: ' + (r && r.status || '') + ' ' + String(r.data).slice(0, 120))
    } catch(e) {
      console.error('loadReplen:', e)
      if (seq === replenSeq.current) {
        setReplen([])
        setReplenError((e && (e.message || e.statusText)) ? String(e.message || e.statusText) : String(e))
      }
    }
    if (seq === replenSeq.current) setReplenLoading(false)
  }

  // 从后端加载已下单标记（按渠道隔离）
  const loadOrdered = async () => {
    try {
      const r = await api.get('/api/purchase-orders?channel=' + globalChannel)
      const items = r.data || []
      // 存两份：orderedKeys 用于快速判断，orderedItems 用于展示详情
      setOrderedKeys(items.map(x => x.sku + "|" + x.store))
      setOrderedItems(items)
    } catch(e) {
      try { const fallback = JSON.parse(localStorage.getItem('c_ordered_' + globalChannel) || '[]'); setOrderedKeys(fallback) } catch { setOrderedKeys([]) }
    }
  }

  const [orderedKeys, setOrderedKeys] = useState([])
  const [orderedItems, setOrderedItems] = useState([])

  // ─── BBCC 模式「已下单」功能 ──────────────────────────────────────────
  // 业务含义：京东 B 仓入库批次标记。点击「下单」= 给该 SKU 打上 B 仓入库批次
  // 标记，再填写「到 B 仓日期」，用于监控在库天数（避免超储被京东收取仓储费）。
  // 仅 BBCC 模式展示（replenMode==='bbcc' 控制），按渠道隔离持久化。
  const toggleOrdered = async (sku, store, product_name, suggested_qty) => {
    const key = sku + '|' + store
    const isOrdered = orderedKeys.includes(key)
    // 乐观更新：立即更新本地状态，不等 API 返回
    if (isOrdered) {
      setOrderedKeys(prev => prev.filter(k => k !== key))
      setOrderedItems(prev => prev.filter(x => x.sku !== sku || x.store !== store))
      api.delete('/api/purchase-orders?sku=' + encodeURIComponent(sku) + '&store=' + encodeURIComponent(store) + '&channel=' + globalChannel)
        .then(() => toast.success('已取消下单'))
        .catch(() => { toast.error('取消失败'); loadOrdered() })
    } else {
      const newItem = {sku, store, product_name: product_name || '', suggested_qty: suggested_qty || 0, arrival_date: ''}
      setOrderedKeys(prev => [...prev, key])
      setOrderedItems(prev => [...prev, newItem])
      api.post('/api/purchase-orders?sku=' + encodeURIComponent(sku) + '&store=' + encodeURIComponent(store) + '&product_name=' + encodeURIComponent(product_name || '') + '&suggested_qty=' + (suggested_qty || 0) + '&channel=' + globalChannel)
        .then(() => toast.success('已下单'))
        .catch(() => { toast.error('下单失败'); loadOrdered() })
    }
  }

  // 设置到 B 仓日期（入库批次生效日，用于计算在库天数监控超储）
  const setArrivalDate = async (item, date) => {
    // 乐观更新
    setOrderedItems(prev => prev.map(x => x.id === item.id ? {...x, arrival_date: date} : x))
    api.put('/api/purchase-orders/' + item.id, {arrival_date: date}).catch(() => loadOrdered())
  }

  const todayStr = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    loadOrdered()
    setReplenLoading(true)
    setPurchaseLoading(true)
    setSlowLoading(true)
    const seq = ++reqSeq.current
    const mode = globalChannel === 'jd' ? replenMode : 'traditional'
    if (globalChannel !== 'jd' && replenMode === 'bbcc') setHammerReplenMode('traditional')
    loadReplen(mode, globalChannel)
    api.get('/api/insights/purchase?days=28&mode=' + replenMode + '&channel=' + globalChannel).then(r => {
      if (seq !== reqSeq.current) { setPurchaseLoading(false); return }
      setPurchase(r.data?.suggestions || r.data || [])
      setPurchaseLoading(false)
    }).catch(() => setPurchaseLoading(false))
    api.get('/api/insights/slow-moving').then(r => {
      if (seq !== reqSeq.current) { setSlowLoading(false); return }
      setSlowMoving(r.data || [])
      setSlowLoading(false)
    }).catch(() => setSlowLoading(false))
    api.get('/api/insights/disposal-suggestions?channel=' + globalChannel).then(r => {
      if (seq !== reqSeq.current) { setDisposalsLoading(false); return }
      setDisposals(r.data || [])
      setDisposalsLoading(false)
    }).catch(() => setDisposalsLoading(false))
  }, [globalChannel, replenMode])

  const doDispose = async () => {
    if (dispSel.length === 0) { toast.error('请先勾选要处置的项'); return }
    setDispBusy(true)
    try {
      const items = dispSel
        .map(key => { const parts = key.split('|'); const d = disposals.find(x => (x.sku + '|' + x.warehouse) === key); return d ? { sku: parts[0], warehouse: parts[1], warehouse_type: d.warehouse_type, level: d.level, turnover_days: d.turnover_days, reason: d.reason } : null })
        .filter(Boolean)
      await api.post('/api/disposals/batch', { channel: globalChannel, action: dispAction, note: dispNote, items })
      toast.success('已标记 ' + items.length + ' 项处置')
      setDispSel([]); setDispNote('')
      api.get('/api/insights/disposal-suggestions?channel=' + globalChannel).then(r => setDisposals(r.data || [])).catch(() => {})
    } catch(e) { toast.error('处置失败: ' + (e.message||'')) }
    setDispBusy(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* {t("nav.insights")} */}
      {tab === 'replen' && (
        <div className="card">
          <div className="section-title" style={{display:'flex',flexWrap:'wrap',gap:6,alignItems:'center'}}>
            <span>补货建议</span>
            <span className="muted2" style={{fontSize:11,fontWeight:400}}>已加载 {Math.min(replenLimit, filteredReplen.length)}/{filteredReplen.length} 条 · 显示 {visCols.length}/{currentCols.length} 列{insightSearch ? ` · "${insightSearch}"` : ''}</span>
            {replenMode==='bbcc' && orderedKeys.length > 0 && <span className="pill success" style={{fontSize:10}}>已下单 {orderedKeys.length} 项</span>}
          </div>
          {replenLoading ? (
            <div>
              <Skeleton height={14} width="30%" style={{ marginBottom: 8 }} />
              {[1,2,3,4,5].map(i => <Skeleton key={i} height={36} style={{ marginBottom: 4 }} />)}
            </div>
          ) : !Array.isArray(replen) || replen.length === 0 ? (
            <div style={{ padding: 12, textAlign: 'center' }}>
              {replenError ? (
                <div className="muted2" style={{ fontSize: 12 }}>
                  <div style={{ color: 'var(--danger)', marginBottom: 4 }}>⚠️ 加载失败：{replenError}</div>
                  <div>请下拉刷新重试，或到设置页检查「API 连接状态」</div>
                </div>
              ) : (
                <div className="muted">{t("insights.no_replenish")}</div>
              )}
            </div>
          ) : (
            <div style={{overflow:'auto',maxHeight:'calc(100vh - 180px)'}}>
              <table>
                <colgroup>{visCols.map(id => {const col = currentCols.find(c => c.id === id); return col ? <col key={col.id} /> : null})}</colgroup>
                <thead style={{position:'sticky',top:0,background:'var(--card)',zIndex:1}}><tr>{visCols.map(id => {const col = currentCols.find(c => c.id === id); return col ? <th style={{whiteSpace:'nowrap',fontSize:11,padding:'8px 4px'}} key={col.id}>{col.label}</th> : null})}</tr></thead>
                <tbody>
                  {Array.isArray(filteredReplen) && filteredReplen.slice(0, replenLimit).map((x, i) => {
                    const isOrdered = orderedKeys.includes(x.sku+'|'+x.store)
                    const rowStyle = isOrdered ? {opacity:0.55,background:'var(--bg)'} : {}
                    return (
                    <tr key={i} style={rowStyle}>
                      {visCols.map(id => {
                        const col = currentCols.find(c => c.id === id)
                        if (!col) return <td key={id}></td>
                        // 序号列
                        if (col.id === 'seq') return <td key={col.id} className="text-11 muted2">{i+1}</td>
                        // SKU
                        if (col.id === 'sku') return <td key={col.id} className="mono" style={{fontSize:12,textDecoration:isOrdered?'line-through':'none'}}>{x.sku}</td>
                        if (col.id === 'barcode') return <td key={col.id} className='mono' style={{fontSize:11}}>{x.barcode||'-'}</td>
                        // 商品名
                        if (col.id === 'name') return <td key={col.id} style={{textDecoration:isOrdered?'line-through':'none'}}>{x.product_name}</td>
                        // 仓库(BBCC) / 店铺(TRAD)
                        if (col.id === 'warehouse' || col.id === 'store') return <td key={col.id} className="col-store">{replenMode==='bbcc' ? 'B仓' : (x.warehouse || x.store || '-')}</td>
                        // 现有(TRAD)
                        if (col.id === 'avail') return <td key={col.id} style={{fontWeight:600}}>{x.available_qty}</td>
                        // B仓可用库存
                        if (col.id === 'b_stock') return <td key={col.id} style={{color:'var(--primary)',fontWeight:600}}>{x.b_stock ?? '-'}</td>
                        // B仓周转
                        if (col.id === 'b_turn') return <td key={col.id} style={{fontSize:11,fontWeight:600,color:x.b_stock > 0 && (x.daily_sales > 0 ? (x.b_stock/x.daily_sales) : Infinity) > 15 ? '#ef4444' : x.b_stock > 0 && x.daily_sales > 0 && (x.b_stock/x.daily_sales) > 10 ? 'var(--warning)' : 'var(--text)'}}>{x.b_stock > 0 ? (x.daily_sales > 0 ? (x.b_stock/x.daily_sales).toFixed(1)+'天' : '∞') : '-'}</td>
                        // C仓总和可用
                        if (col.id === 'c_stock') return <td key={col.id} style={{fontWeight:600}}>{x.c_stock ?? x.available_qty}</td>
                        // 在途
                        if (col.id === 'transit') return <td key={col.id}>{x.in_transit_qty}</td>
                        // 日销
                        if (col.id === 'sales') return <td key={col.id} style={{fontSize:11,fontWeight:600,whiteSpace:'nowrap'}}>{x.daily_sales}<span style={{fontSize:10,fontWeight:400,color:'var(--muted2)'}}>
                          /{x.daily_sales_7||0 > (x.daily_sales_14||0)*1.15 ? <IconTrendUp size={12} style={{display:'inline',verticalAlign:'middle'}} /> : x.daily_sales_7||0 < (x.daily_sales_14||0)*0.85 ? <IconTrendDown size={12} style={{display:'inline',verticalAlign:'middle'}} /> : <IconTrendFlat size={12} style={{display:'inline',verticalAlign:'middle'}} />}{x.daily_sales_7||0}
                          /{x.daily_sales_14||0 > (x.daily_sales_28||0)*1.15 ? <IconTrendUp size={12} style={{display:'inline',verticalAlign:'middle'}} /> : x.daily_sales_14||0 < (x.daily_sales_28||0)*0.85 ? <IconTrendDown size={12} style={{display:'inline',verticalAlign:'middle'}} /> : <IconTrendFlat size={12} style={{display:'inline',verticalAlign:'middle'}} />}{x.daily_sales_14||0}
                          /{x.daily_sales_28||0}</span></td>
                        // C仓周转
                        if (col.id === 'c_turn') return <td key={col.id} className="text-11 font-600">{x.c_turnover != null ? x.c_turnover+'天' : '∞'}</td>
                        // 在途周转
                        if (col.id === 'transit_turn') return <td key={col.id} style={{fontSize:11}}>{x.transit_turnover != null ? x.transit_turnover+'天' : '∞'}</td>
                        // 安全线(TRAD)
                        if (col.id === 'safety') return <td key={col.id}>{x.safety_qty}</td>
                        // 在库周转(TRAD)
                        if (col.id === 'turn') return <td key={col.id} style={{color: x.days_to_empty < 5 ? '#ef4444' : x.days_to_empty < 10 ? 'var(--warning)' : 'var(--text)'}}>{x.days_to_empty > 999 ? '∞' : x.days_to_empty}</td>
                        // C仓建议补
                        if (col.id === 'suggest') return <td key={col.id} style={{color:'var(--primary)',fontWeight:600}}>{x.suggested_qty > 0 ? x.suggested_qty : '-'}</td>
                        // B仓需补
                        if (col.id === 'b_suggest') return <td key={col.id} style={{color:'var(--success)',fontWeight:700}}>{x.b_suggested > 0 ? x.b_suggested : '-'}</td>
                        // 当前综转
                        if (col.id === 'cur_turn') return <td key={col.id} style={{fontSize:11}}>{x.combined_turnover_current != null ? x.combined_turnover_current+'天' : '∞'}</td>
                        // 补后综转(BBCC) / 补后周转(TRAD)
                        if (col.id === 'after_turn') return <td key={col.id} style={{fontSize:11,fontWeight:700,color:replenMode==='bbcc'?(x.combined_turnover!=null&&x.combined_turnover>90?'#ef4444':x.combined_turnover!=null&&x.combined_turnover>15?'var(--warning)':'var(--text)'):(x.after_turnover!=null&&x.after_turnover>90?'#ef4444':x.after_turnover!=null&&x.after_turnover>15?'var(--warning)':'var(--text)')}}>{replenMode==='bbcc'?(x.suggested_qty>0||x.b_suggested>0)&&x.combined_turnover!=null?x.combined_turnover+'天':'-':x.suggested_qty>0&&x.after_turnover!=null?x.after_turnover+'天':'-'}</td>
                        // 备注
                        if (col.id === 'note') return <td key={col.id} className="col-name" style={{color:'var(--muted2)',fontSize:12}}>{renderNote(x.note)}</td>
                        // 标记操作
                        if (col.id === 'action') return <td key={col.id}>{isOrdered
                          ? <span onClick={()=>toggleOrdered(x.sku, x.store, x.product_name, x.suggested_qty || x.b_suggested)} style={{cursor:'pointer',fontSize:16,color:'var(--success)',display:'inline-flex',alignItems:'center',gap:2}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle'}}><polyline points="4 12 10 18 20 6"/></svg><span className="text-9 muted2">{t("undo.undo")}</span></span>
                          : <span onClick={()=>{
                            if ((x.suggested_qty > 0 || x.b_suggested > 0) && x.combined_turnover > 90 && !window.confirm(`补后综合周转${x.combined_turnover}天，已超90天考核红线，仍标记操作？`)) return
                            toggleOrdered(x.sku, x.store, x.product_name, x.suggested_qty || x.b_suggested)
                          }} style={{cursor:'pointer',fontSize:18,opacity:0.5}}>☐</span>}</td>
                        return <td key={col.id} className="small muted" style={{fontSize:11}}>-</td>
                      })}
                    </tr>
                  )})}
                </tbody>
              </table>
              {Array.isArray(filteredReplen) && filteredReplen.length > replenLimit && (
                <div className="text-center mt-8" ref={function(el) {
                  if (el && !el._observer) {
                    el._observer = new IntersectionObserver(function(entries) {
                      if (entries[0].isIntersecting) setReplenLimit(function(prev) { return prev + 50 })
                    }, {rootMargin: '200px'})
                    el._observer.observe(el)
                  }
                }}>
                  <span className="btn btn-ghost" style={{fontSize:12,padding:'6px 16px',cursor:'pointer'}}>加载中... ({replenLimit}/{filteredReplen.length})</span>
                </div>
              )}
            </div>
          )}
          {/* 已下单明细（仅BBCC模式）：B 仓入库批次 + 在库天数监控，超储预警用 */}
          {replenMode==='bbcc' && orderedItems.length > 0 && <details style={{marginTop:12}} open>
            <summary className="small muted" style={{cursor:'pointer',fontSize:12,fontWeight:600}}>📦 已下单 {orderedItems.length} 项 · 点击查看入库日期与仓储天数</summary>
            <div style={{fontSize:12,marginTop:8}}>
              {orderedItems.map((po, i) => {
                const daysSinceArrival = po.arrival_date ? Math.floor((new Date() - new Date(po.arrival_date)) / (1000*60*60*24)) : null
                const stayColor = daysSinceArrival != null ? (daysSinceArrival > 90 ? '#ef4444' : daysSinceArrival > 15 ? '#f59e0b' : 'var(--text)') : 'var(--muted)'
                return <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 10px',border:'1px solid var(--border)',borderRadius:32,marginBottom:4,flexWrap:'wrap',gap:4}}>
                  <span style={{flex:1,minWidth:120}}>{po.sku} {po.product_name} <span className="pill success" style={{fontSize:10}}>+{(po.actual_qty||po.suggested_qty)}</span></span>
                  <span style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                    <span className="small" style={{color:stayColor,fontWeight:600}}>
                      {daysSinceArrival != null ? daysSinceArrival + '天' : '待入仓'}
                    </span>
                    <input type="date" value={po.arrival_date || ''}
                      onChange={e => setArrivalDate(po, e.target.value)}
                      style={{fontSize:11,padding:'2px 6px',border:'1px solid var(--border)',borderRadius:4,width:130}} />
                    <span onClick={()=>toggleOrdered(po.sku, po.store)} style={{cursor:'pointer',color:'var(--danger)',opacity:0.6,display:'inline-flex'}}><IconUndo size={14} /></span>
                  </span>
                </div>
              })}
            </div>
          </details>}
        </div>
      )}

      {/* 采购建议 */}
      {tab === 'purchase' && (
        <div className="card">
          <div className="section-title" style={{display:'flex',flexWrap:'wrap',gap:6,alignItems:'center'}}>
            <span>采购建议</span>
            {globalChannel==='jd' && <span className="pill" style={{fontSize:10,padding:'2px 8px',minHeight:'auto',lineHeight:'18px'}}>{replenMode==='bbcc'?'BBCC 口径(含B仓)':'传统口径(不含B仓)'}</span>}
            <span className="muted2" style={{fontSize:11,fontWeight:400}}>显示 {purchaseVisCols.length}/{PURCHASE_COLS.length} 列 · 已加载 {Math.min(purchaseLimit, filteredPurchase.length)}/{filteredPurchase.length} 条{insightSearch ? ` · "${insightSearch}"` : ''}</span>
          </div>
          {purchaseLoading ? (
            <div>
              {[1,2,3,4].map(i => <Skeleton key={i} height={36} style={{ marginBottom: 4 }} />)}
            </div>
          ) : (purchase.length === 0 ? (
            <div className="muted" style={{ padding: 12, textAlign: 'center' }}>{t("insights.no_purchase")}</div>
          ) : (
            <div style={{overflow:'auto',maxHeight:"calc(100vh - 180px)"}}>
              <table>
                <colgroup>{purchaseVisCols.map(id => {const col = PURCHASE_COLS.find(c => c.id === id); return col ? <col key={col.id} /> : null})}</colgroup>
                <thead style={{position:'sticky',top:0,background:'var(--card)',zIndex:1}}><tr>{purchaseVisCols.map(id => {const col = PURCHASE_COLS.find(c => c.id === id); return col ? <th style={{whiteSpace:'nowrap',fontSize:11,padding:'8px 4px'}} key={col.id}>{col.label}</th> : null})}</tr></thead>
                <tbody>
                  {filteredPurchase.slice(0, purchaseLimit).map((x, i) => {
                    const timing = !x.purchase_qty || x.purchase_qty <= 0 ? '充足' : (x.after_turnover && (x.target_turnover || 15) > 0 && x.after_turnover <= (x.target_turnover || 15) ? '建议' : '充足')
                    return (
                    <tr key={i}>
                      {purchaseVisCols.map(id => {
                        const col = PURCHASE_COLS.find(c => c.id === id)
                        if (!col) return <td key={id}></td>
                        if (col.id === 'barcode') return <td key={col.id} className="mono text-11 muted2">{x.barcode || '-'}</td>
                        if (col.id === 'sku') return <td key={col.id} className="mono" style={{fontSize:12}}>{x.sku}</td>
                        if (col.id === 'name') return <td key={col.id} className="col-name">{x.product_name}</td>
                        if (col.id === 'warehouse') return <td key={col.id} className="col-store">{x.warehouse || x.store || '-'}</td>
                        if (col.id === 'sys_total') return <td key={col.id} style={{fontSize:12}}>
                          <span style={{fontWeight:600}}>{x.sys_total}</span>
                          <span className="small muted" style={{fontWeight:400}}> 自有{x.own_available}+{x.own_transit ? `在途${x.own_transit}`:''} 平台{x.plat_available}+{x.plat_transit ? `在途${x.plat_transit}`:''}{globalChannel === 'jd' ? ` B仓${x.b_available||0}` : ''}</span>
                        </td>
                        if (col.id === 'daily_sales') return <td key={col.id} style={{fontSize:12,fontWeight:600,whiteSpace:'nowrap'}}>{x.daily_sales}<span style={{fontSize:10,fontWeight:400,color:'var(--muted2)'}}> /{x.daily_sales_14||0}/{x.daily_sales_28||0}</span></td>
                        if (col.id === 'actual_purchase') return <td key={col.id} style={{fontWeight:700,color:x.actual_purchase > 0 ? 'var(--success)' : 'var(--muted2)'}}>{x.actual_purchase > 0 ? '+'+x.actual_purchase : (x.actual_purchase === 0 ? '0' : '-')}</td>
                        if (col.id === 'after_turnover') return <td key={col.id} style={{fontWeight:600,color: x.actual_purchase > 0 ? (x.target_turnover > 0 && x.after_turnover > x.target_turnover ? '#ef4444' : 'var(--text)') : 'var(--muted2)'}}>{x.actual_purchase > 0 ? x.after_turnover+'天' : '-'}</td>
                        if (col.id === 'note') return <td key={col.id} className="col-name" style={{color:'var(--muted2)',fontSize:12}}>{renderNote(x.note) || t("insights.no_purchase_needed")}</td>
                        if (col.id === 'timing') return <td key={col.id}><span className={`pill ${timing==='建议'?'warning':'info'}`}>{timing}</span></td>
                        return <td key={col.id}></td>
                      })}
                    </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{fontWeight:700,borderTop:'2px solid var(--border)'}}>
                    {purchaseVisCols.includes('actual_purchase') && <>
                      <td colSpan={purchaseVisCols.indexOf('actual_purchase')} style={{textAlign:'right',fontSize:12}}>合计</td>
                      <td style={{color:'var(--success)',fontSize:13}}>+{filteredPurchase.reduce((s,x)=>s+(x.actual_purchase||0),0)}</td>
                      {purchaseVisCols.includes('after_turnover') && purchaseVisCols.indexOf('after_turnover') > purchaseVisCols.indexOf('actual_purchase') && <td colSpan={purchaseVisCols.length - purchaseVisCols.indexOf('after_turnover') - 1} className="text-11 muted2">
                        {(() => {
                          const withPurchase = filteredPurchase.filter(x => x.purchase_qty > 0)
                          const avgTurnover = withPurchase.length > 0
                            ? (withPurchase.reduce((s,x)=>s+(x.after_turnover||0),0) / withPurchase.length).toFixed(1)
                            : ''
                          return '平均周转 ' + (avgTurnover || '—') + ' 天'
                        })()}
                      </td>}
                    </>}
                  </tr>
                </tfoot>
              </table>
              {filteredPurchase.length > purchaseLimit && (
                <div className="text-center mt-8" ref={function(el) {
                  if (el && !el._observer) {
                    el._observer = new IntersectionObserver(function(entries) {
                      if (entries[0].isIntersecting) setPurchaseLimit(function(prev) { return prev + 50 })
                    }, {rootMargin: '200px'})
                    el._observer.observe(el)
                  }
                }}>
                  <span className="btn btn-ghost" style={{fontSize:12,padding:'6px 16px',cursor:'pointer'}}>加载中... ({purchaseLimit}/{filteredPurchase.length})</span>
                </div>
              )}
            </div>
        ))}
      </div>
    )}

      {/* 滞销预警 */}
      {tab === 'slow' && (
        <div className="card">
          <div className="section-title" style={{display:'flex',flexWrap:'wrap',gap:6,alignItems:'center'}}>
            <span>滞销预警</span>
            <span className="muted2" style={{fontSize:11,fontWeight:400}}>显示 {slowVisCols.length}/{SLOW_COLS.length} 列 · 共 {filteredSlow.length} 条{insightSearch ? ` · "${insightSearch}"` : ''}</span>
          </div>

          {/* 处置建议（SKU×仓库 + 批量处置） */}
          <div style={{marginBottom:14,padding:14,borderRadius:24,border:'1px solid var(--border)',background:'var(--bg-thin)'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,flexWrap:'wrap'}}>
              <span style={{fontWeight:700,fontSize:14}}>自动处置建议</span>
              <span className="muted2" style={{fontSize:11}}>按 SKU×仓库 · 对齐 90 天周转红线 + B仓15天免费期</span>
              <span onClick={()=>setShowDisposed(!showDisposed)} className="clickable" style={{marginLeft:'auto',fontSize:12,padding:'4px 12px',borderRadius:99,border:'1px solid var(--border)',background:'var(--card)',cursor:'pointer'}}>{showDisposed?'隐藏已处置':'查看已处置'}</span>
            </div>
            {disposalsLoading ? (
              <div className="muted" style={{padding:12,textAlign:'center',fontSize:12}}>计算中...</div>
            ) : (
              <>
                {disposals.filter(x => showDisposed || !x.disposed).length === 0 ? (
                  <div className="muted" style={{padding:12,textAlign:'center',fontSize:12}}>{showDisposed ? '暂无处置记录' : '暂无需要处置的积压库存 🎉'}</div>
                ) : (
                  <div style={{maxHeight:'calc(100vh - 260px)',overflowY:'auto'}}>
                    {disposals.filter(x => showDisposed || !x.disposed).map(d => {
                      const key = d.sku + '|' + d.warehouse
                      const isSel = dispSel.includes(key)
                      return <div key={key} onClick={()=>setDispSel(prev => isSel ? prev.filter(k=>k!==key) : [...prev, key])} style={{display:'flex',gap:10,alignItems:'flex-start',padding:'10px 12px',marginBottom:6,borderRadius:16,border:'1px solid var(--border)',background:isSel?'rgba(29,78,216,0.08)':'var(--card)',cursor: d.disposed ? 'default':'pointer',opacity:d.disposed?0.6:1}}>
                        <span style={{width:18,height:18,borderRadius:6,border:'1.5px solid',borderColor:isSel?'var(--primary)':'var(--border)',background:isSel?'var(--primary)':'transparent',display:'inline-flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:11,flexShrink:0,marginTop:2}}>{isSel?'✓':''}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                            <span className={`pill ${d.level==='black'?'danger':d.level==='red'?'danger':d.level==='yellow'?'warning':'info'}`} style={{fontSize:10,padding:'2px 8px',minHeight:'auto',lineHeight:'18px',background:d.level==='black'?'#7c3aed':'',border:d.level==='black'?'1px solid #7c3aed':''}}>{d.level==='black'?'紧急':d.level==='red'?'处置':'滞销'}</span>
                            <span style={{fontWeight:600,fontSize:13}}>{d.sku}</span>
                            <span style={{fontSize:12,marginLeft:4}}>{d.product_name}</span>
                            {d.disposed && <span style={{fontSize:11,color:'var(--muted2)'}}>✓ 已处置({d.disposed_action||'已标记'})</span>}
                          </div>
                          <div style={{fontSize:11,color:'var(--muted2)',marginTop:4}}>
                            <b style={{color:'var(--text)'}}>{d.warehouse}</b> · {d.cat_line} · {d.days_zero}天未销售 · 库存 {d.stock} · 占用 ¥{d.fund_occupied}
                            {d.b_storage && <span style={{color:'var(--danger)'}}> · 在库{d.b_storage.days_stored}天({d.b_storage.volume_m3}方) · 超期{d.b_storage.over_days}天 ≈{d.b_storage.billed_months}计费月(费率待定)</span>}
                          </div>
                          <div style={{fontSize:11,marginTop:4,color:'var(--text)'}}>
                            {(d.reason||[]).join(' · ')}
                            <span style={{fontWeight:600}}> → {d.suggestion}</span>
                          </div>
                        </div>
                      </div>
                    })}
                  </div>
                )}
                {/* 批量处置操作栏 */}
                {!showDisposed && dispSel.length > 0 && (
                  <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:10,padding:'8px 10px',borderRadius:16,background:'var(--card)',border:'1px solid var(--border)',alignItems:'center'}}>
                    <span style={{fontSize:12,fontWeight:600}}>已选 {dispSel.length} 项</span>
                    <select value={dispAction} onChange={e=>setDispAction(e.target.value)} style={{fontSize:12,padding:'6px 8px',borderRadius:99,border:'1px solid var(--border)',background:'var(--card)'}}>
                      <option value="return">退货供应商</option>
                      <option value="clearance">清仓甩卖</option>
                      <option value="promo">降价促销</option>
                    </select>
                    <input value={dispNote} onChange={e=>setDispNote(e.target.value)} placeholder="备注(可选)" style={{flex:1,minWidth:80,fontSize:12,padding:'6px 10px',borderRadius:99,border:'1px solid var(--border)',background:'var(--card)',outline:'none'}} />
                    <button onClick={doDispose} disabled={dispBusy} className="btn btn-primary" style={{minHeight:32,padding:'0 14px',fontSize:12,flexShrink:0}}>{dispBusy?'处理中...':'批量标记处置'}</button>
                  </div>
                )}
              </>
            )}
          </div>
          {slowLoading ? (
            <div>
              {[1,2,3].map(i => <Skeleton key={i} height={36} style={{ marginBottom: 4 }} />)}
            </div>
          ) : (slowMoving.length === 0 ? (
            <div className="muted" style={{ padding: 12, textAlign: 'center' }}>{t("common.empty")}</div>
          ) : (
            <>
              <div style={{overflow:'auto',maxHeight:"calc(100vh - 180px)"}}>
                <div style={{fontSize:11,color:'var(--muted2)',marginBottom:4}}>显示 {slowVisCols.length}/{SLOW_COLS.length} 列 · 点击"列"按钮切换{insightSearch ? ` · 搜索 "${insightSearch}"` : ''}</div>
                <table>
                  <colgroup>{slowVisCols.map(id => {const col = SLOW_COLS.find(c => c.id === id); return col ? <col key={col.id} /> : null})}</colgroup>
                  <thead style={{position:'sticky',top:0,background:'var(--card)',zIndex:1}}><tr>{slowVisCols.map(id => {const col = SLOW_COLS.find(c => c.id === id); return col ? <th style={{whiteSpace:'nowrap',fontSize:11,padding:'8px 4px'}} key={col.id}>{col.label}</th> : null})}</tr></thead>
                  <tbody>
                    {filteredSlow.filter(x => x.level !== '正常').map((x, i) => (
                      <tr key={i}>
                        {slowVisCols.map(id => {
                          const col = SLOW_COLS.find(c => c.id === id)
                          if (!col) return <td key={id}></td>
                          if (col.id === 'barcode') return <td key={col.id} className="mono text-11 muted2">{x.barcode || '-'}</td>
                          if (col.id === 'sku') return <td key={col.id} className="mono" style={{fontSize:12}}>{x.sku}</td>
                          if (col.id === 'name') return <td key={col.id}>{x.product_name}</td>
                          if (col.id === 'store') return <td key={col.id}>{x.store || x.warehouse || '-'}</td>
                          if (col.id === 'category') return <td key={col.id}>{x.category || '-'}</td>
                          if (col.id === 'last_order_date') return <td key={col.id} className="text-12 muted">{x.last_order_date}</td>
                          if (col.id === 'days') return <td key={col.id} style={{fontWeight:600,color:(x.days_since_last||x.days_since_last_order||0) >= 90 ? '#ef4444' : (x.days_since_last||x.days_since_last_order||0) >= 30 ? 'var(--warning)' : 'var(--muted)'}}>{(x.days_since_last||x.days_since_last_order||0)}天</td>
                          if (col.id === 'stock') return <td key={col.id}>{(x.stock||x.available_qty||0)}</td>
                          if (col.id === 'level') return <td key={col.id}><span className={`pill ${x.level === '滞销' ? 'danger' : x.level === '冷淡' ? 'warning' : 'info'}`}>{x.level}</span></td>
                          return <td key={col.id}></td>
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
            </div>
              {slowMoving.filter(x => x.level === '正常').length > 0 && (
                <div className="small muted" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  另有 {slowMoving.filter(x => x.level === '正常').length} 个商品最近 14 天内有过订单（正常销售中）
                </div>
              )}
            </>
          ))}
        </div>
      )}
    </div>
  )
}
