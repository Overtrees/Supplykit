import React, { useState, useEffect } from 'react'
import { IconDownload, IconCheck, IconLoading, IconClose } from './Icons'
const API = import.meta.env.VITE_API_BASE_URL || 'https://overtrees.pythonanywhere.com'

export default function ExportProgress() {
  const [tasks, setTasks] = useState([])
  const [dismissed, setDismissed] = useState({})

  useEffect(() => {
    const refresh = () => {
      try {
        const raw = localStorage.getItem('c_export_task')
        if (!raw) { setTasks([]); return }
        const parsed = JSON.parse(raw)
        if (!parsed.task_id) { setTasks([]); return }
        // 合并已完成任务，避免重复显示
        setTasks(prev => {
          const exists = prev.find(t => t.id === parsed.task_id)
          if (exists) return prev
          return [...prev, { id: parsed.task_id, type: 'export', label: '导出任务', status: 'running', ts: Date.now() }]
        })
      } catch {}
    }
    refresh()
    const timer = setInterval(refresh, 3000)
    return () => clearInterval(timer)
  }, [])

  // 轮询每个任务的状态
  useEffect(() => {
    if (tasks.length === 0) return
    const poll = setInterval(async () => {
      const updated = await Promise.all(tasks.map(async t => {
        if (t.status !== 'running') return t
        try {
          const r = await fetch(API + '/api/seed/fill/status?task_id=' + t.id, {headers:{'Authorization':'Bearer '+(()=>{try{return localStorage.getItem('c_token')}catch{return ''}})()}})
          const d = await r.json()
          if (d.data?.status === 'done') {
            const fn = d.data?.result?.filename || ''
            return { ...t, status: 'done', filename: fn }
          } else if (d.data?.status === 'error') {
            return { ...t, status: 'error' }
          }
        } catch {}
        return t
      }))
      setTasks(updated)
    }, 3000)
    return () => clearInterval(poll)
  }, [tasks.length])

  const active = tasks.filter(t => t.status === 'running')
  const done = tasks.filter(t => t.status !== 'running' && !dismissed[t.id])
  if (active.length === 0 && done.length === 0) return null

  return (
    <div style={{position:'fixed',bottom:80,right:16,zIndex:999,display:'flex',flexDirection:'column',gap:8,maxWidth:280}}>
      {active.map(t => (
        <div key={t.id} style={{background:'var(--card)',borderRadius:16,padding:'12px 16px',boxShadow:'var(--shadow-card)',display:'flex',alignItems:'center',gap:10}}>
          <span className="hammer-spinner" style={{width:16,height:16,borderWidth:2}} />
          <div style={{flex:1,fontSize:13}}>导出任务进行中...</div>
        </div>
      ))}
      {done.map(t => (
        <div key={t.id} style={{background:'var(--card)',borderRadius:16,padding:'12px 16px',boxShadow:'var(--shadow-card)',display:'flex',alignItems:'center',gap:10}}>
          <IconCheck size={16} color="var(--primary)" />
          <div style={{flex:1,fontSize:13}}>
            {t.status === 'done' ? (t.filename ? `导出完成: ${t.filename}` : '导出完成') : '导出失败'}
          </div>
          {t.status === 'done' && t.filename && (
            <button onClick={async () => {
              const dl = await fetch(API + '/api/exports/download/' + t.filename, {headers:{'Authorization':'Bearer '+(()=>{try{return localStorage.getItem('c_token')}catch{return ''}})()}})
              const blob = await dl.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
              a.download = t.filename; a.click()
            }} style={{border:'none',background:'var(--primary)',color:'#fff',borderRadius:99,padding:'4px 10px',fontSize:12,cursor:'pointer'}}>
              <IconDownload size={12} /> 下载
            </button>
          )}
          <button onClick={() => setDismissed(p => ({...p, [t.id]: true}))} style={{border:'none',background:'transparent',cursor:'pointer',color:'var(--muted2)',padding:0}}>
            <IconClose size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}