import React, { useEffect, useState } from 'react'
import { api } from '../api/client'

const levelClass = level => level === 'error' ? 'danger' : level === 'warning' ? 'warning' : 'info'

export default function AnomalyTracking() {
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('alerts')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get('/api/insights/anomaly-tracking')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="card"><div className="muted" style={{ padding:20, textAlign:'center' }}>加载中...</div></div>

  const summary = data?.summary || {}

  return (
    <div>
      {/* 统计卡片 */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
        <div className="card">
          <div className="small muted">告警总数</div>
          <div style={{ fontSize:24, fontWeight:700, color:'#d97706' }}>{summary.alert_count || 0}</div>
        </div>
        <div className="card">
          <div className="small muted">活跃告警</div>
          <div style={{ fontSize:24, fontWeight:700, color:'#dc2626' }}>{summary.active_alerts || 0}</div>
        </div>
        <div className="card">
          <div className="small muted">数据异常</div>
          <div style={{ fontSize:24, fontWeight:700, color:'#dc2626' }}>{summary.error_count || 0}</div>
        </div>
        <div className="card">
          <div className="small muted">操作记录</div>
          <div style={{ fontSize:24, fontWeight:700 }}>{summary.event_count || 0}</div>
        </div>
      </div>

      {/* 标签切换 */}
      <div style={{ display:'flex', gap:4, marginBottom:12 }}>
        {[
          { id:'alerts', label:'告警', count: summary.alert_count },
          { id:'quality', label:'质量日志', count: summary.error_count },
          { id:'events', label:'操作回溯', count: summary.event_count },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            fontSize:12, padding:'4px 14px', borderRadius:99, border:'1px solid', cursor:'pointer',
            background: tab === t.id ? '#1d4ed8' : '#fff', color: tab === t.id ? '#fff' : '#64748b',
            borderColor: tab === t.id ? '#1d4ed8' : '#e2e8f0', fontWeight: tab === t.id ? 600 : 400,
          }}>{t.label}{t.count > 0 ? ` (${t.count})` : ''}</button>
        ))}
      </div>

      {/* 告警列表 */}
      {tab === 'alerts' && (
        <div className="card">
          <div className="section-title">告警列表</div>
          {(!data?.alerts || data.alerts.length === 0)
            ? <div className="small muted">暂无告警</div>
            : <div style={{ overflowX:'auto' }}>
                <table>
                  <thead><tr>{['级别','类型','标题','描述','状态','时间'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {data.alerts.map(x => <tr key={x.id}>
                      <td><span className={`pill ${levelClass(x.severity)}`}>{x.severity}</span></td>
                      <td>{x.alert_type}</td>
                      <td>{x.title}</td>
                      <td>{x.description}</td>
                      <td><span className={`pill ${x.status === 'active' ? 'danger' : 'success'}`}>{x.status}</span></td>
                      <td className="small mono">{(x.created_at || '').slice(0,16)}</td>
                    </tr>)}
                  </tbody>
                </table>
              </div>}
        </div>
      )}

      {/* 质量日志 */}
      {tab === 'quality' && (
        <div className="card">
          <div className="section-title">数据质量日志</div>
          {(!data?.quality_logs || data.quality_logs.length === 0)
            ? <div className="small muted">暂无异常</div>
            : <div style={{ overflowX:'auto' }}>
                <table>
                  <thead><tr>{['级别','类型','消息','时间'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {data.quality_logs.map(x => <tr key={x.id}>
                      <td><span className={`pill ${levelClass(x.level)}`}>{x.level}</span></td>
                      <td>{x.log_type}</td>
                      <td>{x.message}</td>
                      <td className="small mono">{(x.created_at || '').slice(0,16)}</td>
                    </tr>)}
                  </tbody>
                </table>
              </div>}
        </div>
      )}

      {/* 操作回溯 */}
      {tab === 'events' && (
        <div className="card">
          <div className="section-title">操作回溯</div>
          {(!data?.events || data.events.length === 0)
            ? <div className="small muted">暂无记录</div>
            : <div style={{ overflowX:'auto' }}>
                <table>
                  <thead><tr>{['类型','标题','操作对象','时间'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {data.events.map(x => <tr key={x.id || x.event_id}>
                      <td><span className="pill info">{x.event_type}</span></td>
                      <td>{x.title}</td>
                      <td className="small mono">{x.entity_id || '-'}</td>
                      <td className="small mono">{(x.created_at || '').slice(0,16)}</td>
                    </tr>)}
                  </tbody>
                </table>
              </div>}
        </div>
      )}
    </div>
  )
}
