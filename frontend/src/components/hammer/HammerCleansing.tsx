import React from "react"
import { useAppStore } from "../../store/useAppStore"
interface HammerCleansingProps { channel: string }

export default function HammerCleansing({ channel }: HammerCleansingProps) {
  const { hammerPanel, setHammerPanel, hammerCleansingChannel, setHammerCleansingChannel } = useAppStore()
  const target = hammerCleansingChannel === 'jd' ? '京东' : '其他渠道'
  const sameAsGlobal = hammerCleansingChannel === channel
  return (
    <div>
      <div className="hammer-header">清洗导入 · 数据归入：<b>{target}</b></div>
      <div className="hammer-segmented">
        {[['jd','京东'],['other','其他渠道']].map(([id,label]) => (
          <span key={id} onClick={() => setHammerCleansingChannel(id)}
            className={'hammer-segment' + (hammerCleansingChannel === id ? ' active' : '')}>
            {label}
          </span>
        ))}
      </div>
      <div className="hammer-panel">
        <div style={{fontSize:10,color:'var(--muted2)',textAlign:'center',marginBottom:4}}>导入的数据将归入「{target}」渠道</div>
        {!sameAsGlobal && (
          <div style={{fontSize:10,color:'var(--warning)',textAlign:'center',background:'rgba(245,158,11,0.1)',borderRadius:32,padding:'4px 8px'}}>
            ⚠️ 当前全局主体是「{channel === 'jd' ? '京东' : '其他渠道'}」，导入后请切换主体查看该数据
          </div>
        )}
      </div>
    </div>
  )
}

/* 规则页: 锤子菜单 tab入口 + 新建 + 模式切换 + 变更历史 */
