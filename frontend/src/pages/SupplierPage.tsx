import React,{useEffect,useState, useRef} from 'react'
import {api} from '../api/client'
import EmptyState from '../components/EmptyState'

const COLS = [{id:'code',label:'编号'},{id:'name',label:'名称'},{id:'contact',label:'联系人'},{id:'phone',label:'手机'},{id:'score',label:'评分'}]
const COL_KEY = () => 'c_cols_suppliers_' + (useAppStore.getState().channel || 'jd')
const getVis=()=>{try{return JSON.parse(localStorage.getItem(COL_KEY())||'null')}catch{return <td key={col.id} className="small muted" style={{fontSize:11}}>-</td>}}

function Skeleton(){return <div>{[1,2,3].map(i=><div key={i} style={{display:'flex',gap:8,padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
  <div className="skeleton" style={{width:60,height:14}}/><div className="skeleton" style={{flex:1,height:14}}/>
  <div className="skeleton" style={{width:50,height:14}}/><div className="skeleton" style={{width:40,height:14}}/>
</div>)}</div>}

import { useAppStore } from '../store/useAppStore'
import { t } from "../locale"
export default function SupplierPage(){const[list,setList]=useState([]);const[ld,setLd]=useState(true)
const[visCols,setVisCols]=useState(()=>getVis(COL_KEY())||COLS.map(c=>c.id))
const { channelVersion, hammerCols, hammerSearch } = useAppStore()
useEffect(()=>{api.get('/api/suppliers').then(r=>{const d=r.data?.items||r.data||[];setList(d);setLd(false)}).catch(()=>setLd(false))},[channelVersion])
useEffect(() => { if (hammerCols?.suppliers) setVisCols(hammerCols.suppliers) }, [hammerCols])
if(ld)return<div className='card'><div className='section-title'><span>{t("nav.suppliers")}</span></div><Skeleton/></div>
const s = hammerSearch || ''
const fl=s?list.filter(x=>(x.supplier_name||x.name||'').includes(s)||(x.supplier_code||x.code||'').includes(s)||(x.contact_person||'').includes(s)||(x.contact_phone||x.phone||'').includes(s)):list
return<div className='card'><div className='section-title' style={{display:'flex',flexWrap:'wrap',gap:6,alignItems:'center'}}>
  <span>供应商管理 <span className='small muted'>{t("common.total")} {list.length} t("common.items")</span></span>
</div>
{fl.length===0?<EmptyState icon='factory' title={s?'t("supplier.empty_matched")':'t("supplier.empty")'}/>:<div style={{overflowX:"auto"}}>
<div style={{fontSize:11,color:'var(--muted2)',marginBottom:4}}>{t("common.showing")} {visCols.length}/{COLS.length} t("common.columns")</div>
<table><colgroup>{visCols.map(id=>{const col=COLS.find(c=>c.id===id);return col?<col key={col.id} />:null})}</colgroup>
<thead><tr>{visCols.map(id=>{const col=COLS.find(c=>c.id===id);return col?<th key={col.id}>{col.label}</th>:null})}</tr></thead>
<tbody>{fl.map(x=><tr key={x.id}>{visCols.map(id=>{const col=COLS.find(c=>c.id===id);if(!col)return <td key={col.id} className="small muted" style={{fontSize:11}}>-</td>;
  if(col.id==='code')return <td key={col.id} className='mono col-sku'>{x.supplier_code||x.code}</td>
  if(col.id==='name')return <td key={col.id} className='col-name'>{x.supplier_name}</td>
  if(col.id==='contact')return <td key={col.id} className='col-store'>{x.contact_person}</td>
  if(col.id==='phone')return <td key={col.id} className='col-store'>{x.contact_phone||x.phone}</td>
  if(col.id==='score')return <td key={col.id} className='col-price'><span className={'pill '+(x.score>3?'success':'warning')}>{x.score}/5</span></td>
  return <td key={col.id} className="small muted" style={{fontSize:11}}>-</td>
})}</tr>)}</tbody></table></div>}</div>}