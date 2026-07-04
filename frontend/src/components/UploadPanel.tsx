import React, { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { api } from '../api/client'
import { useToast } from './Toast'
export default function UploadPanel({ onImport }) {
  const [busy, setBusy] = useState('')
  const { importLogs, loadAll, addImportLog } = useAppStore()
  const toast = useToast()
const submit = async (type, file) => {
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    setBusy(type)
    try {
      const url = type === 'orders' ? '/api/orders/import' : '/api/inventory/import'
      const res = await api.post(url, form)
      const data = res.data
      if (!data.ok) { toast.error(data.error || '导入失败' + (data.diagnose ? ` (${data.diagnose.bytes}字节, 列:${data.diagnose.sample_columns})` : '')); return }
      addImportLog({ type: type === 'orders' ? 'orders.imported' : 'inventory.imported', payload: data, file: file.name })
      const detail = data.total_rows ? ` (共${data.total_rows}行, 新增${data.imported}条, 重复${data.duplicates||0}条, 跳过${data.skipped||0}行)` : ''
      toast.success(`导入完成: 新增 ${data.imported} 条${detail}`)
      await loadAll()
    } catch(e) {
      toast.error('导入异常: ' + (e.response?.data?.detail || e.message || '请求失败'))
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
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[...importLogs].reverse().map((x, idx) => {
              const p = x.payload || x
              const name = p?.from_file || x.file || '—'
              const imp = p?.imported ?? 0
              const dup = p?.duplicates ?? 0
              const skp = p?.skipped ?? 0
              const tot = p?.total_rows ?? 0
              const cols = p?.columns_mapped
              const extras = p?.columns_rawdata
              return (
              <div key={idx} style={{ fontSize:13, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:12, padding:'10px 14px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <span style={{ fontWeight:600, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'60%' }} title={name}>{name}</span>
                  <span style={{ fontSize:11, color: imp > 0 ? 'var(--success)' : 'var(--muted)' }}>
                    +{imp}{dup > 0 ? ` · ${dup}重复` : ''}{skp > 0 ? ` · ${skp}跳过` : ''}
                  </span>
                </div>
                {tot > 0 && <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:4 }}>
                  <span className="small muted">共{tot}行</span>
                  {cols?.length > 0 && <span className="small muted" style={{ color:'var(--info)' }}>映射{cols.length}列</span>}
                  {extras?.length > 0 && <span className="small muted" style={{ color:'var(--muted2)' }}>原始{extras.length}列</span>}
                </div>}
                {cols?.length > 0 && <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                  {cols.map(c => <span key={c} style={{ fontSize:10, padding:'1px 6px', borderRadius:4, background:'rgba(29,78,216,0.08)', color:'var(--primary)', whiteSpace:'nowrap' }}>{c}</span>)}
                </div>}
              </div>
            )})}
          </div>
        )}
      </div>
    </div>
  )
}
