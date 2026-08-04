import React from 'react'
import { IconLoading } from './Icons'

interface LoadingProps { text?: string }

export default function Loading({ text = '加载中...' }: LoadingProps) {
  return <div className="card" style={{textAlign:'center',padding:'60px 20px'}}>
    <div style={{fontSize:36,marginBottom:12,opacity:0.3,display:'flex',justifyContent:'center'}}><IconLoading size={36} /></div>
    <div className="small muted">{text}</div>
  </div>
}
