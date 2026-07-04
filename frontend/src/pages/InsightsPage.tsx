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

export default function InsightsPage() {
  const toast = useToast()
  const [tab, setTab] = useState('replen')
  const [replen, setReplen] = useState([])
  const [replenDays, setReplenDays] = useState(28)
  const [purchase, setPurchase] = useState([])
  const [summary, setSummary] = useState(null)
  const [activities, setActivities] = useState([])
  const [slowMoving, setSlowMoving] = useState([])
  const [loading, setLoading] = useState(true)
  const [replenMode, setReplenMode] = useState(() => localStorage.getItem('c_replen_mode') || 'bbcc')

  const switchMode = (m) => { setReplenMode(m); localStorage.setItem('c_replen_mode', m) }
  const loadReplen = async (days) => {
    try { const r = await api.get('/api/insights/replenishment?days=' + (days||replenDays) + '&mode=' + replenMode); setReplen(r.data || []) } catch(e) {}
  }

  // "已下单"标记 — localStorage 持久化
  const [ordered, setOrdered] = useState(() => {
    try { return JSON.parse(localStorage.getItem('c_ordered') || '[]') } catch { return [] }
  })
  const toggleOrdered = (sku, store) => {
    const key = sku + '|' + store
    const next = ordered.includes(key) ? ordered.filter(k => k !== key) : [...ordered, key]
    setOrdered(next)
    localStorage.setItem('c_ordered', JSON.stringify(next))
  }

  useEffect(() => {
    Promise.all([
      loadReplen(replenDays),
      api.get('/api/insights/purchase'),
      api.get('/api/insights/summary'),
      api.get('/api/events'),
      api.get('/api/insights/slow-moving'),
    ]).then(([, p, s, ev, sm]) => {
      setPurchase(p.data?.suggestions || p.data || [])
      setSummary(s.data)
      setActivities((ev.data || []).slice(0, 15))
      setSlowMoving(sm.data || [])
    }).catch(() => {}).finally(() => setLoading(false))
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

  if (loading) return <div className="card"><div className="muted">加载中...</div></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Summary cards */}
      {summary && (
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
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`btn btn-ghost`} style={{fontSize:12,background:tab===t.id?'var(--primary)':'transparent',color:tab===t.id?'#fff':''}}>
            {t.label}{t.count > 0 ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {/* 补货建议 */}
      {tab === 'replen' && (
        <div className="card">
          <div className="section-title" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span>
              补货建议{replen.length > 0 && <span className="small muted" style={{ marginLeft: 8 }}>· 低于安全线的商品</span>}
              <span style={{marginLeft:12,display:'inline-flex',gap:4}}>
                <span onClick={()=>switchMode('bbcc')} className="btn btn-ghost" style={{fontSize:11,padding:'2px 10px',background:replenMode==='bbcc'?'var(--primary)':'transparent',color:replenMode==='bbcc'?'#fff':''}}>BBCC</span>
                <span onClick={()=>switchMode('traditional')} className="btn btn-ghost" style={{fontSize:11,padding:'2px 10px',background:replenMode==='traditional'?'var(--primary)':'transparent',color:replenMode==='traditional'?'#fff':''}}>传统</span>
                {[7,14,28].map(d => (
                  <span key={d} onClick={()=>{setReplenDays(d);loadReplen(d)}}
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
          {replen.filter(x => !ordered.includes(x.sku+'|'+x.store)).length === 0 ? (
            <div className="muted" style={{ padding: 12, textAlign: 'center' }}>库存健康，暂无补货建议</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <div style={{fontSize:11,color:'var(--muted2)',marginBottom:4}}>共 15 列 · 左右滑动查看</div>
              <table>
                <thead><tr>{['','SKU','商品','店铺','现有','安全线','在途','日销7','日销14','日销28','可撑(天)','建议补','安全(天)','紧急度','已下单'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {replen.filter(x => !ordered.includes(x.sku+'|'+x.store)).map((x, i) => (
                    <tr key={i}>
                      <td style={{fontSize:11,color:'var(--muted2)'}}>{i+1}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{x.sku}</td>
                      <td>{x.product_name}</td><td>{x.store}</td>
                      <td style={{ color: x.available_qty === 0 ? '#ef4444' : 'var(--text)', fontWeight: 600 }}>{x.available_qty}</td>
                      <td>{x.safety_qty}</td><td>{x.in_transit_qty}</td>
                      <td style={{fontSize:11}}>{x.daily_sales_7}</td>
                      <td style={{fontSize:11}}>{x.daily_sales_14}</td>
                      <td style={{fontSize:11,fontWeight:replenDays===28?600:400}}>{x.daily_sales_28}</td>
                      <td style={{color: x.days_to_empty < 5 ? '#ef4444' : x.days_to_empty < 10 ? 'var(--warning)' : 'var(--text)'}}>{x.days_to_empty > 999 ? '∞' : x.days_to_empty}</td>
                      <td style={{ fontWeight: 600, color: 'var(--success)' }}>+{x.suggested_qty}</td>
                      <td style={{fontSize:11}}>{x.safety_days || '-'}</td>
                      <td><span className={`pill ${x.urgency === '紧急' ? 'danger' : x.urgency === '仓储费风险' ? 'warning' : x.urgency === '建议' ? 'info' : 'info'}`}>{x.urgency}</span></td>
                      <td><span onClick={()=>toggleOrdered(x.sku, x.store)} style={{cursor:'pointer',fontSize:18,opacity:0.5}}>☐</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
          {purchase.length === 0 ? (
            <div className="muted" style={{ padding: 12, textAlign: 'center' }}>暂无采购建议</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <div style={{fontSize:11,color:'var(--muted2)',marginBottom:4}}>共 6 列 · 左右滑动查看</div>
              <table>
                <thead><tr>{['SKU','商品','建议补量','推荐供应商','评分','紧急度'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {purchase.map((x, i) => (
                    <tr key={i}>
                      <td className="mono" style={{ fontSize: 12 }}>{x.sku}</td>
                      <td>{x.product_name}</td>
                      <td style={{ fontWeight: 600, color: 'var(--success)' }}>+{x.suggested_qty}</td>
                      <td>{x.supplier_name || '-'}</td>
                      <td><span className={`pill ${x.supplier_score >= 80 ? 'success' : x.supplier_score >= 60 ? 'warning' : 'danger'}`}>{x.supplier_score}</span></td>
                      <td><span className={`pill ${x.urgency === '紧急' ? 'danger' : x.urgency === '关注' ? 'warning' : 'info'}`}>{x.urgency}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 滞销预警 */}
      {tab === 'slow' && (
        <div className="card">
          <div className="section-title">滞销预警 <span className="small muted">· 超过 14 天未下单的商品</span></div>
          {slowMoving.length === 0 ? (
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
          )}
        </div>
      )}

      {/* 操作回溯 */}
      {tab === 'activity' && (
        <div className="card">
          <div className="section-title">操作回溯 <span className="small muted">· 最近操作记录</span></div>
          {activities.length === 0 ? (
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
          )}
        </div>
      )}
    </div>
  )
}
