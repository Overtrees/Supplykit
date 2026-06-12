import React, { useEffect, useState, useMemo } from 'react'
import * as echarts from 'echarts'
import { api } from '../api/client'

function Chart({ option, height=200 }) {
  const ref = React.useRef(null)
  useEffect(() => {
    if (!ref.current || !window.echarts) return
    const existing = echarts.getInstanceByDom(ref.current)
    if (existing) existing.dispose()
    const chart = echarts.init(ref.current)
    chart.setOption(option)
    const rz = () => chart.resize()
    window.addEventListener('resize', rz)
    return () => { window.removeEventListener('resize', rz); chart.dispose() }
  }, [option])
  return <div ref={ref} style={{ width:'100%', height }} />
}

export default function TrendAnalysis() {
  const [data, setData] = useState(null)
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get('/api/insights/trend-analysis', { params: { days } })
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [days])

  const trendOption = useMemo(() => data ? {
    tooltip: { trigger: 'axis' },
    legend: { data: ['GMV', '订单数'], bottom: 0, left: 'center' },
    xAxis: { type: 'category', data: data.daily.map(i => i.date.slice(5)), axisLabel: { rotate: 45, fontSize: 10 } },
    yAxis: [{ type: 'value', name: 'GMV' }, { type: 'value', name: '订单' }],
    series: [
      { type: 'line', name: 'GMV', data: data.daily.map(i => i.gmv), color: '#1d4ed8', smooth: true },
      { type: 'bar', name: '订单数', data: data.daily.map(i => i.orders), color: '#0f766e', yAxisIndex: 1 },
    ],
    grid: { left: 50, right: 50, bottom: 50, top: 30 },
  } : {}, [data])

  const pieOption = useMemo(() => data ? {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    series: [{ type: 'pie', radius: ['30%', '60%'], data: data.categories, label: { fontSize: 11 } }],
  } : {}, [data])

  const invOption = useMemo(() => data ? {
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie', radius: ['40%', '70%'],
      data: [
        { name: '正常', value: data.inventory_health.normal, itemStyle: { color: '#059669' } },
        { name: '偏低', value: data.inventory_health.low, itemStyle: { color: '#d97706' } },
        { name: '缺货', value: data.inventory_health.out, itemStyle: { color: '#dc2626' } },
      ],
      label: { fontSize: 11 },
    }],
  } : {}, [data])

  if (loading) return <div className="card"><div className="muted" style={{ padding: 20, textAlign:'center' }}>加载中...</div></div>

  return (
    <div>
      {/* 时段切换 */}
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {[7, 30, 90].map(n => (
          <button key={n} onClick={() => setDays(n)} style={{
            fontSize:12, padding:'4px 14px', borderRadius:99, border:'1px solid', cursor:'pointer',
            background: days === n ? '#1d4ed8' : '#fff', color: days === n ? '#fff' : '#64748b',
            borderColor: days === n ? '#1d4ed8' : '#e2e8f0', fontWeight: days === n ? 600 : 400,
          }}>近{n}天</button>
        ))}
      </div>

      {/* 统计卡片 */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
        <div className="card">
          <div className="small muted">总 GMV</div>
          <div style={{ fontSize:24, fontWeight:700 }}>¥{Number(data?.total_gmv || 0).toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="small muted">总订单</div>
          <div style={{ fontSize:24, fontWeight:700 }}>{data?.total_orders || 0}</div>
        </div>
        <div className="card">
          <div className="small muted">库存正常率</div>
          <div style={{ fontSize:24, fontWeight:700 }}>
            {data ? Math.round(data.inventory_health.normal / Math.max(1, data.inventory_health.normal + data.inventory_health.low + data.inventory_health.out) * 100) : 0}%
          </div>
        </div>
        <div className="card">
          <div className="small muted">分类数</div>
          <div style={{ fontSize:24, fontWeight:700 }}>{data?.categories?.length || 0}</div>
        </div>
      </div>

      {/* 趋势图 */}
      <div className="card" style={{ marginBottom:16 }}>
        <div className="section-title">GMV·订单日趋势</div>
        <Chart option={trendOption} height={250} />
      </div>

      {/* 分布图 */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        <div className="card">
          <div className="section-title">商品分类分布</div>
          <Chart option={pieOption} height={220} />
        </div>
        <div className="card">
          <div className="section-title">库存健康度</div>
          <Chart option={invOption} height={220} />
        </div>
      </div>
    </div>
  )
}
