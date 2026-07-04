import React, { useState, useMemo, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import EmptyState from '../components/EmptyState'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'
const API = import.meta.env.VITE_API_BASE_URL || 'https://overtrees.pythonanywhere.com'
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
      const r = await fetch(`${API}/api/inventory/${confirmDel}`, {method:'DELETE'})
      if (r.ok) { toast.success('已删除'); setConfirmDel(null); loadAll() }
      else toast.error('删除失败')
    } catch(e) { toast.error('删除失败: '+e.message) }
    setConfirmDel(null)
  }
  return <div className="card">
    <div className="section-title" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <span>库存 <span className="small muted">共 {inventory.length} 条</span></span>
      <div className="search-bar" style={{maxWidth:240,flex:'none'}}>
        <span style={{fontSize:16,color:'var(--muted2)',flexShrink:0}}>🔍</span>
        <input value={s} onChange={e=>setS(e.target.value)} placeholder="搜索SKU/商品名" enterKeyHint="search" autoCorrect="off" />
      </div>
    </div>
    {fl.length === 0
      ? <EmptyState icon='📦' title={s?'无匹配库存':'暂无库存数据'} desc={s?'换个关键词试试':'通过清洗导入或手动添加库存'} />
      : <div style={{overflowX:"auto"}}>
        <div style={{fontSize:11,color:'var(--muted2)',marginBottom:4}}>共 9 列 · 左右滑动查看</div>
      <table style={{minWidth:640}}><thead><tr>{['店铺','仓库','SKU','商品','可用','锁定','在途','安全线','安全天数',''].map(h=><th key={h} style={{whiteSpace:'nowrap',padding:'8px 6px'}}>{h}</th>)}</tr></thead>
      <tbody>{fl.map(x => {
        const isHL = highlightSku && x.sku === highlightSku
        return <tr key={x.id} id={'hl-'+x.sku} style={isHL ? {background:'rgba(245,158,11,0.15)',outline:'2px solid #f59e0b'} : {}}>
        <td className="col-store" style={{minWidth:64}}>{x.store||'-'}</td><td className="col-store" style={{minWidth:64}}>{x.warehouse||'-'}</td>
        <td className="mono col-sku" style={{minWidth:80}}>{x.sku}</td><td className="col-name" style={{minWidth:100}}>{x.product_name}</td>
        <td className="col-qty" style={{minWidth:44}}>{x.available_qty}</td><td className="col-qty" style={{minWidth:44}}>{x.locked_qty}</td><td className="col-qty" style={{minWidth:44}}>{x.in_transit_qty}</td><td className="col-qty" style={{minWidth:44}}>{x.safety_qty}</td>
        <td className="col-qty"><input type='number' min='0' max='30' step='1'
          value={x.safety_days || ''} placeholder='全局' onChange={e=>{const v=parseFloat(e.target.value)||0;fetch(API+'/api/inventory/'+x.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({safety_days:v})})}}
          style={{width:48,fontSize:11,textAlign:'center',padding:'2px',border:'1px solid #e2e8f0',borderRadius:4,outline:'none'}} /></td>
        <td><span onClick={()=>setConfirmDel(x.id)} style={{cursor:'pointer',fontSize:18,opacity:0.4,padding:'8px'}} title='删除'>🗑️</span></td>
      </tr>})}</tbody></table>
    </div>}
    <ConfirmDialog open={!!confirmDel} title='删除库存记录' desc='删除后不可恢复' confirmLabel='删除' onConfirm={delInv} onCancel={()=>setConfirmDel(null)} />
  </div>
}
