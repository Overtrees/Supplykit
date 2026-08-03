import React, { useState } from "react"
import { useAppStore } from "../../store/useAppStore"
export default function HammerRules({ channel, onShowHistory }) {
  const { hammerRulesTab, setHammerRulesTab, bumpHammerRuleNew, hammerRulesMode, setHammerRulesMode, hammerSearch, setHammerSearch } = useAppStore()
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <div>
      <div style={{fontSize:11,color:'var(--muted2)',marginBottom:8,textAlign:'center'}}>
        {channel === 'jd' ? '京东' : '其他'} · 规则参数
      </div>
      {/* tab 入口 */}
      <div style={{display:'flex',gap:4}}>
        {[['rules','规则'],['params','补货参数'],['purchase','采购参数']].map(([id,label]) => (
          <span key={id} onClick={() => setHammerRulesTab(id)}
            style={{flex:1,fontSize:12,minHeight:32,padding:'4px 6px',borderRadius:99,cursor:'pointer',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',boxSizing:'border-box',
              background: hammerRulesTab === id ? 'var(--primary)' : 'var(--gray)',
              color: hammerRulesTab === id ? '#fff' : 'var(--text)',fontWeight: hammerRulesTab === id ? 600 : 400}}>
            {label}
          </span>
        ))}
      </div>
      {/* 规则 tab: 新建 + 搜索 + 变更历史 */}
      {hammerRulesTab === 'rules' && <>
        <div style={{display:'flex',gap:4,marginTop:8}}>
          <button onClick={() => { setHammerRulesTab('rules'); bumpHammerRuleNew() }} className="btn btn-primary"
            style={{flex:1,fontSize:12,minHeight:34,padding:'4px 8px',display:'flex',alignItems:'center',justifyContent:'center',gap:4,boxSizing:'border-box'}}>
            + 新建
          </button>
          <button onClick={() => setSearchOpen(!searchOpen)} className="btn btn-ghost"
            style={{flex:1,fontSize:12,minHeight:34,padding:'4px 8px',display:'flex',alignItems:'center',justifyContent:'center',gap:4,boxSizing:'border-box'}}>
            搜索{hammerSearch ? ' ✓' : ''}
          </button>
          <button onClick={() => { onShowHistory && onShowHistory(channel) }} className="btn btn-ghost"
            style={{flex:1,fontSize:12,minHeight:34,padding:'4px 8px',display:'flex',alignItems:'center',justifyContent:'center',gap:4,boxSizing:'border-box'}}>
            变更历史
          </button>
        </div>
        {searchOpen && <div style={{borderTop:'1px solid var(--border)',paddingTop:8,marginTop:8}}>
          <input value={hammerSearch} onChange={e=>setHammerSearch(e.target.value)}
            placeholder="搜索规则名称..."
            style={{width:'100%',padding:'6px 10px',fontSize:16,border:'1px solid var(--border)',borderRadius:32,outline:'none',boxSizing:'border-box',background:'var(--card)',color:'var(--text)'}} />
          {hammerSearch && <div style={{marginTop:4,textAlign:'right'}}>
            <span className="clickable btn btn-ghost" onClick={()=>setHammerSearch('')} style={{fontSize:10,padding:'2px 8px',cursor:'pointer'}}>清除</span>
          </div>}
        </div>}
      </>}
      {/* 补货参数 tab: 模式切换 */}
      {hammerRulesTab === 'params' && (
        <div style={{display:'flex',gap:4,marginTop:8}}>
          {channel === 'jd' && (
            <span onClick={() => setHammerRulesMode('bbcc')}
              style={{flex:1,fontSize:12,minHeight:32,padding:'4px 6px',borderRadius:99,cursor:'pointer',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',boxSizing:'border-box',
                background: hammerRulesMode==='bbcc'?'var(--primary)':'var(--gray)',color: hammerRulesMode==='bbcc'?'#fff':'var(--text)',fontWeight: hammerRulesMode==='bbcc'?600:400}}>
              BBCC 送仓
            </span>
          )}
          <span onClick={() => setHammerRulesMode('traditional')}
            style={{flex:1,fontSize:12,minHeight:32,padding:'4px 6px',borderRadius:99,cursor:'pointer',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',boxSizing:'border-box',
              background: hammerRulesMode==='traditional'?'var(--primary)':'var(--gray)',color: hammerRulesMode==='traditional'?'#fff':'var(--text)',fontWeight: hammerRulesMode==='traditional'?600:400}}>
            传统多仓
          </span>
        </div>
      )}

      </div>
  )
}

/* 看板页: 锤子菜单 时间维度(今日/本周/本月) */
