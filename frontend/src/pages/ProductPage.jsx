import React, { useEffect, useState } from 'react'
import { api } from '../api/client'

export default function ProductPage() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/products')
      .then(r => { setList(r.data?.items || r.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="card"><div className="muted">加载中...</div></div>

  return (
    <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:16, padding:16 }}>
      <div style={{ fontWeight:600, marginBottom:12 }}>
        商品管理 <span style={{ color:'#94a3b8', fontSize:12, marginLeft:8 }}>共 {list.length} 个</span>
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>
              {['SKU','名称','店铺','分类','单价','状态'].map(h => (
                <th key={h} style={{ textAlign:'left', fontSize:12, color:'#64748b', borderBottom:'1px solid #e5e7eb', padding:'8px 0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign:'center', color:'#94a3b8', padding:20 }}>暂无商品</td></tr>
            ) : list.map(x => (
              <tr key={x.id}>
                <td style={{ padding:'8px 0', fontFamily:'monospace', fontSize:12 }}>{x.sku}</td>
                <td style={{ padding:'8px 0' }}>{x.product_name}</td>
                <td style={{ padding:'8px 0' }}>{x.store}</td>
                <td style={{ padding:'8px 0' }}>{x.category}</td>
                <td style={{ padding:'8px 0' }}>¥{x.price}</td>
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
