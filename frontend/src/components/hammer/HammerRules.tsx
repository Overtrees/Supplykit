import React, { useState } from "react"
import { useAppStore } from "../../store/useAppStore"
export default function HammerRules({ channel, onShowHistory }) {
  const { hammerRulesTab, setHammerRulesTab, bumpHammerRuleNew, hammerRulesMode, setHammerRulesMode } = useAppStore()

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
      {/* 规则 tab: 新建 + 变更历史 */}
      {hammerRulesTab === 'rules' && <>
        <button onClick={() => { setHammerRulesTab('rules'); bumpHammerRuleNew() }} className="btn btn-primary"
          style={{width:'100%',marginTop:8,fontSize:12,minHeight:34,padding:'4px 8px',display:'flex',alignItems:'center',justifyContent:'center',gap:4,boxSizing:'border-box'}}>
          + 新建规则
        </button>
        <button onClick={() => { onShowHistory && onShowHistory(channel) }} className="btn btn-ghost"
          style={{width:'100%',marginTop:6,fontSize:12,minHeight:34,padding:'4px 8px',display:'flex',alignItems:'center',justifyContent:'center',gap:4,boxSizing:'border-box'}}>
          变更历史
        </button>
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
