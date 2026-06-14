import React from 'react'
import { useAppStore } from '../store/useAppStore'
export default function OrdersPage() {
  const { orders, orderTotal, orderPage, setOrderPage } = useAppStore()
  return <div className="card">
    <div className="section-title" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <span>订单 <span className="small muted">共 {orderTotal} 条</span></span>
      <div style={{display:'flex',gap:6,alignItems:'center'}}>
        <button onClick={()=>setOrderPage(Math.max(1,orderPage-1))} disabled={orderPage<=1} style={{fontSize:11,padding:'4px 10px',border:'1px solid #e2e8f0',borderRadius:6,background:orderPage<=1?'#f1f5f9':'#fff',cursor:orderPage<=1?'not-allowed':'pointer'}}>‹ 上一页</button>
        <span className="small muted" style={{fontSize:12}}>{orderPage}</span>
        <button onClick={()=>setOrderPage(orderPage+1)} style={{fontSize:11,padding:'4px 10px',border:'1px solid #e2e8f0',borderRadius:6,background:'#fff',cursor:'pointer'}}>下一页 ›</button>
      </div>
    </div>
    <div style={{overflowX:'auto'}}>
      <table><thead><tr>{['订单号','店铺','仓库','商品','金额','状态','日期'].map(h=><th key={h}>{h}</th>)}</tr></thead>
      <tbody>
        {orders.map(x => <tr key={x.id}>
          <td className="mono" style={{fontSize:12}}>{x.order_no}</td>
          <td>{x.store||'-'}</td><td>{x.warehouse||'-'}</td><td>{x.product_name}</td>
          <td>¥{Number(x.total_amount).toLocaleString()}</td><td>{x.order_status}</td><td>{x.ordered_at}</td>
        </tr>)}
      </tbody></table>
    </div>
  </div>
}
