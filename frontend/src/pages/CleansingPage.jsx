import React, { useState } from 'react'

const API = import.meta.env.VITE_API_BASE_URL || 'https://overtrees.pythonanywhere.com'

export default function CleansingPage() {
  const [step, setStep] = useState(0)
  const [file, setFile] = useState(null)
  const [columns, setColumns] = useState([])
  const [totalRows, setTotalRows] = useState(0)
  const [targetType, setTargetType] = useState('order')
  const [mapping, setMapping] = useState({})
  const [systemFields, setSystemFields] = useState([])
  const [preview, setPreview] = useState(null)
  const [templates, setTemplates] = useState([])
  const [templateName, setTemplateName] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState('')
  const [showFieldForm, setShowFieldForm] = useState(false)
  const [newFieldKey, setNewFieldKey] = useState('')
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [newFieldType, setNewFieldType] = useState('string')

  const handleUpload = async f => {
    if (!f) return
    setFile(f); setBusy('detect')
    try {
      const form = new FormData(); form.append('file', f)
      const res = await fetch(API + '/api/cleansing/detect', { method: 'POST', body: form })
      const data = await res.json()
      if (data.ok) {
        setColumns(data.columns); setTotalRows(data.total)
        const m = {}
        data.columns.forEach(c => { m[c.name] = { target: '', type: 'string', format: '', default: '' } })
        setMapping(m)
        const sysRes = await fetch(API + '/api/cleansing/fields/' + targetType)
        const sysData = await sysRes.json()
        setSystemFields(sysData.all || sysData)
        await loadTemplates()
        setStep(1)
      }
    } finally { setBusy('') }
  }

  const loadTemplates = async () => {
    try { const r = await fetch(API + '/api/cleansing/templates'); setTemplates(await r.json()) } catch (e) {}
  }

  const switchTarget = async t => {
    setTargetType(t)
    const r = await fetch(API + '/api/cleansing/fields/' + t)
    const d = await r.json()
    setSystemFields(d.all || d)
  }

  const updateMapping = (src, key, val) => setMapping(prev => ({ ...prev, [src]: { ...prev[src], [key]: val } }))

  const applyTemplate = tpl => {
    if (!tpl.mapping) return
    setMapping(prev => {
      const m = { ...prev }
      Object.keys(tpl.mapping).forEach(k => { if (m[k]) m[k] = { ...m[k], ...tpl.mapping[k] } })
      return m
    })
  }

  const handlePreview = async () => {
    if (!file) return; setBusy('preview')
    const form = new FormData(); form.append('file', file)
    form.append('mapping', JSON.stringify(mapping))
    try {
      const r = await fetch(API + '/api/cleansing/preview', { method: 'POST', body: form })
      const d = await r.json()
      if (d.ok) { setPreview(d); setStep(2) }
    } finally { setBusy('') }
  }

  const handleExecute = async () => {
    if (!file) return; setBusy('exec')
    const form = new FormData(); form.append('file', file)
    form.append('mapping', JSON.stringify(mapping))
    form.append('target', targetType)
    form.append('template_name', templateName)
    try {
      const r = await fetch(API + '/api/cleansing/execute-async', { method: 'POST', body: form })
      if (!r.ok) {
        const txt = await r.text().catch(() => '')
        alert('提交失败 (HTTP ' + r.status + '): ' + (txt.slice(0, 200) || r.statusText))
        setBusy(''); return
      }
      const d = await r.json()
      if (!d.ok) { alert(d.error || '提交失败'); setBusy(''); return }

      // 轮询任务进度
      const taskId = d.task_id
      const poll = setInterval(async () => {
        try {
          const sr = await fetch(API + '/api/cleansing/task/' + taskId)
          const sd = await sr.json()
          if (sd.status === 'done') {
            clearInterval(poll)
            setResult(sd.result); await loadTemplates(); setStep(3)
          } else if (sd.status === 'error') {
            clearInterval(poll)
            alert('清洗失败: ' + (sd.error || '未知错误'))
            setBusy('')
          }
        } catch(e) { clearInterval(poll); setBusy('') }
      }, 1000)
      setBusy('polling')
    } catch (e) {
      alert('网络错误: ' + e.message + '\n\n请检查:\n1. ' + API + ' 是否可访问\n2. 切换到 Wi-Fi 或 4G 重试')
      setBusy('')
    }
  }

  const reset = () => { setStep(0); setFile(null); setColumns([]); setPreview(null); setResult(null); setTemplateName('') }

  const mappedCount = Object.values(mapping).filter(v => v.target).length

  return (
    <div>
      <div className="step-indicator">
        {['上传文件', '字段映射', '预览确认', '完成'].map((label, i) => (
          <span key={i} className={`step${step === i ? ' active' : ''}${step > i ? ' done' : ''}`}>
            {step > i ? '✓ ' : ''}{label}
          </span>
        ))}
        {busy && <span className="step" style={{ color: '#1d4ed8' }}>⏳ {busy}...</span>}
      </div>

      {step === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.3 }}>🧹</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>上传需要清洗的数据文件</div>
          <div className="small muted" style={{ marginBottom: 16 }}>CSV / XLSX · 检测列名 → 映射字段 → 标准化写入</div>
          <label style={{ display: 'inline-block', padding: '10px 24px', background: '#1d4ed8', color: '#fff', borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            {busy === 'detect' ? '检测中...' : '选择文件'}
            <input type="file" accept=".csv,.xlsx" style={{ display: 'none' }} onChange={e => handleUpload(e.target.files?.[0])} />
          </label>
        </div>
      )}

      {step === 1 && (
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <span className="section-title" style={{ marginBottom: 0 }}>字段映射</span>
                <span className="small muted" style={{ marginLeft: 8 }}>{columns.length} 源字段 → {mappedCount}/{systemFields.length} 已映射</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select value={targetType} onChange={e => switchTarget(e.target.value)}
                  style={{ fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8, padding: '5px 10px' }}>
                  <option value="order">订单</option>
                  <option value="inventory">库存</option>
                </select>
                <button onClick={() => { setShowFieldForm(!showFieldForm); setNewFieldKey(''); setNewFieldLabel(''); setNewFieldType('string') }}
                  style={{ fontSize: 11, border: '1px solid #e2e8f0', borderRadius: 8, padding: '5px 10px', background: showFieldForm ? '#eff6ff' : '#fff', cursor: 'pointer', color: '#1d4ed8', whiteSpace: 'nowrap' }}>
                  {showFieldForm ? '✕ 关闭' : '＋自定义字段'}
                </button>
                {showFieldForm && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '6px 10px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <input placeholder="字段名(key)" value={newFieldKey} onChange={e => setNewFieldKey(e.target.value)}
                      style={{ width: 90, fontSize: 11, padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 6 }} />
                    <input placeholder="显示名称" value={newFieldLabel} onChange={e => setNewFieldLabel(e.target.value)}
                      style={{ width: 80, fontSize: 11, padding: '4px 6px', border: '1px solid #e2e8f0', borderRadius: 6 }} />
                    <select value={newFieldType} onChange={e => setNewFieldType(e.target.value)}
                      style={{ width: 70, fontSize: 11, padding: '4px', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                      <option value="string">文本</option><option value="number">数值</option><option value="date">日期</option>
                    </select>
                    <button onClick={async () => {
                      if (!newFieldKey) return
                      await fetch(API + '/api/cleansing/custom-fields/' + targetType, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key: newFieldKey, label: newFieldLabel || newFieldKey, type: newFieldType })
                      }).then(() => { switchTarget(targetType); setShowFieldForm(false) })
                    }} style={{ fontSize: 11, padding: '4px 10px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>添加</button>
                  </div>
                )}
                {templates.length > 0 && (
                  <select onChange={e => { const t = templates.find(t => t.name === e.target.value); if (t) applyTemplate(t) }}
                    style={{ fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8, padding: '5px 10px' }}>
                    <option value="">套用模板...</option>
                    {templates.map(t => <option key={t.name}>{t.name}</option>)}
                  </select>
                )}
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>
              每行左边是源文件列名（含样例值），下拉选择要映射到的系统字段
            </div>
            {columns.map(col => {
              const m = mapping[col.name] || { target: '', type: 'string', format: '', default: '' }
              return (
                <div key={col.name} className="mapping-row">
                  <div className="mapping-src">
                    <div>{col.name}</div>
                    <div className="small muted mono" style={{ fontSize: 10 }}>{col.samples?.join(' · ') || '-'}</div>
                  </div>
                  <div className="mapping-arrow">→</div>
                  <div className="mapping-dst">
                    <select value={m.target} onChange={e => updateMapping(col.name, 'target', e.target.value)}>
                      <option value="">— 忽略 —</option>
                      {systemFields.map(f => <option key={f.key} value={f.key}>{f.label} ({f.key})</option>)}
                    </select>
                  </div>
                  <div className="mapping-type">
                    <select value={m.type} onChange={e => updateMapping(col.name, 'type', e.target.value)}>
                      <option value="string">文本</option>
                      <option value="number">数值</option>
                      <option value="date">日期</option>
                    </select>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={reset}
              style={{ padding: '8px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>重新上传</button>
            <button disabled={mappedCount === 0} onClick={handlePreview}
              style={{ padding: '8px 20px', background: mappedCount === 0 ? '#94a3b8' : '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, cursor: mappedCount === 0 ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13 }}>
              {busy === 'preview' ? '预览中...' : `预览清洗结果 (${mappedCount} 字段)`}
            </button>
          </div>
        </div>
      )}

      {step === 2 && preview && (
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="section-title">清洗预览 · 前 {preview.preview?.length || 0} 行 · 共 {preview.total} 行</div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr>
                  {preview.preview?.length > 0 && Object.keys(preview.preview[0]).filter(k => k !== '_source').map(k => (
                    <th key={k} style={{ fontSize: 11 }}>{systemFields.find(f => f.key === k)?.label || k}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {preview.preview?.map((row, i) => (
                    <tr key={i}>
                      {Object.entries(row).filter(([k]) => k !== '_source').map(([k, v]) => (
                        <td key={k} className="small mono">{String(v || '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
            <input placeholder="保存为模板（可选）" value={templateName} onChange={e => setTemplateName(e.target.value)}
              style={{ fontSize: 12, border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', width: 200 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep(1)}
                style={{ padding: '8px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>返回修改</button>
              <button onClick={handleExecute} disabled={busy === 'exec'}
                style={{ padding: '8px 20px', background: busy === 'exec' ? '#94a3b8' : '#059669', color: '#fff', border: 'none', borderRadius: 8, cursor: busy === 'exec' ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13 }}>
                {busy === 'exec' ? '执行中...' : `确认写入 (${preview.total} 条)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && result && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>{result.success > 0 ? '✅' : '⚠️'}</div>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>
            {result.success > 0 ? '清洗完成' : '清洗完成（无新增）'}
          </div>
          <div className="small muted" style={{ marginBottom: 16 }}>
            {result.message || `目标: ${result.target} · 文件: ${result.file}`}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginBottom: 16 }}>
            <div><div style={{ fontSize: 24, fontWeight: 700, color: '#059669' }}>{result.success}</div><div className="small muted">成功</div></div>
            <div><div style={{ fontSize: 24, fontWeight: 700, color: result.failed > 0 ? '#e11d48' : '#94a3b8' }}>{result.failed}</div><div className="small muted">跳过</div></div>
          </div>
          <button onClick={reset}
            style={{ padding: '8px 20px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            继续清洗下一份文件
          </button>
        </div>
      )}
    </div>
  )
}
