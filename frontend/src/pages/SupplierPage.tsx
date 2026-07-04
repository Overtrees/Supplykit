import React,{useEffect,useState} from 'react'
import {api} from '../api/client'
import EmptyState from '../components/EmptyState'
export default function SupplierPage(){const[list,setList]=useState([]);const[s,setS]=useState('');const[ld,setLd]=useState(true)
useEffect(()=>{api.get('/api/suppliers').then(r=>{const d=r.data?.items||r.data||[];setList(d);setLd(false)}).catch(()=>setLd(false))},[])
if(ld)return<div className='card'><div className='muted'>加载中...</div></div>
const fl=s?list.filter(x=>(x.supplier_name||x.code||'').includes(s)||(x.contact_person||'').includes(s)):list
return<div className='card'><div className='section-title'><span>供应商管理</span><span className='small muted'>共 {list.length} 个</span></div>
<input value={s} onChange={e=>setS(e.target.value)} placeholder='搜索供应商...' style={{width:'100%',padding:'8px 12px',fontSize:16,border:'1px solid #e2e8f0',borderRadius:8,marginBottom:12,outline:'none',boxSizing:'border-box'}}/>
{fl.length===0?<EmptyState icon='🏭' title={s?'无匹配供应商':'暂无供应商'}/>:<div style={{overflowX:"auto"}}>
<div style={{fontSize:11,color:'var(--muted2)',marginBottom:4}}>共 5 列 · 左右滑动查看</div>
<table><thead><tr>{['编号','名称','联系人','手机','评分'].map(h=><th key={h}>{h}</th>)}</tr></thead>
<tbody>{fl.map(x=><tr key={x.id}><td className='mono col-sku'>{x.supplier_code||x.code}</td><td className='col-name'>{x.supplier_name}</td><td className='col-store'>{x.contact_person}</td><td className='col-store'>{x.contact_phone||x.phone}</td><td className='col-price'><span className={'pill '+(x.score>3?'success':'warning')}>{x.score}/5</span></td></tr>)}</tbody></table></div>}</div>}
