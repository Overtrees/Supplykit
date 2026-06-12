import React, { useEffect, useMemo, useState } from 'react'
import * as echarts from 'echarts'
import { useAppStore } from './store/useAppStore'
import { api } from './api/client'
import ProductPage from './pages/ProductPage'
import SupplierPage from './pages/SupplierPage'
import InsightsPage from './pages/InsightsPage'
import CleansingPage from './pages/CleansingPage'
import TrendAnalysis from './pages/TrendAnalysis'
import AnomalyTracking from './pages/AnomalyTracking'

// ─── 导航配置 ────────────────────────────────────────────────────────────────

const NAV = [
  { id:'dash',     label:'总览',   icon:'📊' },
  { id:'products', label:'商品',   icon:'🏷️' },
  { id:'suppliers',label:'供应商', icon:'🏭' },
  { id:'orders',   label:'订单',   icon:'📋' },
  { id:'inv',      label:'库存',   icon:'📦' },
  { id:'insights', label:'建议',   icon:'💡' },
  { id:'cleansing',label:'清洗',   icon:'🧹' },
  { id:'analytics', label:'趋势',   icon:'📈' },
  { id:'anomalies', label:'异常',   icon:'⚠️' },
  { id:'import',   label:'导入数据',icon:'📤' },
]

// ─── 小组件 ──────────────────────────────────────────────────────────────────

function Card({ title, value, sub, badge }) {
  return (
    <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:16, padding:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', gap:8 }}>
        <div style={{ fontSize:12, color:'#94a3b8', marginBottom:6 }}>{title}</div>
        {badge || null}
      </div>
      <div style={{ fontSize:28, fontWeight:700, color:'#0f172a' }}>{value}</div>
      {sub ? <div style={{ fontSize:12, color:'#94a3b8', marginTop:4 }}>{sub}</div> : null}
    </div>
  )
}

function Chart({ option, height=260 }) {
  const ref = React.useRef(null)
  useEffect(() => {
    if (!ref.current || !window.echarts) return
    const existing = echarts.getInstanceByDom(ref.current)
    if (existing) existing.dispose()
    const chart = echarts.init(ref.current)
    chart.setOption(option)
    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); chart.dispose() }
  }, [option])
  return <div ref={ref} style={{ width:'100%', height }} />
}

function UploadPanel() {
  const [busy, setBusy] = useState('')
  const { importLogs, loadAll, addImportLog } = useAppStore()

  const submit = async (type, file) => {
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    setBusy(type)
    try {
      const url = type === 'orders' ? '/api/orders/import' : '/api/inventory/import'
      const res = await api.post(url, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      addImportLog({ type: type === 'orders' ? 'orders.imported' : 'inventory.imported', payload: res.data, file: file.name })
      await loadAll()
    } finally { setBusy('') }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <label style={{ background:'#fff', border:'1px dashed #cbd5e1', borderRadius:16, padding:20, cursor:'pointer', textAlign:'center', transition:'border 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.borderColor='#1d4ed8'} onMouseLeave={e => e.currentTarget.style.borderColor='#cbd5e1'}>
          <div style={{ fontSize:18, marginBottom:6, opacity:0.4 }}>📄</div>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>导入订单</div>
          <div style={{ fontSize:12, color:'#64748b' }}>{busy === 'orders' ? '上传中...' : 'CSV / XLSX · 中文列名自动映射'}</div>
          <input type="file" accept=".csv,.xlsx" style={{ display:'none' }} onChange={e => submit('orders', e.target.files?.[0])} />
        </label>
        <label style={{ background:'#fff', border:'1px dashed #cbd5e1', borderRadius:16, padding:20, cursor:'pointer', textAlign:'center', transition:'border 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.borderColor='#1d4ed8'} onMouseLeave={e => e.currentTarget.style.borderColor='#cbd5e1'}>
          <div style={{ fontSize:18, marginBottom:6, opacity:0.4 }}>📦</div>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>导入库存</div>
          <div style={{ fontSize:12, color:'#64748b' }}>{busy === 'inventory' ? '上传中...' : '导入后自动重建低库存告警'}</div>
          <input type="file" accept=".csv,.xlsx" style={{ display:'none' }} onChange={e => submit('inventory', e.target.files?.[0])} />
        </label>
      </div>
      <div style={{ background:'#fff', borderRadius:16, border:'1px solid #f1f5f9', padding:16 }}>
        <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', color:'#94a3b8', marginBottom:12 }}>导入日志</div>
        {importLogs.length === 0 ? (
          <div style={{ color:'#94a3b8', fontSize:13, textAlign:'center' }}>暂无导入记录</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {importLogs.map((x, idx) => (
              <div key={idx} style={{ fontSize:12, background:'#f8fafc', border:'1px solid #f1f5f9', borderRadius:10, padding:'8px 12px' }}>
                <div style={{ fontWeight:600, marginBottom:2 }}>{x.type || 'manual.import'}</div>
                <div style={{ color:'#64748b', fontSize:11 }}>{JSON.stringify(x.payload || x)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 侧边栏 ──────────────────────────────────────────────────────────────────

function Sidebar({ open, onClose, page, onNavigate, lowStock, errCount }) {
  return (
    <>
      {/* 遮罩 */}
      <div onClick={onClose} style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', zIndex:999,
        opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
        transition:'opacity 0.25s ease',
      }} />
      {/* 侧边栏 */}
      <div style={{
        position:'fixed', top:0, left:0, bottom:0, width:280,
        background:'#1e293b', color:'#fff', zIndex:1000,
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition:'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
        display:'flex', flexDirection:'column', overflow:'hidden',
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.08)', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'#3b82f6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700 }}>供</div>
            <span style={{ fontWeight:700, fontSize:16, letterSpacing:'-0.02em' }}>SupplyChain</span>
          </div>
          <button onClick={onClose} style={{
            width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center',
            borderRadius:8, cursor:'pointer', border:'none',
            background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.6)',
            fontSize:16, transition:'all 0.15s',
          }}>✕</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'12px 8px' }}>
          {NAV.map(item => {
            const active = page === item.id
            return (
              <div key={item.id} onClick={() => { onNavigate(item.id); onClose() }} style={{
                display:'flex', alignItems:'center', gap:12, padding:'12px 16px', margin:'2px 4px',
                borderRadius:10, cursor:'pointer', fontSize:14, transition:'all 0.12s',
                color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                background: active ? 'rgba(59,130,246,0.2)' : 'transparent',
                fontWeight: active ? 600 : 400,
              }}>
                <span style={{ fontSize:18, width:24, textAlign:'center', flexShrink:0 }}>{item.icon}</span>
                <span>{item.label}</span>
                {item.id === 'quality' && errCount > 0 && (
                  <span style={{ marginLeft:'auto', background:'#ef4444', color:'#fff', fontSize:10, borderRadius:99, padding:'1px 7px', minWidth:18, textAlign:'center' }}>{errCount}</span>
                )}
                {item.id === 'inv' && lowStock > 0 && (
                  <span style={{ marginLeft:'auto', background:'#f59e0b', color:'#fff', fontSize:10, borderRadius:99, padding:'1px 7px', minWidth:18, textAlign:'center' }}>{lowStock}</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ─── 主应用 ──────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState('dash')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [periodTab, setPeriodTab] = useState('month')
  const { dashboard, orders, orderTotal, orderPage, inventory, qualityLogs, alerts, startPolling, stopAll, setOrderPage, wsStatus } = useAppStore()
  const [loadingOrders, setLoadingOrders] = useState(false)

  useEffect(() => { startPolling(); return () => stopAll() }, [])

  const periodLabel = { today:'今日', week:'本周', month:'本月' }
  const periodTrend = dashboard?.periods?.[periodTab + '_trend'] || dashboard?.trend || []
  const periodMeta = dashboard?.periods?.[periodTab] || {}

  const trendOption = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: dashboard?.trend?.map(i => i['日期']) || [] },
    yAxis: { type: 'value' },
    series: [{ type: 'line', smooth: true, areaStyle: {}, data: dashboard?.trend?.map(i => i['GMV']) || [], color:'#1d4ed8' }],
    grid: { left: 40, right: 20, top: 30, bottom: 30 }
  }), [dashboard])

  const storeOption = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: dashboard?.stores?.map(i => i.name) || [] },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: dashboard?.stores?.map(i => i.gmv) || [], itemStyle: { color:'#0f766e' } }],
    grid: { left: 40, right: 20, top: 30, bottom: 30 }
  }), [dashboard])

  const periodTrendOption = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: periodTrend.map(i => i['日期']) || [] },
    yAxis: { type: 'value' },
    grid: { left: 40, right: 20, top: 30, bottom: 30 },
    series: [
      { type: 'line', smooth: true, areaStyle: { opacity: 0.15 }, data: periodTrend.map(i => i['GMV']) || [], color: '#1d4ed8', name: 'GMV' },
      { type: 'bar', data: periodTrend.map(i => i['订单数']) || [], color: '#0f766e', yAxisIndex: 1, name: '订单数' }
    ],
    legend: { data: ['GMV', '订单数'], bottom: 0, left: 'center', icon: 'circle', itemWidth: 8 }
  }), [periodTrend])

  const funnelOption = useMemo(() => {
    const f = dashboard?.funnel || []
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      series: [{
        type: 'funnel', left: '10%', top: 20, bottom: 40, width: '80%',
        minSize: '20%', maxSize: '100%', sort: 'descending', gap: 4,
        label: { show: true, fontSize: 11, formatter: '{b}\n{c}单\n转化率{d}%' },
        itemStyle: { borderColor: '#fff', borderWidth: 1 },
        data: f.map((x, i) => ({ ...x, value: x.value, itemStyle: { color: ['#3b82f6','#06b6d4','#0ea5e9','#14b8a6','#10b981'][i % 5] } }))
      }]
    }
  }, [dashboard])

  const lowStock = (inventory||[]).filter(x => Number(x.available_qty) < Number(x.safety_qty)).length
  const errCount = (qualityLogs||[]).length
  const alertsList = alerts || []

  const currentLabel = NAV.find(i => i.id === page)?.label || '总览'

  return (
    <>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} page={page} onNavigate={setPage} lowStock={lowStock} errCount={errCount} />

      <div style={{ minHeight:'100vh', background:'#f8fafc', fontFamily:'system-ui, sans-serif', color:'#0f172a' }}>
        {/* Header */}
        <div style={{
          background:'linear-gradient(135deg,#0f172a,#1d4ed8)', color:'#fff',
          padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center',
          position:'relative', zIndex:1,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <button onClick={() => setSidebarOpen(true)} style={{
              width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center',
              borderRadius:8, cursor:'pointer', border:'none',
              background:'rgba(255,255,255,0.12)', color:'#fff', fontSize:18,
              transition:'all 0.15s', flexShrink:0,
            }}>☰</button>
            <div>
              <div style={{ fontSize:20, fontWeight:800, lineHeight:1.3 }}>SupplyChain V1</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.6)' }}>React + ECharts · FastAPI · Polling</div>
            </div>
          </div>
          <div style={{ fontSize:12, color: wsStatus === 'connected' ? '#86efac' : wsStatus === 'polling' ? '#fcd34d' : '#f87171' }}>
            {wsStatus === 'connected' ? '🟢 实时' : wsStatus === 'polling' ? '🟡 轮询' : '🔴 断开'}
          </div>
        </div>

        {/* 内容 */}
        <div style={{ maxWidth:1200, margin:'0 auto', padding:20 }}>
          {page === 'dash' && (
            <>
              {/* 时段切换条 */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <div style={{ display:'flex', gap:4 }}>
                  {['today','week','month'].map(k => (
                    <button key={k} onClick={() => setPeriodTab(k)} style={{
                      fontSize:12, padding:'4px 14px', borderRadius:99, border:'1px solid', cursor:'pointer',
                      background: periodTab === k ? '#1d4ed8' : '#fff',
                      color: periodTab === k ? '#fff' : '#64748b',
                      borderColor: periodTab === k ? '#1d4ed8' : '#e2e8f0',
                      fontWeight: periodTab === k ? 600 : 400
                    }}>{periodLabel[k]}</button>
                  ))}
                </div>
                <div className="small muted">{periodMeta.date ? `截至 ${periodMeta.date}` : ''}</div>
              </div>
              {/* KPI 卡片 */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
                <Card title={`${periodLabel[periodTab]} GMV`}
                  value={`¥${Number(periodMeta.gmv || 0).toLocaleString()}`}
                  sub={`${periodMeta.orders || 0} 单 / 总额 ¥${Number(dashboard?.summary?.gmv || 0).toLocaleString()}`} />
                <Card title="待发货" value={dashboard?.summary?.pending_count || 0}
                  badge={dashboard?.summary?.pending_count > 3 ? <span className="pill danger">积压</span> : null} />
                <Card title="库存健康度" value={`${dashboard?.health_index?.score || 0}分`}
                  sub={`${dashboard?.health_index?.healthy || 0}健康 / ${dashboard?.health_index?.warning || 0}偏低 / ${dashboard?.health_index?.out_of_stock || 0}缺货`}
                  badge={<span className={`pill ${dashboard?.health_index?.level === 'danger' ? 'danger' : dashboard?.health_index?.level === 'warning' ? 'warning' : 'success'}`}>
                    {dashboard?.health_index?.level === 'danger' ? '危险' : dashboard?.health_index?.level === 'warning' ? '关注' : '良好'}</span>} />
                <Card title={errCount > 0 || dashboard?.summary?.active_alerts > 0 ? '⚠️ 待处理异常' : '待处理异常'}
                  value={(errCount + (dashboard?.summary?.active_alerts || 0)).toString()}
                  sub={`${dashboard?.summary?.active_alerts || 0} 告警 · ${errCount || 0} 数据异常`}
                  badge={errCount > 0 || dashboard?.summary?.active_alerts > 0 ? <span className="pill danger" style={{ background:'#ef4444', color:'#fff' }}>需处理</span> : null} />
              </div>
              {/* 图表行：趋势 + 漏斗 */}
              <div style={{ display:'grid', gridTemplateColumns:'1.3fr 1fr', gap:16, marginBottom:16 }}>
                <div className="card"><div className="section-title">{periodLabel[periodTab]} GMV·订单趋势</div>
                  <Chart option={periodTrendOption} height={200} /></div>
                <div className="card"><div className="section-title">订单漏斗 下单→完成</div>
                  <Chart option={funnelOption} height={200} /></div>
              </div>
              {/* 分布 + 告警 */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:16 }}>
                <div className="card"><div className="section-title">店铺 GMV</div>
                  <Chart option={storeOption} height={170} /></div>
                <div className="card"><div className="section-title">商品分类分布</div>
                  {dashboard?.category_distribution
                    ? <Chart option={{ tooltip: { trigger: 'item' }, series: [{ type: 'pie', radius: ['40%', '70%'], data: dashboard.category_distribution, label: { fontSize: 11 } }] }} height={170} />
                    : <div className="small muted">暂无数据</div>}
                </div>
                <div className="card"><div className="section-title">低库存 & 补货告警</div>
                  {alertsList.length === 0
                    ? <div className="small muted" style={{ padding: 12, textAlign: 'center' }}>暂无告警</div>
                    : alertsList.slice(0, 6).map(x => (
                        <div key={x.id} style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ fontWeight: 600, fontSize: 12 }}>{x.title}</span>
                            <span className={`pill ${x.alert_type === 'replenish' || x.severity === 'error' ? 'danger' : x.severity === 'warning' ? 'warning' : 'info'}`}>
                              {x.alert_type === 'replenish' ? '补货' : x.severity}</span>
                          </div>
                          <div className="small muted" style={{ fontSize: 11 }}>{x.description}</div>
                        </div>
                      ))}
                  {alertsList.length > 6 && <div className="small muted" style={{ textAlign: 'center', padding: 6 }}>还有 {alertsList.length - 6} 条...</div>}
                </div>
              </div>
            </>
          )}

          {page === 'products' && <ProductPage />}
          {page === 'suppliers' && <SupplierPage />}

          {page === 'orders' && (
            <div className="card">
              <div className="section-title" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span>订单 <span className="small muted">共 {orderTotal} 条</span></span>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <button onClick={() => { setLoadingOrders(true); setOrderPage(Math.max(1, orderPage - 1)); setTimeout(() => setLoadingOrders(false), 500) }} disabled={orderPage <= 1}
                    style={{ fontSize:11, padding:'4px 10px', border:'1px solid #e2e8f0', borderRadius:6, background: orderPage <= 1 ? '#f1f5f9' : '#fff', cursor: orderPage <= 1 ? 'not-allowed' : 'pointer' }}>{loadingOrders ? '⏳' : '‹ 上一页'}</button>
                  <span className="small muted" style={{ fontSize:12 }}>{orderPage}</span>
                  <button onClick={() => { setLoadingOrders(true); setOrderPage(orderPage + 1); setTimeout(() => setLoadingOrders(false), 500) }}
                    style={{ fontSize:11, padding:'4px 10px', border:'1px solid #e2e8f0', borderRadius:6, background:'#fff', cursor:'pointer' }}>{loadingOrders ? '⏳' : '下一页 ›'}</button>
                </div>
              </div>
              <div style={{ overflowX:'auto' }}>
                <table>
                  <thead><tr>{['订单号','店铺','仓库','商品','金额','状态','日期'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {orders.map(x => <tr key={x.id}>
                      <td className="mono" style={{ fontSize:12 }}>{x.order_no}</td>
                      <td>{x.store || '-'}</td>
                      <td>{x.warehouse || '-'}</td>
                      <td>{x.product_name}</td>
                      <td>¥{Number(x.total_amount).toLocaleString()}</td>
                      <td>{x.order_status}</td>
                      <td>{x.ordered_at}</td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {page === 'inv' && (
            <div className="card">
              <div className="section-title">库存</div>
              <div style={{ overflowX:'auto' }}>
                <table>
                  <thead><tr>{['店铺','仓库','SKU','商品','可用','锁定','在途','安全线'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {inventory.map(x => <tr key={x.id}>
                      <td>{x.store || '-'}</td>
                      <td>{x.warehouse || '-'}</td>
                      <td className="mono" style={{ fontSize:12 }}>{x.sku}</td>
                      <td>{x.product_name}</td>
                      <td>{x.available_qty}</td>
                      <td>{x.locked_qty}</td>
                      <td>{x.in_transit_qty}</td>
                      <td>{x.safety_qty}</td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {page === 'import' && <UploadPanel />}
          {page === 'insights' && <InsightsPage />}
          {page === 'analytics' && <TrendAnalysis />}
          {page === 'anomalies' && <AnomalyTracking />}
          {page === 'cleansing' && <CleansingPage />}

          {page === 'quality' && (
            <div className="card">
              <div className="section-title">数据质量日志</div>
              {qualityLogs.length === 0
                ? <div className="small muted">暂无异常</div>
                : <div style={{ overflowX:'auto' }}>
                    <table>
                      <thead><tr>{['类型','字段','消息','级别','时间'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                      <tbody>
                        {qualityLogs.map(x => <tr key={x.id}>
                          <td>{x.issue_type}</td>
                          <td>{x.field_name || '-'}</td>
                          <td>{x.issue_message}</td>
                          <td><span className={`pill ${x.severity === 'error' ? 'danger' : x.severity === 'warning' ? 'warning' : 'info'}`}>{x.severity}</span></td>
                          <td className="small mono">{x.created_at || '-'}</td>
                        </tr>)}
                      </tbody>
                    </table>
                  </div>}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
