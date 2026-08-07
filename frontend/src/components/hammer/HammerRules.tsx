import React, { useState } from "react"
import { useAppStore } from "../../store/useAppStore"
import { useDebouncedSearch } from "../../hooks/useDebounce"
interface HammerRulesProps { channel: string; onShowHistory?: (ch: string) => void }

export default function HammerRules({ channel, onShowHistory }: HammerRulesProps) {
  const { hammerRulesTab, setHammerRulesTab, bumpHammerRuleNew, hammerRulesMode, setHammerRulesMode, hammerSearch, setHammerSearch } = useAppStore()
  const [localSearch, setLocalSearch] = useDebouncedSearch(hammerSearch, setHammerSearch)
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <div>
      <div className="hammer-header">{channel === 'jd' ? '京东' : '其他'} · 规则参数</div>
      {/* tab 入口 */}
      <div className="hammer-segmented" style={{marginBottom:8}}>
        {[['rules','规则'],['params','补货参数'],['purchase','采购参数']].map(([id,label]) => (
          <span key={id} onClick={() => setHammerRulesTab(id)}
            className={'hammer-segment' + (hammerRulesTab === id ? ' active' : '')}>
            {label}
          </span>
        ))}
      </div>
      {/* 规则 tab: 新建 + 搜索 + 变更历史 */}
      {hammerRulesTab === 'rules' && <>
        <div className="hammer-row-3">
          <button onClick={() => { setHammerRulesTab('rules'); bumpHammerRuleNew() }} className="hammer-btn btn-primary"
            style={{display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
            + 新建
          </button>
          <button onClick={() => setSearchOpen(!searchOpen)} className="hammer-btn btn-ghost"
            style={{display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
            搜索{hammerSearch ? ' ✓' : ''}
          </button>
          <button onClick={() => { onShowHistory && onShowHistory(channel) }} className="hammer-btn btn-ghost"
            style={{display:'flex',alignItems:'center',justifyContent:'center',gap:4}}>
            变更历史
          </button>
        </div>
        {searchOpen && <div className="hammer-panel">
          <input value={localSearch} onChange={e=>setLocalSearch(e.target.value)}
            placeholder="搜索规则名称..." className="hammer-input" />
          {hammerSearch && <div style={{marginTop:4,textAlign:'right'}}>
            <button className="hammer-clear" onClick={()=>setHammerSearch('')}>清除</button>
          </div>}
        </div>}
      </>}
      {/* 补货参数 tab: 模式切换 */}
      {hammerRulesTab === 'params' && (
        <div className="hammer-btn-row" style={{marginTop:8}}>
          {channel === 'jd' && (
            <span onClick={() => setHammerRulesMode('bbcc')}
              className={'hammer-tab' + (hammerRulesMode==='bbcc' ? ' active' : '')}>
              BBCC 送仓
            </span>
          )}
          <span onClick={() => setHammerRulesMode('traditional')}
            className={'hammer-tab' + (hammerRulesMode==='traditional' ? ' active' : '')}>
            传统多仓
          </span>
        </div>
      )}

      </div>
  )
}

/* 看板页: 锤子菜单 时间维度(今日/本周/本月) */
