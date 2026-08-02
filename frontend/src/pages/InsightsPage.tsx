import React, { useEffect, useState, useRef } from 'react'
import { api } from '../api/client'
import { useAppStore } from '../store/useAppStore'
import { IconTrendUp, IconTrendDown, IconTrendFlat, IconUndo } from '../components/Icons'

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
  {id:'b_stock',label:'B仓可用库存'},{id:'b_turn',label:'B仓周转'},{id:'c_stock',label:'C仓总和可用'},
  {id:'transit',label:'B-C调拨在途'},{id:'sales',label:'C仓日销'},{id:'c_turn',label:'C仓周转'},
  {id:'transit_turn',label:'B→C调拨周转'},{id:'suggest',label:'C仓建议补'},{id:'b_suggest',label:'B仓需补'},
  {id:'cur_turn',label:'当前综转'},{id:'after_turn',label:'补后综转'},{id:'note',label:'备注'},{id:'action',label:'标记操作（用于B仓统计入库批次）'},
]
const TRAD_COLS = [
  {id:'seq',label:''},{id:'sku',label:'SKU'},{id:'barcode',label:'69码'},{id:'name',label:'商品'},{id:'store',label:'仓库'},
  {id:'avail',label:'现有'},{id:'transit',label:'在途'},{id:'sales',label:'日销'},
  {id:'safety',label:'安全线'},{id:'turn',label:'在库周转'},{id:'after_turn',label:'补后周转'},
  {id:'suggest',label:'建议补'},{id:'note',label:'备注'},
]
const colKey = m => 'c_cols_' + m
function getVis(m) {try{return JSON.parse(localStorage.getItem(colKey(m))||'null')}catch{return null}}
function defVis(cols){return cols.map(c=>c.id).filter((_,i)=>[0,1,2,3,4,8,11,12,15].includes(i))} // 默认9列(BBCC)
function defVisTrad(cols){return cols.map(c=>c.id).filter((_,i)=>[0,1,2,3,4,5,6,10,11].includes(i))} // 默认9列(TRAD)
const PURCHASE_COLS = [
  {id:'barcode',label:'69码'},{id:'sku',label:'SKU'},{id:'name',label:'商品'},{id:'warehouse',label:'仓库'},
  {id:'sys_total',label:'系统总库存'},{id:'daily_sales',label:'日销(融合/14/28)'},
  {id:'actual_purchase',label:'建议采购'},{id:'after_turnover',label:'补后周转'},
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
  const [replen, setReplen] = useState([])
  const [purchase, setPurchase] = useState([])
  const [slowMoving, setSlowMoving] = useState([])

  // 各区块加载状态
  const [replenLoading, setReplenLoading] = useState(true)
  const [purchaseLoading, setPurchaseLoading] = useState(true)
  const [slowLoading, setSlowLoading] = useState(true)

  const { channel: globalChannel, hammerInsightsTab: tab, hammerReplenMode, setHammerReplenMode, hammerCols } = useAppStore()
  const replenMode = (globalChannel !== 'jd' && hammerReplenMode === 'bbcc') ? 'traditional' : hammerReplenMode
  const currentCols = replenMode === 'bbcc' ? BBCC_COLS : TRAD_COLS
  const [visCols, setVisCols] = useState(() => getVis(replenMode) || (replenMode==='bbcc'?defVis(BBCC_COLS):defVisTrad(TRAD_COLS)))
  const [purchaseVisCols, setPurchaseVisCols] = useState(() => PURCHASE_COLS.map(c => c.id))
  const [slowVisCols, setSlowVisCols] = useState(() => SLOW_COLS.map(c => c.id))
  const reqSeq = useRef(0)

  useEffect(() => {
    const saved = hammerCols?.['insights_'+replenMode]
    if (saved) setVisCols(saved)
    else {
      const ls = getVis(replenMode)
      if (ls) setVisCols(ls)
      else setVisCols(replenMode==='bbcc'?defVis(BBCC_COLS):defVisTrad(TRAD_COLS))
    }
  }, [hammerCols, replenMode])
  // 采购建议列同步
  useEffect(() => {
    const saved = hammerCols?.['insights_' + globalChannel + '_purchase']
    if (saved) setPurchaseVisCols(saved)
    else setPurchaseVisCols(PURCHASE_COLS.map(c => c.id))
  }, [hammerCols, globalChannel])
  // 滞销预警列同步
  useEffect(() => {
    const saved = hammerCols?.['insights_' + globalChannel + '_slow']
    if (saved) setSlowVisCols(saved)
    else setSlowVisCols(SLOW_COLS.map(c => c.id))
  }, [hammerCols, globalChannel])
  const loadReplen = async (mode, ch) => {
    const seq = ++reqSeq.current
    setReplenLoading(true)
    try {
      const r = await api.get('/api/insights/replenishment?days=28&mode=' + mode)
      if (seq === reqSeq.current) setReplen(Array.isArray(r.data) ? r.data : [])
    } catch(e) {
      console.error('loadReplen:', e)
      if (seq === reqSeq.current) setReplen([])
    }
    if (seq === reqSeq.current) setReplenLoading(false)
  }

  // 从后端加载已下单标记
  const loadOrdered = async () => {
    try {
      const r = await api.get('/api/purchase-orders')
      const items = r.data || []
      // 存两份：orderedKeys 用于快速判断，orderedItems 用于展示详情
      setOrderedKeys(items.map(x => x.sku + "|" + x.store))
      setOrderedItems(items)
    } catch(e) {
      try { const fallback = JSON.parse(localStorage.getItem('c_ordered') || '[]'); setOrderedKeys(fallback) } catch { setOrderedKeys([]) }
    }
  }

  const [orderedKeys, setOrderedKeys] = useState([])
  const [orderedItems, setOrderedItems] = useState([])

  const toggleOrdered = async (sku, store, product_name, suggested_qty) => {
    const key = sku + '|' + store
    const isOrdered = orderedKeys.includes(key)
    // 乐观更新：立即更新本地状态，不等 API 返回
    if (isOrdered) {
      setOrderedKeys(prev => prev.filter(k => k !== key))
      setOrderedItems(prev => prev.filter(x => x.sku !== sku || x.store !== store))
      api.delete('/api/purchase-orders?sku=' + encodeURIComponent(sku) + '&store=' + encodeURIComponent(store)).catch(() => loadOrdered())
    } else {
      const newItem = {sku, store, product_name: product_name || '', suggested_qty: suggested_qty || 0, arrival_date: ''}
      setOrderedKeys(prev => [...prev, key])
      setOrderedItems(prev => [...prev, newItem])
      api.post('/api/purchase-orders?sku=' + encodeURIComponent(sku) + '&store=' + encodeURIComponent(store) + '&product_name=' + encodeURIComponent(product_name || '') + '&suggested_qty=' + (suggested_qty || 0)).catch(() => loadOrdered())
    }
  }

  // 设置到B仓日期
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
    const mode = globalChannel === 'jd' ? replenMode : 'traditional'
    if (globalChannel !== 'jd' && replenMode === 'bbcc') setHammerReplenMode('traditional')
    loadReplen(mode, globalChannel)
    api.get('/api/insights/purchase?days=28&channel=' + globalChannel).then(r => {
      setPurchase(r.data?.suggestions || r.data || [])
      setPurchaseLoading(false)
    }).catch(() => setPurchaseLoading(false))
    api.get('/api/insights/slow-moving').then(r => {
      setSlowMoving(r.data || [])
      setSlowLoading(false)
    }).catch(() => setSlowLoading(false))
  }, [globalChannel, replenMode])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* 补货建议 */}
      {tab === 'replen' && (
        <div className="card">
          <div className="section-title" style={{display:'flex',flexWrap:'wrap',gap:6}}>
            <span>
              补货建议{replen.length > 0 && <span className="small muted" style={{ marginLeft: 8 }}></span>}
            </span>
          </div>
          {replenLoading ? (
            <div>
              <Skeleton height={14} width="30%" style={{ marginBottom: 8 }} />
              {[1,2,3,4,5].map(i => <Skeleton key={i} height={36} style={{ marginBottom: 4 }} />)}
            </div>
          ) : !Array.isArray(replen) || replen.length === 0 ? (
            <div className="muted" style={{ padding: 12, textAlign: 'center' }}>库存健康，暂无补货建议</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <div style={{fontSize:11,color:'var(--muted2)',marginBottom:4,display:'flex',gap:8,alignItems:'center'}}>
                <span>显示 {visCols.length}/{currentCols.length} 列 · 点击"列"按钮切换</span>
                {replenMode==='bbcc' && orderedKeys.length > 0 && <span className="pill success" style={{fontSize:10}}>已下单 {orderedKeys.length} 项</span>}
              </div>
              <table>
                <colgroup>{visCols.map(id => {const col = currentCols.find(c => c.id === id); return col ? <col key={col.id} /> : null})}</colgroup>
                <thead><tr>{visCols.map(id => {const col = currentCols.find(c => c.id === id); return col ? <th key={col.id} style={{whiteSpace:'nowrap',fontSize:11,padding:'8px 4px'}}>{col.label}</th> : null})}</tr></thead>
                <tbody>
                  {Array.isArray(replen) && replen.map((x, i) => {
                    const isOrdered = orderedKeys.includes(x.sku+'|'+x.store)
                    const rowStyle = isOrdered ? {opacity:0.55,background:'var(--bg)'} : {}
                    return (
                    <tr key={i} style={rowStyle}>
                      {visCols.map(id => {
                        const col = currentCols.find(c => c.id === id)
                        if (!col) return <td key={id}></td>
                        // 序号列
                        if (col.id === 'seq') return <td key={col.id} style={{fontSize:11,color:'var(--muted2)'}}>{i+1}</td>
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
                        if (col.id === 'c_turn') return <td key={col.id} style={{fontSize:11,fontWeight:600}}>{x.c_turnover != null ? x.c_turnover+'天' : '∞'}</td>
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
                          ? <span onClick={()=>toggleOrdered(x.sku, x.store, x.product_name, x.suggested_qty || x.b_suggested)} style={{cursor:'pointer',fontSize:16,color:'var(--success)',display:'inline-flex',alignItems:'center',gap:2}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle'}}><polyline points="4 12 10 18 20 6"/></svg><span style={{fontSize:9,color:'var(--muted2)'}}>撤销</span></span>
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
            </div>
          )}
          {/* 已下单明细（仅BBCC模式） */}
          {replenMode==='bbcc' && orderedItems.length > 0 && <details style={{marginTop:12}} open>
            <summary className="small muted" style={{cursor:'pointer',fontSize:12,fontWeight:600}}>📦 已下单 {orderedItems.length} 项 · 点击查看入库日期与仓储天数</summary>
            <div style={{fontSize:12,marginTop:8}}>
              {orderedItems.map((po, i) => {
                const daysSinceArrival = po.arrival_date ? Math.floor((new Date() - new Date(po.arrival_date)) / (1000*60*60*24)) : null
                const stayColor = daysSinceArrival != null ? (daysSinceArrival > 90 ? '#ef4444' : daysSinceArrival > 15 ? '#f59e0b' : 'var(--text)') : 'var(--muted)'
                return <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 10px',border:'1px solid var(--border)',borderRadius:32,marginBottom:4,flexWrap:'wrap',gap:4}}>
                  <span>{po.sku} {po.product_name} <span className="pill success" style={{fontSize:10}}>+{(po.actual_qty||po.suggested_qty)}</span></span>
                  <span style={{display:'flex',alignItems:'center',gap:6}}>
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
          <div className="section-title" style={{display:'flex',flexWrap:'wrap',gap:6}}>
            <span>采购建议</span>
          </div>
          {purchaseLoading ? (
            <div>
              {[1,2,3,4].map(i => <Skeleton key={i} height={36} style={{ marginBottom: 4 }} />)}
            </div>
          ) : (purchase.length === 0 ? (
            <div className="muted" style={{ padding: 12, textAlign: 'center' }}>暂无采购建议</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <div style={{fontSize:11,color:'var(--muted2)',marginBottom:4}}>显示 {purchaseVisCols.length}/{PURCHASE_COLS.length} 列 · 点击"列"按钮切换</div>
              <table>
                <colgroup>{purchaseVisCols.map(id => {const col = PURCHASE_COLS.find(c => c.id === id); return col ? <col key={col.id} /> : null})}</colgroup>
                <thead><tr>{purchaseVisCols.map(id => {const col = PURCHASE_COLS.find(c => c.id === id); return col ? <th key={col.id} style={{whiteSpace:'nowrap',fontSize:11,padding:'8px 4px'}}>{col.label}</th> : null})}</tr></thead>
                <tbody>
                  {purchase.map((x, i) => {
                    const timing = !x.purchase_qty || x.purchase_qty <= 0 ? '充足' : (x.after_turnover && (x.target_turnover || 15) > 0 && x.after_turnover <= (x.target_turnover || 15) ? '建议' : '充足')
                    return (
                    <tr key={i}>
                      {purchaseVisCols.map(id => {
                        const col = PURCHASE_COLS.find(c => c.id === id)
                        if (!col) return <td key={id}></td>
                        if (col.id === 'barcode') return <td key={col.id} className="mono" style={{fontSize:11,color:'var(--muted2)'}}>{x.barcode || '-'}</td>
                        if (col.id === 'sku') return <td key={col.id} className="mono" style={{fontSize:12}}>{x.sku}</td>
                        if (col.id === 'name') return <td key={col.id} className="col-name">{x.product_name}</td>
                        if (col.id === 'warehouse') return <td key={col.id} className="col-store">{x.warehouse || x.store || '-'}</td>
                        if (col.id === 'sys_total') return <td key={col.id} style={{fontSize:12}}>
                          <span style={{fontWeight:600}}>{x.sys_total}</span>
                          <span className="small muted" style={{fontWeight:400}}> 自有{x.own_available}+{x.own_transit ? `在途${x.own_transit}`:''} 平台{x.plat_available}+{x.plat_transit ? `在途${x.plat_transit}`:''} B仓{x.b_available||0}</span>
                        </td>
                        if (col.id === 'daily_sales') return <td key={col.id} style={{fontSize:12,fontWeight:600,whiteSpace:'nowrap'}}>{x.daily_sales}<span style={{fontSize:10,fontWeight:400,color:'var(--muted2)'}}> /{x.daily_sales_14||0}/{x.daily_sales_28||0}</span></td>
                        if (col.id === 'actual_purchase') return <td key={col.id} style={{fontWeight:700,color:x.actual_purchase > 0 ? 'var(--success)' : 'var(--muted2)'}}>{x.actual_purchase > 0 ? '+'+x.actual_purchase : (x.actual_purchase === 0 ? '0' : '-')}</td>
                        if (col.id === 'after_turnover') return <td key={col.id} style={{fontWeight:600,color: x.actual_purchase > 0 ? (x.target_turnover > 0 && x.after_turnover > x.target_turnover ? '#ef4444' : 'var(--text)') : 'var(--muted2)'}}>{x.actual_purchase > 0 ? x.after_turnover+'天' : '-'}</td>
                        if (col.id === 'note') return <td key={col.id} className="col-name" style={{color:'var(--muted2)',fontSize:12}}>{renderNote(x.note) || '无需采购'}</td>
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
                      <td style={{color:'var(--success)',fontSize:13}}>+{purchase.reduce((s,x)=>s+(x.actual_purchase||0),0)}</td>
                      {purchaseVisCols.includes('after_turnover') && purchaseVisCols.indexOf('after_turnover') > purchaseVisCols.indexOf('actual_purchase') && <td colSpan={purchaseVisCols.length - purchaseVisCols.indexOf('after_turnover') - 1} style={{fontSize:11,color:'var(--muted2)'}}>
                        {(() => {
                          const withPurchase = purchase.filter(x => x.purchase_qty > 0)
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
            </div>
          ))}
        </div>
      )}

      {/* 滞销预警 */}
      {tab === 'slow' && (
        <div className="card">
          <div className="section-title">滞销预警 <span className="small muted">· 超过 14 天未下单的商品</span></div>
          {slowLoading ? (
            <div>
              {[1,2,3].map(i => <Skeleton key={i} height={36} style={{ marginBottom: 4 }} />)}
            </div>
          ) : (slowMoving.length === 0 ? (
            <div className="muted" style={{ padding: 12, textAlign: 'center' }}>暂无数据</div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <div style={{fontSize:11,color:'var(--muted2)',marginBottom:4}}>显示 {slowVisCols.length}/{SLOW_COLS.length} 列 · 点击"列"按钮切换</div>
                <table>
                  <colgroup>{slowVisCols.map(id => {const col = SLOW_COLS.find(c => c.id === id); return col ? <col key={col.id} /> : null})}</colgroup>
                  <thead><tr>{slowVisCols.map(id => {const col = SLOW_COLS.find(c => c.id === id); return col ? <th key={col.id} style={{whiteSpace:'nowrap',fontSize:11,padding:'8px 4px'}}>{col.label}</th> : null})}</tr></thead>
                  <tbody>
                    {slowMoving.filter(x => x.level !== '正常').map((x, i) => (
                      <tr key={i}>
                        {slowVisCols.map(id => {
                          const col = SLOW_COLS.find(c => c.id === id)
                          if (!col) return <td key={id}></td>
                          if (col.id === 'barcode') return <td key={col.id} className="mono" style={{fontSize:11,color:'var(--muted2)'}}>{x.barcode || '-'}</td>
                          if (col.id === 'sku') return <td key={col.id} className="mono" style={{fontSize:12}}>{x.sku}</td>
                          if (col.id === 'name') return <td key={col.id}>{x.product_name}</td>
                          if (col.id === 'store') return <td key={col.id}>{x.store || x.warehouse || '-'}</td>
                          if (col.id === 'category') return <td key={col.id}>{x.category || '-'}</td>
                          if (col.id === 'last_order_date') return <td key={col.id} style={{fontSize:12,color:'var(--muted)'}}>{x.last_order_date}</td>
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
