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

function LoadingSkeleton() {
  return <div className="card">
    <Skeleton height={20} width="40%" />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginTop: 12 }}>
      {[1,2,3,4,5].map(i => <div key={i} className="card" style={{ padding: 12 }}><Skeleton height={14} /><Skeleton height={24} width="60%" /></div>)}
    </div>
    <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
      {[1,2,3,4].map(i => <Skeleton key={i} height={32} width={80} />)}
    </div>
    <Skeleton height={200} style={{ marginTop: 12 }} />
  </div>
}

export default function InsightsPage() {
  const toast = useToast()
  const [tab, setTab] = useState('replen')
  const [replen, setReplen] = useState([])
  const [replenDays, setReplenDays] = useState(28)
  const [purchase, setPurchase] = useState([])
  const [summary, setSummary] = useState(null)
  const [activities, setActivities] = useState([])
  const [slowMoving, setSlowMoving] = useState([])
  const [ordered, setOrdered] = useState([])

  // 各区块加载状态
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [replenLoading, setReplenLoading] = useState(true)
  const [purchaseLoading, setPurchaseLoading] = useState(true)
  const [slowLoading, setSlowLoading] = useState(true)
  const [activityLoading, setActivityLoading] = useState(true)
  const [initLoading, setInitLoading] = useState(true)

  const [replenMode, setReplenMode] = useState(() => localStorage.getItem('c_replen_mode') || 'bbcc')

  const switchMode = (m) => { setReplenMode(m); localStorage.setItem('c_replen_mode', m); loadReplen(replenDays, m) }
  const loadReplen = async (days, mode) => {
    setReplenLoading(true)
    try { const r = await api.get('/api/insights/replenishment?days=' + (days||replenDays) + '&mode=' + (mode||replenMode)); setReplen(r.data || []) } catch(e) {}
    setReplenLoading(false)
  }

  // 从后端加载已下单标记
  const loadOrdered = async () => {
    try {
      const r = await api.get('/api/purchase-orders')
      const items = r.data || []
      setOrdered(items.map(x => x.sku + '|' + x.store))
    } catch(e) {
      // 后端不可用时 fallback 到 localStorage
      try { const fallback = JSON.parse(localStorage.getItem('c_ordered') || '[]'); setOrdered(fallback) } catch { setOrdered([]) }
    }
  }

  const toggleOrdered = async (sku, store, product_name, suggested_qty) => {
    const key = sku + '|' + store
    if (ordered.includes(key)) {
      // 取消标记
      setOrdered(prev => prev.filter(k => k !== key))
      try { await api.delete('/api/purchase-orders?sku=' + encodeURIComponent(sku) + '&store=' + encodeURIComponent(store)) } catch(e) {}
    } else {
      // 标记已下单
      setOrdered(prev => [...prev, key])
      try {
        await api.post('/api/purchase-orders?sku=' + encodeURIComponent(sku) + '&store=' + encodeURIComponent(store) + '&product_name=' + encodeURIComponent(product_name || '') + '&suggested_qty=' + (suggested_qty || 0))
      } catch(e) {}
    }
  }

  useEffect(() => {
    setInitLoading(true)
    loadOrdered()
    // 补货建议独立加载（自带 loading 管理）
    loadReplen(replenDays, replenMode)
    // 其余 4 组数据同时加载
    const otherPromises = [
      api.get('/api/insights/purchase?days=' + replenDays + '&mode=' + replenMode),
      api.get('/api/insights/summary'),
      api.get('/api/events'),
      api.get('/api/insights/slow-moving'),
    ]
    Promise.allSettled(otherPromises).then(([purchaseR, summaryR, eventsR, slowR]) => {
      if (purchaseR.status === 'fulfilled') setPurchase(purchaseR.value.data?.suggestions || purchaseR.value.data || [])
      setPurchaseLoading(false)
      if (summaryR.status === 'fulfilled') setSummary(summaryR.value.data)
      setSummaryLoading(false)
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

  if (initLoading) return <LoadingSkeleton />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Summary cards */}
      {summaryLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
          {[1,2,3,4,5].map(i => <div key={i} className="card" style={{ padding: 12, textAlign: 'center' }}>
            <Skeleton height={14} width="60%" style={{ margin: '0 auto' }} />
            <Skeleton height={24} width="40%" style={{ margin: '6px auto 0' }} />
          </div>)}
        </div>
      ) : (summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
          {[
            { label: '库存商品', value: summary.total_products },
            { label: '低库存', value: summary.low_stock, color: 'var(--warning)' },
            { label: '紧急补货', value: summary.urgent_replenish, color: summary.urgent_replenish > 0 ? '#ef4444' : 'var(--success)' },
            { label: '滞销', value: summary.slow_moving, color: summary.slow_moving > 0 ? '#ef4444' : 'var(--success)' },
            { label: '冷淡', value: summary.cold_count, color: summary.cold_count > 0 ? 'var(--warning)' : 'var(--muted2)' },
          ].map((c, i) => (
            <div key={i} className="card" style={{ textAlign: 'center', containerType:'inline-size' }}>
              <div className="small muted">{c.label}</div>
              <div className="card-value" style={{ color: c.color || 'var(--text)' }}>{c.value ?? 0}</div>
            </div>
          ))}
        </div>
      ))}

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
                {[7,14,28].map(d => (
                  <span key={d} onClick={()=>{setReplenDays(d);loadReplen(d, replenMode)}}
                    className="btn btn-ghost" style={{fontSize:11,padding:'2px 10px',
                      background:replenDays===d?'var(--primary)':'transparent',
                      color:replenDays===d?'#fff':'var(--muted)',fontWeight:replenDays===d?600:400}}>{d}天</span>
                ))}
                <button onClick={async()=>{
                  try {
                    const r = await fetch(API+'/api/insights/export-purchase?days='+replenDays+'&mode=bbcc')
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
          ) : (replen.filter(x => !ordered.includes(x.sku+'|'+x.store)).length === 0 ? (
            <div className="muted" style={{ padding: 12, textAlign: 'center' }}>库存健康，暂无补货建议</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <div style={{fontSize:11,color:'var(--muted2)',marginBottom:4}}>共 13 列 · 左右滑动查看</div>
              <table>
                <thead><tr>{['','SKU','商品','店铺','现有','安全线','在途','日销28','可撑(天)','建议补','实际补','补后周转','备注',''].map(h => <th key={h} style={{whiteSpace:'nowrap',fontSize:11,padding:'8px 4px'}}>{h}</th>)}</tr></thead>
                <tbody>
                  {replen.filter(x => !ordered.includes(x.sku+'|'+x.store)).map((x, i) => (
                    <tr key={i}>
                      <td style={{fontSize:11,color:'var(--muted2)'}}>{i+1}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{x.sku}</td>
                      <td>{x.product_name}</td><td>{x.store}</td>
                      <td style={{ color: x.available_qty === 0 ? '#ef4444' : 'var(--text)', fontWeight: 600 }}>{x.available_qty}</td>
                      <td>{x.safety_qty}</td><td>{x.in_transit_qty}</td>
                      <td style={{fontSize:11,fontWeight:600}}>{x.daily_sales}</td>
                      <td style={{color: x.days_to_empty < 5 ? '#ef4444' : x.days_to_empty < 10 ? 'var(--warning)' : 'var(--text)'}}>{x.days_to_empty > 999 ? '∞' : x.days_to_empty}</td>
                      <td style={{color:'var(--primary)',fontWeight:600}}>{x.raw_suggested || x.suggested_qty}</td>
                      <td style={{color:'var(--success)',fontWeight:700}}>{x.suggested_qty > 0 ? x.suggested_qty : '-'}</td>
                      <td style={{color: (x.after_turnover||0) > 15 ? '#ef4444' : 'var(--text)',fontWeight:600}}>{x.after_turnover ? x.after_turnover+'天' : '-'}</td>
                      <td className="col-name" style={{color:'var(--muted2)',fontSize:12}}>{x.note || '-'}</td>
                      <td><span onClick={()=>toggleOrdered(x.sku, x.store, x.product_name, x.suggested_qty)} style={{cursor:'pointer',fontSize:18,opacity:0.5}}>☐</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {/* 已下单区域 */}
          {ordered.length > 0 && <details style={{marginTop:12}}>
            <summary className="small muted" style={{cursor:'pointer',fontSize:12}}>已下单 {ordered.length} 项</summary>
            <div style={{fontSize:12,marginTop:8}}>
              {replen.filter(x => ordered.includes(x.sku+'|'+x.store)).map((x,i) => (
                <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'4px 8px',border:'1px solid #f1f5f9',borderRadius:6,marginBottom:4}}>
                  <span>{x.sku} {x.product_name} <span className="pill success" style={{fontSize:10}}>+{x.suggested_qty}</span></span>
                  <span onClick={()=>toggleOrdered(x.sku, x.store)} style={{cursor:'pointer',fontSize:14}}>↩ 撤销</span>
                </div>
              ))}
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
                <thead><tr>{['SKU','商品','系统库存','日销','再订货点','离订货','建议采购','补后周转','备注','时机'].map(h => <th key={h} style={{whiteSpace:'nowrap',fontSize:11}}>{h}</th>)}</tr></thead>
                <tbody>
                  {purchase.map((x, i) => {
                    const timing = !x.purchase_qty || x.purchase_qty <= 0 ? '充足' : x.days_to_empty <= x.days_to_reorder ? '紧急' : '建议'
                    return (
                    <tr key={i}>
                      <td className="mono" style={{ fontSize: 12 }}>{x.sku}</td>
                      <td className="col-name">{x.product_name}</td>
                      <td style={{fontSize:12}}>
                        <span style={{fontWeight:600}}>{x.sys_total}</span>
                        <span className="small muted" style={{fontWeight:400}}> 自有{x.own_available}+{x.own_transit ? `在途${x.own_transit}`:''} 平台{x.plat_available}+{x.plat_transit ? `在途${x.plat_transit}`:''}</span>
                      </td>
                      <td style={{fontSize:12,fontWeight:600}}>{x.daily_sales}</td>
                      <td style={{fontSize:12}}>{x.reorder_point}</td>
                      <td style={{fontSize:12,color: x.days_to_reorder <= 0 ? '#ef4444' : x.days_to_reorder < 7 ? 'var(--warning)' : 'var(--muted)'}}>{x.days_to_reorder > 999 ? '∞' : x.days_to_reorder+'天'}</td>
                      <td style={{ fontWeight: 600, color: x.purchase_qty > 0 ? 'var(--success)' : 'var(--muted2)' }}>{x.purchase_qty > 0 ? '+'+x.purchase_qty : x.purchase_qty}</td>
                      <td style={{color: x.days_to_empty < 3 ? '#ef4444' : x.days_to_empty < 7 ? 'var(--warning)' : 'var(--text)'}}>{x.days_to_empty > 999 ? '∞' : x.days_to_empty}</td>
                      <td style={{fontSize:11,color:'var(--muted2)',maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={x.note||''}>{x.note || '-'}</td>
                      <td><span className={`pill ${timing==='紧急'?'danger':timing==='建议'?'warning':'info'}`}>{timing}</span></td>
                    </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{fontWeight:700,borderTop:'2px solid var(--border)'}}>
                    <td colSpan={7} style={{textAlign:'right',fontSize:12}}>合计</td>
                    <td style={{color:'var(--success)',fontSize:13}}>+{purchase.reduce((s,x)=>s+(x.purchase_qty||0),0)}</td>
                    <td colSpan={2} style={{fontSize:11,color:'var(--muted2)'}}>
                      {(() => {
                        const totalQty = purchase.reduce((s,x)=>s+(x.purchase_qty||0),0)
                        const totalAvail = purchase.reduce((s,x)=>s+(x.sys_available||0),0)
                        const totalSales = purchase.reduce((s,x)=>s+((x.daily_sales||0)*(x.purchase_qty>0?1:0)),0)
                        const overallTurnover = totalSales > 0 ? ((totalAvail+totalQty)/totalSales).toFixed(1) : ''
                        let footer = '总计采购 ' + totalQty + ' 件'
                        if (overallTurnover) footer += ' · 补后整体周转约 ' + overallTurnover + ' 天'
                        return footer
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
