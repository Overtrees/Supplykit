import React, { useState, useEffect } from 'react'
import { IconCheck, IconLoading, IconUndo } from './Icons'

const API = import.meta.env.VITE_API_BASE_URL || 'https://overtrees.pythonanywhere.com'

export default function SeedProgress() {
  const [tasks, setTasks] = useState([])

  useEffect(() => {
    const refresh = () => {
      const list = []
      let seedTask = null, cleansingTask = null
      try { seedTask = localStorage.getItem('c_seed_task') } catch {}
      try { cleansingTask = JSON.parse(localStorage.getItem('c_cleansing_task') || 'null') } catch {}
      if (seedTask) list.push({ type: 'seed', id: seedTask, label: '种子数据填充' })
      if (cleansingTask && cleansingTask.task_id) list.push({ type: 'cleansing', id: cleansingTask.task_id, label: '数据清洗导入', progress: cleansingTask.progress })
      setTasks(list)
    }
    refresh()
    const timer = setInterval(refresh, 3000)
    return () => clearInterval(timer)
  }, [])

  if (tasks.length === 0) return null

  return (
    <div className="card mt-12">
      <div className="section-title text-12">后台任务</div>
      {tasks.map(t => (
        <TaskItem key={t.type + t.id} task={t} />
      ))}
    </div>
  )
}

function TaskItem({ task }) {
  const [status, setStatus] = useState('pending')
  const [message, setMessage] = useState('')
  const [progress, setProgress] = useState(task.progress || 0)
  const [steps, setSteps] = useState([])

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const url = task.type === 'seed'
          ? API + '/api/seed/fill/status?task_id=' + task.id
          : API + '/api/cleansing/task/' + task.id
        const r = await fetch(url)
        const d = await r.json()
        const data = d.data || d
        if (task.type === 'seed') {
          if (data.steps) setSteps(data.steps)
          if (data.status === 'done') { clearInterval(poll); setStatus('done'); setTimeout(() => { try{localStorage.removeItem('c_seed_task')}catch{}; window.location.reload() }, 1500) }
          else if (data.status === 'error') { clearInterval(poll); setStatus('error'); setMessage(data.error || '') }
          else if (data.status === 'running') setStatus('running')
        } else {
          if (data.status === 'done') { clearInterval(poll); setStatus('done'); setTimeout(() => { try{localStorage.removeItem('c_cleansing_task')}catch{}; window.location.reload() }, 1500) }
          else if (data.status === 'error') { clearInterval(poll); setStatus('error'); setMessage(data.error || '') }
          else if (data.progress !== undefined) { setProgress(data.progress); setStatus('running') }
        }
      } catch {}
    }, 3000)
    return () => clearInterval(poll)
  }, [task.id, task.type])

  return (
    <div className="flex-col gap-4" style={{padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
      <div className="flex items-center gap-8">
        <span className={'seed-status seed-status-' + status}>
          {status === 'running' && <IconLoading size={10} />}
        </span>
        <div className="flex-1">
          <div className="text-12 font-600">{task.label}</div>
          <div className="text-11 text-secondary">
            {status === 'done' ? <span className="flex items-center gap-4"><IconCheck size={12} /> 完成，即将刷新</span> :
             status === 'error' ? <span className="flex items-center gap-4"><IconUndo size={12} /> 失败: {message}</span> :
             status === 'running' ? (task.type === 'cleansing' ? '清洗中 ' + progress + '%' : '正在填充...') :
             '等待执行'}
          </div>
        </div>
        {status !== 'done' && (
          <button onClick={() => { try{localStorage.removeItem(task.type === 'seed' ? 'c_seed_task' : 'c_cleansing_task')}catch{}; window.location.reload() }}
            className="btn btn-ghost text-10" style={{padding:'2px 8px'}}>取消</button>
        )}
      </div>
      {/* 步骤进度 */}
      {task.type === 'seed' && steps.length > 0 && (
        <div className="flex-col gap-2" style={{paddingLeft:18,marginTop:4}}>
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-4 text-10">
              {s.status === 'ok' ? <span className="muted2"><IconCheck size={10} /></span> :
               s.status === 'error' ? <span className="danger"><IconUndo size={10} /></span> :
               <span className="muted2"><IconLoading size={10} /></span>}
              <span className={s.status === 'error' ? 'danger' : 'muted2'}>{s.name}</span>
              {s.status === 'error' && <span className="text-10 muted2">({s.error})</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}