import React, { useState } from "react"
import { useAppStore } from "../../store/useAppStore"
import { useToast } from "../../components/Toast"
import { useDebouncedSearch } from "../../hooks/useDebounce"
interface HammerRulesProps { channel: string; onShowHistory?: (ch: string) => void }

export default function HammerRules({ channel, onShowHistory }: HammerRulesProps) {
  const toast = useToast()
  const { hammerRulesTab, setHammerRulesTab, bumpHammerRuleNew, hammerRulesMode, setHammerRulesMode, hammerSearch, setHammerSearch, prodBatch, setProdBatch } = useAppStore()
  const [localSearch, setLocalSearch] = useDebouncedSearch(hammerSearch, setHammerSearch)
  const [searchOpen, setSearchOpen] = useState(false)
  const [batchOpen, setBatchOpen] = useState(false)
  const runBatch = async (action, label) => {
    const s = useAppStore.getState()
    const ids = s.prodSelIds || []
    if (ids.length === 0) { toast.error('请先勾选规则'); return }
    if (action === 'delete' && !window.confirm('删除 ' + ids.length + ' 条规则？可在回收站恢复')) return
    try {
      const API = import.meta.env.VITE_API_BASE_URL || 'https://overtrees.pythonanywhere.com'
      const r = await fetch(API + '/api/rules/batch', {method:'POST', headers:{'Authorization':'Bearer '+(()=>{try{return localStorage.getItem('c_token')}catch{return ''}})(), 'Content-Type':'application/json'}, body: JSON.stringify({action, ids})})
      const d = await r.json()
      if (d.ok) {
        toast.success(label + '完成: ' + ids.length + ' 项')
        s.setProdBatchSel([]); s.setProdBatch(false); s.bumpProdBatchVersion()
      } else toast.error(label + '失败: ' + (d.error || ''))
    } catch(e) { toast.error(label + '失败: ' + (e.message||'')) }
  }

  return (
    <div>
      <div className="hammer-header">{channel === 'jd' ? '京东' : '其他'} · 规则参数</div>
      {/* tab 竖排 */}
      <div className="hm-group">
        {[['rules','📋 规则'],['params','⚙ 补货参数'],['purchase','📦 采购参数'],['slow','🧊 滞销参数']].map(([id,label]) => (
          <span key={id} onClick={() => setHammerRulesTab(id)}
            className={'hm-tab' + (hammerRulesTab === id ? ' active' : '')}>
            {label}
          </span>
        ))}
      </div>
      {/* 规则 tab: 功能按钮竖排 */}
      {hammerRulesTab === 'rules' && <>
        <div className="hm-group">
          <span onClick={() => { setHammerRulesTab('rules'); bumpHammerRuleNew() }} className="hm-btn" style={{color:'var(--primary)',fontWeight:600}}>
            + 新建规则
          </span>
          <span onClick={() => setSearchOpen(!searchOpen)} className="hm-btn">
            🔍 搜索{hammerSearch ? ' ✓' : ''}
          </span>
          <span onClick={() => { onShowHistory && onShowHistory(channel) }} className="hm-btn">
            📋 变更历史
          </span>
          <span onClick={() => setBatchOpen(!batchOpen)} className="hm-btn" style={{color:prodBatch?'var(--danger)':undefined}}>
            ⬚ 批量操作
          </span>
        </div>
        {batchOpen && (
          <div className="hammer-panel">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
              <span className="text-12 muted2">已选 <b style={{color:'var(--text)'}}>{(useAppStore.getState().prodSelIds||[]).length}</b> 项</span>
              {useAppStore.getState().prodBatch ? (
                <button className="hammer-clear" onClick={() => { useAppStore.getState().setProdBatch(false); useAppStore.getState().setProdBatchSel([]) }}>退出批量模式</button>
              ) : (
                <button className="hammer-clear" onClick={() => useAppStore.getState().setProdBatch(true)}>进入批量模式</button>
              )}
            </div>
            <div className="hm-group">
              <span className="hm-btn" onClick={() => { const s = useAppStore.getState(); if (!s.prodBatch) s.setProdBatch(true); s.requestProdBatchAll() }}>全选/取消</span>
            </div>
            <div className="hm-group">
              <span className="hm-btn" style={{color:'var(--success)'}} onClick={() => runBatch('active','启用')}>批量启用</span>
              <span className="hm-btn" style={{color:'var(--warning)'}} onClick={() => runBatch('inactive','停用')}>批量停用</span>
              <span className="hm-btn" style={{color:'var(--danger)'}} onClick={() => runBatch('delete','删除')}>批量删除</span>
            </div>
            <div className="muted2 text-10" style={{marginTop:8}}>勾选规则后在此批量操作（删除可回收站恢复）</div>
          </div>
        )}
        {searchOpen && <div className="hammer-panel">
          <input value={localSearch} onChange={e=>setLocalSearch(e.target.value)}
            placeholder="搜索规则名称..." className="hammer-input" />
          {hammerSearch && <div style={{marginTop:4,textAlign:'right'}}>
            <button className="hammer-clear" onClick={()=>setHammerSearch('')}>清除</button>
          </div>}
        </div>}
      </>}
      {/* 补货参数 tab: 模式切换竖排 */}
      {hammerRulesTab === 'params' && (
        <div className="hm-group" style={{marginTop:8}}>
          {channel === 'jd' && (
            <span onClick={() => setHammerRulesMode('bbcc')}
              className={'hm-tab' + (hammerRulesMode==='bbcc' ? ' active' : '')}>
              BBCC 送仓
            </span>
          )}
          <span onClick={() => setHammerRulesMode('traditional')}
            className={'hm-tab' + (hammerRulesMode==='traditional' ? ' active' : '')}>
            传统多仓
          </span>
        </div>
      )}
    </div>
  )
}

/* 看板页: 锤子菜单 时间维度(今日/本周/本月) */
