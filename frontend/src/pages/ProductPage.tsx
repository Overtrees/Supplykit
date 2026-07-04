import React,{useEffect,useState} from 'react'
import {api} from '../api/client'
import EmptyState from '../components/EmptyState'
export default function ProductPage(){const[list,setList]=useState([]);const[s,setS]=useState('');const[ld,setLd]=useState(true)
useEffect(()=>{api.get('/api/products').then(r=>{setList(r.data?.items||r.data||[]);setLd(false)}).catch(()=>setLd(false))},[])
if(ld)return<div className='card'><div className='muted'>加载中...</div></div>
const fl=s?list.filter(x=>(x.sku||'').includes(s)||(x.product_name||'').includes(s)||(x.store||'').includes(s)):list
return<div className='card' style={{containerType:'inline-size'}}><div className='section-title'><span>商品管理</span><span className='small muted'>共 {list.length} 个</span></div>
<input value={s} onChange={e=>setS(e.target.value)} placeholder='搜索SKU/名称/店铺...' style={{width:'100%',padding:'8px 12px',fontSize:16,border:'1px solid #e2e8f0',borderRadius:8,marginBottom:12,outline:'none',boxSizing:'border-box'}}/>
{fl.length===0?<EmptyState icon='🏷️' title={s?'无匹配商品':'暂无商品'} desc={s?'换个关键词试试':''}/>:<div style={{overflowX:"auto"}}>
<div style={{fontSize:11,color:'var(--muted2)',marginBottom:4}}>共 7 列 · 左右滑动查看</div>
<table><thead><tr>{['SKU','名称','店铺','分类','单价','箱规','状态'].map(h=><th key={h}>{h}</th>)}</tr></thead>
<tbody>{fl.map(x=><tr key={x.id}><td className='mono col-sku'>{x.sku}</td><td className='col-name'>{x.product_name}</td><td className='col-store'>{x.store}</td><td className='col-store'>{x.category}</td><td className='col-price'>¥{x.price}</td><td className='col-qty' style={{fontSize:12}}>{x.box_qty||1}瓶/箱</td><td><span className={'pill '+(x.status==='active'?'success':'warning')}>{x.status==='active'?'在售':x.status}</span></td></tr>)}</tbody></table></div>}</div>}
