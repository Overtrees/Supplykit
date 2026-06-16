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
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: periodTrend.map(i => i['日期']) || [], axisLabel: { fontSize: 10 } },
    yAxis: [
      { type: 'value', axisLabel: { fontSize: 10 } },
      { type: 'value', axisLabel: { fontSize: 10 } }
    ],
    grid: { left: 36, right: 4, top: 12, bottom: 40 },
    series: [
      { type: 'line', smooth: true, areaStyle: { opacity: 0.15 }, data: periodTrend.map(i => i['GMV']) || [], color: '#1d4ed8', name: 'GMV' },
      { type: 'bar', data: periodTrend.map(i => i['订单数']) || [], color: '#0f766e', yAxisIndex: 1, name: '订单数' }
    ],
    legend: { data: ['GMV', '订单数'], bottom: 4, left: 'center', icon: 'circle', itemWidth: 8, itemHeight: 8, textStyle: { fontSize: 10 } }
  }), [periodTrend])

  const storeOption = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: dashboard?.stores?.map(i => i.name) || [], axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
    series: [{ type: 'bar', data: dashboard?.stores?.map(i => i.gmv) || [], itemStyle: { color:'#0f766e' } }],
    grid: { left: 36, right: 8, top: 16, bottom: 20 }
  }), [dashboard])

  const funnelOption = useMemo(() => {
    const f = dashboard?.funnel || []
    return {
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      grid: { top: 10, bottom: 10 },
      series: [{
        type: 'funnel', left: '5%', top: 20, bottom: 8, width: '90%',
        minSize: '15%', maxSize: '100%', sort: 'descending', gap: 2,
        label: { show: true, fontSize: 10, position: 'inside', formatter: (p) => `${p.name}\n${p.value}单` },
        itemStyle: { borderColor: '#fff', borderWidth: 1 },
        data: f.map((x,i) => ({ ...x, value: x.value, itemStyle: { color: ['#3b82f6','#06b6d4','#0ea5e9','#14b8a6','#10b981'][i % 5] } }))
      }]
    }
  }, [dashboard])

  const lowStock = (inventory||[]).filter(x => Number(x.available_qty) < Number(x.safety_qty)).length
  const errCount = (qualityLogs||[]).length
  const alertsList = alerts || []

  return <div>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
      <div style={{ display:'flex', gap:4 }}>
        {['today','week','month'].map(k => (
          <button key={k} onClick={() => setPeriodTab(k)} style={{ fontSize:12, padding:'4px 14px', borderRadius:99, border:'1px solid', cursor:'pointer', background: periodTab === k ? 'var(--primary)' : '#fff', color: periodTab === k ? '#fff' : 'var(--muted)', borderColor: periodTab === k ? 'var(--primary)' : 'var(--border)', fontWeight: periodTab === k ? 600 : 400 }}>{periodLabel[k]}</button>
        ))}
      </div>
      <div className="small muted">{periodMeta.date ? periodMeta.date : ''}</div>
    </div>

    <div className="card-grid" style={{marginBottom:16}}>
      <Card title={periodLabel[periodTab]+' GMV'} value={'¥'+Number(periodMeta.gmv||0).toLocaleString()} sub={periodMeta.orders+' 单'} />
      <Card title="待发货" value={dashboard?.summary?.pending_count||0} badge={dashboard?.summary?.pending_count>3?<span className="pill danger">积压</span>:null} />
      <Card title="库存健康度" value={(dashboard?.health_index?.score||0)+'分'} sub={dashboard?.health_index?.healthy+'健康 / '+dashboard?.health_index?.warning+'偏低'} badge={<span className={'pill '+(dashboard?.health_index?.level==='danger'?'danger':dashboard?.health_index?.level==='warning'?'warning':'success')}>{dashboard?.health_index?.level==='danger'?'危险':dashboard?.health_index?.level==='warning'?'关注':'良好'}</span>} />
      <Card title="待处理" value={errCount+(dashboard?.summary?.active_alerts||0)} sub={errCount+' 异常 · '+(dashboard?.summary?.active_alerts||0)+' 告警'} badge={errCount>0 ? <span className="pill danger" style={{background:'#ef4444',color:'#fff'}}>需处理</span> : null} />
    </div>

    <div className="chart-row">
      <div className="card"><div className="section-title">{periodLabel[periodTab]} GMV·订单趋势</div>
        {periodTrend.length === 0 ? <div className="small muted" style={{ padding: '40px 0', textAlign: 'center' }}>暂无{periodLabel[periodTab]}数据</div> : <Chart option={periodTrendOption} height={200} />}
      </div>
      <div className="card"><div className="section-title">订单漏斗 下单→完成</div><Chart option={funnelOption} height={200} /></div>
    </div>

    <div className="chart-row-3">
      <div className="card"><div className="section-title">店铺 GMV</div><Chart option={storeOption} height={170} /></div>
      <div className="card"><div className="section-title">商品分类分布</div>
        {dashboard?.category_distribution
          ? <Chart option={{ tooltip: { trigger: 'item' }, series: [{ type: 'pie', radius: ['40%', '70%'], data: dashboard.category_distribution, label: { fontSize: 11 } }] }} height={170} />
          : <div className="small muted">暂无数据</div>}
      </div>
      <div className="card"><div className="section-title">低库存 & 补货告警</div>
        {alertsList.length === 0
          ? <div className="small muted" style={{ padding: 12, textAlign: 'center' }}>暂无告警</div>
          : alertsList.slice(0, 6).map(x => (
              <div key={x.id} onClick={() => onAlert && onAlert(x.related_sku)} style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13, cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 12 }}>{x.title}</span>
                  <span className={'pill '+(x.alert_type==='replenish'||x.severity==='error'?'danger':x.severity==='warning'?'warning':'info')}>{x.alert_type==='replenish'?'补货':x.severity}</span>
                </div>
                <div className="small muted" style={{ fontSize: 11 }}>{x.description}</div>
              </div>
            ))}
        {alertsList.length > 6 && <div className="small muted" style={{ textAlign: 'center', padding: 6 }}>还有 {alertsList.length - 6} 条...</div>}
      </div>
    </div>
  </div>
}
