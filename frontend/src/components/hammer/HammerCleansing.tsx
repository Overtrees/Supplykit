import React from "react"
import { useAppStore } from "../../store/useAppStore"
interface HammerCleansingProps { channel: string }

export default function HammerCleansing({ channel }: HammerCleansingProps) {
  const { hammerPanel, setHammerPanel, hammerCleansingChannel, setHammerCleansingChannel } = useAppStore()
  return (
    <div>
      <div style={{fontSize:11,color:'var(--muted2)',marginBottom:8,textAlign:'center'}}>
        {channel === 'jd' ? '京东' : '其他'} · 清洗导入
      </div>
      <div className="flex gap-4">
        {[['jd','京东'],['other','其他渠道']].map(([id,label]) => (
          <span key={id} onClick={() => setHammerCleansingChannel(id)}
            style={{flex:1,fontSize:12,minHeight:32,padding:'4px 8px',borderRadius:99,cursor:'pointer',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',boxSizing:'border-box',
              background: hammerCleansingChannel === id ? 'var(--primary)' : 'var(--gray)',
              color: hammerCleansingChannel === id ? '#fff' : 'var(--text)',fontWeight: hammerCleansingChannel === id ? 600 : 400}}>
            {label}
          </span>
        ))}
      </div>
      <div style={{marginTop:8,borderTop:'1px solid var(--border)',paddingTop:8}}>
        <div style={{fontSize:10,color:'var(--muted2)',textAlign:'center'}}>导入时按此渠道标注数据</div>
      </div>
    </div>
  )
}

/* 规则页: 锤子菜单 tab入口 + 新建 + 模式切换 + 变更历史 */
