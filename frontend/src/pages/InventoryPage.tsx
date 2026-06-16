import React, { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import EmptyState from '../components/EmptyState'
export default function InventoryPage({ highlightSku }) {
  const { inventory } = useAppStore()
  useEffect(() => {
    if (highlightSku) setTimeout(() => document.getElementById('hl-' + highlightSku)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200)
  }, [highlightSku])
  return <div className="card">
    <div className="section-title">库存 <span className="small muted">共 {inventory.length} 条</span></div>
    {inventory.length === 0
      ? <EmptyState icon='📦' title='暂无库存数据' desc='通过清洗导入或手动添加库存' />
      : <div style={{overflowX:'auto'}}>
      <table><thead><tr>{['店铺','仓库','SKU','商品','可用','锁定','在途','安全线'].map(h=><th key={h}>{h}</th>)}</tr></thead>
      <tbody>{inventory.map(x => {
        const isHL = highlightSku && x.sku === highlightSku
        return <tr key={x.id} id={'hl-'+x.sku} style={isHL ? {background:'#fef3c7',outline:'2px solid #f59e0b'} : {}}>
        <td className="col-store">{x.store||'-'}</td><td className="col-store">{x.warehouse||'-'}</td>
        <td className="mono col-sku">{x.sku}</td><td className="col-name">{x.product_name}</td>
        <td className="col-qty">{x.available_qty}</td><td className="col-qty">{x.locked_qty}</td><td className="col-qty">{x.in_transit_qty}</td><td className="col-qty">{x.safety_qty}</td>
      </tr>})}</tbody></table>
    </div>}
  </div>
}
