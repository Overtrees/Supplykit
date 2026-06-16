import React, { useState, useEffect } from 'react'
import { api } from '../api/client'

const API = import.meta.env.VITE_API_BASE_URL || 'https://overtrees.pythonanywhere.com'



const EVENTS = [
  { value: 'inventory.changed', label: '库存变动' },
  { value: 'order.created', label: '订单创建' },
  { value: 'scheduled.daily', label: '每日定时' },
]

export default function RulesPage() {
  const [rules, setRules] = useState([])
  const [editing, setEditing] = useState(null)
  const [cfg, setCfg] = useState({})
  const [form, setForm] = useState({
    name: '', event: 'inventory.changed', alert_type: '',
    alert_title: '', alert_desc: '', severity: 'warning',
    condition_json: '{}',
  })

  const loadCfg = async () => { try { const r = await api.get('/api/replenishment-config'); setCfg(r.data || {}) } catch(e) {} }
  useEffect(() => { loadCfg() }, [])

  const load = async () => {
    try { const r = await fetch(API + '/api/rules'); setRules(await r.json()) }
    catch (e) {}
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    const url = editing ? '/api/rules/' + editing.id : '/api/rules'
    const method = editing ? 'PUT' : 'POST'
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setEditing(null)
    setForm({ name: '', event: 'inventory.changed', alert_type: '', alert_title: '', alert_desc: '', severity: 'warning', condition_json: '{}' })
    load()
  }

  const del = async (id) => {
    await fetch('/api/rules/' + id, { method: 'DELETE' })
    load()
  }

  const startNew = () => {
    setEditing({})
    setForm({ name: '', event: 'inventory.changed', alert_type: '', alert_title: '', alert_desc: '', severity: 'warning', condition_json: '{}' })
  }

  const cancel = () => {
    setEditing(null)
    setForm({ name: '', event: 'inventory.changed', alert_type: '', alert_title: '', alert_desc: '', severity: 'warning', condition_json: '{}' })
  }

  const startEdit = (rule) => {
    setEditing(rule)
    setForm({
      name: rule.name, event: rule.event, alert_type: rule.alert_type || '',
      alert_title: rule.alert_title || '', alert_desc: rule.alert_desc || '',
      severity: rule.severity || 'warning', condition_json: rule.condition_json || '{}',
    })
  }

  const severityClass = (sev) => {
    if (sev === 'error') return 'danger'
    if (sev === 'info') return 'info'
    return 'warning'
  }

  const severityLabel = (sev) => {
    if (sev === 'error') return '严重'
    if (sev === 'info') return '提示'
    return '警告'
  }

  return (
    <div className="card">
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>⚙️ 规则引擎</span>
        <button onClick={startNew} style={btnStyle.primary}>+ 新建规则</button>
      </div>

      {editing !== null && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>{editing.id ? '编辑规则' : '新建规则'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ fontSize: 12, display: 'block' }}>
              规则名称
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
            </label>
            <label style={{ fontSize: 12, display: 'block' }}>
              触发事件
              <select value={form.event} onChange={e => setForm({ ...form, event: e.target.value })} style={inputStyle}>
                {EVENTS.map(ev => <option key={ev.value} value={ev.value}>{ev.label}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 12, display: 'block' }}>
              告警类型
              <input value={form.alert_type} onChange={e => setForm({ ...form, alert_type: e.target.value })} style={inputStyle} placeholder="low_stock" />
            </label>
            <label style={{ fontSize: 12, display: 'block' }}>
              严重级别
              <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })} style={inputStyle}>
                <option value="warning">警告</option>
                <option value="error">严重</option>
                <option value="info">提示</option>
              </select>
            </label>
            <label style={{ fontSize: 12, display: 'block' }}>
              告警标题
              <input value={form.alert_title} onChange={e => setForm({ ...form, alert_title: e.target.value })} style={inputStyle} />
            </label>
            <label style={{ fontSize: 12, display: 'block' }}>
              告警描述
              <input value={form.alert_desc} onChange={e => setForm({ ...form, alert_desc: e.target.value })} style={inputStyle} />
            </label>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button onClick={save} style={btnStyle.primary}>保存</button>
            <button onClick={cancel} style={btnStyle.secondary}>取消</button>
          </div>
        </div>
      )}

      {rules.map(rule => (
        <div key={rule.id} style={{ padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 10, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{rule.name}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              <span className={'pill ' + (rule.is_active ? 'success' : 'warning')}>{rule.is_active ? '启用' : '停用'}</span>
              {' '}
              <span className={'pill ' + severityClass(rule.severity)}>{severityLabel(rule.severity)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => startEdit(rule)} style={btnStyle.edit}>编辑</button>
            <button onClick={() => del(rule.id)} style={btnStyle.danger}>删除</button>
          </div>
        </div>
      ))}

      {rules.length === 0 && (
        <div className="small muted" style={{ textAlign: 'center', padding: 40 }}>
          暂无规则，点击「新建规则」创建
        </div>
      )}

      {/* 补货参数面板 */}
      <div style={{border:'1px solid #e2e8f0',borderRadius:12,padding:16,marginTop:16}}>
      <div className="section-title">📊 补货参数</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
        {[{k:'lead_time_days',l:'前置期(天)'},{k:'safety_multiplier',l:'安全线倍数'},{k:'max_turnover_days',l:'最大周转(天)'},{k:'season_618',l:'618系数'},{k:'season_1111',l:'双11系数'},{k:'season_cny',l:'年货节系数'}].map(({k,l}) => <label key={k} style={{fontSize:12}}>{l}<input value={cfg[k]||''} onChange={e=>setCfg(p=>({...p,[k]:e.target.value}))} style={inputStyle}/></label>)}
      </div>
      <button onClick={async()=>{try{await api.put('/api/replenishment-config',cfg)}catch(e){};loadCfg()}} style={{marginTop:10,padding:'6px 16px',background:'#1d4ed8',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontSize:13}}>保存参数</button>
      <span className="small muted" style={{marginLeft:8,fontSize:11}}>更新后补货建议 & 规则引擎自动使用新参数</span>
      </div>
    </div>
  )
}

const btnStyle = {
  primary: { padding: '6px 16px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13 },
  secondary: { padding: '6px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 13 },
  edit: { fontSize: 12, padding: '4px 10px', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', background: '#fff' },
  danger: { fontSize: 12, padding: '4px 10px', border: '1px solid #ef4444', borderRadius: 6, cursor: 'pointer', background: '#fff', color: '#ef4444' },
}

const inputStyle = { width: '100%', padding: '6px 8px', fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 6, marginTop: 4, outline: 'none', background: '#fff', boxSizing: 'border-box' }
