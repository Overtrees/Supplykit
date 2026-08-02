import React, { useState, useMemo, useEffect } from "react"
import { api } from '../api/client'
import { useAppStore } from '../store/useAppStore'
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
    tooltip: { trigger: 'axis', valueFormatter: (v) => '¥' + Number(v).toLocaleString('zh-CN', {minimumFractionDigits:2,maximumFractionDigits:2}), extraCssText: 'z-index:1000', hideDelay: 100 },
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
    tooltip: { trigger: 'axis', valueFormatter: (v) => '¥' + Number(v).toLocaleString('zh-CN', {minimumFractionDigits:2,maximumFractionDigits:2}), extraCssText: 'z-index:1000', hideDelay: 100 },
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
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, extraCssText: 'z-index:1000', hideDelay: 100, formatter: (p) => {
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
  const criticalAlerts = alertsList.filter(x => x.severity === 'error').length
  const periodDays = {today:1,week:7,month:30}[periodTab]||30
  const riskCritical = (stockRisk||[]).filter(x => x.days_to_empty < 3).length
  const riskWarning = (stockRisk||[]).filter(x => x.days_to_empty >= 3 && x.days_to_empty < 7).length
  const riskBCount = (stockRisk||[]).filter(x => x.type === 'B').length
  const riskCCount = (stockRisk||[]).filter(x => x.type === 'C').length
  const outOfStockItems = (inventory||[]).filter(x => {
    const wt = healthTab === 'own' ? 'own' : 'platform'
    return Number(x.available_qty) === 0 && (wt === 'own' ? x.warehouse_type === 'own' : x.warehouse_type !== 'own' && x.warehouse_type !== 'platform_b')
  }).slice(0,3)

  if (chLoading) return <div className="card" style={{padding:16}}>{[1,2,3,4,5,6].map(i=><div key={i} className="skeleton" style={{height:80,marginBottom:8,borderRadius:24}}/>)}</div>
  return <div>
    <div className="card-grid" style={{marginBottom:16}}>
      {/* 1. GMV 卡 — 加环比微趋势线 + 日均 */}
      <div className="card" style={{borderRadius:26,containerType:'inline-size',aspectRatio:'1',display:'flex',flexDirection:'column',padding:16,overflow:'hidden'}}>
        <div className="small muted" style={{fontSize:12,lineHeight:1.2}}>{periodLabel[periodTab]} GMV</div>
        <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'flex-end',marginBottom:2}}>
          <div className="card-value" style={{fontSize:'clamp(18px,9cqi,30px)',fontWeight:700,lineHeight:1.1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
            ¥{Number(periodMeta.gmv||0).toLocaleString()}
          </div>
          <div className="card-sub" style={{marginTop:0,display:'flex',alignItems:'center',gap:6}}>
            <span>{periodMeta.orders} 单</span>
            {periodTrend.length >= 2 && (() => {
              const vals = periodTrend.map(i => Number(i['GMV'])||0)
              const last = vals[vals.length-1], prev = vals[vals.length-2]
              if (!prev) return null
              const pct = ((last - prev) / prev * 100)
              return <span style={{fontSize:11,fontWeight:600,color:pct >= 0 ? 'var(--success)' : '#ef4444'}}>
                {pct >= 0 ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}%
              </span>
            })()}
            <span style={{color:'var(--muted2)',fontSize:10}}>· 日均 ¥{Math.round((periodMeta.gmv||0)/periodDays).toLocaleString()}</span>
          </div>
        </div>
        {/* 微趋势线 */}
        {periodTrend.length >= 3 && <div style={{height:22,marginTop:'auto',display:'flex',alignItems:'flex-end',gap:1.5}}>
          {periodTrend.map((i,idx) => {
            const v = Number(i['GMV'])||0
            const max = Math.max(...periodTrend.map(x => Number(x['GMV'])||0), 1)
            const h = Math.max(v / max * 18, 2)
            return <div key={idx} style={{flex:1,height:h,borderRadius:'2px 2px 0 0',background:'var(--primary)',opacity:0.3+0.7*(v/max)}} />
          })}
        </div>}
      </div>

      {/* 2. 待处理卡 — 加告警类型拆分 */}
      <div className="card" style={{borderRadius:26,containerType:'inline-size',aspectRatio:'1',display:'flex',flexDirection:'column',padding:16}}>
        <div className="small muted" style={{fontSize:12,lineHeight:1.2}}>待处理</div>
        <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'flex-end',marginBottom:2}}>
          <div className="card-value" style={{fontSize:'clamp(18px,9cqi,30px)',fontWeight:700,lineHeight:1.1,color:errCount+(dashboard?.summary?.active_alerts||0) > 10 ? '#ef4444' : (errCount+(dashboard?.summary?.active_alerts||0) > 5 ? '#f59e0b' : 'var(--text)')}}>
            {errCount+(dashboard?.summary?.active_alerts||0)}
          </div>
          <div className="card-sub" style={{marginTop:0}}>
            <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
              <span style={{display:'inline-flex',alignItems:'center',gap:3}}><span style={{width:6,height:6,borderRadius:3,background:'#ef4444'}}/>{errCount} 异常</span>
              <span style={{display:'inline-flex',alignItems:'center',gap:3}}><span style={{width:6,height:6,borderRadius:3,background:'#f59e0b'}}/>{dashboard?.summary?.active_alerts||0} 告警{criticalAlerts > 0 ? <span style={{color:'#ef4444',fontSize:10}}>({criticalAlerts} 严重)</span> : ''}</span>
            </div>
            {(lowStockAlerts.length > 0 || replenishAlerts.length > 0) && <div style={{fontSize:10,display:'flex',gap:6,marginTop:1,color:'var(--muted2)'}}>
              {lowStockAlerts.length > 0 && <span>● 低库存 {lowStockAlerts.length}</span>}
              {replenishAlerts.length > 0 && <span>● 需补货 {replenishAlerts.length}</span>}
            </div>}
          </div>
        </div>
      </div>

      {/* 3. 库存健康度 — 加总 SKU 数 */}
      <div className="card" style={{borderRadius:26,containerType:'inline-size',aspectRatio:'1',display:'flex',flexDirection:'column',padding:16}}>
        {(()=>{
          const h = dashboard?.health_index?.[healthTab]||{}
          return <>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
              <div className="small muted" style={{fontSize:12,lineHeight:1.2}}>库存健康度</div>
              <div style={{display:'flex',gap:2,background:'var(--bg)',borderRadius:99,padding:2}}>
                {[{v:'own',l:'自有'},{v:'platform',l:'平台'}].map(({v,l}) =>
                  <span key={v} onClick={()=>{localStorage.setItem('health_tab',v);setHealthTab(v)}}
                    style={{fontSize:10,padding:'2px 8px',borderRadius:99,cursor:'pointer',fontWeight:healthTab===v?600:400,background:healthTab===v?'var(--card)':'transparent',color:healthTab===v?'var(--text)':'var(--muted2)'}}>{l}</span>
                )}
              </div>
            </div>
            <div style={{flex:1,display:'flex',alignItems:'flex-end',marginBottom:2}}>
              <div className="card-value" style={{fontSize:'clamp(18px,9cqi,30px)',fontWeight:700,lineHeight:1.1,color:h.level==='danger'?'#ef4444':h.level==='warning'?'#f59e0b':'var(--success)'}}>{h.score||0}分</div>
            </div>
            <div className="card-sub" style={{marginTop:0}}>
              <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                <span style={{color:'var(--success)'}}>● {h.healthy||0}健康</span>
                <span style={{color:'var(--warning)'}}>● {h.warning||0}偏低</span>
                <span style={{color:'#ef4444'}}>● {h.out_of_stock||0}缺货</span>
              </div>
              <div style={{fontSize:10,color:'var(--muted2)',marginTop:1}}>{h.out_of_stock||0}缺货 · {h.total||0} SKU</div>
            </div>
            {h.out_of_stock > 0 && outOfStockItems.length > 0 && <div style={{marginTop:2}}>
              {outOfStockItems.map((x,i) => (
                <div key={i} style={{fontSize:9,color:'var(--muted2)',lineHeight:1.4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {x.product_name || x.sku} <span style={{fontSize:8,color:'var(--muted)',background:'var(--bg)',padding:'0 4px',borderRadius:4}}>{x.warehouse_type === 'own' ? '自有' : '平台'}</span>
                </div>
              ))}
            </div>}
          </>
        })()}
      </div>

      {/* 4. 濒临断货 TOP10 — 加危急/警告分层 */}
      <div className="card" style={{borderRadius:26,containerType:'inline-size',aspectRatio:'1',display:'flex',flexDirection:'column',padding:16,overflow:'hidden'}}>
        <div className="small muted" style={{fontSize:12,lineHeight:1.2}}>濒临断货 TOP 10</div>
        {(!stockRisk || stockRisk.length === 0)
          ? <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:2}}>
              <div style={{fontSize:14,fontWeight:400,color:'var(--muted2)'}}>库存充足</div>
            </div>
          : <>
              <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'flex-end',marginBottom:2}}>
                <div className="card-value" style={{fontSize:'clamp(18px,9cqi,30px)',fontWeight:700,lineHeight:1.1,color:'#ef4444'}}>{stockRisk.length}</div>
                <div className="card-sub" style={{marginTop:0}}>最短 {stockRisk[0].days_to_empty} 天断货</div>
                {(riskCritical > 0 || riskWarning > 0) && <div style={{fontSize:10,display:'flex',gap:4,marginTop:2,flexWrap:'wrap'}}>
                  {riskCritical > 0 && <span style={{color:'#ef4444'}}>● {riskCritical} 紧急</span>}
                  {riskWarning > 0 && <span style={{color:'var(--warning)'}}>● {riskWarning} 预警</span>}
                </div>}
              </div>
              {stockRisk.slice(0,3).map((x,i) => (
                <div key={i} style={{fontSize:9,color:'var(--muted2)',lineHeight:1.4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {i+1}. {x.product_name || x.sku} <span style={{fontSize:8,color:'var(--muted)',background:'var(--bg)',padding:'0 4px',borderRadius:4}}>{x.type === 'B' ? 'B' : x.type === 'C' ? 'C' : '自有'}</span>
                </div>
              ))}
            </>}
      </div>
    </div>

    <div className="mid-chart-grid">
      <div className="card" style={{height:'auto',overflow:'visible'}}><div className="section-title">订单阶段转化</div><Chart option={funnelOption} height={200} /></div>
      <div className="card" style={{height:'auto',overflow:'visible'}}><div className="section-title">店铺 GMV</div><Chart option={storeOption} height={170} /></div>
    </div>

    <div className="chart-row-3">
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
