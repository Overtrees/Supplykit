import React from 'react'
import { useAppStore } from '../store/useAppStore'
import { t } from "../locale"

const TYPE_LABEL = {
  duplicate_order: '重复订单号',
  duplicate_sku: '重复SKU',
  format_error: '格式错误',
  field_warning: '字段警告',
  field_error: '字段错误',
  mapping_info: '映射信息',
}
const LEVEL_LABEL = { warning: '警告', error: '异常', info: '提示' }

export default function QualityPage() {
  const { qualityLogs, channelVersion, loading } = useAppStore()
  if (loading) return <div className="card"><div className="section-title">{t("nav.quality")}</div><div>{[1,2,3].map(i => <div key={i} className="skeleton" style={{height:36,marginBottom:4}} />)}</div></div>
  if (qualityLogs.length === 0) return <div className="card" key={channelVersion}><div className="section-title">{t("nav.quality")}</div><div className="small muted" style={{padding:24,textAlign:'center'}}>{t("quality.empty")}</div></div>

  const groups = {}
  for (const x of qualityLogs) {
    const day = (x.created_at || '').slice(0,10) || '未知日期'
    if (!groups[day]) groups[day] = []
    groups[day].push(x)
  }

  const days = Object.entries(groups).reverse()
  const rows = []
  for (const [day, items] of days) {
    rows.push(
      <div key={day} style={{marginBottom:12}}>
        <div style={{fontSize:11,fontWeight:600,color:'var(--muted2)',marginBottom:4}}>{day} · {items.length} 条</div>
        <div style={{overflowY:'auto',overflowX:'hidden',maxHeight:'calc(100vh - 180px)'}}>
        <table style={{minWidth:400}}><tbody>
          {items.map(x => (
            <tr key={x.id}>
              <td style={{whiteSpace:'nowrap',padding:'5px 6px',width:72,fontSize:12}}>{TYPE_LABEL[x.log_type||x.issue_type] || x.log_type||x.issue_type}</td>
              <td style={{maxWidth:240,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',padding:'5px 6px',fontSize:12}} title={x.message||x.issue_message}>{x.message||x.issue_message}</td>
              <td style={{padding:'5px 6px',width:44}}><span className={'pill '+(x.level==='error'||x.severity==='error'?'danger':x.level==='warning'||x.severity==='warning'?'warning':'info')} style={{fontSize:10}}>{LEVEL_LABEL[x.level||x.severity] || x.level||x.severity}</span></td>
              <td className="mono" style={{fontSize:11,padding:'5px 6px',width:64,color:'var(--muted2)'}}>{(x.created_at||'').slice(11,16) || '-'}</td>
            </tr>
          ))}
        </tbody></table></div>
      </div>
    )
  }

  return <div className="card">
    <div className="section-title">操作异常记录</div>
    {rows}
  </div>
}