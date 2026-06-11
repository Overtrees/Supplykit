import React, { useEffect, useState } from 'react'
import { api } from '../api/client'

export default function SupplierPage() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/suppliers')
      .then(r => { setList(r.data?.items || r.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const scoreClass = score => {
    if (score >= 80) return { bg: '#ecfdf5', color: '#059669' }
    if (score >= 60) return { bg: '#fffbeb', color: '#b45309' }
    return { bg: '#fff1f2', color: '#e11d48' }
  }

  if (loading) return <div className="card"><div className="muted">加载中...</div></div>

  return (
    <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:16, padding:16 }}>
      <div style={{ fontWeight:600, marginBottom:12 }}>
        供应商管理 <span style={{ color:'#94a3b8', fontSize:12, marginLeft:8 }}>共 {list.length} 个</span>
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>
              {['编码','名称','联系人','电话','评分','状态'].map(h => (
                <th key={h} style={{ textAlign:'left', fontSize:12, color:'#64748b', borderBottom:'1px solid #e5e7eb', padding:'8px 0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign:'center', color:'#94a3b8', padding:20 }}>暂无供应商</td></tr>
            ) : list.map(x => (
              <tr key={x.id}>
                <td style={{ padding:'8px 0', fontFamily:'monospace', fontSize:12 }}>{x.supplier_code}</td>
                <td style={{ padding:'8px 0' }}>{x.supplier_name}</td>
                <td style={{ padding:'8px 0' }}>{x.contact_person}</td>
                <td style={{ padding:'8px 0' }}>{x.contact_phone || '-'}</td>
                <td style={{ padding:'8px 0' }}>
                  <span style={{
                    display:'inline-block', padding:'2px 8px', borderRadius:99, fontSize:12, fontWeight:600,
                    ...scoreClass(x.score)
                  }}>{x.score}</span>
                </td>
                <td style={{ padding:'8px 0' }}>
                  <span style={{
                    display:'inline-block', padding:'2px 8px', borderRadius:99, fontSize:12, fontWeight:600,
                    background: x.status === 'active' ? '#ecfdf5' : '#fffbeb',
                    color: x.status === 'active' ? '#059669' : '#b45309'
                  }}>{x.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
