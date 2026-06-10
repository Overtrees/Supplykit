import React, { useEffect, useMemo, useState } from 'react'
import * as echarts from 'echarts'
import { useAppStore } from './store/useAppStore'
import { api } from './api/client'

function Card({ title, value, sub }) {
  return (
    <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:16, padding:16 }}>
      <div style={{ fontSize:12, color:'#94a3b8', marginBottom:6 }}>{title}</div>
      <div style={{ fontSize:28, fontWeight:700, color:'#0f172a' }}>{value}</div>
      {sub ? <div style={{ fontSize:12, color:'#94a3b8', marginTop:4 }}>{sub}</div> : null}
    </div>
  )
}

function Chart({ option, height=260 }) {
  const ref = React.useRef(null)
  useEffect(() => {
    if (!ref.current) return
    const chart = echarts.init(ref.current)
    chart.setOption(option)
    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      chart.dispose()
    }
  }, [option])
  return <div ref={ref} style={{ width:'100%', height }} />
}

function UploadPanel() {
  const [busy, setBusy] = useState('')
  const { importLogs, loadAll } = useAppStore()

  const submit = async (type, file) => {
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    setBusy(type)
    try {
      const url = type === 'orders' ? '/api/orders/import' : '/api/inventory/import'
      await api.post(url, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      await loadAll()
    } finally {
      setBusy('')
    }
  }

  return (
    <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:16, padding:16 }}>
      <div style={{ fontWeight:600, marginBottom:12 }}>导入与轮询刷新</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
        <label style={{ border:'1px dashed #cbd5e1', borderRadius:12, padding:16, cursor:'pointer' }}>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>导入订单 CSV / XLSX</div>
          <div style={{ fontSize:12, color:'#64748b' }}>{busy === 'orders' ? '上传中...' : '支持中文列名与英文字段名'}</div>
          <input type="file" accept=".csv,.xlsx" style={{ display:'none' }} onChange={(e) => submit('orders', e.target.files?.[0])} />
        </label>
        <label style={{ border:'1px dashed #cbd5e1', borderRadius:12, padding:16, cursor:'pointer' }}>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>导入库存 CSV / XLSX</div>
          <div style={{ fontSize:12, color:'#64748b' }}>{busy === 'inventory' ? '上传中...' : '导入后会自动重建低库存告警'}</div>
          <input type="file" accept=".csv,.xlsx" style={{ display:'none' }} onChange={(e) => submit('inventory', e.target.files?.[0])} />
        </label>
      </div>
      <div>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>最近导入日志</div>
        {importLogs.length === 0 ? <div style={{ fontSize:12, color:'#94a3b8' }}>暂无日志</div> : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {importLogs.map((x, idx) => (
              <div key={idx} style={{ fontSize:12, background:'#f8fafc', border:'1px solid #e5e7eb', borderRadius:10, padding:'8px 10px' }}>
                <div style={{ fontWeight:600 }}>{x.type || 'manual.import'}</div>
                <div style={{ color:'#64748b' }}>{JSON.stringify(x.payload || x)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function App() {
  const { dashboard, orders, inventory, qualityLogs, loadAll, startPolling, stopPolling, wsStatus } = useAppStore()
  useEffect(() => {
    loadAll()
    startPolling()
    return () => stopPolling()
  }, [])

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

  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', fontFamily:'system-ui, sans-serif', color:'#0f172a' }}>
      <div style={{ background:'#fff', borderBottom:'1px solid #e5e7eb', padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700 }}>SupplyChain V1</div>
          <div style={{ fontSize:12, color:'#64748b' }}>React + ECharts + Zustand / FastAPI + PostgreSQL Ready / Polling</div>
        </div>
        <div style={{ fontSize:12, color:'#1d4ed8' }}>Refresh: {wsStatus}</div>
      </div>

      <div style={{ maxWidth:1200, margin:'0 auto', padding:20 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
          <Card title="已完成 GMV" value={`¥${Number(dashboard?.summary?.gmv || 0).toLocaleString()}`} />
          <Card title="待发货" value={dashboard?.summary?.pending_count || 0} />
          <Card title="退款申请" value={dashboard?.summary?.refund_count || 0} />
          <Card title="低库存 SKU" value={dashboard?.summary?.low_stock_count || 0} />
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1.3fr 1fr', gap:16, marginBottom:16 }}>
          <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:16, padding:16 }}>
            <div style={{ fontWeight:600, marginBottom:8 }}>GMV 每日趋势</div>
            <Chart option={trendOption} />
          </div>
          <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:16, padding:16 }}>
            <div style={{ fontWeight:600, marginBottom:8 }}>店铺 GMV</div>
            <Chart option={storeOption} />
          </div>
        </div>

        <div style={{ marginBottom:16 }}>
          <UploadPanel />
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
          <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:16, padding:16 }}>
            <div style={{ fontWeight:600, marginBottom:12 }}>订单</div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>{['订单号','店铺','商品','金额','状态','日期'].map(h => <th key={h} style={{ textAlign:'left', fontSize:12, color:'#64748b', borderBottom:'1px solid #e5e7eb', padding:'8px 0' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {orders.map(x => <tr key={x.id}><td style={{ padding:'8px 0', fontFamily:'monospace', fontSize:12 }}>{x.order_no}</td><td>{x.store}</td><td>{x.product_name}</td><td>¥{Number(x.total_amount).toLocaleString()}</td><td>{x.order_status}</td><td>{x.ordered_at}</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:16, padding:16 }}>
            <div style={{ fontWeight:600, marginBottom:12 }}>库存</div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>{['店铺','SKU','商品','可用','锁定','在途','安全线'].map(h => <th key={h} style={{ textAlign:'left', fontSize:12, color:'#64748b', borderBottom:'1px solid #e5e7eb', padding:'8px 0' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {inventory.map(x => <tr key={x.id}><td style={{ padding:'8px 0' }}>{x.store}</td><td style={{ fontFamily:'monospace', fontSize:12 }}>{x.sku}</td><td>{x.product_name}</td><td>{x.available_qty}</td><td>{x.locked_qty}</td><td>{x.in_transit_qty}</td><td>{x.safety_qty}</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:16, padding:16 }}>
          <div style={{ fontWeight:600, marginBottom:12 }}>数据质量日志</div>
          {qualityLogs.length === 0 ? <div style={{ color:'#94a3b8', fontSize:14 }}>暂无异常</div> : (
            <ul>
              {qualityLogs.map(x => <li key={x.id}>{x.issue_type} - {x.issue_message}</li>)}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
