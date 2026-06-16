import React from 'react'
import { useAppStore } from '../store/useAppStore'
import EmptyState from '../components/EmptyState'
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
    {orders.length === 0
      ? <EmptyState icon='📋' title='暂无订单' desc='通过清洗导入或手动创建订单' />
      : <div style={{overflowX:'auto'}}>
      <table><thead><tr>{['订单号','店铺','仓库','商品','金额','状态','日期'].map(h=><th key={h}>{h}</th>)}</tr></thead>
      <tbody>
        {orders.map(x => <tr key={x.id}>
          <td className="mono col-sku">{x.order_no}</td>
          <td className="col-store">{x.store||'-'}</td><td className="col-store">{x.warehouse||'-'}</td><td className="col-name">{x.product_name}</td>
          <td className="col-price">¥{Number(x.total_amount).toLocaleString()}</td><td>{x.order_status}</td><td className="col-date">{x.ordered_at}</td>
        </tr>)}
      </tbody></table>
    </div>}
  </div>
}
