import React from 'react'
import { useAppStore } from '../store/useAppStore'
export default function InventoryPage() {
  const { inventory } = useAppStore()
  return <div className="card">
    <div className="section-title">库存 <span className="small muted">共 {inventory.length} 条</span></div>
    <div style={{overflowX:'auto'}}>
      <table><thead><tr>{['店铺','仓库','SKU','商品','可用','锁定','在途','安全线'].map(h=><th key={h}>{h}</th>)}</tr></thead>
      <tbody>{inventory.map(x => <tr key={x.id}>
        <td>{x.store||'-'}</td><td>{x.warehouse||'-'}</td>
        <td className="mono" style={{fontSize:12}}>{x.sku}</td><td>{x.product_name}</td>
        <td>{x.available_qty}</td><td>{x.locked_qty}</td><td>{x.in_transit_qty}</td><td>{x.safety_qty}</td>
      </tr>)}</tbody></table>
    </div>
  </div>
}
