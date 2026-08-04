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
      toast.success('库存导出完成')
    } catch(e) { toast.error('导出失败') }
    setExporting(false)
  }

  return (
    <div>
      <div style={{fontSize:11,color:'var(--muted2)',marginBottom:8,textAlign:'center'}}>
        {channel === 'jd' ? t('channel.jd') : t('channel.other')} · {t('nav.inv')}

      </div>
      {/* 功能按钮行 */}
      <div style={{display:'flex',gap:6,marginBottom:hammerPanel?8:0,flexWrap:'wrap'}}>
        <button onClick={() => setHammerPanel(hammerPanel === 'columns' ? null : 'columns')}
          className="btn btn-ghost" style={{flex:1,fontSize:12,minHeight:32,padding:'4px 8px'}}>
          列选择 ({visCols.length}/{INV_COLS[hammerWhType].length})
        </button>
        <button onClick={() => setHammerPanel(hammerPanel === 'search' ? null : 'search')}
          className="btn btn-ghost" style={{flex:1,fontSize:12,minHeight:32,padding:'4px 8px'}}>
          搜索
        </button>
        <button onClick={() => setHammerPanel(hammerPanel === 'wh' ? null : 'wh')}
          className="btn btn-ghost" style={{flex:1,fontSize:12,minHeight:32,padding:'4px 8px'}}>
          仓库 {INV_WH_LABEL[hammerWhType]}
        </button>
        <button onClick={doExport} disabled={exporting}
          className="clickable btn btn-ghost" style={{flex:1,fontSize:12,minHeight:32,padding:'4px 8px',display:'flex',alignItems:'center',gap:4,justifyContent:'center',opacity:exporting?0.5:1}}>
          {exporting ? <span style={{display:'inline-block',width:12,height:12,border:'2px solid var(--primary)',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.6s linear infinite'}} /> : <IconExport size={13} />} {exporting ? '导出中...' : '导出'}
        </button>
      </div>
      {/* 列选择面板 */}
      {hammerPanel === 'columns' && (
        <div style={{borderTop:'1px solid var(--border)',paddingTop:8,marginTop:0,maxHeight:260,overflowY:'auto'}}>
          <div style={{fontSize:10,color:'var(--muted2)',marginBottom:4,padding:'0 4px'}}>{t("common.drag_hint")}</div>
          {(visCols.map(id=>INV_COLS[hammerWhType].find(c=>c.id===id)).filter(Boolean).concat(INV_COLS[hammerWhType].filter(c=>!visCols.includes(c.id)))).map((col,idx)=>{
            const isVis=visCols.includes(col.id)
            return <div key={col.id} draggable={isVis?true:undefined}
              onDragStart={isVis?e=>{e.dataTransfer.setData('text/plain',col.id);e.target.style.opacity='0.4';e.currentTarget.parentNode._dragId=col.id}:undefined}
              onDragEnd={isVis?e=>e.target.style.opacity='1':undefined}
              onDragOver={isVis?e=>{e.preventDefault();e.currentTarget.style.borderTop='2px solid var(--primary)';const from=e.currentTarget.parentNode._dragId;if(from&&from!==col.id){const nxt=visCols.filter(c=>c!==from);const toIdx=nxt.indexOf(col.id);nxt.splice(toIdx,0,from);saveCols(nxt)}}:undefined}
              onDragLeave={isVis?e=>e.currentTarget.style.borderTop='1px solid transparent':undefined}
              onDrop={isVis?e=>{e.preventDefault();e.currentTarget.style.borderTop='1px solid transparent';const from=e.dataTransfer.getData('text/plain');if(from===col.id)return;const nxt=visCols.filter(c=>c!==from);const toIdx=nxt.indexOf(col.id);nxt.splice(toIdx,0,from);saveCols(nxt);e.currentTarget.parentNode._dragId=null}:undefined}
              style={{display:'flex',alignItems:'center',gap:4,padding:'4px 6px',borderRadius:6,cursor:isVis?'grab':'default',fontSize:12,whiteSpace:'nowrap',borderTop:'1px solid transparent',background:isVis?'var(--card)':'transparent',opacity:isVis?1:0.4,userSelect:'none',WebkitUserSelect:'none'}}>
              <span style={{color:'var(--muted2)',fontSize:12,width:16,flexShrink:0,textAlign:'center',cursor:isVis?'grab':'default'}}>{isVis?'⠿':'○'}</span>
              <input type="checkbox" checked={isVis} onChange={e=>{const n=e.target.checked?[...visCols,col.id]:visCols.filter(c=>c!==col.id);saveCols(n)}} className="accent-primary" />
              <span className="flex-1">{col.label}</span>
              <span className="text-9 muted2">{isVis?'#'+(visCols.indexOf(col.id)+1):''}</span>
            </div>
          })}
          <div style={{borderTop:'1px solid var(--border)',marginTop:4,paddingTop:4}}>
            <span onClick={()=>saveCols(INV_COLS[hammerWhType].map(c=>c.id))} className="btn btn-ghost" style={{fontSize:10,padding:'2px 8px',cursor:'pointer'}}>{t("common.all")}</span>
          </div>
        </div>
      )}
      {/* 搜索面板 */}
      {hammerPanel === 'search' && (
        <div style={{borderTop:'1px solid var(--border)',paddingTop:8}}>
          <input id="hm-search-inv" value={hammerSearch} onChange={e=>setHammerSearch(e.target.value)}
            placeholder="搜索SKU/商品名..."
            style={{width:'100%',padding:'6px 10px',fontSize:16,border:'1px solid var(--border)',borderRadius:32,outline:'none',boxSizing:'border-box',background:'var(--card)',color:'var(--text)'}} />
          {hammerSearch && <div style={{marginTop:4,textAlign:'right'}}>
            <span className="clickable btn btn-ghost" onClick={()=>setHammerSearch('')} style={{fontSize:10,padding:'2px 8px',cursor:'pointer'}}>{t("common.clear")}</span>
          </div>}
        </div>
      )}
      {/* 仓库类型面板 */}
      {hammerPanel === 'wh' && (
        <div style={{borderTop:'1px solid var(--border)',paddingTop:8}}>
          <div style={{fontSize:10,color:'var(--muted2)',marginBottom:4}}>仓库类型</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
            {Object.keys(INV_COLS).map(k => {
              if (k === 'platform_b' && channel !== 'jd') return null
              const active = hammerWhType === k
              return <span key={k} onClick={() => switchWh(k)}
                style={{fontSize:12,padding:'4px 10px',borderRadius:99,cursor:'pointer',
                  background: active ? 'var(--primary)' : 'var(--gray)',
                  color: active ? '#fff' : 'var(--text)',
                  fontWeight: active ? 600 : 400
                }}>
                {INV_WH_LABEL[k]}
              </span>
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* 建议页: 锤子菜单 tab入口 + 模式 + 列选择 + 导出 */
const INS_BBCC_COLS = [
  {id:'seq',label:''},{id:'sku',label:'SKU'},{id:'barcode',label:'69码'},{id:'name',label:'商品'},{id:'warehouse',label:'仓库'},
  {id:'b_stock',label:'B仓可用库存'},{id:'b_turn',label:'B仓周转'},{id:'c_stock',label:'C仓总和可用'},
  {id:'transit',label:'B-C调拨在途'},{id:'sales',label:'C仓日销'},{id:'c_turn',label:'C仓周转'},
  {id:'transit_turn',label:'B→C调拨周转'},{id:'suggest',label:'C仓建议补'},{id:'b_suggest',label:'B仓需补'},
  {id:'cur_turn',label:'当前综转'},{id:'after_turn',label:'补后综转'},{id:'note',label:'备注'},{id:'action',label:'标记操作'},
]
const INS_TRAD_COLS = [
  {id:'seq',label:''},{id:'sku',label:'SKU'},{id:'barcode',label:'69码'},{id:'name',label:'商品'},{id:'store',label:'仓库'},
  {id:'avail',label:'现有'},{id:'transit',label:'在途'},{id:'sales',label:'日销'},
  {id:'safety',label:'安全线'},{id:'turn',label:'在库周转'},{id:'after_turn',label:'补后周转'},
  {id:'suggest',label:'建议补'},{id:'note',label:'备注'},
]
const INS_PURCHASE_COLS = [
  {id:'barcode',label:'69码'},{id:'sku',label:'SKU'},{id:'name',label:'商品'},{id:'warehouse',label:'仓库'},
  {id:'sys_total',label:'系统总库存'},{id:'daily_sales',label:'日销(融合/14/28)'},
  {id:'actual_purchase',label:'建议采购(含箱规取整)'},{id:'after_turnover',label:'补后周转'},
  {id:'note',label:'备注'},{id:'timing',label:'采购时机'},
]
const INS_SLOW_COLS = [
  {id:'barcode',label:'69码'},{id:'sku',label:'SKU'},{id:'name',label:'商品'},{id:'store',label:'店铺'},{id:'category',label:'分类'},
  {id:'last_order_date',label:'最近下单'},{id:'days',label:'天数'},{id:'stock',label:'库存'},{id:'level',label:'状态'},
]
const insColKey = (m) => 'c_cols_' + m
const getInsVis = (m) => { try { return JSON.parse(localStorage.getItem(insColKey(m)) || 'null') } catch{return null} }
function insDefVis(cols){return cols.map(c=>c.id).filter((_,i)=>[0,1,2,3,4,8,11,12,15].includes(i))}
function insDefVisTrad(cols){return cols.map(c=>c.id).filter((_,i)=>[0,1,2,3,4,5,6,10,11].includes(i))}

