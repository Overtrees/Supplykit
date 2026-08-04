import React, { useState, useMemo, useEffect } from "react"
import { api } from '../api/client'
import { useAppStore } from '../store/useAppStore'
import Chart from '../components/Chart'

const periodLabel = { today:'今日', week:'本周', month:'本月' }

interface DashboardPageProps { onAlert?: (sku: string) => void }

export default function DashboardPage({ onAlert }: DashboardPageProps) {
  const { dashboard, inventory, qualityLogs, alerts, stockRisk, channel, loading, hammerDashPeriod: periodTab } = useAppStore()
  const [healthTab, setHealthTab] = useState(() => localStorage.getItem('health_tab') || (channel === 'jd' ? 'own' : 'platform'))
  const [bcMenuOpen, setBcMenuOpen] = useState(false)
  const [showAllLowStock, setShowAllLowStock] = useState(false)
  const [showAllReplenish, setShowAllReplenish] = useState(false)
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

  const storeOption = useMemo(() => {
    var storeData = dashboard?.period_stores?.[periodTab] || dashboard?.stores || []
    return {
    tooltip: { trigger: 'axis', valueFormatter: (v) => '¥' + Number(v).toLocaleString('zh-CN', {minimumFractionDigits:2,maximumFractionDigits:2}), extraCssText: 'z-index:1000', hideDelay: 100 },
    xAxis: { type: 'category', data: storeData.map(i => i.name) || [], axisLabel: { fontSize: 9 } },
    yAxis: { type: 'value', axisLabel: { fontSize: 9, formatter: (v) => v >= 10000 ? (v/10000).toFixed(0) + 'W' : v }, max: (v) => Math.ceil(v.max * 1.2 / 1000) * 1000 },
    series: [{ type: 'bar', data: storeData.map((i, idx) => ({ value: Math.round(i.gmv * 100) / 100, itemStyle: { color: ['#f59e0b','#06b6d4','#8b5cf6','#ec4899','#10b981','#f97316'][idx % 6] } })) || [] }],
    grid: { containLabel: true, top: 8, bottom: 16 }
  }}, [dashboard, periodTab])

  const barOption = useMemo(() => {
    const f = dashboard?.period_funnel?.[periodTab] || dashboard?.funnel || []
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
  }, [dashboard, periodTab])

  const lowStock = (inventory||[]).filter(x => Number(x.available_qty) < Number(x.safety_qty)).length
  const errCount = (qualityLogs||[]).length
  const alertsList = Array.isArray(alerts) ? alerts.filter(x => x.status === 'active') : []
  const lowStockAlerts = alertsList.filter(x => x.alert_type !== 'replenish')
  const replenishAlerts = alertsList.filter(x => x.alert_type === 'replenish')
  const criticalAlerts = alertsList.filter(x => x.severity === 'error').length
  const periodDays = periodTab === 'custom' ? (periodMeta?.days || 30) : ({today:1,week:7,month:30}[periodTab]||30)
  const riskCritical = (stockRisk||[]).filter(x => x.days_to_empty < 3).length
  const riskWarning = (stockRisk||[]).filter(x => x.days_to_empty >= 3 && x.days_to_empty < 7).length
  var outOfStockItems = (inventory||[]).filter(function(item) {
    var filterType = healthTab === 'bc' ? 'bc' : (healthTab === 'platform' ? 'platform' : (healthTab === 'platform_b' ? 'platform_b' : 'own'))
    if (filterType === 'bc') return Number(item.available_qty) === 0 && item.warehouse_type !== 'own'
    return Number(item.available_qty) === 0 && item.warehouse_type === filterType
  }).slice(0,3)
  // 告警 × 仓库维度拆t("dash.score_unit")
  const skuWhMap = Object.fromEntries((inventory||[]).map(i => [i.sku, i.warehouse_type]))
  function countByWh(items) {
    var result = {b:0, c:0, own:0}
    items.forEach(function(item) {
      var whType = skuWhMap[item.related_sku] || ''
      if (whType === 'platform_b') result.b++
      else if (whType === 'own') result.own++
      else result.c++
    })
    return result
  }
  const lsWh = countByWh(lowStockAlerts)
  const rpWh = countByWh(replenishAlerts)

  if (chLoading) return <div className="card" style={{padding:16}}>{[1,2,3,4,5,6,7].map(i=><div key={i} className="skeleton" style={{height:80,marginBottom:8,borderRadius:24}}/>)}</div>
  return <>
    <div className="card-grid" style={{marginBottom:16}}>
      {/* 1. GMV 卡 — 加环比微趋势线 + 日均 */}
      <div className="card" style={{borderRadius:26,containerType:'inline-size',aspectRatio:'1',display:'flex',flexDirection:'column',padding:16,overflow:'hidden'}}>
        <div className="small muted" style={{fontSize:12,lineHeight:1.2}}>{periodTab === 'custom' ? '自定义' : periodLabel[periodTab]} GMV</div>
        <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'flex-end',marginBottom:4}}>
          <div className="card-value" style={{fontSize:'clamp(18px,9cqi,30px)',fontWeight:700,lineHeight:1.1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
            ¥{Number(periodMeta.gmv||0).toLocaleString()}
          </div>
          <div className="card-sub" style={{marginTop:4,display:'flex',alignItems:'center',gap:6}}>
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
        {periodTrend.length >= 3 && <div style={{height:22,marginTop:6,display:'flex',alignItems:'flex-end',gap:1.5}}>
          {periodTrend.map((i,idx) => {
            const v = Number(i['GMV'])||0
            const max = Math.max(...periodTrend.map(x => Number(x['GMV'])||0), 1)
            const h = Math.max(v / max * 18, 2)
            return <div key={idx} style={{flex:1,height:h,borderRadius:'2px 2px 0 0',background:'var(--primary)',opacity:0.3+0.7*(v/max)}} />
          })}
        </div>}
      </div>

      {/* 2. t("dash.pending")卡 — 按仓库维度拆分 */}
      <div className="card" style={{borderRadius:26,containerType:'inline-size',aspectRatio:'1',display:'flex',flexDirection:'column',padding:16}}>
        <div className="small muted" style={{fontSize:12,lineHeight:1.2}}>待处理</div>
        <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'flex-end',marginBottom:4}}>
          <div className="card-value" style={{fontSize:'clamp(18px,9cqi,30px)',fontWeight:700,lineHeight:1.1,color:errCount+(dashboard?.summary?.active_alerts||0) > 10 ? '#ef4444' : (errCount+(dashboard?.summary?.active_alerts||0) > 5 ? '#f59e0b' : 'var(--text)')}}>
            {errCount+(dashboard?.summary?.active_alerts||0)}
          </div>
          <div className="card-sub" style={{marginTop:4}}>
            <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
              <span style={{display:'inline-flex',alignItems:'center',gap:3}}><span style={{width:6,height:6,borderRadius:3,background:'#ef4444'}}/>{errCount} 异常</span>
              <span style={{display:'inline-flex',alignItems:'center',gap:3}}><span style={{width:6,height:6,borderRadius:3,background:'#f59e0b'}}/>{dashboard?.summary?.active_alerts||0} 告警{criticalAlerts > 0 ? <span style={{color:'#ef4444',fontSize:10}}>({criticalAlerts} 严重)</span> : ''}</span>
            </div>
            {(lowStockAlerts.length > 0 || replenishAlerts.length > 0) && <>
              <div style={{fontSize:10,display:'flex',gap:8,marginTop:4}}>
                <span style={{color:'var(--muted2)'}}>● 低库存 {lowStockAlerts.length}</span>
                <span style={{color:'var(--muted2)'}}>● 需t("dash.replenish") {replenishAlerts.length}</span>
              </div>
              <div style={{fontSize:9,display:'flex',gap:6,marginTop:3,color:'var(--muted)'}}>
                <span>B{lsWh.b} C{lsWh.c} t("dash.own"){lsWh.own}</span>
                <span style={{color:'var(--border)'}}>|</span>
                <span>B{rpWh.b} C{rpWh.c} 自有{rpWh.own}</span>
              </div>
            </>}
          </div>
        </div>
      </div>

      {/* 3. t("dash.health") — 加总 t("dash.sku") 数 */}
      <div className="card" style={{borderRadius:26,containerType:'inline-size',aspectRatio:'1',display:'flex',flexDirection:'column',padding:16}}>
        {(()=>{
          var healthData = dashboard?.health_index?.[healthTab]||{}
          var isJd = channel === 'jd'
          var bcActive = healthTab === 'bc' || healthTab === 'platform'
          var bcLabel = healthTab === 'platform' ? 'C仓' : 'BC'
          return <>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
              <div className="small muted" style={{fontSize:12,lineHeight:1.2}}>库存t("dash.healthy")度</div>
              <div style={{display:'flex',gap:2,background:'var(--bg)',borderRadius:99,padding:2,position:'relative'}}>
                <span onClick={function(){localStorage.setItem('health_tab','own');setHealthTab('own')}}
                  className="clickable"
                  style={{fontSize:9,padding:'2px 6px',borderRadius:99,cursor:'pointer',fontWeight:healthTab==='own'?600:400,background:healthTab==='own'?'var(--card)':'transparent',color:healthTab==='own'?'var(--text)':'var(--muted2)',whiteSpace:'nowrap'}}>自有</span>
                {isJd && <span onClick={function(){
              if (healthTab === 'bc' || healthTab === 'platform') {
                setBcMenuOpen(!bcMenuOpen)
              } else {
                localStorage.setItem('health_tab','bc');setHealthTab('bc')
              }
            }}
              className="clickable"
              style={{fontSize:9,padding:'2px 6px',borderRadius:99,cursor:'pointer',fontWeight:bcActive?600:400,background:bcActive?'var(--card)':'transparent',color:bcActive?'var(--text)':'var(--muted2)',display:'flex',alignItems:'center',gap:1,whiteSpace:'nowrap'}}>
              {bcLabel}{bcActive && <svg width="6" height="6" viewBox="0 0 8 8" fill="none" style={{transform:'rotate('+(bcMenuOpen?'180':'0')+'deg)',transition:'transform 0.15s'}}><path d="M2 3l2 2 2-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>}
            </span>}
                {!isJd && <span onClick={function(){localStorage.setItem('health_tab','platform');setHealthTab('platform')}}
                  className="clickable"
                  style={{fontSize:10,padding:'2px 8px',borderRadius:99,cursor:'pointer',fontWeight:healthTab==='platform'?600:400,background:healthTab==='platform'?'var(--card)':'transparent',color:healthTab==='platform'?'var(--text)':'var(--muted2)'}}>平台</span>}
                {bcMenuOpen && <div onClick={function(){setBcMenuOpen(false)}} style={{position:'fixed',inset:0,zIndex:9}} />}
                {bcMenuOpen && <div style={{position:'absolute',top:'calc(100% + 4px)',right:0,background:'var(--card)',borderRadius:12,border:'0.5px solid var(--border)',boxShadow:'0 4px 12px rgba(0,0,0,0.1)',overflow:'hidden',minWidth:64,zIndex:10}}>
                  {healthTab === 'bc'
                    ? <div onClick={function(){localStorage.setItem('health_tab','platform');setHealthTab('platform');setBcMenuOpen(false)}}
                        className="clickable" style={{padding:'6px 12px',fontSize:11,color:'var(--text)',cursor:'pointer',whiteSpace:'nowrap'}}>C仓</div>
                    : <div onClick={function(){localStorage.setItem('health_tab','bc');setHealthTab('bc');setBcMenuOpen(false)}}
                        className="clickable" style={{padding:'6px 12px',fontSize:11,color:'var(--text)',cursor:'pointer',whiteSpace:'nowrap'}}>BC</div>
                  }
                </div>}
              </div>
            </div>
            <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'flex-end',marginBottom:4}}>
              <div className="card-value" style={{fontSize:'clamp(18px,9cqi,30px)',fontWeight:700,lineHeight:1.1,color:healthData.level==='danger'?'#ef4444':healthData.level==='warning'?'#f59e0b':'var(--success)'}}>{healthData.score||0}分</div>
              <div className="card-sub" style={{marginTop:4}}>
                <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                  <span style={{color:'var(--success)'}}>● {healthData.healthy||0}健康</span>
                  <span style={{color:'var(--warning)'}}>● {healthData.warning||0}t("dash.low")</span>
                </div>
                <div style={{fontSize:10,marginTop:3}}>
                  <span style={{color:'#ef4444'}}>● {healthData.out_of_stock||0}t("dash.out_of_stock")</span>
                  <span style={{color:'var(--muted2)'}}> · {healthData.total||0} SKU</span>
                </div>
              </div>
            </div>
            {healthData.out_of_stock > 0 && outOfStockItems.length > 0 && <div style={{marginTop:4}}>
              {outOfStockItems.map((x,i) => (
                <div key={i} style={{fontSize:9,color:'var(--muted2)',lineHeight:1.5,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {x.product_name || x.sku} <span style={{fontSize:8,color:'var(--muted)',background:'var(--bg)',padding:'0 4px',borderRadius:4}}>{x.warehouse_type === 'own' ? '自有' : '平台'}</span>
                </div>
              ))}
            </div>}
          </>
        })()}
      </div>

      {/* 4. 濒临断货 TOP10 — 加危急/t("dash.alert_warning")分层 */}
      <div className="card" style={{borderRadius:26,containerType:'inline-size',aspectRatio:'1',display:'flex',flexDirection:'column',padding:16,overflow:'hidden'}}>
        <div className="small muted" style={{fontSize:12,lineHeight:1.2}}>t("dash.risk")</div>
        {(!stockRisk || stockRisk.length === 0)
          ? <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:2}}>
              <div style={{fontSize:14,fontWeight:400,color:'var(--muted2)'}}>t("dash.stock_ok")</div>
            </div>
          : <>
              <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'flex-end',marginBottom:4}}>
                <div className="card-value" style={{fontSize:'clamp(18px,9cqi,30px)',fontWeight:700,lineHeight:1.1,color:'#ef4444'}}>{stockRisk.length}</div>
                <div className="card-sub" style={{marginTop:4}}>t("dash.min_days") {stockRisk[0].days_to_empty} t("dash.days_out")</div>
                {(riskCritical > 0 || riskWarning > 0) && <div style={{fontSize:10,display:'flex',gap:4,marginTop:3,flexWrap:'wrap'}}>
                  {riskCritical > 0 && <span style={{color:'#ef4444'}}>● {riskCritical} t("dash.critical")</span>}
                  {riskWarning > 0 && <span style={{color:'var(--warning)'}}>● {riskWarning} t("dash.warning")</span>}
                </div>}
              </div>
              {stockRisk.slice(0,3).map((x,i) => (
                <div key={i} style={{fontSize:9,color:'var(--muted2)',lineHeight:1.5,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginTop:i===0?4:0}}>
                  {i+1}. {x.product_name || x.sku} <span style={{fontSize:8,color:'var(--muted)',background:'var(--bg)',padding:'0 4px',borderRadius:4}}>{x.type === 'B' ? 'B' : x.type === 'C' ? 'C' : '自有'}</span>
                </div>
              ))}
            </>}
      </div>
    </div>

    <div className="mid-chart-grid">
      <div className="card" style={{height:'auto',overflow:'visible'}}><div className="section-title">t("dash.funnel")</div><Chart option={barOption} height={200} /></div>
      <div className="card" style={{height:'auto',overflow:'visible'}}><div className="section-title">t("dash.store_gmv")</div><Chart option={storeOption} height={170} /></div>
    </div>

    <div className="chart-row-3">
      <div className="card" style={{height:'auto',overflow:'visible'}}>
        <div className="section-title">t("dash.low_stock")</div>
        {lowStockAlerts.length === 0
          ? <div className="small muted" style={{padding:12,textAlign:'center'}}>t("dash.no_alerts")</div>
          : lowStockAlerts.slice(0,5).map(x => (
              <div key={x.id} onClick={() => onAlert && onAlert(x.related_sku)} className="clickable" style={{padding:'7px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'flex-start'}}>
                  <span style={{fontWeight:600,fontSize:12,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1,minWidth:0}}>{x.title}</span>
                  <span className={'pill '+(x.severity==='error'?'danger':'warning')} style={{flexShrink:0}}>{x.severity==='warning'?'警告':'t("dash.alert_overstock")'}</span>
                </div>
                <div className="small muted" style={{fontSize:11,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginTop:2}}>{x.description}</div>
              </div>
            ))}
        {lowStockAlerts.length > 5 && <button onClick={()=>setShowAllLowStock(true)} className="clickable" style={{width:'100%',padding:8,border:'none',borderRadius:0,background:'transparent',fontSize:12,color:'var(--muted)',cursor:'pointer',fontFamily:'inherit'}}>还有 {lowStockAlerts.length - 5} 条...</button>}
      </div>
      <div className="card" style={{height:'auto',overflow:'visible'}}>
        <div className="section-title">t("dash.replenish_alert")</div>
        {replenishAlerts.length === 0
          ? <div className="small muted" style={{padding:12,textAlign:'center'}}>暂无告警</div>
          : replenishAlerts.slice(0,5).map(x => (
              <div key={x.id} onClick={() => onAlert && onAlert(x.related_sku)} className="clickable" style={{padding:'7px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'flex-start'}}>
                  <span style={{fontWeight:600,fontSize:12,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1,minWidth:0}}>{x.title}</span>
                  <span className="pill danger" style={{flexShrink:0}}>补货</span>
                </div>
                <div className="small muted" style={{fontSize:11,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginTop:2}}>{x.description}</div>
              </div>
            ))}
        {replenishAlerts.length > 5 && <button onClick={()=>setShowAllReplenish(true)} className="clickable" style={{width:'100%',padding:8,border:'none',borderRadius:0,background:'transparent',fontSize:12,color:'var(--muted)',cursor:'pointer',fontFamily:'inherit'}}>还有 {replenishAlerts.length - 5} 条...</button>}
      </div>
    </div>
      {/* 低库存告警弹窗 */}
      {showAllLowStock && <div onClick={function(){setShowAllLowStock(false)}} style={{position:'fixed',inset:0,zIndex:9998,background:'transparent'}} />}
      {showAllLowStock && <div style={{position:'fixed',left:0,right:0,bottom:'calc(env(safe-area-inset-bottom) + 14px)',zIndex:9999,display:'flex',justifyContent:'center',padding:'0 14px',pointerEvents:'none'}}>
        <div onClick={function(e){e.stopPropagation()}} style={{width:'100%',maxWidth:600,background:'var(--glass-bg)',backdropFilter:'blur(40px) saturate(2.5) brightness(1.15)',WebkitBackdropFilter:'blur(40px) saturate(2.5) brightness(1.15)',border:'0.5px solid var(--glass-border)',borderRadius:32,padding:'18px 14px calc(14px + env(safe-area-inset-bottom))',boxShadow:'0 -8px 24px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.25)',pointerEvents:'auto',maxHeight:'70vh',overflowY:'auto'}}>
          <div style={{fontSize:18,fontWeight:700,marginBottom:12,textAlign:'center',color:'var(--text)'}}>低库存告警 · 共 {lowStockAlerts.length} 条</div>
          {lowStockAlerts.map(function(x) {
            return <div key={x.id} onClick={function(){onAlert && onAlert(x.related_sku)}} className="clickable" style={{padding:'8px 12px',background:'var(--card)',borderRadius:16,marginBottom:6}}>
              <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'flex-start',marginBottom:2}}>
                <span style={{fontWeight:600,fontSize:12,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1,minWidth:0}}>{x.title}</span>
                <span className={'pill '+(x.severity==='error'?'danger':'warning')} style={{flexShrink:0,fontSize:10}}>{x.severity==='warning'?'警告':'超储'}</span>
              </div>
              <div className="small muted" style={{fontSize:11}}>{x.description}</div>
            </div>
          })}
          <div onClick={function(){setShowAllLowStock(false)}} className="clickable" style={{borderRadius:22,padding:12,marginTop:8,background:'var(--primary)',textAlign:'center',cursor:'pointer'}}>
            <span style={{fontSize:15,fontWeight:600,color:'#fff'}}>关闭</span>
          </div>
        </div>
      </div>}

      {/* 补货告警弹窗 */}
      {showAllReplenish && <div onClick={function(){setShowAllReplenish(false)}} style={{position:'fixed',inset:0,zIndex:9998,background:'transparent'}} />}
      {showAllReplenish && <div style={{position:'fixed',left:0,right:0,bottom:'calc(env(safe-area-inset-bottom) + 14px)',zIndex:9999,display:'flex',justifyContent:'center',padding:'0 14px',pointerEvents:'none'}}>
        <div onClick={function(e){e.stopPropagation()}} style={{width:'100%',maxWidth:600,background:'var(--glass-bg)',backdropFilter:'blur(40px) saturate(2.5) brightness(1.15)',WebkitBackdropFilter:'blur(40px) saturate(2.5) brightness(1.15)',border:'0.5px solid var(--glass-border)',borderRadius:32,padding:'18px 14px calc(14px + env(safe-area-inset-bottom))',boxShadow:'0 -8px 24px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.25)',pointerEvents:'auto',maxHeight:'70vh',overflowY:'auto'}}>
          <div style={{fontSize:18,fontWeight:700,marginBottom:12,textAlign:'center',color:'var(--text)'}}>补货告警 · 共 {replenishAlerts.length} 条</div>
          {replenishAlerts.map(function(x) {
            return <div key={x.id} onClick={function(){onAlert && onAlert(x.related_sku)}} className="clickable" style={{padding:'8px 12px',background:'var(--card)',borderRadius:16,marginBottom:6}}>
              <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'flex-start',marginBottom:2}}>
                <span style={{fontWeight:600,fontSize:12,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1,minWidth:0}}>{x.title}</span>
                <span className="pill danger" style={{flexShrink:0,fontSize:10}}>补货</span>
              </div>
              <div className="small muted" style={{fontSize:11}}>{x.description}</div>
            </div>
          })}
          <div onClick={function(){setShowAllReplenish(false)}} className="clickable" style={{borderRadius:22,padding:12,marginTop:8,background:'var(--primary)',textAlign:'center',cursor:'pointer'}}>
            <span style={{fontSize:15,fontWeight:600,color:'#fff'}}>关闭</span>
          </div>
        </div>
      </div>}
</>
}
