import React from "react"
import { useAppStore } from "../../store/useAppStore"
interface HammerCleansingProps { channel: string }

export default function HammerCleansing({ channel }: HammerCleansingProps) {
  const { hammerPanel, setHammerPanel, hammerCleansingChannel, setHammerCleansingChannel } = useAppStore()
  return (
    <div>
      <div className="hammer-header">{channel === 'jd' ? '京东' : '其他'} · 清洗导入</div>
      <div className="hammer-btn-row">
        {[['jd','京东'],['other','其他渠道']].map(([id,label]) => (
          <span key={id} onClick={() => setHammerCleansingChannel(id)}
            className={'hammer-tab' + (hammerCleansingChannel === id ? ' active' : '')}>
            {label}
          </span>
        ))}
      </div>
      <div className="hammer-panel">
        <div style={{fontSize:10,color:'var(--muted2)',textAlign:'center'}}>导入时按此渠道标注数据</div>
      </div>
    </div>
  )
}

/* 规则页: 锤子菜单 tab入口 + 新建 + 模式切换 + 变更历史 */
