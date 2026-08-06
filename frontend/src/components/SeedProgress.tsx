import React, { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_BASE_URL || 'https://overtrees.pythonanywhere.com'

export default function SeedProgress() {
  const [taskId, setTaskId] = useState(localStorage.getItem('c_seed_task') || '')
  const [status, setStatus] = useState('pending')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!taskId) return
    const poll = setInterval(async () => {
      try {
        const r = await fetch(API + '/api/seed/fill/status?task_id=' + taskId)
        const d = await r.json()
        if (d.data?.status === 'done') {
          clearInterval(poll); setStatus('done')
          setTimeout(() => { localStorage.removeItem('c_seed_task'); window.location.reload() }, 1500)
        } else if (d.data?.status === 'error') {
          clearInterval(poll); setStatus('error'); setMessage(d.data?.error || '')
        } else if (d.data?.status === 'running') {
          setStatus('running')
        }
      } catch {}
    }, 3000)
    return () => clearInterval(poll)
  }, [taskId])

  if (!taskId) return null

  return (
    <div className="card" style={{marginTop:12}}>
      <div className="section-title">种子数据填充进度</div>
      <div className="flex items-center gap-8" style={{padding:'4px 0'}}>
        <span className={'seed-status seed-status-' + status} />
        <span className="text-12">
          {status === 'done' ? '✅ 填充完成，即将刷新...' :
           status === 'error' ? '❌ 填充失败: ' + message :
           status === 'running' ? '⏳ 正在填充数据（约 3-5 分钟）...' :
           '⏳ 任务已提交，等待执行...'}
        </span>
      </div>
      <div className="mt-12">
        <button onClick={() => { localStorage.removeItem('c_seed_task'); setTaskId(''); window.location.reload() }}
          className="btn btn-ghost text-12" style={{padding:'4px 12px'}}>取消并刷新</button>
      </div>
    </div>
  )
}