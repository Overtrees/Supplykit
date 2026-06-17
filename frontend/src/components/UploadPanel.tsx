import React, { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { api } from '../api/client'
export default function UploadPanel({ onImport }) {
  const [busy, setBusy] = useState('')
  const { importLogs, loadAll, addImportLog } = useAppStore()
const submit = async (type, file) => {
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    setBusy(type)
    try {
      const url = type === 'orders' ? '/api/orders/import' : '/api/inventory/import'
      const res = await api.post(url, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      addImportLog({ type: type === 'orders' ? 'orders.imported' : 'inventory.imported', payload: res.data, file: file.name })
      await loadAll()
    } finally { setBusy('') }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <label style={{ background:'var(--card)', border:'1px dashed #cbd5e1', borderRadius:16, padding:20, cursor:'pointer', textAlign:'center', transition:'border 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.borderColor='#1d4ed8'} onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
          <div style={{ fontSize:18, marginBottom:6, opacity:0.4 }}>📄</div>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>导入订单</div>
          <div style={{ fontSize:12, color:'var(--muted)' }}>{busy === 'orders' ? '上传中...' : 'CSV / XLSX · 中文列名自动映射'}</div>
          <input type="file" accept=".csv,.xlsx" style={{ display:'none' }} onChange={e => submit('orders', e.target.files?.[0])} />
        </label>
        <label style={{ background:'var(--card)', border:'1px dashed #cbd5e1', borderRadius:16, padding:20, cursor:'pointer', textAlign:'center', transition:'border 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.borderColor='#1d4ed8'} onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
          <div style={{ fontSize:18, marginBottom:6, opacity:0.4 }}>📦</div>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>导入库存</div>
          <div style={{ fontSize:12, color:'var(--muted)' }}>{busy === 'inventory' ? '上传中...' : '导入后自动重建低库存告警'}</div>
          <input type="file" accept=".csv,.xlsx" style={{ display:'none' }} onChange={e => submit('inventory', e.target.files?.[0])} />
        </label>
      </div>
      <div style={{ background:'var(--card)', borderRadius:16, border:'1px solid #f1f5f9', padding:16 }}>
        <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--muted2)', marginBottom:12 }}>导入日志</div>
        {importLogs.length === 0 ? (
          <div style={{ color:'var(--muted2)', fontSize:13, textAlign:'center' }}>暂无导入记录</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {importLogs.map((x, idx) => (
              <div key={idx} style={{ fontSize:12, background:'var(--bg)', border:'1px solid #f1f5f9', borderRadius:10, padding:'8px 12px' }}>
                <div style={{ fontWeight:600, marginBottom:2 }}>{x.type || 'manual.import'}</div>
                <div style={{ color:'var(--muted)', fontSize:11 }}>{JSON.stringify(x.payload || x)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 侧边栏 ──────────────────────────────────────────────────────────────────
