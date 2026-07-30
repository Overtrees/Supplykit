import React, { useState, useMemo, useEffect, useRef } from 'react'
import { api } from '../api/client'
import EmptyState from '../components/EmptyState'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'
import { IconSearch, IconTrash, IconExport } from '../components/Icons'

const API = import.meta.env.VITE_API_BASE_URL || 'https://overtrees.pythonanywhere.com'
const WH_COLS = {
  own: [
    {id:'warehouse',label:'仓库'},{id:'sku',label:'SKU'},{id:'barcode',label:'69码'},{id:'name',label:'商品'},
    {id:'begin',label:'期初库存'},{id:'transit',label:'在途'},{id:'month_in',label:'当月采购入库'},
    {id:'month_out',label:'当月出库'},{id:'avail',label:'可用'},{id:'turnover',label:'在库周转'},
  ],
  platform: [
    {id:'warehouse',label:'仓库'},{id:'sku',label:'SKU'},{id:'barcode',label:'69码'},{id:'name',label:'商品'},
    {id:'transit',label:'在途'},{id:'avail',label:'可用'},
  ],
  platform_b: [
    {id:'warehouse',label:'仓库'},{id:'sku',label:'SKU'},{id:'barcode',label:'69码'},{id:'name',label:'商品'},
    {id:'transit',label:'B-C仓调拨在途'},{id:'avail',label:'可用'},
  ],
}
const COL_KEY='c_cols_inventory'
const getVis=(wt)=>{try{return JSON.parse(localStorage.getItem(COL_KEY+'_'+wt)||'null')}catch{return null}}

export default function InventoryPage({ highlightSku }) {
  const toast = useToast()
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)
  const [visCols, setVisCols] = useState(() => {const wt='own';return getVis(wt)||WH_COLS[wt].map(c=>c.id)})
  const [showPicker, setShowPicker] = useState(false)
  const [s, setS] = useState('')
  const [confirmDel, setConfirmDel] = useState(null)
  const [monthRange, setMonthRange] = useState('')
  const [whType, setWhType] = useState('own')

  const loadInv = async () => {
    setLoading(true)
    try {
      const r = await api.get('/api/insights/with-sales?wh_type=' + whType)
      const data = r.data || []
      setInventory(data)
      if (data.length > 0) {
        const s = data[0].month_start?.slice(5) || ''
        const e = data[0].month_end?.slice(5) || ''
        setMonthRange(`${s}至${e}`)
      }
    } catch(e) { setInventory([]) }
    setLoading(false)
  }
  useEffect(() => { loadInv() }, [whType])

  const fl = useMemo(() => {
    if (!s) return inventory
    const q = s.toLowerCase()
    return inventory.filter(x => (x.sku||'').toLowerCase().includes(q) || (x.product_name||'').toLowerCase().includes(q) || (x.store||'').toLowerCase().includes(q))
  }, [inventory, s])

  const totalTurnover = useMemo(() => {
    const valid = inventory.filter(x => x.turnover_days != null)
    return valid.length > 0
      ? (valid.reduce((s,x) => s + x.turnover_days, 0) / valid.length).toFixed(1)
      : null
  }, [inventory])

  const delInv = async () => {
    if (!confirmDel) return
    try {
      const r = await fetch(`${API}/api/inventory/${confirmDel}`, {method:'DELETE'})
      if (r.ok) { toast.success('已删除'); setConfirmDel(null); loadInv() }
      else toast.error('删除失败')
    } catch(e) { toast.error('删除失败: '+e.message) }
    setConfirmDel(null)
  }

  return <div className='card'>
    <div className='section-title' style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
      <span>进销存 <span className='small muted'>共 {inventory.length} 条</span></span>
      <span style={{display:'flex',gap:8,alignItems:'center'}}>
        <span style={{position:'relative',display:'inline-block'}}>
          <span onClick={()=>setShowPicker(!showPicker)} className='btn btn-ghost' style={{fontSize:11,padding:'2px 10px',cursor:'pointer'}}>列 {visCols.length}/{WH_COLS[whType].length}</span>
          {showPicker && <div style={{position:'absolute',top:'100%',right:0,zIndex:10,background:'var(--card)',border:'1px solid var(--border)',borderRadius:16,padding:6,minWidth:180,boxShadow:'0 4px 12px rgba(0,0,0,0.15)'}}>
      <div style={{fontSize:10,color:'var(--muted2)',marginBottom:4,padding:'0 4px'}}>拖拽 ⠿ 调整列顺序</div>
      {(visCols.map(id=>WH_COLS[whType].find(c=>c.id===id)).filter(Boolean).concat(WH_COLS[whType].filter(c=>!visCols.includes(c.id)))).map((col,idx)=>{
        const isVis=visCols.includes(col.id)
        return <div key={col.id} draggable={isVis?true:undefined}
          onDragStart={isVis?e=>{e.dataTransfer.setData('text/plain',col.id);e.target.style.opacity='0.4';e.currentTarget.parentNode._dragId=col.id}:undefined}
          onDragEnd={isVis?e=>e.target.style.opacity='1':undefined}
          onDragOver={isVis?e=>{e.preventDefault();e.currentTarget.style.borderTop='2px solid var(--primary)';const from=e.currentTarget.parentNode._dragId;if(from&&from!==col.id){const nxt=visCols.filter(c=>c!==from);const toIdx=nxt.indexOf(col.id);nxt.splice(toIdx,0,from);setVisCols(nxt);localStorage.setItem(COL_KEY+'_'+whType,JSON.stringify(nxt))}}:undefined}
          onDragLeave={isVis?e=>e.currentTarget.style.borderTop='1px solid transparent':undefined}
          onDrop={isVis?e=>{e.preventDefault();e.currentTarget.style.borderTop='1px solid transparent';const from=e.dataTransfer.getData('text/plain');if(from===col.id)return;const nxt=visCols.filter(c=>c!==from);const toIdx=nxt.indexOf(col.id);nxt.splice(toIdx,0,from);setVisCols(nxt);localStorage.setItem(COL_KEY+'_'+whType,JSON.stringify(nxt));e.currentTarget.parentNode._dragId=null}:undefined}
          onTouchStart={isVis?e=>{const t=e.touches[0];e.currentTarget._dragStart={x:t.clientX,y:t.clientY,id:col.id}}:undefined}
          onTouchMove={isVis?e=>{e.preventDefault();const t=e.touches[0];const el=document.elementFromPoint(t.clientX,t.clientY);if(el&&el!==e.currentTarget&&el._dragStart)el.style.borderTop='2px solid var(--primary)'}:undefined}
          onTouchEnd={isVis?e=>{const start=e.currentTarget._dragStart;if(!start)return;const t=e.changedTouches[0];const dropEl=document.elementFromPoint(t.clientX,t.clientY);if(dropEl&&dropEl._dragStart&&dropEl._dragStart.id!==start.id){const from=start.id;const to=dropEl._dragStart.id;const nxt=visCols.filter(c=>c!==from);const toIdx=nxt.indexOf(to);nxt.splice(toIdx,0,from);setVisCols(nxt);localStorage.setItem(COL_KEY+'_'+whType,JSON.stringify(nxt))}}:undefined}
          style={{display:'flex',alignItems:'center',gap:4,padding:'4px 6px',borderRadius:6,cursor:isVis?'grab':'default',fontSize:12,whiteSpace:'nowrap',borderTop:'1px solid transparent',background:isVis?'var(--card)':'transparent',opacity:isVis?1:0.4,userSelect:'none',WebkitUserSelect:'none'}}>
          <span style={{color:'var(--muted2)',fontSize:12,width:16,flexShrink:0,textAlign:'center',cursor:isVis?'grab':'default'}}>{isVis?'⠿':'○'}</span>
          <input type='checkbox' checked={isVis} onChange={e=>{const n=e.target.checked?[...visCols,col.id]:visCols.filter(c=>c!==col.id);setVisCols(n);localStorage.setItem(COL_KEY+'_'+whType,JSON.stringify(n))}} style={{accentColor:'var(--primary)'}} />
          <span style={{flex:1}}>{col.label}</span>
          <span style={{fontSize:9,color:'var(--muted2)'}}>{isVis?'#'+(visCols.indexOf(col.id)+1):''}</span>
        </div>
      })}
      <div style={{borderTop:'1px solid var(--border)',marginTop:4,paddingTop:4}}>
        <span onClick={()=>{const d=WH_COLS[whType].map(c=>c.id);setVisCols(d);localStorage.setItem(COL_KEY+'_'+whType,JSON.stringify(d));setShowPicker(false)}} className='btn btn-ghost' style={{fontSize:10,padding:'2px 8px',cursor:'pointer'}}>全部</span>
      </div>
    </div>}
        </span>
        <button onClick={async()=>{try{const r=await fetch(API+'/api/insights/export-inventory');const b=await r.blob();const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='inventory_'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(a);a.click();a.remove()}catch(e){toast.error('导出失败')}}}
          className='btn btn-ghost' style={{fontSize:12,padding:'4px 12px',display:'flex',alignItems:'center',gap:4}}><IconExport size={14} /> 导出</button>
      </span>
    </div>
    <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
      <span onClick={()=>{setWhType('own');const d=WH_COLS['own'].map(c=>c.id);setVisCols(getVis('own')||d);localStorage.setItem(COL_KEY+'_own',JSON.stringify(d))}} className="btn btn-ghost" style={{fontSize:12,padding:'4px 12px',cursor:'pointer',background:whType==='own'?'var(--primary)':'transparent',color:whType==='own'?'#fff':''}}>自有仓</span>
      <span onClick={()=>{setWhType('platform');const d=WH_COLS['platform'].map(c=>c.id);setVisCols(getVis('platform')||d);localStorage.setItem(COL_KEY+'_platform',JSON.stringify(d))}} className="btn btn-ghost" style={{fontSize:12,padding:'4px 12px',cursor:'pointer',background:whType==='platform'?'var(--primary)':'transparent',color:whType==='platform'?'#fff':''}}>平台仓</span>
      <span onClick={()=>{setWhType('platform_b');const d=WH_COLS['platform_b'].map(c=>c.id);setVisCols(getVis('platform_b')||d);localStorage.setItem(COL_KEY+'_platform_b',JSON.stringify(d))}} className="btn btn-ghost" style={{fontSize:12,padding:'4px 12px',cursor:'pointer',background:whType==='platform_b'?'var(--primary)':'transparent',color:whType==='platform_b'?'#fff':''}}>B仓</span>
    </div>
    <div className='search-bar' style={{maxWidth:200,marginBottom:12}}>
      <IconSearch size={16} style={{color:'var(--muted2)',flexShrink:0}} />
      <input value={s} onChange={e=>setS(e.target.value)} placeholder='搜索SKU/商品名' enterKeyHint='search' autoCorrect='off' />
    </div>
    {loading ? <div>{[1,2,3,4].map(i=><div key={i} className='skeleton' style={{height:36,marginBottom:4}}/>)}</div>
    : fl.length === 0
      ? <EmptyState icon='package' title={s?'无匹配':'暂无数据'} desc={s?'换个关键词试试':'通过清洗导入数据'} />
      : <div style={{overflowX:'auto'}}>
        <div style={{fontSize:11,color:'var(--muted2)',marginBottom:4}}>显示 {visCols.length}/{WH_COLS[whType].length} 列</div>
      <table><colgroup>{visCols.map(id=>{const col=WH_COLS[whType].find(c=>c.id===id);return col?<col key={col.id} />:null})}</colgroup>
        <thead><tr>{visCols.map(id=>{const col=WH_COLS[whType].find(c=>c.id===id);if(!col)return null;let el;if(col.id==='month_in')el=<th key={col.id}>{col.label}<br/><span className='small' style={{fontWeight:400}}>{monthRange}</span></th>;else if(col.id==='month_out')el=<th key={col.id}>{col.label}<br/><span className='small' style={{fontWeight:400}}>{monthRange}</span></th>;else el=<th key={col.id}>{col.label}</th>;return el})}</tr></thead>
      <tbody>{fl.map(x => {
        const isHL = highlightSku && x.sku === highlightSku
        const visCells = visCols.map(function(id){const col=WH_COLS[whType].find(function(c){return c.id===id});if(!col)return null;var el;if(col.id==='warehouse')el=React.createElement('td',{key:col.id,className:'col-store'},x.warehouse||'-');else if(col.id==='sku')el=React.createElement('td',{key:col.id,className:'mono col-sku'},x.sku);else if(col.id==='barcode')el=React.createElement('td',{key:col.id,className:'mono',style:{fontSize:11}},x.barcode||'-');else if(col.id==='name')el=React.createElement('td',{key:col.id,className:'col-name'},x.product_name);else if(col.id==='begin')el=React.createElement('td',{key:col.id,className:'col-qty',style:{fontWeight:600}},x.beginning_stock??'-');else if(col.id==='transit')el=React.createElement('td',{key:col.id,className:'col-qty'},x.in_transit_qty);else if(col.id==='month_in')el=React.createElement('td',{key:col.id,className:'col-qty'},x.month_inbound??0);else if(col.id==='month_out')el=React.createElement('td',{key:col.id,className:'col-qty',style:{fontWeight:600}},x.month_outbound??0);else if(col.id==='avail')el=React.createElement('td',{key:col.id,className:'col-qty',style:{fontWeight:600}},x.available_qty);else if(col.id==='turnover'){var tc=x.turnover_days;el=React.createElement('td',{key:col.id,className:'col-qty',style:{fontWeight:600,color:tc!=null&&tc>30?'#ef4444':tc!=null&&tc>15?'var(--warning)':'var(--text)'}},tc!=null?tc+'天':'∞')}return el})
        return React.createElement('tr',{key:x.id,id:'hl-'+x.sku,style:isHL?{background:'rgba(245,158,11,0.15)',outline:'2px solid #f59e0b'}:{}},visCells)
      })}
      </tbody>
      {totalTurnover != null && <tfoot>
        <tr style={{fontWeight:700,borderTop:'2px solid var(--border)'}}>
          <td colSpan={5} style={{textAlign:'right',fontSize:12}}>合计</td>
          <td>{inventory.reduce((s,x)=>s+(x.month_inbound||0),0)}</td>
          <td>{inventory.reduce((s,x)=>s+(x.month_outbound||0),0)}</td>
          <td>{inventory.reduce((s,x)=>s+(x.available_qty||0),0)}</td>
          <td style={{fontSize:13}}>{totalTurnover} 天</td>
          <td></td>
        </tr>
      </tfoot>}
              </table>
    </div>}
    <ConfirmDialog open={!!confirmDel} title='删除库存记录' desc='删除后不可恢复' confirmLabel='删除' onConfirm={delInv} onCancel={()=>setConfirmDel(null)} />
  </div>
}
