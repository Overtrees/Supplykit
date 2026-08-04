import React, { useState, useEffect } from 'react'
import { t } from "../../locale"
import { useAppStore } from '../../store/useAppStore'
import { SUPPLIER_COLS, suppColKey, getSuppVis } from './configs'

interface HammerSuppliersProps { channel: string }

export default function HammerSuppliers({ channel }: HammerSuppliersProps) {
  const { hammerPanel, setHammerPanel, hammerSearch, setHammerSearch, setHammerCols } = useAppStore()
  const [visCols, setVisCols] = useState(() => getSuppVis(channel) || SUPPLIER_COLS.map(c => c.id))

  useEffect(() => {
    setVisCols(getSuppVis(channel) || SUPPLIER_COLS.map(c => c.id))
  }, [channel])

  const saveCols = (cols) => {
    setVisCols(cols)
    localStorage.setItem(suppColKey(channel), JSON.stringify(cols))
    setHammerCols('suppliers', cols)
  }

  return (
    <div>
      <div style={{fontSize:11,color:'var(--muted2)',marginBottom:8,textAlign:'center'}}>
        {channel === 'jd' ? t('channel.jd') : t('channel.other')} · {t('nav.suppliers')}

      </div>
      <div style={{display:'flex',gap:6,marginBottom:hammerPanel?8:0}}>
        <button onClick={() => setHammerPanel(hammerPanel === 'columns' ? null : 'columns')}
          className="btn btn-ghost" style={{flex:1,fontSize:12,minHeight:32,padding:'4px 8px'}}>
          列选择 ({visCols.length}/{SUPPLIER_COLS.length})
        </button>
        <button onClick={() => { setHammerPanel(hammerPanel === 'search' ? null : 'search'); if (hammerPanel !== 'search') setTimeout(() => document.getElementById('hm-search-supp')?.focus(), 100) }}
          className="btn btn-ghost" style={{flex:1,fontSize:12,minHeight:32,padding:'4px 8px'}}>
          搜索
        </button>
      </div>
      {hammerPanel === 'columns' && (
        <div style={{borderTop:'1px solid var(--border)',paddingTop:8,marginTop:0,maxHeight:260,overflowY:'auto'}}>
          <div style={{fontSize:10,color:'var(--muted2)',marginBottom:4,padding:'0 4px'}}>{t("common.drag_hint")}</div>
          {(visCols.map(id=>SUPPLIER_COLS.find(c=>c.id===id)).filter(Boolean).concat(SUPPLIER_COLS.filter(c=>!visCols.includes(c.id)))).map((col,idx)=>{
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
              <span style={{flex:1}}>{col.label}</span>
              <span style={{fontSize:9,color:'var(--muted2)'}}>{isVis?'#'+(visCols.indexOf(col.id)+1):''}</span>
            </div>
          })}
          <div style={{borderTop:'1px solid var(--border)',marginTop:4,paddingTop:4}}>
            <span onClick={()=>saveCols(SUPPLIER_COLS.map(c=>c.id))} className="btn btn-ghost" style={{fontSize:10,padding:'2px 8px',cursor:'pointer'}}>{t("common.all")}</span>
          </div>
        </div>
      )}
      {hammerPanel === 'search' && (
        <div style={{borderTop:'1px solid var(--border)',paddingTop:8,marginTop:0}}>
          <input id="hm-search-supp" value={hammerSearch} onChange={e=>setHammerSearch(e.target.value)}
            placeholder="搜索供应商名称/编号..."
            style={{width:'100%',padding:'6px 10px',fontSize:16,border:'1px solid var(--border)',borderRadius:32,outline:'none',boxSizing:'border-box',background:'var(--card)',color:'var(--text)'}} />
          {hammerSearch && <div style={{marginTop:4,textAlign:'right'}}>
            <span className="clickable btn btn-ghost" onClick={()=>setHammerSearch('')} style={{fontSize:10,padding:'2px 8px',cursor:'pointer'}}>{t("common.clear")}</span>
          </div>}
        </div>
      )}
    </div>
  )
}