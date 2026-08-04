import React, { useState, useEffect } from "react"
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
      <div style={{fontSize:11,color:'var(--muted2)',marginBottom:8,textAlign:'center'}}>
        {channel === 'jd' ? '京东' : '其他'} · 建议
      </div>
      {/* tab 入口 */}
      <div style={{display:'flex',gap:4,marginBottom:8,flexWrap:'wrap'}}>
        {[['replen','补货建议'],['purchase','采购建议'],['slow','滞销预警']].map(([id,label]) => (
          <span key={id} onClick={() => setHammerInsightsTab(id)}
            style={{flex:1,fontSize:12,minHeight:32,padding:'4px 6px',borderRadius:99,cursor:'pointer',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',boxSizing:'border-box',
              background: hammerInsightsTab === id ? 'var(--primary)' : 'var(--gray)',
              color: hammerInsightsTab === id ? '#fff' : 'var(--text)',fontWeight: hammerInsightsTab === id ? 600 : 400}}>
            {label}
          </span>
        ))}
      </div>
      {/* 补货模式行（单独一行） */}
      {hammerInsightsTab === 'replen' && (
        <div style={{display:'flex',gap:4,marginBottom:6}}>
          {channel === 'jd' && (
            <span onClick={() => setHammerReplenMode('bbcc')}
              style={{flex:1,fontSize:12,minHeight:32,padding:'4px 8px',borderRadius:99,cursor:'pointer',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',boxSizing:'border-box',
                background: mode==='bbcc'?'var(--primary)':'var(--gray)',color: mode==='bbcc'?'#fff':'var(--text)',fontWeight: mode==='bbcc'?600:400}}>
              BBCC
            </span>
          )}
          <span onClick={() => setHammerReplenMode('traditional')}
            style={{flex:1,fontSize:12,minHeight:32,padding:'4px 8px',borderRadius:99,cursor:'pointer',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',boxSizing:'border-box',
              background: mode==='traditional'?'var(--primary)':'var(--gray)',color: mode==='traditional'?'#fff':'var(--text)',fontWeight: mode==='traditional'?600:400}}>
            传统多仓
          </span>
        </div>
      )}
      {/* 操作行（列选择+搜索+导出，单独一行） */}
      <div style={{display:'flex',gap:6}}>
        <button onClick={() => setHammerPanel(hammerPanel === 'search' ? null : 'search')}
          className="btn btn-ghost" style={{flex:1,fontSize:12,minHeight:32,padding:'4px 8px'}}>
          搜索
        </button>
        <button onClick={() => setHammerPanel(hammerPanel === 'columns' ? null : 'columns')}
            className="btn btn-ghost" style={{flex:1,fontSize:12,minHeight:32,padding:'4px 8px'}}>
            列选择 ({visCols.length}/{cols.length})
          </button>
        <button onClick={() => doExport(
          isSlow ? 'slow' : (isPurchase ? 'purchase' : 'replen')
        )} disabled={exporting} className="clickable btn btn-ghost" style={{flex:1,fontSize:12,minHeight:32,padding:'4px 8px',display:'flex',alignItems:'center',gap:4,justifyContent:'center',opacity:exporting?0.5:1}}>
          {exporting ? <span style={{display:'inline-block',width:12,height:12,border:'2px solid var(--primary)',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.6s linear infinite'}} /> : <IconExport size={13} />} {exporting ? '导出中...' : '导出'}
        </button>
      </div>
      {/* 搜索面板 — 建议页 */}
      {hammerPanel === 'search' && (
        <div style={{borderTop:'1px solid var(--border)',paddingTop:8,marginTop:8}}>
          <div style={{fontSize:11,color:'var(--muted2)',marginBottom:4,textAlign:'center'}}>
            {hammerInsightsTab === 'replen' ? '补货建议' : hammerInsightsTab === 'purchase' ? '采购建议' : '滞销预警'}
            {isPurchase ? '' : mode === 'bbcc' ? ' (BBCC)' : ' (传统)'} · 搜索
          </div>
          <input id="hm-search-insights" value={hammerData?.[channel]?.['insights_search_' + (isPurchase ? 'purchase' : isSlow ? 'slow' : mode)] || ''}
            onChange={e => setHammerData('insights_search_' + (isPurchase ? 'purchase' : isSlow ? 'slow' : mode), e.target.value)}
            placeholder="搜索SKU/商品名..."
            style={{width:'100%',padding:'6px 10px',fontSize:16,border:'1px solid var(--border)',borderRadius:32,outline:'none',boxSizing:'border-box',background:'var(--card)',color:'var(--text)'}} />
          {hammerData?.[channel]?.['insights_search_' + (isPurchase ? 'purchase' : isSlow ? 'slow' : mode)] && (
            <div style={{marginTop:4,textAlign:'center'}}>
              <span className="clickable btn btn-ghost" onClick={() => setHammerData('insights_search_' + (isPurchase ? 'purchase' : isSlow ? 'slow' : mode), '')} style={{fontSize:10,padding:'2px 8px',cursor:'pointer'}}>清除</span>
            </div>
          )}
        </div>
      )}
      {/* 列选择面板 */}
      {hammerPanel === 'columns' && (
        <div style={{borderTop:'1px solid var(--border)',paddingTop:8,marginTop:8,maxHeight:260,overflowY:'auto'}}>
          <div style={{fontSize:10,color:'var(--muted2)',marginBottom:4,padding:'0 4px'}}>拖拽 ⠿ 调整列顺序</div>
          {(visCols.map(id=>cols.find(c=>c.id===id)).filter(Boolean).concat(cols.filter(c=>!visCols.includes(c.id)))).map((col,idx)=>{
            const isVis=visCols.includes(col.id)
            return <div key={col.id} draggable={isVis?true:undefined}
              onDragStart={isVis?e=>{e.dataTransfer.setData('text/plain',col.id);e.target.style.opacity='0.4';e.currentTarget.parentNode._dragId=col.id}:undefined}
              onDragEnd={isVis?e=>e.target.style.opacity='1':undefined}
              onDragOver={isVis?e=>{e.preventDefault();e.currentTarget.style.borderTop='2px solid var(--primary)';const from=e.currentTarget.parentNode._dragId;if(from&&from!==col.id){const nxt=visCols.filter(c=>c!==from);const toIdx=nxt.indexOf(col.id);nxt.splice(toIdx,0,from);saveCols(nxt)}}:undefined}
              onDragLeave={isVis?e=>e.currentTarget.style.borderTop='1px solid transparent':undefined}
              onDrop={isVis?e=>{e.preventDefault();e.currentTarget.style.borderTop='1px solid transparent';const from=e.dataTransfer.getData('text/plain');if(from===col.id)return;const nxt=visCols.filter(c=>c!==from);const toIdx=nxt.indexOf(col.id);nxt.splice(toIdx,0,from);saveCols(nxt);e.currentTarget.parentNode._dragId=null}:undefined}
              style={{display:'flex',alignItems:'center',gap:4,padding:'4px 6px',borderRadius:6,cursor:isVis?'grab':'default',fontSize:12,whiteSpace:'nowrap',borderTop:'1px solid transparent',background:isVis?'var(--card)':'transparent',opacity:isVis?1:0.4,userSelect:'none',WebkitUserSelect:'none'}}>
              <span style={{color:'var(--muted2)',fontSize:12,width:16,flexShrink:0,textAlign:'center',cursor:isVis?'grab':'default'}}>{isVis?'⠿':'○'}</span>
              <input type="checkbox" checked={isVis} onChange={e=>{const n=e.target.checked?[...visCols,col.id]:visCols.filter(c=>c!==col.id);saveCols(n)}} style={{accentColor:'var(--primary)'}} />
              <span style={{flex:1}}>{col.label || '(序号)'}</span>
              <span style={{fontSize:9,color:'var(--muted2)'}}>{isVis?'#'+(visCols.indexOf(col.id)+1):''}</span>
            </div>
          })}
          <div style={{borderTop:'1px solid var(--border)',marginTop:4,paddingTop:4,display:'flex',gap:6}}>
            <span onClick={()=>saveCols(isSlow ? INS_SLOW_COLS.map(c=>c.id) : (isPurchase ? INS_PURCHASE_COLS.map(c=>c.id) : (mode==='bbcc'?insDefVis(INS_BBCC_COLS):insDefVisTrad(INS_TRAD_COLS))))} className="btn btn-ghost" style={{fontSize:10,padding:'2px 8px',cursor:'pointer'}}>默认</span>
            <span onClick={()=>saveCols(cols.map(c=>c.id))} className="btn btn-ghost" style={{fontSize:10,padding:'2px 8px',cursor:'pointer'}}>全部</span>
          </div>
        </div>
      )}
    </div>
  )
}

/* 清洗页: 锤子菜单渠道标注 */
