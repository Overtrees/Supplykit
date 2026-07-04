import React from 'react'
import { useAppStore } from '../store/useAppStore'
export default function QualityPage() {
  const { qualityLogs } = useAppStore()
  return <div className="card">
    <div className="section-title">数据质量日志</div>
    {qualityLogs.length === 0 ? <div className="small muted">暂无异常</div>
    : <div style={{overflowX:"auto"}}>
      <div style={{fontSize:11,color:'var(--muted2)',marginBottom:4}}>共 5 列 · 左右滑动查看</div>
      <table><thead><tr>{['类型','字段','消息','级别','时间'].map(h=><th key={h}>{h}</th>)}</tr></thead>
      <tbody>{qualityLogs.map(x=><tr key={x.id}>
        <td>{x.log_type||x.issue_type}</td><td>{x.field_name||'-'}</td><td>{x.message||x.issue_message}</td>
        <td><span className={'pill '+(x.level==='error'?'danger':x.level==='warning'?'warning':'info')}>{x.level||x.severity}</span></td>
        <td className="small mono">{x.created_at||'-'}</td>
      </tr>)}</tbody></table>
    </div>}
  </div>
}
