import React, { useState, useEffect } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { useDebouncedSearch } from '../../hooks/useDebounce'
import { PRODUCT_COLS, prodColKey, getProdVis } from './configs'
import { t } from '../../locale'

interface HammerProductsProps { channel: string }

export default function HammerProducts({ channel }: HammerProductsProps) {
  const { hammerPanel, setHammerPanel, hammerSearch, setHammerSearch, setHammerCols } = useAppStore()
  const [localSearch, setLocalSearch] = useDebouncedSearch(hammerSearch, setHammerSearch)
  const [visCols, setVisCols] = useState(() => getProdVis(channel) || PRODUCT_COLS.map(c => c.id))

  useEffect(() => { setVisCols(getProdVis(channel) || PRODUCT_COLS.map(c => c.id)) }, [channel])

  const saveCols = (cols) => {
    setVisCols(cols)
    localStorage.setItem(prodColKey(channel), JSON.stringify(cols))
    setHammerCols('products', cols)
  }

  return (
    <div>
      <div className="hammer-header">{channel === 'jd' ? t('channel.jd') : t('channel.other')} · {t('nav.products')}</div>
      <div className="hammer-btn-row" style={{marginBottom:hammerPanel?8:0}}>
        <button onClick={() => setHammerPanel(hammerPanel === 'columns' ? null : 'columns')}
          className="btn-ghost hammer-btn">{t('common.columns')} ({visCols.length}/{PRODUCT_COLS.length})</button>
        <button onClick={() => { setHammerPanel(hammerPanel === 'search' ? null : 'search'); if (hammerPanel !== 'search') setTimeout(() => document.getElementById('hm-search-prod')?.focus(), 100) }}
          className="btn-ghost hammer-btn">{t('common.search')}</button>
        <button onClick={() => useAppStore.getState().setProdBatch(!useAppStore.getState().prodBatch)}
          className="btn-ghost hammer-btn" style={useAppStore.getState().prodBatch?{borderColor:'var(--danger)',color:'var(--danger)'}:undefined}>批量操作</button>
      </div>
      {hammerPanel === 'columns' && (
        <div className="hammer-panel hammer-panel-scroll">
          <div className="cols-top-bar">
            <button onClick={()=>saveCols(PRODUCT_COLS.map(c=>c.id))} className="hammer-clear">{t('common.all')}</button>
            <button onClick={()=>saveCols([])} className="hammer-clear">取消全选</button>
          </div>
          <div className="muted2 text-10" style={{marginBottom:2,padding:'0 4px'}}>{t('common.drag_hint')}</div>
          {/* 已显示 */}
          {visCols.length > 0 && <div className="cols-group-title"><span>已显示</span><span>{visCols.length}</span></div>}
          {visCols.map(id=>{
            const col=PRODUCT_COLS.find(c=>c.id===id);if(!col)return null
            return <div key={col.id} draggable
              onDragStart={e=>{e.dataTransfer.setData('text/plain',col.id);e.target.style.opacity='0.4';e.currentTarget.parentNode._dragId=col.id}}
              onDragEnd={e=>e.target.style.opacity='1'}
              onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderTop='2px solid var(--primary)';const from=e.currentTarget.parentNode._dragId;if(from&&from!==col.id){const nxt=visCols.filter(c=>c!==from);const toIdx=nxt.indexOf(col.id);nxt.splice(toIdx,0,from);saveCols(nxt)}}}
              onDragLeave={e=>e.currentTarget.style.borderTop='1px solid transparent'}
              onDrop={e=>{e.preventDefault();e.currentTarget.style.borderTop='1px solid transparent';const from=e.dataTransfer.getData('text/plain');if(from===col.id)return;const nxt=visCols.filter(c=>c!==from);const toIdx=nxt.indexOf(col.id);nxt.splice(toIdx,0,from);saveCols(nxt);e.currentTarget.parentNode._dragId=null}}
              className="col-drag visible">
              <span className="muted2 text-12" style={{width:16,flexShrink:0,textAlign:'center',cursor:'grab'}}>⠿</span>
              <input type="checkbox" checked onChange={e=>{saveCols(visCols.filter(c=>c!==col.id))}} className="accent-primary" />
              <span className="flex-1 text-12">{col.label}</span>
              <span className="muted2 text-9">#{visCols.indexOf(col.id)+1}</span>
            </div>
          })}
          {/* 已隐藏 */}
          {(()=>{
            const hidden=PRODUCT_COLS.filter(c=>!visCols.includes(c.id))
            if(hidden.length===0)return null
            return <>
              <div className="cols-group-title"><span>已隐藏</span><span>{hidden.length}</span></div>
              {hidden.map(col=>
                <div key={col.id} className="col-drag hidden">
                  <span className="muted2" style={{width:16,flexShrink:0,textAlign:'center'}}>○</span>
                  <input type="checkbox" onChange={e=>{saveCols([...visCols,col.id])}} className="accent-primary" />
                  <span className="flex-1 text-12">{col.label}</span>
                </div>
              )}
            </>
          })()}
        </div>
      )}
      {hammerPanel === 'search' && (
        <div className="hammer-panel">
          <input id="hm-search-prod" value={localSearch} onChange={e=>setLocalSearch(e.target.value)}
            placeholder="搜索SKU/商品名..." className="hammer-input" />
          {hammerSearch && <div className="text-right mt-8">
            <button className="hammer-clear" onClick={()=>setHammerSearch('')}>{t('common.clear')}</button>
          </div>}
        </div>
      )}
    </div>
  )
}