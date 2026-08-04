import React, { useState, useEffect } from 'react'
import { t } from "../../locale"
import { useAppStore } from '../../store/useAppStore'
import { useToast } from '../../components/Toast'
import { INV_COLS, INV_COL_KEY, getInvVis, INV_WH_LABEL } from './configs'
import { IconExport } from '../Icons'

interface HammerInventoryProps { channel: string }

export default function HammerInventory({ channel }: HammerInventoryProps) {
  const toast = useToast()
  const { hammerPanel, setHammerPanel, hammerSearch, setHammerSearch, setHammerCols, hammerWhType, setHammerWhType } = useAppStore()
  const [visCols, setVisCols] = useState(() => getInvVis(hammerWhType) || INV_COLS[hammerWhType].map(c => c.id))
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const saved = getInvVis(hammerWhType) || INV_COLS[hammerWhType].map(c => c.id)
    setVisCols(saved)
    setHammerCols('inventory_' + hammerWhType, saved)
  }, [hammerWhType])

  const saveCols = (cols) => {
    setVisCols(cols)
    localStorage.setItem(INV_COL_KEY + '_' + hammerWhType, JSON.stringify(cols))
    setHammerCols('inventory_' + hammerWhType, cols)
  }

  const switchWh = (v) => {
    setHammerWhType(v)
    const saved = getInvVis(v) || INV_COLS[v].map(c => c.id)
    setVisCols(saved)
    setHammerCols('inventory_' + v, saved)
  }

  const doExport = async () => {
    setExporting(true)
    try {
      const API = import.meta.env.VITE_API_BASE_URL || 'https://overtrees.pythonanywhere.com'
      const r = await fetch(API + '/api/insights/export-inventory?channel=' + channel + '&wh_type=' + hammerWhType)
      if (!r.ok) throw new Error('HTTP ' + r.status)
      const b = await r.blob()
      const u = URL.createObjectURL(b)
      const a = document.createElement('a')
      a.href = u
      a.download = 'inventory_' + new Date().toISOString().slice(0,10) + '.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(u)
      toast.success(t('export.inv_success'))
    } catch(e) { toast.error(t('export.failed')) }
    setExporting(false)
  }

  return (
    <div>
      <div className="hammer-header">{channel === 'jd' ? t('channel.jd') : t('channel.other')} · {t('nav.inv')}</div>
      {/* 功能按钮行 — B 型布局 2×2 */}
      <div className="hammer-row-2x2" style={{marginBottom:hammerPanel?8:0}}>
        <div className="hammer-row">
          <button onClick={() => setHammerPanel(hammerPanel === 'columns' ? null : 'columns')}
            className="hammer-btn btn-ghost">{t('common.columns')} ({visCols.length}/{INV_COLS[hammerWhType].length})</button>
          <button onClick={() => setHammerPanel(hammerPanel === 'search' ? null : 'search')}
            className="hammer-btn btn-ghost">{t('common.search')}</button>
        </div>
        <div className="hammer-row">
          <button onClick={() => setHammerPanel(hammerPanel === 'wh' ? null : 'wh')}
            className="hammer-btn btn-ghost">仓库 {INV_WH_LABEL[hammerWhType]}</button>
          <button onClick={doExport} disabled={exporting}
            className="clickable hammer-btn btn-ghost" style={{opacity:exporting?0.5:1}}>
            {exporting ? <span className="hammer-spinner" /> : <IconExport size={13} />} {exporting ? t('common.exporting') : t('common.export')}
          </button>
        </div>
      </div>
      {/* 列选择面板 */}
      {hammerPanel === 'columns' && (
        <div className="hammer-panel hammer-panel-scroll">
          <div className="muted2 text-10" style={{marginBottom:4,padding:'0 4px'}}>{t("common.drag_hint")}</div>
          {(visCols.map(id=>INV_COLS[hammerWhType].find(c=>c.id===id)).filter(Boolean).concat(INV_COLS[hammerWhType].filter(c=>!visCols.includes(c.id)))).map((col,idx)=>{
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
              <span className="flex-1 text-12">{col.label}</span>
              <span className="muted2 text-9">{isVis?'#'+(visCols.indexOf(col.id)+1):''}</span>
            </div>
          })}
          <div className="border-bottom mt-4" style={{paddingTop:4}}>
            <button onClick={()=>saveCols(INV_COLS[hammerWhType].map(c=>c.id))} className="hammer-clear">{t("common.all")}</button>
          </div>
        </div>
      )}
      {/* 搜索面板 */}
      {hammerPanel === 'search' && (
        <div className="hammer-panel">
          <input id="hm-search-inv" value={hammerSearch} onChange={e=>setHammerSearch(e.target.value)}
            placeholder="搜索SKU/商品名..." className="hammer-input" />
          {hammerSearch && <div style={{marginTop:4,textAlign:'right'}}>
            <button className="hammer-clear" onClick={()=>setHammerSearch('')}>{t("common.clear")}</button>
          </div>}
        </div>
      )}
      {/* 仓库类型面板 */}
      {hammerPanel === 'wh' && (
        <div className="hammer-panel">
          <div className="muted2 text-10 mb-4">仓库类型</div>
          <div className="hammer-btn-row">
            {Object.keys(INV_COLS).map(k => {
              if (k === 'platform_b' && channel !== 'jd') return null
              return <span key={k} onClick={() => switchWh(k)}
                className={'hammer-tab' + (hammerWhType === k ? ' active' : '')}>
                {INV_WH_LABEL[k]}
              </span>
            })}
          </div>
        </div>
      )}
    </div>
  )
}