import React, { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
export default function InventoryPage({ highlightSku }) {
  const { inventory } = useAppStore()
  useEffect(() => {
    if (highlightSku) setTimeout(() => document.getElementById('hl-' + highlightSku)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200)
  }, [highlightSku])
  return <div className="card">
    <div className="section-title">库存 <span className="small muted">共 {inventory.length} 条</span></div>
    <div style={{overflowX:'auto'}}>
      <table><thead><tr>{['店铺','仓库','SKU','商品','可用','锁定','在途','安全线'].map(h=><th key={h}>{h}</th>)}</tr></thead>
      <tbody>{inventory.map(x => {
        const isHL = highlightSku && x.sku === highlightSku
        return <tr key={x.id} id={'hl-'+x.sku} style={isHL ? {background:'#fef3c7',outline:'2px solid #f59e0b'} : {}}>
        <td>{x.store||'-'}</td><td>{x.warehouse||'-'}</td>
        <td className="mono" style={{fontSize:12}}>{x.sku}</td><td>{x.product_name}</td>
        <td>{x.available_qty}</td><td>{x.locked_qty}</td><td>{x.in_transit_qty}</td><td>{x.safety_qty}</td>
      </tr>})}</tbody></table>
    </div>
  </div>
}
