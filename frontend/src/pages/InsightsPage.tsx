import React, { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useToast } from '../components/Toast'

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
  const toast = useToast()
  const [tab, setTab] = useState('replen')
  const [replen, setReplen] = useState([])
  const [purchase, setPurchase] = useState([])
  const [activities, setActivities] = useState([])
  const [slowMoving, setSlowMoving] = useState([])

  // 各区块加载状态
  const [replenLoading, setReplenLoading] = useState(true)
  const [purchaseLoading, setPurchaseLoading] = useState(true)
  const [slowLoading, setSlowLoading] = useState(true)
  const [activityLoading, setActivityLoading] = useState(true)

  const [replenMode, setReplenMode] = useState(() => localStorage.getItem('c_replen_mode') || 'bbcc')

  const switchMode = (m) => { setReplenMode(m); localStorage.setItem('c_replen_mode', m); loadReplen(m) }
  const loadReplen = async (mode) => {
    setReplenLoading(true)
    try { const r = await api.get('/api/insights/replenishment?days=28&mode=' + (mode||replenMode)); setReplen(r.data || [])
    } catch(e) {}
    setReplenLoading(false)
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
    if (orderedKeys.includes(key)) {
      try { await api.delete('/api/purchase-orders?sku=' + encodeURIComponent(sku) + '&store=' + encodeURIComponent(store)) } catch(e) {}
    } else {
      try {
        await api.post('/api/purchase-orders?sku=' + encodeURIComponent(sku) + '&store=' + encodeURIComponent(store) + '&product_name=' + encodeURIComponent(product_name || '') + '&suggested_qty=' + (suggested_qty || 0))
      } catch(e) {}
    }
    await loadOrdered()
  }

  // 设置到B仓日期
  const setArrivalDate = async (item, date) => {
    try { await api.put('/api/purchase-orders/' + item.id, {arrival_date: date}) } catch(e) {}
    await loadOrdered()
  }

  const todayStr = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    loadOrdered()
    // 补货建议独立加载
    loadReplen(replenMode)
    // 其余数据同时加载
    api.get('/api/insights/purchase?days=28&mode=' + replenMode).then(r => {
      setPurchase(r.data?.suggestions || r.data || [])
      setPurchaseLoading(false)
    }).catch(() => setPurchaseLoading(false))
    api.get('/api/events').then(r => {
      setActivities((r.data || []).slice(0, 15))
      setActivityLoading(false)
    }).catch(() => setActivityLoading(false))
    api.get('/api/insights/slow-moving').then(r => {
      setSlowMoving(r.data || [])
      setSlowLoading(false)
    }).catch(() => setSlowLoading(false))
      if (eventsR.status === 'fulfilled') setActivities((eventsR.value.data || []).slice(0, 15))
      setActivityLoading(false)
      if (slowR.status === 'fulfilled') setSlowMoving(slowR.value.data || [])
      setSlowLoading(false)
      setInitLoading(false)
    }).catch(() => setInitLoading(false))
  }, [])

  const tabs = [
    { id: 'replen', label: '补货建议', count: replen.length },
    { id: 'purchase', label: '采购建议', count: purchase.length },
    { id: 'slow', label: '滞销预警', count: slowMoving.filter(x => x.level !== '正常').length },
    { id: 'activity', label: '操作回溯', count: activities.length },
  ]

  const btnStyle = id => ({
    flex: 1, padding: '10px 12px', fontSize: 13, fontWeight: 500,
    border: 'none', borderRadius: 10,
    background: tab === id ? 'var(--primary)' : 'transparent',
    color: tab === id ? '#fff' : 'var(--muted)', cursor: 'pointer',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, flexWrap:'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`btn btn-ghost`} style={{fontSize:12,background:tab===t.id?'var(--primary)':'transparent',color:tab===t.id?'#fff':''}}>
            {t.label}{t.count > 0 ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {/* 补货建议 */}
      {tab === 'replen' && (
        <div className="card">
          <div className="section-title" style={{display:'flex',flexWrap:'wrap',gap:6}}>
            <span>
              补货建议{replen.length > 0 && <span className="small muted" style={{ marginLeft: 8 }}>· 低于安全线的商品</span>}
              <span style={{marginLeft:12,display:'inline-flex',flexWrap:'wrap',gap:4}}>
                <span onClick={()=>switchMode('bbcc')} className="btn btn-ghost" style={{fontSize:11,padding:'2px 10px',background:replenMode==='bbcc'?'var(--primary)':'transparent',color:replenMode==='bbcc'?'#fff':''}}>BBCC</span>
                <span onClick={()=>switchMode('traditional')} className="btn btn-ghost" style={{fontSize:11,padding:'2px 10px',background:replenMode==='traditional'?'var(--primary)':'transparent',color:replenMode==='traditional'?'#fff':''}}>传统</span>
                <button onClick={async()=>{
                  try {
                    const r = await fetch(API+'/api/insights/export-purchase?days=28&mode=bbcc')
                    const blob = await r.blob()
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url; a.download = '补货建议_'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'.xlsx'
                    document.body.appendChild(a); a.click(); a.remove()
                    URL.revokeObjectURL(url)
                  } catch(e) { toast.error('导出失败: '+e.message) }
                }}
                  className="btn btn-ghost" style={{fontSize:11,padding:'2px 10px'}}>导出</button>
              </span>
            </span>
          </div>
          {replenLoading ? (
            <div>
              <Skeleton height={14} width="30%" style={{ marginBottom: 8 }} />
              {[1,2,3,4,5].map(i => <Skeleton key={i} height={36} style={{ marginBottom: 4 }} />)}
            </div>
          ) : (replen.filter(x => !orderedKeys.includes(x.sku+'|'+x.store)).length === 0 ? (
            <div className="muted" style={{ padding: 12, textAlign: 'center' }}>库存健康，暂无补货建议</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <div style={{fontSize:11,color:'var(--muted2)',marginBottom:4}}>共 {replenMode==='bbcc'?14:12} 列 · 左右滑动查看</div>
              <table>
                <thead><tr>{['','SKU','商品','仓库',...(replenMode==='bbcc'?['B仓可用库存','B仓周转','全国C仓总和可用库存',`B-C仓调拨在途`, `全国C仓日销(融合/7/14/28)`]:['现有','在途',`日销(融合/7/14/28)`]),...(replenMode==='bbcc'?['全国C仓总和周转','B→C 调拨在途总和周转']:['安全线','在库周转','补后周转']),...(replenMode==='bbcc'?['C仓建议补','B仓需补','当前综转','补后综转']:['建议补','实际补']),'备注',...(replenMode==='bbcc'?['标记操作（用于B仓入库批次统计）']:[])].map(h => <th key={h} style={{whiteSpace:'nowrap',fontSize:11,padding:'8px 4px'}}>{h}</th>)}</tr></thead>
                <tbody>
                  {replen.filter(x => !orderedKeys.includes(x.sku+'|'+x.store)).map((x, i) => (
                    <tr key={i}>
                      <td style={{fontSize:11,color:'var(--muted2)'}}>{i+1}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{x.sku}</td>
                      <td>{x.product_name}</td><td className="col-store">{replenMode==='bbcc' ? 'B仓' : (x.warehouse || x.store || '-')}</td>
                      {replenMode==='bbcc' ?<>
                      <td style={{color:'var(--primary)',fontWeight:600}}>{x.b_stock ?? '-'}</td>
                      <td style={{fontSize:11,fontWeight:600,color:x.b_stock > 0 && (x.b_stock/x.daily_sales) > 15 ? '#ef4444' : x.b_stock > 0 && (x.b_stock/x.daily_sales) > 10 ? 'var(--warning)' : 'var(--text)'}}>{x.b_stock > 0 ? (x.b_stock/x.daily_sales).toFixed(1)+'天' : '-'}</td>
                      <td style={{fontWeight:600}}>{x.c_stock ?? x.available_qty}</td>
                      </> : <td style={{fontWeight:600}}>{x.available_qty}</td>}
                      <td>{x.in_transit_qty}</td>
                      <td style={{fontSize:11,fontWeight:600,whiteSpace:'nowrap'}}>{x.daily_sales}<span style={{fontSize:10,fontWeight:400,color:'var(--muted2)'}}>
                        /{(x.daily_sales_7||0) > (x.daily_sales_14||0)*1.15?'📈':(x.daily_sales_7||0) < (x.daily_sales_14||0)*0.85?'📉':'➡️'}{x.daily_sales_7||0}
                        /{(x.daily_sales_14||0) > (x.daily_sales_28||0)*1.15?'📈':(x.daily_sales_14||0) < (x.daily_sales_28||0)*0.85?'📉':'➡️'}{x.daily_sales_14||0}
                        /{x.daily_sales_28||0}</span></td>
                      {replenMode==='bbcc' ? <>
                      <td style={{fontSize:11,fontWeight:600}}>{x.c_turnover != null ? x.c_turnover+'天' : '∞'}</td>
                      <td style={{fontSize:11}}>{x.transit_turnover != null ? x.transit_turnover+'天' : '∞'}</td>
                      </> : <>
                      <td>{x.safety_qty}</td>
                      <td style={{color: x.days_to_empty < 5 ? '#ef4444' : x.days_to_empty < 10 ? 'var(--warning)' : 'var(--text)'}}>{x.days_to_empty > 999 ? '∞' : x.days_to_empty}</td>
                      </>}
                      {replenMode==='bbcc'
                        ? <><td style={{color:'var(--primary)',fontWeight:600}}>{x.suggested_qty > 0 ? x.suggested_qty : '-'}</td>
                          <td style={{color:'var(--success)',fontWeight:700}}>{x.b_suggested > 0 ? x.b_suggested : '-'}</td>
                          <td style={{fontSize:11}}>{x.combined_turnover_current != null ? x.combined_turnover_current+'天' : '∞'}</td>
                          <td style={{fontSize:11,fontWeight:700,color:x.combined_turnover != null && x.combined_turnover > 90 ? '#ef4444' : x.combined_turnover != null && x.combined_turnover > 15 ? 'var(--warning)' : 'var(--text)'}}>{(x.suggested_qty > 0 || x.b_suggested > 0) && x.combined_turnover != null ? x.combined_turnover+'天' : '-'}</td></>
                        : <><td style={{color:'var(--primary)',fontWeight:600}}>{x.raw_suggested || x.suggested_qty}</td>
                          <td style={{color:'var(--success)',fontWeight:700}}>{x.suggested_qty > 0 ? x.suggested_qty : '-'}</td></>}
                      {replenMode!=='bbcc' && <td style={{fontWeight:600,color:x.suggested_qty > 0 && (x.after_turnover||0) > 15 ? '#ef4444' : 'var(--text)'}}>{x.suggested_qty > 0 ? x.after_turnover+'天' : '-'}</td>}
                      <td className="col-name" style={{color:'var(--muted2)',fontSize:12}}>{x.note || '-'}</td>
                      {replenMode==='bbcc' && <td><span onClick={()=>{
                        if ((x.suggested_qty > 0 || x.b_suggested > 0) && x.combined_turnover > 90 && !window.confirm(`补后综合周转${x.combined_turnover}天，已超90天考核红线，仍标记操作？`)) return
                        toggleOrdered(x.sku, x.store, x.product_name, x.suggested_qty || x.b_suggested)
                      }} style={{cursor:'pointer',fontSize:18,opacity:0.5}}>☐</span></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {/* 已下单区域（仅BBCC模式） */}
          {replenMode==='bbcc' && orderedKeys.length > 0 && <details style={{marginTop:12}}>
            <summary className="small muted" style={{cursor:'pointer',fontSize:12}}>已下单 {orderedKeys.length} 项</summary>
            <div style={{fontSize:12,marginTop:8}}>
              {orderedItems.map((po, i) => {
                const daysSinceArrival = po.arrival_date ? Math.floor((new Date() - new Date(po.arrival_date)) / (1000*60*60*24)) : null
                const stayColor = daysSinceArrival != null ? (daysSinceArrival > 90 ? '#ef4444' : daysSinceArrival > 15 ? '#f59e0b' : 'var(--text)') : 'var(--muted)'
                return <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 10px',border:'1px solid #f1f5f9',borderRadius:6,marginBottom:4,flexWrap:'wrap',gap:4}}>
                  <span>{po.sku} {po.product_name} <span className="pill success" style={{fontSize:10}}>+{(po.actual_qty||po.suggested_qty)}</span></span>
                  <span style={{display:'flex',alignItems:'center',gap:6}}>
                    <span className="small" style={{color:stayColor,fontWeight:600}}>
                      {daysSinceArrival != null ? daysSinceArrival + '天' : '待入仓'}
                    </span>
                    <input type="date" value={po.arrival_date || ''}
                      onChange={e => setArrivalDate(po, e.target.value)}
                      style={{fontSize:11,padding:'2px 6px',border:'1px solid #e2e8f0',borderRadius:4,width:130}} />
                    <span onClick={()=>toggleOrdered(po.sku, po.store)} style={{cursor:'pointer',fontSize:14,color:'var(--danger)',opacity:0.6}}>↩</span>
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
          <div className="section-title">采购建议 <span className="small muted">· 含供应商匹配</span></div>
          {purchaseLoading ? (
            <div>
              {[1,2,3,4].map(i => <Skeleton key={i} height={36} style={{ marginBottom: 4 }} />)}
            </div>
          ) : (purchase.length === 0 ? (
            <div className="muted" style={{ padding: 12, textAlign: 'center' }}>暂无采购建议</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <div style={{fontSize:11,color:'var(--muted2)',marginBottom:4}}>共 9 列 · 左右滑动查看</div>
              <table>
                <thead><tr>{['SKU','商品','仓库','系统总库存','日销(融合/14/28)','建议采购','补后周转','备注','采购时机'].map(h => <th key={h} style={{whiteSpace:'nowrap',fontSize:11}}>{h}</th>)}</tr></thead>
                <tbody>
                  {purchase.map((x, i) => {
                    const timing = !x.purchase_qty || x.purchase_qty <= 0 ? '充足' : (x.after_turnover && (x.target_turnover || 15) > 0 && x.after_turnover <= (x.target_turnover || 15) ? '建议' : '充足')
                    return (
                    <tr key={i}>
                      <td className="mono" style={{ fontSize: 12 }}>{x.sku}</td>
                      <td className="col-name">{x.product_name}</td>
                      <td className="col-store">{x.warehouse || x.store || '-'}</td>
                      <td style={{fontSize:12}}>
                        <span style={{fontWeight:600}}>{x.sys_total}</span>
                        <span className="small muted" style={{fontWeight:400}}> 自有{x.own_available}+{x.own_transit ? `在途${x.own_transit}`:''} 平台{x.plat_available}+{x.plat_transit ? `在途${x.plat_transit}`:''} B仓{x.b_available||0}</span>
                      </td>
                      <td style={{fontSize:12,fontWeight:600,whiteSpace:'nowrap'}}>{x.daily_sales}<span style={{fontSize:10,fontWeight:400,color:'var(--muted2)'}}> /{x.daily_sales_14||0}/{x.daily_sales_28||0}</span></td>
                      <td style={{fontWeight:700,color:x.actual_purchase > 0 ? 'var(--success)' : 'var(--muted2)'}}>{x.actual_purchase > 0 ? '+'+x.actual_purchase : (x.actual_purchase === 0 ? '0' : '-')}</td>
                      <td style={{fontWeight:600,color: x.actual_purchase > 0 ? (x.target_turnover > 0 && x.after_turnover > x.target_turnover ? '#ef4444' : 'var(--text)') : 'var(--muted2)'}}>{x.actual_purchase > 0 ? x.after_turnover+'天' : '-'}</td>
                      <td className="col-name" style={{color:'var(--muted2)',fontSize:12}}>{x.note || '无需采购'}</td>
                      <td><span className={`pill ${timing==='建议'?'warning':'info'}`}>{timing}</span></td>
                    </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{fontWeight:700,borderTop:'2px solid var(--border)'}}>
                    <td colSpan={5} style={{textAlign:'right',fontSize:12}}>合计</td>
                    <td style={{color:'var(--success)',fontSize:13}}>+{purchase.reduce((s,x)=>s+(x.actual_purchase||0),0)}</td>
                    <td colSpan={3} style={{fontSize:11,color:'var(--muted2)'}}>
                      {(() => {
                        const withPurchase = purchase.filter(x => x.purchase_qty > 0)
                        const avgTurnover = withPurchase.length > 0
                          ? (withPurchase.reduce((s,x)=>s+(x.after_turnover||0),0) / withPurchase.length).toFixed(1)
                          : ''
                        return avgTurnover ? '平均周转 ' + avgTurnover + ' 天' : '平均周转 —'
                      })()}
                    </td>
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
                <div style={{fontSize:11,color:'var(--muted2)',marginBottom:4}}>共 8 列 · 左右滑动查看</div>
                <table>
                  <thead><tr>{['SKU','商品','店铺','分类','最近下单','天数','库存','状态'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {slowMoving.filter(x => x.level !== '正常').map((x, i) => (
                      <tr key={i}>
                        <td className="mono" style={{ fontSize: 12 }}>{x.sku}</td>
                        <td>{x.product_name}</td><td>{x.store}</td><td>{x.category}</td>
                        <td style={{ fontSize: 12, color: 'var(--muted)' }}>{x.last_order_date}</td>
                        <td style={{ fontWeight: 600, color: x.days_since_last_order >= 90 ? '#ef4444' : x.days_since_last_order >= 30 ? 'var(--warning)' : 'var(--muted)' }}>{x.days_since_last_order}天</td>
                        <td>{x.available_qty}</td>
                        <td><span className={`pill ${x.level === '滞销' ? 'danger' : x.level === '冷淡' ? 'warning' : 'info'}`}>{x.level}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {slowMoving.filter(x => x.level === '正常').length > 0 && (
                <div className="small muted" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                  另有 {slowMoving.filter(x => x.level === '正常').length} 个商品最近 14 天内有过订单（正常销售中）
                </div>
              )}
            </>
          ))}
        </div>
      )}

      {/* 操作回溯 */}
      {tab === 'activity' && (
        <div className="card">
          <div className="section-title">操作回溯 <span className="small muted">· 最近操作记录</span></div>
          {activityLoading ? (
            <div>
              {[1,2,3,4,5].map(i => <Skeleton key={i} height={32} style={{ marginBottom: 4 }} />)}
            </div>
          ) : (activities.length === 0 ? (
            <div className="muted" style={{ padding: 12, textAlign: 'center' }}>暂无操作记录</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {activities.map((x, i) => (
                <div key={i} style={{
                  fontSize: 12, padding: '8px 12px', background: 'var(--bg)',
                  border: '1px solid #f1f5f9', borderRadius: 8,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <span>
                    <span className={`pill ${x.level === 'error' ? 'danger' : x.level === 'warning' ? 'warning' : 'info'}`} style={{ fontSize: 10, marginRight: 8 }}>
                      {x.event_type}
                    </span>
                    {x.title}
                  </span>
                  <span className="small muted">{(x.created_at || '').slice(0, 16).replace('T', ' ')}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
