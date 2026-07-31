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
export default function SupplierPage(){const[list,setList]=useState([]);const[s,setS]=useState('');const[ld,setLd]=useState(true)
const[visCols,setVisCols]=useState(()=>getVis(COL_KEY())||COLS.map(c=>c.id));const[showPicker,setShowPicker]=useState(false)
const { channelVersion } = useAppStore()
useEffect(()=>{api.get('/api/suppliers').then(r=>{const d=r.data?.items||r.data||[];setList(d);setLd(false)}).catch(()=>setLd(false))},[channelVersion])
if(ld)return<div className='card'><div className='section-title'><span>供应商管理</span></div><Skeleton/></div>
const fl=s?list.filter(x=>(x.supplier_name||x.code||'').includes(s)||(x.contact_person||'').includes(s)):list
return<div className='card'><div className='section-title' style={{display:'flex',flexWrap:'wrap',gap:6,alignItems:'center'}}>
  <span>供应商管理 <span className='small muted'>共 {list.length} 个</span></span>
  <span style={{marginLeft:'auto',position:'relative',display:'inline-block'}}>
    <span onClick={()=>setShowPicker(!showPicker)} className="btn btn-ghost" style={{fontSize:11,padding:'2px 10px',cursor:'pointer'}}>列 {visCols.length}/{COLS.length}</span>
    
    {showPicker && <div style={{position:'absolute',top:'100%',right:0,zIndex:10,background:'var(--card)',border:'1px solid var(--border)',borderRadius:16,padding:6,minWidth:180,boxShadow:'0 4px 12px rgba(0,0,0,0.15)'}}>
      <div style={{fontSize:10,color:'var(--muted2)',marginBottom:4,padding:'0 4px'}}>拖拽 ⠿ 调整列顺序</div>
      {(visCols.map(id=>COLS.find(c=>c.id===id)).filter(Boolean).concat(COLS.filter(c=>!visCols.includes(c.id)))).map((col,idx)=>{
        const isVis=visCols.includes(col.id)
        return <div key={col.id} draggable={isVis?true:undefined}
          onDragStart={isVis?e=>{e.dataTransfer.setData('text/plain',col.id);e.target.style.opacity='0.4';e.currentTarget.parentNode._dragId=col.id}:undefined}
          onDragEnd={isVis?e=>e.target.style.opacity='1':undefined}
          onDragOver={isVis?e=>{e.preventDefault();e.currentTarget.style.borderTop='2px solid var(--primary)';const from=e.currentTarget.parentNode._dragId;if(from&&from!==col.id){const nxt=visCols.filter(c=>c!==from);const toIdx=nxt.indexOf(col.id);nxt.splice(toIdx,0,from);setVisCols(nxt);localStorage.setItem(COL_KEY(),JSON.stringify(nxt))}}:undefined}
          onDragLeave={isVis?e=>e.currentTarget.style.borderTop='1px solid transparent':undefined}
          onDrop={isVis?e=>{e.preventDefault();e.currentTarget.style.borderTop='1px solid transparent';const from=e.dataTransfer.getData('text/plain');if(from===col.id)return;const nxt=visCols.filter(c=>c!==from);const toIdx=nxt.indexOf(col.id);nxt.splice(toIdx,0,from);setVisCols(nxt);localStorage.setItem(COL_KEY(),JSON.stringify(nxt));e.currentTarget.parentNode._dragId=null}:undefined}
          onTouchStart={isVis?e=>{const t=e.touches[0];e.currentTarget._dragStart={x:t.clientX,y:t.clientY,id:col.id}}:undefined}
          onTouchMove={isVis?e=>{e.preventDefault();const t=e.touches[0];const el=document.elementFromPoint(t.clientX,t.clientY);if(el&&el!==e.currentTarget&&el._dragStart)el.style.borderTop='2px solid var(--primary)'}:undefined}
          onTouchEnd={isVis?e=>{const start=e.currentTarget._dragStart;if(!start)return;const t=e.changedTouches[0];const dropEl=document.elementFromPoint(t.clientX,t.clientY);if(dropEl&&dropEl._dragStart&&dropEl._dragStart.id!==start.id){const from=start.id;const to=dropEl._dragStart.id;const nxt=visCols.filter(c=>c!==from);const toIdx=nxt.indexOf(to);nxt.splice(toIdx,0,from);setVisCols(nxt);localStorage.setItem(COL_KEY(),JSON.stringify(nxt))}}:undefined}
          style={{display:'flex',alignItems:'center',gap:4,padding:'4px 6px',borderRadius:6,cursor:isVis?'grab':'default',fontSize:12,whiteSpace:'nowrap',borderTop:'1px solid transparent',background:isVis?'var(--card)':'transparent',opacity:isVis?1:0.4,userSelect:'none',WebkitUserSelect:'none'}}>
          <span style={{color:'var(--muted2)',fontSize:12,width:16,flexShrink:0,textAlign:'center',cursor:isVis?'grab':'default'}}>{isVis?'⠿':'○'}</span>
          <input type="checkbox" checked={isVis} onChange={e=>{const n=e.target.checked?[...visCols,col.id]:visCols.filter(c=>c!==col.id);setVisCols(n);localStorage.setItem(COL_KEY(),JSON.stringify(n))}} style={{accentColor:'var(--primary)'}} />
          <span style={{flex:1}}>{col.label}</span>
          <span style={{fontSize:9,color:'var(--muted2)'}}>{isVis?'#'+(visCols.indexOf(col.id)+1):''}</span>
        </div>
      })}
      <div style={{borderTop:'1px solid var(--border)',marginTop:4,paddingTop:4}}>
        <span onClick={()=>{const d=COLS.map(c=>c.id);setVisCols(d);localStorage.setItem(COL_KEY(),JSON.stringify(d));setShowPicker(false)}} className="btn btn-ghost" style={{fontSize:10,padding:'2px 8px',cursor:'pointer'}}>全部</span>
      </div>
    </div>}

  </span>
</div>
<input value={s} onChange={e=>setS(e.target.value)} placeholder='搜索供应商...' style={{width:'100%',padding:'8px 12px',fontSize:16,border:'1px solid var(--border)',borderRadius:32,marginBottom:12,outline:'none',boxSizing:'border-box'}}/>
{fl.length===0?<EmptyState icon='factory' title={s?'无匹配供应商':'暂无供应商'}/>:<div style={{overflowX:"auto"}}>
<div style={{fontSize:11,color:'var(--muted2)',marginBottom:4}}>显示 {visCols.length}/{COLS.length} 列</div>
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