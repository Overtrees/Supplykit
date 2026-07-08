import React, { useState, useMemo } from "react"
import { useAppStore } from '../store/useAppStore'
import Card from '../components/Card'
import Chart from '../components/Chart'

const periodLabel = { today:'今日', week:'本周', month:'本月' }

export default function DashboardPage({ onAlert }) {
  const [periodTab, setPeriodTab] = useState('month')
  const { dashboard, inventory, qualityLogs, alerts } = useAppStore()
  const periodTrend = dashboard?.periods?.[periodTab + '_trend'] || dashboard?.trend || []
  const periodMeta = dashboard?.periods?.[periodTab] || {}

  const periodTrendOption = useMemo(() => ({
    tooltip: { trigger: 'axis', valueFormatter: (v) => '¥' + Number(v).toLocaleString('zh-CN', {minimumFractionDigits:2,maximumFractionDigits:2}) },
    xAxis: { type: 'category', data: periodTrend.map(i => i['日期']) || [], axisLabel: { fontSize: 9 } },
    yAxis: [
      { type: 'value', axisLabel: { fontSize: 9, formatter: (v) => v >= 10000 ? (v/10000).toFixed(0) + 'W' : v }, max: (v) => Math.ceil(v.max * 1.2 / 1000) * 1000 },
      { type: 'value', axisLabel: { fontSize: 9 } }
    ],
    grid: { containLabel: true, top: 8, bottom: 42 },
    series: [
      { type: 'line', smooth: true, areaStyle: { opacity: 0.15 }, data: periodTrend.map(i => i['GMV']) || [], color: 'var(--primary)', name: 'GMV' },
      { type: 'bar', data: periodTrend.map(i => i['订单数']) || [], color: '#0f766e', yAxisIndex: 1, name: '订单数' }
    ],
    legend: { data: ['GMV', '订单数'], bottom: 6, left: 'center', icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { fontSize: 9 } }
  }), [periodTrend])

  const storeOption = useMemo(() => ({
    tooltip: { trigger: 'axis', valueFormatter: (v) => '¥' + Number(v).toLocaleString('zh-CN', {minimumFractionDigits:2,maximumFractionDigits:2}) },
    xAxis: { type: 'category', data: dashboard?.stores?.map(i => i.name) || [], axisLabel: { fontSize: 9 } },
    yAxis: { type: 'value', axisLabel: { fontSize: 9, formatter: (v) => v >= 10000 ? (v/10000).toFixed(0) + 'W' : v }, max: (v) => Math.ceil(v.max * 1.2 / 1000) * 1000 },
    series: [{ type: 'bar', data: dashboard?.stores?.map(i => Math.round(i.gmv * 100) / 100) || [], itemStyle: { color:'var(--success)' } }],
    grid: { containLabel: true, top: 8, bottom: 16 }
  }), [dashboard])

  const funnelOption = useMemo(() => {
    const f = dashboard?.funnel || []
    const names = f.map(x => x.name)
    const values = f.map(x => x.value)
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (p) => {
        const idx = p[0]?.dataIndex ?? 0; const item = f[idx]
        return `${item.name}<br/>数量: ${item.value}单<br/>占比: ${item.percentage}%<br/>转化率: ${item.conversion}%`
      }},
      grid: { containLabel: true, top: 4, bottom: 6 },
      xAxis: { type: 'value', show: false },
      yAxis: { type: 'category', data: names, axisLabel: { fontSize: 10 } },
      series: [{
        type: 'bar', data: values.map((v, i) => ({ value: v, itemStyle: { color: ['var(--primary)','#06b6d4','#0ea5e9','#14b8a6','#10b981'][i % 5], borderRadius: [0, 4, 4, 0] } })),
        barWidth: '60%',
        label: { show: true, position: 'right', fontSize: 10, formatter: (p) => `${p.value}单` }
      }]
    }
  }, [dashboard])

  const lowStock = (inventory||[]).filter(x => Number(x.available_qty) < Number(x.safety_qty)).length
  const errCount = (qualityLogs||[]).length
  const alertsList = (alerts || []).filter(x => x.status === 'active')

  return <div>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
      <div style={{ display:'flex', gap:4 }}>
        {['today','week','month'].map(k => (
          <button key={k} onClick={() => setPeriodTab(k)} className={`btn btn-ghost`} style={{fontSize:12,background:periodTab===k?'var(--primary)':'transparent',color:periodTab===k?'#fff':'',borderColor:periodTab===k?'transparent':''}}>{periodLabel[k]}</button>
        ))}
      </div>
      <div className="small muted">{periodMeta.date ? periodMeta.date : ''}</div>
    </div>

    <div className="card-grid" style={{marginBottom:16}}>
      <Card title={periodLabel[periodTab]+' GMV'} value={'¥'+Number(periodMeta.gmv||0).toLocaleString()} sub={periodMeta.orders+' 单'} />
      <Card title="库存健康度" 
  value={(dashboard?.health_index?.own?.score||0)+'分 / '+(dashboard?.health_index?.platform?.score||0)+'分'} 
  sub={'自有'+(dashboard?.health_index?.own?.healthy||0)+'健康·'+(dashboard?.health_index?.own?.warning||0)+'偏低  |  平台'+(dashboard?.health_index?.platform?.healthy||0)+'健康·'+(dashboard?.health_index?.platform?.warning||0)+'偏低'}
  badge={<span style={{display:'flex',gap:4,flexWrap:'wrap'}}>
    <span className={'pill '+(dashboard?.health_index?.own?.level==='danger'?'danger':dashboard?.health_index?.own?.level==='warning'?'warning':'success')} style={{textAlign:'center',fontSize:10}}>自有{dashboard?.health_index?.own?.level==='danger'?'危险':dashboard?.health_index?.own?.level==='warning'?'关注':'良好'}</span>
    <span className={'pill '+(dashboard?.health_index?.platform?.level==='danger'?'danger':dashboard?.health_index?.platform?.level==='warning'?'warning':'success')} style={{textAlign:'center',fontSize:10}}>平台{dashboard?.health_index?.platform?.level==='danger'?'危险':dashboard?.health_index?.platform?.level==='warning'?'关注':'良好'}</span>
  </span>} />
      <Card title="待处理" value={errCount+(dashboard?.summary?.active_alerts||0)} sub={errCount+' 异常 · '+(dashboard?.summary?.active_alerts||0)+' 告警'} badge={errCount>0 ? <span className="pill danger" style={{background:'#ef4444',color:'var(--card)'}}>需处理</span> : null} />
    </div>

    <div className="chart-row">
      <div className="card" style={{height:'auto',overflow:'visible'}}><div className="section-title">订单阶段转化</div><Chart option={funnelOption} height={200} /></div>
    </div>

    <div className="chart-row-3">
      <div className="card" style={{height:'auto',overflow:'visible'}}><div className="section-title">店铺 GMV</div><Chart option={storeOption} height={170} /></div>
      <div className="card" style={{height:'auto',overflow:'visible'}}><div className="section-title">低库存 & 补货告警</div>
        {alertsList.length === 0
          ? <div className="small muted" style={{ padding: 12, textAlign: 'center' }}>暂无告警</div>
          : alertsList.slice(0, 6).map(x => (
              <div key={x.id} onClick={() => onAlert && onAlert(x.related_sku)} style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13, cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 12 }}>{x.title}</span>
                  <span className={'pill '+(x.alert_type==='replenish'||x.severity==='error'?'danger':x.severity==='warning'?'warning':'info')}>{x.alert_type==='replenish'?'补货':(x.severity==='warning'?'警告':x.severity==='error'?'错误':x.severity)}</span>
                </div>
                <div className="small muted" style={{ fontSize: 11 }}>{x.description}</div>
              </div>
            ))}
        {alertsList.length > 6 && <div className="small muted" style={{ textAlign: 'center', padding: 6 }}>还有 {alertsList.length - 6} 条...</div>}
      </div>
    </div>
  </div>
}
