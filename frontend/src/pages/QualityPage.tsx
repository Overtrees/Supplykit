import React from 'react'
import { useAppStore } from '../store/useAppStore'

const TYPE_LABEL = {
  duplicate_order: '重复订单',
  duplicate_sku: '重复SKU',
  format_error: '格式错误',
  field_warning: '字段警告',
  field_error: '字段异常',
  mapping_info: '映射提示',
}
const LEVEL_LABEL = { warning: '警告', error: '严重', info: '提示' }

export default function QualityPage() {
  const { qualityLogs } = useAppStore()
  return <div className="card">
    <div className="section-title">数据异常</div>
    {qualityLogs.length === 0 ? <div className="small muted" style={{padding:24,textAlign:'center'}}>暂无异常</div>
    : <div style={{overflowX:"auto"}}>
      <div style={{fontSize:11,color:'var(--muted2)',marginBottom:4}}>共 {qualityLogs.length} 条</div>
      <table style={{minWidth:400}}><thead><tr>{['问题','详情','级别','时间'].map(h=><th key={h} style={{padding:'6px 8px'}}>{h}</th>)}</tr></thead>
      <tbody>{qualityLogs.map(x=><tr key={x.id}>
        <td style={{whiteSpace:'nowrap',padding:'6px 8px'}}>{TYPE_LABEL[x.log_type||x.issue_type] || x.log_type||x.issue_type}</td>
        <td style={{maxWidth:260,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',padding:'6px 8px'}} title={x.message||x.issue_message}>{x.message||x.issue_message}</td>
        <td style={{padding:'6px 8px'}}><span className={'pill '+(x.level==='error'||x.severity==='error'?'danger':x.level==='warning'||x.severity==='warning'?'warning':'info')}>{LEVEL_LABEL[x.level||x.severity] || x.level||x.severity}</span></td>
        <td className="small mono" style={{whiteSpace:'nowrap',padding:'6px 8px'}}>{(x.created_at||'').slice(5,16) || '-'}</td>
      </tr>)}</tbody></table>
    </div>}
  </div>
}
