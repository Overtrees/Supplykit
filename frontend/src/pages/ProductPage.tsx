import React,{useEffect,useState, useRef} from 'react'
import {api} from '../api/client'
import { useToast } from '../components/Toast'
import EmptyState from '../components/EmptyState'

import { useAppStore } from '../store/useAppStore'
import { t } from "../locale"
const COLS = [
  {id:'barcode',label:'69码'},{id:'channel',label:'平台'},{id:'sku',label:'SKU'},{id:'name',label:'名称'},{id:'store',label:'店铺'},
  {id:'cat',label:'分类'},{id:'price',label:'单价'},{id:'box',label:'箱规'},{id:'unit',label:'单位'},{id:'weight',label:'箱重/KG'},{id:'volume',label:'体积/方'},{id:'batch_days',label:'总效期/天'},{id:'status',label:'状态'},
]
const COL_KEY = () => 'c_cols_products_' + (useAppStore.getState().channel || 'jd')
const getVis = () => { try { return JSON.parse(localStorage.getItem(COL_KEY())||'null') } catch{return null} }

function Skeleton(){return <div>{[1,2,3,4].map(i=><div key={i} style={{display:'flex',gap:8,padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
  <div className="skeleton" style={{width:70,height:14}}/><div className="skeleton" style={{flex:1,height:14}}/>
  <div className="skeleton" style={{width:50,height:14}}/><div className="skeleton" style={{width:40,height:14}}/>
  <div className="skeleton" style={{width:50,height:14}}/><div className="skeleton" style={{width:40,height:14}}/>
</div>)}</div>}

export default function ProductPage(){const[list,setList]=useState([]);const[ld,setLd]=useState(true)
const[visCols,setVisCols]=useState(()=>getVis(COL_KEY())||COLS.map(c=>c.id))
const toast = useToast()
const { channel: globalChannel, hammerSearch, hammerCols, prodBatch, setProdBatch } = useAppStore()
const [selIds, setSelIds] = useState([])
const [batchBusy, setBatchBusy] = useState(false)
useEffect(()=>{setLd(true);api.get('/api/products').then(r=>{setList(r.data?.items||r.data||[]);setLd(false)}).catch(()=>setLd(false))}, [globalChannel])
useEffect(() => {
  if (hammerCols?.products) setVisCols(hammerCols.products)
}, [hammerCols])
// 退出批量模式时清空选择
useEffect(()=>{ if(!prodBatch) setSelIds([]) },[prodBatch])
const reload = () => { api.get('/api/products').then(r=>setList(r.data?.items||r.data||[])).catch(()=>{}) }
const doBatch = async (action, label) => {
  if (selIds.length === 0) { toast.error('请先勾选商品'); return }
  if (action === 'delete' && !window.confirm('删除 ' + selIds.length + ' 个商品？可在回收站恢复')) return
  setBatchBusy(true)
  try {
    await api.post('/api/products/batch', { action, ids: selIds })
    toast.success(label + '完成: ' + selIds.length + ' 项')
    setSelIds([]); setProdBatch(false); reload()
  } catch(e) { toast.error(label + '失败: ' + (e.message||'')) }
  setBatchBusy(false)
}
if(ld)return<div className='card'><div className='section-title'><span>{t("nav.products")}</span></div><Skeleton/></div>
const s = hammerSearch || ''
const fl=s?list.filter(x=>(x.sku||'').includes(s)||(x.product_name||'').includes(s)||(x.store||'').includes(s)):list
return<div className='card' style={{containerType:'inline-size'}}>
<div className='section-title' style={{display:'flex',flexWrap:'wrap',gap:6,alignItems:'center'}}>
  <span>商品管理 <span className='small muted'>{t("common.total")} {list.length} {t("common.items")}</span></span>
</div>
{fl.length===0?<EmptyState icon='tag' title={s?t("product.empty_matched"):t("product.empty")} desc={s?'换个关键词试试':'通过清洗页导入商品数据'} action={!s&&<button className="btn btn-primary" onClick={()=>window.__setPage&&window.__setPage('cleansing')}>去导入数据 →</button>}/>:<div style={{overflow:'auto',maxHeight:"calc(100vh - 180px)"}}>
{prodBatch && <div style={{position:'sticky',top:0,zIndex:5,padding:'8px 10px',marginBottom:8,background:'var(--bg-thin)',backdropFilter:'var(--blur-thin)',borderRadius:24,border:'1px solid var(--border)',display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
  <span style={{fontSize:12,fontWeight:600,color:'var(--text)'}}>已选 {selIds.length}/{fl.length}</span>
  <span onClick={()=>{const all=fl.map(x=>x.id);setSelIds(selIds.length===fl.length?[]:all)}} className="clickable" style={{fontSize:12,padding:'5px 12px',borderRadius:99,border:'1px solid var(--border)',background:'var(--card)',cursor:'pointer'}}>{selIds.length===fl.length&&fl.length>0?'取消全选':'全选'}</span>
  <span onClick={()=>doBatch('active','启用')} className="clickable" style={{fontSize:12,padding:'5px 12px',borderRadius:99,border:'1px solid var(--border)',background:'var(--card)',color:'var(--success)',cursor:'pointer'}}>批量启用</span>
  <span onClick={()=>doBatch('inactive','停用')} className="clickable" style={{fontSize:12,padding:'5px 12px',borderRadius:99,border:'1px solid var(--border)',background:'var(--card)',color:'var(--warning)',cursor:'pointer'}}>批量停用</span>
  <span onClick={()=>doBatch('delete','删除')} className="clickable" style={{fontSize:12,padding:'5px 12px',borderRadius:99,border:'1px solid var(--border)',background:'var(--card)',color:'var(--danger)',cursor:'pointer'}}>批量删除</span>
  <button onClick={()=>setProdBatch(false)} className="clickable" style={{fontSize:12,padding:'5px 12px',borderRadius:99,border:'1px solid var(--border)',background:'var(--card)',cursor:'pointer',marginLeft:'auto'}}>退出</button>
  {batchBusy && <span style={{fontSize:11,color:'var(--muted2)'}}>处理中...</span>}
</div>}
<div style={{fontSize:11,color:'var(--muted2)',marginBottom:4}}>{t("common.showing")} {visCols.length}/{COLS.length} {t("common.columns")}</div>
<table><colgroup>{visCols.map(id=>{const col=COLS.find(c=>c.id===id);return col?<col key={col.id} />:null})}</colgroup>
<thead style={{position:"sticky",top:0,background:"var(--card)",zIndex:1}}><tr>{prodBatch&&<th style={{width:30}}></th>}{visCols.map(id=>{const col=COLS.find(c=>c.id===id);return col?<th key={col.id}>{col.label}</th>:null})}</tr></thead>
<tbody>{fl.map(x=><tr key={x.id} style={prodBatch&&selIds.includes(x.id)?{background:'rgba(29,78,216,0.08)'}:undefined}>{prodBatch&&<td className="clickable" onClick={()=>setSelIds(prev=>prev.includes(x.id)?prev.filter(i=>i!==x.id):[...prev,x.id])}><span style={{width:18,height:18,borderRadius:6,border:'1.5px solid',borderColor:selIds.includes(x.id)?'var(--primary)':'var(--border)',background:selIds.includes(x.id)?'var(--primary)':'transparent',display:'inline-flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:11}}>{selIds.includes(x.id)?'✓':''}</span></td>}{visCols.map(id=>{const col=COLS.find(c=>c.id===id);if(!col)return <td key={col.id} className="small muted" style={{fontSize:11}}>-</td>;
  if(col.id==='barcode')return <td key={col.id} className='mono' style={{fontSize:11}}>{x.barcode||'-'}</td>
  if(col.id==='channel')return <td key={col.id} style={{fontSize:11}}>{(useAppStore.getState().channel)==='other'?'其他':'京东'}</td>
  if(col.id==='sku')return <td key={col.id} className='mono col-sku'>{x.sku}</td>
  if(col.id==='name')return <td key={col.id} className='col-name'>{x.product_name}</td>
  if(col.id==='store')return <td key={col.id} className='col-store'>{x.store}</td>
  if(col.id==='cat')return <td key={col.id} className='col-store'>{x.category}</td>
  if(col.id==='price')return <td key={col.id} className='col-price'>¥{x.price}</td>
  if(col.id==='box')return <td key={col.id} className='col-qty' style={{fontSize:12}}>{x.box_qty||1}</td>
  if(col.id==='unit')return <td key={col.id} className='col-qty' style={{fontSize:12}}>{x.unit||'瓶'}</td>
  if(col.id==='weight')return <td key={col.id} className='col-qty' style={{fontSize:12}}>{x.weight||'-'}</td>
  if(col.id==='volume')return <td key={col.id} className='col-qty' style={{fontSize:12}}>{x.volume||'-'}</td>
  if(col.id==='batch_days')return <td key={col.id} className='col-qty' style={{fontSize:12}}>{x.batch_days||'-'}</td>
  if(col.id==='status')return <td key={col.id}><span className={'pill '+(x.status==='active'?'success':'warning')}>{x.status==='active'?'在售':x.status}</span></td>
  return <td key={col.id} className="small muted" style={{fontSize:11}}>-</td>
})}
</tr>)}
</tbody></table>
</div>}
</div>}