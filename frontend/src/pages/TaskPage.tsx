import React, { useState, useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { t } from '../locale'

const API = import.meta.env.VITE_API_BASE_URL || 'https://overtrees.pythonanywhere.com'

const TYPE_LABEL = {
  seed: { label: '种子数据填充', icon: '🧩' },
  cleansing: { label: '数据清洗导入', icon: '🧹' },
  export: { label: '导出任务', icon: '📤' },
}
const STATUS_LABEL = { pending: '等待中', running: '进行中', done: '已完成', error: '失败' }

export default function TaskPage() {
  const { channel } = useAppStore()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  const loadTasks = async () => {
    try {
      const r = await fetch(API + '/api/tasks?channel=' + channel, { headers: { 'Authorization': 'Bearer ' + (() => { try { return localStorage.getItem('c_token') } catch { return '' } })() } })
      const d = await r.json()
      if (d.ok && d.data) setTasks(d.data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadTasks() }, [channel])
  useEffect(() => { const poll = setInterval(loadTasks, 5000); return () => clearInterval(poll) }, [channel])

  const download = async (filename) => {
    try {
      const dl = await fetch(API + '/api/exports/download/' + filename, { headers: { 'Authorization': 'Bearer ' + (() => { try { return localStorage.getItem('c_token') } catch { return '' } })() } })
      const blob = await dl.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
      a.download = filename; a.click()
    } catch {}
  }

  return (
    <div className="card">
      <div className="section-title">任务管理</div>
      <div className="small muted" style={{ padding: '0 0 8px 0', fontSize: 12 }}>{channel === 'jd' ? '京东' : '其他渠道'} · 异步任务</div>
      {loading ? <div className="skeleton" style={{ height: 40 }} /> :
        tasks.length === 0 ? <div className="small muted" style={{ padding: 24, textAlign: 'center' }}>暂无任务</div> :
          tasks.map(task => {
            const type = task.task_type === 'export' ? 'export' :
              task.task_type === 'seed' ? 'seed' : 'cleansing'
            const meta = TYPE_LABEL[type] || { label: '任务', icon: '📋' }
            const st = task.status
            const result = task.result ? (typeof task.result === 'string' ? safeParse(task.result) : task.result) : null
            const filename = result?.filename || ''
            return (
              <div key={task.task_id} className="task-card">
                <div className="task-card-icon">{meta.icon}</div>
                <div className="task-card-body">
                  <div className="task-card-title">
                    <span className="ellipsis">{meta.label}</span>
                    <span className={'task-status ' + st}>{STATUS_LABEL[st]}</span>
                  </div>
                  <div className="task-card-sub">{task.task_id.slice(0,22)}</div>
                  {task.created_at && <div className="task-card-time">{task.created_at.slice(0,19)}</div>}
                  {st === 'running' && <div className="hero-progress"><div className="hero-progress-bar" /></div>}
                </div>
                {st === 'done' && filename && (
                  <button className="task-download" onClick={() => download(filename)} title="下载文件">下载</button>
                )}
              </div>
            )
          })
      }
    </div>
  )
}

function safeParse(s) {
  try { return JSON.parse(s) } catch { return null }
}