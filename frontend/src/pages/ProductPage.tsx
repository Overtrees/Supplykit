import React,{useEffect,useState} from 'react'
import {api} from '../api/client'
import EmptyState from '../components/EmptyState'

const COLS = [
  {id:'sku',label:'SKU'},{id:'name',label:'名称'},{id:'store',label:'店铺'},
  {id:'cat',label:'分类'},{id:'price',label:'单价'},{id:'box',label:'箱规'},{id:'status',label:'状态'},
]
const COL_KEY = 'c_cols_products'
const getVis = () => { try { return JSON.parse(localStorage.getItem(COL_KEY)||'null') } catch { return null } }

function Skeleton(){return <div>{[1,2,3,4].map(i=><div key={i} style={{display:'flex',gap:8,padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
  <div className="skeleton" style={{width:70,height:14}}/><div className="skeleton" style={{flex:1,height:14}}/>
  <div className="skeleton" style={{width:50,height:14}}/><div className="skeleton" style={{width:40,height:14}}/>
  <div className="skeleton" style={{width:50,height:14}}/><div className="skeleton" style={{width:40,height:14}}/>
</div>)}</div>}

export default function ProductPage(){const[list,setList]=useState([]);const[s,setS]=useState('');const[ld,setLd]=useState(true)
const[visCols,setVisCols]=useState(()=>getVis()||COLS.map(c=>c.id));const[showPicker,setShowPicker]=useState(false)
useEffect(()=>{api.get('/api/products').then(r=>{setList(r.data?.items||r.data||[]);setLd(false)}).catch(()=>setLd(false))},[])
if(ld)return<div className='card'><div className='section-title'><span>商品管理</span></div><Skeleton/></div>
const fl=s?list.filter(x=>(x.sku||'').includes(s)||(x.product_name||'').includes(s)||(x.store||'').includes(s)):list
return<div className='card' style={{containerType:'inline-size'}}>
<div className='section-title' style={{display:'flex',flexWrap:'wrap',gap:6,alignItems:'center'}}>
  <span>商品管理 <span className='small muted'>共 {list.length} 个</span></span>
  <span style={{marginLeft:'auto',position:'relative',display:'inline-block'}}>
    <span onClick={()=>setShowPicker(!showPicker)} className="btn btn-ghost" style={{fontSize:11,padding:'2px 10px',cursor:'pointer'}}>列 {visCols.length}/{COLS.length}</span>
    {showPicker && <div style={{position:'absolute',top:'100%',right:0,zIndex:10,background:'var(--card)',border:'1px solid var(--border)',borderRadius:16,padding:8,minWidth:140,boxShadow:'0 4px 12px rgba(0,0,0,0.15)'}}>
      {COLS.map(col => <label key={col.id} style={{display:'flex',alignItems:'center',gap:6,padding:'3px 4',fontSize:12,cursor:'pointer',whiteSpace:'nowrap'}}>
        <input type="checkbox" checked={visCols.includes(col.id)} onChange={e=>{const n=e.target.checked?[...visCols,col.id]:visCols.filter(c=>c!==col.id);setVisCols(n);localStorage.setItem(COL_KEY,JSON.stringify(n))}} style={{accentColor:'var(--primary)'}} />
        {col.label}
      </label>)}
      <div style={{borderTop:'1px solid var(--border)',marginTop:4,paddingTop:4}}>
        <span onClick={()=>{const d=COLS.map(c=>c.id);setVisCols(d);localStorage.setItem(COL_KEY,JSON.stringify(d));setShowPicker(false)}} className="btn btn-ghost" style={{fontSize:10,padding:'2px 8px',cursor:'pointer'}}>全部</span>
      </div>
    </div>}
  </span>
</div>
<input value={s} onChange={e=>setS(e.target.value)} placeholder='搜索SKU/名称/店铺...' style={{width:'100%',padding:'8px 12px',fontSize:16,border:'1px solid var(--border)',borderRadius:32,marginBottom:12,outline:'none',boxSizing:'border-box'}}/>
{fl.length===0?<EmptyState icon='tag' title={s?'无匹配商品':'暂无商品'} desc={s?'换个关键词试试':''}/>:<div style={{overflowX:"auto"}}>
<div style={{fontSize:11,color:'var(--muted2)',marginBottom:4}}>显示 {visCols.length}/{COLS.length} 列</div>
<table><colgroup>{COLS.map(col=><col key={col.id} style={visCols.includes(col.id)?{}:{display:'none'}} />)}</colgroup>
<thead><tr>{COLS.filter(c=>visCols.includes(c.id)).map(h=><th key={h.id}>{h.label}</th>)}</tr></thead>
<tbody>{fl.map(x=><tr key={x.id}>{COLS.filter(c=>visCols.includes(c.id)).map(c=>{
  if(c.id==='sku')return <td key={c.id} className='mono col-sku'>{x.sku}</td>
  if(c.id==='name')return <td key={c.id} className='col-name'>{x.product_name}</td>
  if(c.id==='store')return <td key={c.id} className='col-store'>{x.store}</td>
  if(c.id==='cat')return <td key={c.id} className='col-store'>{x.category}</td>
  if(c.id==='price')return <td key={c.id} className='col-price'>¥{x.price}</td>
  if(c.id==='box')return <td key={c.id} className='col-qty' style={{fontSize:12}}>{x.box_qty||1}瓶/箱</td>
  if(c.id==='status')return <td key={c.id}><span className={'pill '+(x.status==='active'?'success':'warning')}>{x.status==='active'?'在售':x.status}</span></td>
  return null
})}</tr>)}</tbody></table></div>}</div>}