import React, { useState, useMemo } from "react"
import { useAppStore } from '../store/useAppStore'
import Card from '../components/Card'
import Chart from '../components/Chart'

const periodLabel = { today:'今日', week:'本周', month:'本月' }

export default function DashboardPage() {
  const [periodTab, setPeriodTab] = useState('month')
  const { dashboard, inventory, qualityLogs, alerts } = useAppStore()
  const periodTrend = dashboard?.periods?.[periodTab + '_trend'] || dashboard?.trend || []
  const periodMeta = dashboard?.periods?.[periodTab] || {}

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

  const storeOption = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: dashboard?.stores?.map(i => i.name) || [] },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: dashboard?.stores?.map(i => i.gmv) || [], itemStyle: { color:'#0f766e' } }],
    grid: { left: 40, right: 20, top: 30, bottom: 30 }
  }), [dashboard])

  const lowStock = (inventory||[]).filter(x => Number(x.available_qty) < Number(x.safety_qty)).length
  const errCount = (qualityLogs||[]).length
  const alertsList = alerts || []

  return <div>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
      <div style={{ display:'flex', gap:4 }}>
        {['today','week','month'].map(k => (
          <button key={k} onClick={() => setPeriodTab(k)} style={{ fontSize:12, padding:'4px 14px', borderRadius:99, border:'1px solid', cursor:'pointer', background: periodTab === k ? '#1d4ed8' : '#fff', color: periodTab === k ? '#fff' : '#64748b', borderColor: periodTab === k ? '#1d4ed8' : '#e2e8f0', fontWeight: periodTab === k ? 600 : 400 }}>{periodLabel[k]}</button>
        ))}
      </div>
      <div className="small muted">{periodMeta.date ? periodMeta.date : ''}</div>
    </div>

    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
      <Card title={periodLabel[periodTab]+' GMV'} value={'¥'+Number(periodMeta.gmv||0).toLocaleString()} sub={periodMeta.orders+' 单'} />
      <Card title="待发货" value={dashboard?.summary?.pending_count||0} badge={dashboard?.summary?.pending_count>3?<span className="pill danger">积压</span>:null} />
      <Card title="库存健康度" value={(dashboard?.health_index?.score||0)+'分'} sub={dashboard?.health_index?.healthy+'健康 / '+dashboard?.health_index?.warning+'偏低'} badge={<span className={'pill '+(dashboard?.health_index?.level==='danger'?'danger':dashboard?.health_index?.level==='warning'?'warning':'success')}>{dashboard?.health_index?.level==='danger'?'危险':dashboard?.health_index?.level==='warning'?'关注':'良好'}</span>} />
      <Card title="待处理" value={errCount+(dashboard?.summary?.active_alerts||0)} sub={errCount+' 异常 · '+(dashboard?.summary?.active_alerts||0)+' 告警'} badge={errCount>0 ? <span className="pill danger" style={{background:'#ef4444',color:'#fff'}}>需处理</span> : null} />
    </div>

    <div style={{ display:'grid', gridTemplateColumns:'1.3fr 1fr', gap:16, marginBottom:16 }}>
      <div className="card"><div className="section-title">{periodLabel[periodTab]} GMV·订单趋势</div><Chart option={periodTrendOption} height={200} /></div>
      <div className="card"><div className="section-title">店铺 GMV</div><Chart option={storeOption} height={200} /></div>
    </div>
  </div>
}
