import React, { useState, useMemo, useEffect } from "react"
import { api } from '../api/client'
import { useAppStore } from '../store/useAppStore'
import Card from '../components/Card'
import Chart from '../components/Chart'

const periodLabel = { today:'今日', week:'本周', month:'本月' }

export default function DashboardPage({ onAlert }) {
  const [healthTab, setHealthTab] = useState(() => localStorage.getItem('health_tab') || 'platform')
  const { dashboard, inventory, qualityLogs, alerts, stockRisk, channel, loading, hammerDashPeriod: periodTab } = useAppStore()
  const [chLoading, setChLoading] = useState(false)
  useEffect(() => {
    setChLoading(true)
    Promise.all([
      api.get('/api/dashboard/summary'),
      api.get('/api/alerts'),
      api.get('/api/dashboard/stock-risk'),
    ]).then(([s, a, r]) => {
      useAppStore.setState({ dashboard: s.data, alerts: a.data || [], stockRisk: r.data || [], loading: false, dataLoaded: true })
      setChLoading(false)
    }).catch(() => setChLoading(false))
  }, [channel])
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
    series: [{ type: 'bar', data: dashboard?.stores?.map((i, idx) => ({ value: Math.round(i.gmv * 100) / 100, itemStyle: { color: ['#f59e0b','#06b6d4','#8b5cf6','#ec4899','#10b981','#f97316'][idx % 6] } })) || [] }],
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
        type: 'bar', data: values.map((v, i) => ({ value: v, itemStyle: { color: ['#f59e0b','#06b6d4','#8b5cf6','#ec4899','#10b981'][i % 5] } })),
        barWidth: '60%',
        label: { show: true, position: 'right', fontSize: 10, formatter: (p) => `${p.value}单`, textBorderColor: 'transparent' }
      }]
    }
  }, [dashboard])

  const lowStock = (inventory||[]).filter(x => Number(x.available_qty) < Number(x.safety_qty)).length
  const errCount = (qualityLogs||[]).length
  const alertsList = Array.isArray(alerts) ? alerts.filter(x => x.status === 'active') : []
  const lowStockAlerts = alertsList.filter(x => x.alert_type !== 'replenish')
  const replenishAlerts = alertsList.filter(x => x.alert_type === 'replenish')

  if (chLoading) return <div className="card" style={{padding:16}}>{[1,2,3,4,5,6].map(i=><div key={i} className="skeleton" style={{height:80,marginBottom:8,borderRadius:24}}/>)}</div>
  return <div>
    <div className="card-grid" style={{marginBottom:16}}>
      <Card title={periodLabel[periodTab]+' GMV'} value={'¥'+Number(periodMeta.gmv||0).toLocaleString()} sub={periodMeta.orders+' 单'} borderRadius={26} />
      <Card title="待处理" value={errCount+(dashboard?.summary?.active_alerts||0)} sub={errCount+' 异常 · '+(dashboard?.summary?.active_alerts||0)+' 告警'} borderRadius={26} valueColor={errCount+(dashboard?.summary?.active_alerts||0) > 10 ? '#ef4444' : (errCount+(dashboard?.summary?.active_alerts||0) > 5 ? '#f59e0b' : 'var(--text)')} />
      <div className="card" style={{position:'relative',borderRadius:26,containerType:'inline-size',aspectRatio:'1',display:'flex',flexDirection:'column',padding:16}}>
        {(()=>{
          const h = dashboard?.health_index?.[healthTab]||{}
          return <>
            <div className="small muted" style={{fontSize:12,lineHeight:1.2,marginBottom:4}}>库存健康度</div>
            <select value={healthTab} onChange={e=>{const v=e.target.value;localStorage.setItem('health_tab',v);setHealthTab(v)}} style={{fontSize:12,padding:'2px 6px',border:'1px solid var(--border)',borderRadius:32,outline:'none',background:'var(--card)',color:'var(--text)',minWidth:0,width:60,marginBottom:4}}>
                <option value="own">自有</option>
                <option value="platform">平台</option>
              </select>
            <div style={{flex:1,display:'flex',alignItems:'flex-end',marginBottom:2}}>
              <div className="card-value" style={{color:h.level==='danger'?'#ef4444':h.level==='warning'?'#f59e0b':'var(--success)'}}>{h.score||0}分</div>
            </div>
            <div className="card-sub" style={{marginTop:0}}>{h.healthy||0}健康 · {h.warning||0}偏低 · {h.out_of_stock||0}缺货</div>
          </>
        })()}
      </div>
      <div className="card" style={{position:'relative',borderRadius:26,containerType:'inline-size',aspectRatio:'1',display:'flex',flexDirection:'column',padding:16,overflow:'hidden'}}>
        <div className="small muted" style={{fontSize:12,lineHeight:1.2}}>濒临断货 TOP 10</div>
        {(!stockRisk || stockRisk.length === 0)
          ? <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:2}}>
              <div style={{fontSize:14,fontWeight:400,color:'var(--muted2)'}}>库存充足</div>
            </div>
          : <>
              <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'flex-end',marginBottom:2}}>
                <div className="card-value" style={{color:'#ef4444'}}>{stockRisk.length}</div>
                <div className="card-sub" style={{marginTop:0}}>最短 {stockRisk[0].days_to_empty} 天断货</div>
              </div>
              <div style={{marginTop:'auto',fontSize:10,color:'var(--muted2)',textAlign:'center'}}>点击 SKU 查看详情</div>
            </>}
      </div>
    </div>

    <div className="chart-row">
      <div className="card" style={{height:'auto',overflow:'visible'}}><div className="section-title">订单阶段转化</div><Chart option={funnelOption} height={200} /></div>
    </div>

    <div className="chart-row-3">
      <div className="card" style={{height:'auto',overflow:'visible'}}><div className="section-title">店铺 GMV</div><Chart option={storeOption} height={170} /></div>
      <div className="card" style={{height:'auto',overflow:'visible'}}>
        <div className="section-title">低库存告警</div>
        {lowStockAlerts.length === 0
          ? <div className="small muted" style={{padding:12,textAlign:'center'}}>暂无告警</div>
          : lowStockAlerts.slice(0,5).map(x => (
              <div key={x.id} onClick={() => onAlert && onAlert(x.related_sku)} style={{padding:'6px 0',borderBottom:'1px solid var(--border)',fontSize:13,cursor:'pointer'}}>
                <div style={{display:'flex',justifyContent:'space-between',gap:8}}>
                  <span style={{fontWeight:600,fontSize:12}}>{x.title}</span>
                  <span className={'pill '+(x.severity==='error'?'danger':'warning')}>{x.severity==='warning'?'警告':'超储'}</span>
                </div>
                <div className="small muted" style={{fontSize:11}}>{x.description}</div>
              </div>
            ))}
        {lowStockAlerts.length > 5 && <div className="small muted" style={{textAlign:'center',padding:6}}>还有 {lowStockAlerts.length - 5} 条...</div>}
      </div>
      <div className="card" style={{height:'auto',overflow:'visible'}}>
        <div className="section-title">补货告警</div>
        {replenishAlerts.length === 0
          ? <div className="small muted" style={{padding:12,textAlign:'center'}}>暂无告警</div>
          : replenishAlerts.slice(0,5).map(x => (
              <div key={x.id} onClick={() => onAlert && onAlert(x.related_sku)} style={{padding:'6px 0',borderBottom:'1px solid var(--border)',fontSize:13,cursor:'pointer'}}>
                <div style={{display:'flex',justifyContent:'space-between',gap:8}}>
                  <span style={{fontWeight:600,fontSize:12}}>{x.title}</span>
                  <span className="pill danger">补货</span>
                </div>
                <div className="small muted" style={{fontSize:11}}>{x.description}</div>
              </div>
            ))}
        {replenishAlerts.length > 5 && <div className="small muted" style={{textAlign:'center',padding:6}}>还有 {replenishAlerts.length - 5} 条...</div>}
      </div>
    </div>
  </div>
}
