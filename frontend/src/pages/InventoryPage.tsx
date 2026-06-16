import React, { useState, useMemo, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import EmptyState from '../components/EmptyState'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'
export default function InventoryPage({ highlightSku }) {
  const toast = useToast()
  const { inventory, loadAll } = useAppStore()
  const [s, setS] = useState('')
  const [confirmDel, setConfirmDel] = useState(null)
  const fl = useMemo(() => {
    if (!s) return inventory
    const q = s.toLowerCase()
    return inventory.filter(x => (x.sku||'').toLowerCase().includes(q) || (x.product_name||'').toLowerCase().includes(q) || (x.store||'').toLowerCase().includes(q))
  }, [inventory, s])
  useEffect(() => {
    if (highlightSku) setTimeout(() => document.getElementById('hl-' + highlightSku)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200)
  }, [highlightSku])
  const delInv = async () => {
    if (!confirmDel) return
    try {
      const r = await fetch(`https://overtrees.pythonanywhere.com/api/inventory/${confirmDel}`, {method:'DELETE'})
      if (r.ok) { toast.success('已删除'); setConfirmDel(null); loadAll() }
      else toast.error('删除失败')
    } catch(e) { toast.error('删除失败: '+e.message) }
    setConfirmDel(null)
  }
  return <div className="card">
    <div className="section-title" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <span>库存 <span className="small muted">共 {inventory.length} 条</span></span>
      <input value={s} onChange={e=>setS(e.target.value)} placeholder='搜索SKU/商品名...' style={{width:200,fontSize:12,padding:'6px 10px',border:'1px solid var(--border)',borderRadius:8,outline:'none'}} />
    </div>
    {fl.length === 0
      ? <EmptyState icon='📦' title={s?'无匹配库存':'暂无库存数据'} desc={s?'换个关键词试试':'通过清洗导入或手动添加库存'} />
      : <div style={{overflowX:'auto'}}>
      <table><thead><tr>{['店铺','仓库','SKU','商品','可用','锁定','在途','安全线',''].map(h=><th key={h}>{h}</th>)}</tr></thead>
      <tbody>{fl.map(x => {
        const isHL = highlightSku && x.sku === highlightSku
        return <tr key={x.id} id={'hl-'+x.sku} style={isHL ? {background:'#fef3c7',outline:'2px solid #f59e0b'} : {}}>
        <td className="col-store">{x.store||'-'}</td><td className="col-store">{x.warehouse||'-'}</td>
        <td className="mono col-sku">{x.sku}</td><td className="col-name">{x.product_name}</td>
        <td className="col-qty">{x.available_qty}</td><td className="col-qty">{x.locked_qty}</td><td className="col-qty">{x.in_transit_qty}</td><td className="col-qty">{x.safety_qty}</td>
        <td><span onClick={()=>setConfirmDel(x.id)} style={{cursor:'pointer',fontSize:18,opacity:0.4,padding:'8px'}} title='删除'>🗑️</span></td>
      </tr>})}</tbody></table>
    </div>}
    <ConfirmDialog open={!!confirmDel} title='删除库存记录' desc='删除后不可恢复' confirmLabel='删除' onConfirm={delInv} onCancel={()=>setConfirmDel(null)} />
  </div>
}
