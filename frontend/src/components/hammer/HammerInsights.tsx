import React, { useState, useEffect } from "react"
import { t } from "../../locale"
import { useAppStore } from "../../store/useAppStore"
import { useToast } from "../../components/Toast"
import { INS_BBCC_COLS, INS_TRAD_COLS, INS_PURCHASE_COLS, INS_SLOW_COLS, insColKey, getInsVis, insDefVis, insDefVisTrad } from "./configs"
import { IconExport } from "../Icons"
interface HammerInsightsProps { channel: string }

export default function HammerInsights({ channel }: HammerInsightsProps) {
  const { hammerPanel, setHammerPanel, setHammerCols, hammerInsightsTab, setHammerInsightsTab, hammerReplenMode, setHammerReplenMode, hammerData, setHammerData } = useAppStore()
  const mode = (channel !== 'jd' && hammerReplenMode === 'bbcc') ? 'traditional' : hammerReplenMode
  const isPurchase = hammerInsightsTab === 'purchase'
  const isSlow = hammerInsightsTab === 'slow'
  const cols = isSlow ? INS_SLOW_COLS : (isPurchase ? INS_PURCHASE_COLS : (mode === 'bbcc' ? INS_BBCC_COLS : INS_TRAD_COLS))
  const [visCols, setVisCols] = useState(() => {
    if (isSlow) return INS_SLOW_COLS.map(c => c.id)
    if (isPurchase) return INS_PURCHASE_COLS.map(c => c.id)
    return getInsVis(mode) || (mode==='bbcc'?insDefVis(INS_BBCC_COLS):insDefVisTrad(INS_TRAD_COLS))
  })
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (isSlow) {
      const saved = JSON.parse(localStorage.getItem('c_cols_' + channel + '_slow') || 'null')
      const cols = saved || INS_SLOW_COLS.map(c => c.id)
      setVisCols(cols); setHammerCols('insights_' + channel + '_slow', cols)
    } else if (isPurchase) {
      const saved = JSON.parse(localStorage.getItem('c_cols_' + channel + '_purchase') || 'null')
      const cols = saved || INS_PURCHASE_COLS.map(c => c.id)
      setVisCols(cols); setHammerCols('insights_' + channel + '_purchase', cols)
    } else {
      const saved = getInsVis(mode) || (mode==='bbcc'?insDefVis(INS_BBCC_COLS):insDefVisTrad(INS_TRAD_COLS))
      setVisCols(saved); setHammerCols('insights_' + mode, saved)
    }
  }, [mode, hammerInsightsTab, channel])

  const saveCols = (c) => {
    setVisCols(c)
    if (isSlow) {
      localStorage.setItem('c_cols_' + channel + '_slow', JSON.stringify(c))
      setHammerCols('insights_' + channel + '_slow', c)
    } else if (isPurchase) {
      localStorage.setItem('c_cols_' + channel + '_purchase', JSON.stringify(c))
      setHammerCols('insights_' + channel + '_purchase', c)
    } else {
      localStorage.setItem(insColKey(mode), JSON.stringify(c))
      setHammerCols('insights_' + mode, c)
    }
  }

  const doExport = async (type) => {
    setExporting(true)
    try {
      const API = import.meta.env.VITE_API_BASE_URL || 'https://overtrees.pythonanywhere.com'
      let url = ''
      let filename = ''
      if (type === 'slow') {
        url = API + '/api/insights/export-slow-moving?channel=' + channel
        filename = '滞销预警_'
      } else if (type === 'purchase') {
        url = API + '/api/insights/export-purchase-suggestions?days=28&channel=' + channel
        filename = '采购建议_'
      } else {
        url = API + '/api/insights/export-purchase?days=28&mode=' + mode + '&channel=' + channel
        filename = '补货建议_' + (mode === 'bbcc' ? 'BBCC_' : '传统_')
      }
      const r = await fetch(url)
      if (!r.ok) throw new Error('HTTP ' + r.status)
      const blob = await r.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = filename + new Date().toISOString().slice(0,10).replace(/-/g,'') + '.xlsx'
      document.body.appendChild(a); a.click(); a.remove()
      toast.success('导出完成')
    } catch(e) { toast.error('导出失败: ' + e.message) }
    setExporting(false)
  }

  return (
    <div>
      <div className="hammer-header">{channel === 'jd' ? '京东' : '其他'} · 建议</div>
      {/* tab 入口 */}
      <div className="hammer-btn-row" style={{marginBottom:8}}>
        {[['replen','补货建议'],['purchase','采购建议'],['slow','滞销预警']].map(([id,label]) => (
          <span key={id} onClick={() => setHammerInsightsTab(id)}
            className={'hammer-tab' + (hammerInsightsTab === id ? ' active' : '')}>
            {label}
          </span>
        ))}
      </div>
      {/* 补货模式行（单独一行） */}
      {hammerInsightsTab === 'replen' && (
        <div className="hammer-btn-row" style={{marginBottom:8}}>
          {channel === 'jd' && (
            <span onClick={() => setHammerReplenMode('bbcc')}
              className={'hammer-tab' + (mode==='bbcc' ? ' active' : '')}>
              BBCC
            </span>
          )}
          <span onClick={() => setHammerReplenMode('traditional')}
            className={'hammer-tab' + (mode==='traditional' ? ' active' : '')}>
            传统多仓
          </span>
        </div>
      )}
      {/* 操作行（搜索+列选择+导出） */}
      <div className="hammer-row-3">
        <button onClick={() => setHammerPanel(hammerPanel === 'search' ? null : 'search')}
          className="hammer-btn btn-ghost">搜索</button>
        <button onClick={() => setHammerPanel(hammerPanel === 'columns' ? null : 'columns')}
            className="hammer-btn btn-ghost">
            列选择 ({visCols.length}/{cols.length})
          </button>
        <button onClick={() => doExport(
          isSlow ? 'slow' : (isPurchase ? 'purchase' : 'replen')
        )} disabled={exporting} className="clickable hammer-btn btn-ghost" style={{opacity:exporting?0.5:1}}>
          {exporting ? <span className="hammer-spinner" /> : <IconExport size={13} />} {exporting ? '导出中...' : '导出'}
        </button>
      </div>
      {/* 搜索面板 */}
      {hammerPanel === 'search' && (
        <div className="hammer-panel">
          <div className="hammer-header">
            {hammerInsightsTab === 'replen' ? '补货建议' : hammerInsightsTab === 'purchase' ? '采购建议' : '滞销预警'}
            {isPurchase ? '' : mode === 'bbcc' ? ' (BBCC)' : ' (传统)'} · 搜索
          </div>
          <input id="hm-search-insights" value={hammerData?.[channel]?.['insights_search_' + (isPurchase ? 'purchase' : isSlow ? 'slow' : mode)] || ''}
            onChange={e => setHammerData('insights_search_' + (isPurchase ? 'purchase' : isSlow ? 'slow' : mode), e.target.value)}
            placeholder="搜索SKU/商品名..." className="hammer-input" />
          {hammerData?.[channel]?.['insights_search_' + (isPurchase ? 'purchase' : isSlow ? 'slow' : mode)] && (
            <div style={{marginTop:4,textAlign:'center'}}>
              <button className="hammer-clear" onClick={() => setHammerData('insights_search_' + (isPurchase ? 'purchase' : isSlow ? 'slow' : mode), '')}>{t("common.clear")}</button>
            </div>
          )}
        </div>
      )}
      {/* 列选择面板 */}
      {hammerPanel === 'columns' && (
        <div className="hammer-panel hammer-panel-scroll">
          <div className="muted2 text-10" style={{marginBottom:4,padding:'0 4px'}}>{t("common.drag_hint")}</div>
          {(visCols.map(id=>cols.find(c=>c.id===id)).filter(Boolean).concat(cols.filter(c=>!visCols.includes(c.id)))).map((col,idx)=>{
            const isVis=visCols.includes(col.id)
            return <div key={col.id} draggable={isVis?true:undefined}
              onDragStart={isVis?e=>{e.dataTransfer.setData('text/plain',col.id);e.target.style.opacity='0.4';e.currentTarget.parentNode._dragId=col.id}:undefined}
              onDragEnd={isVis?e=>e.target.style.opacity='1':undefined}
              onDragOver={isVis?e=>{e.preventDefault();e.currentTarget.style.borderTop='2px solid var(--primary)';const from=e.currentTarget.parentNode._dragId;if(from&&from!==col.id){const nxt=visCols.filter(c=>c!==from);const toIdx=nxt.indexOf(col.id);nxt.splice(toIdx,0,from);saveCols(nxt)}}:undefined}
              onDragLeave={isVis?e=>e.currentTarget.style.borderTop='1px solid transparent':undefined}
              onDrop={isVis?e=>{e.preventDefault();e.currentTarget.style.borderTop='1px solid transparent';const from=e.dataTransfer.getData('text/plain');if(from===col.id)return;const nxt=visCols.filter(c=>c!==from);const toIdx=nxt.indexOf(col.id);nxt.splice(toIdx,0,from);saveCols(nxt);e.currentTarget.parentNode._dragId=null}:undefined}
              className={'col-drag' + (isVis ? ' visible' : ' hidden')}>
              <span className="muted2 text-12" style={{width:16,flexShrink:0,textAlign:'center',cursor:isVis?'grab':'default'}}>{isVis?'⠿':'○'}</span>
              <input type="checkbox" checked={isVis} onChange={e=>{const n=e.target.checked?[...visCols,col.id]:visCols.filter(c=>c!==col.id);saveCols(n)}} className="accent-primary" />
              <span className="flex-1 text-12">{col.label || '(序号)'}</span>
              <span className="muted2 text-9">{isVis?'#'+(visCols.indexOf(col.id)+1):''}</span>
            </div>
          })}
          <div className="border-bottom mt-4" style={{paddingTop:4,display:'flex',gap:6}}>
            <button onClick={()=>saveCols(isSlow ? INS_SLOW_COLS.map(c=>c.id) : (isPurchase ? INS_PURCHASE_COLS.map(c=>c.id) : (mode==='bbcc'?insDefVis(INS_BBCC_COLS):insDefVisTrad(INS_TRAD_COLS))))} className="hammer-clear">{t("common.default")}</button>
            <button onClick={()=>saveCols(cols.map(c=>c.id))} className="hammer-clear">{t("common.all")}</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* 清洗页: 锤子菜单渠道标注 */
