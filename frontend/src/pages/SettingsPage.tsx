import React, { useState, useEffect } from 'react'
import { api } from '../api/client'
import { useAppStore } from '../store/useAppStore'

const VERSION = '1.0.0'
const BUILD = import.meta.env.VITE_BUILD_TIME || '2026-07-31'

export default function SettingsPage() {
  const { channel } = useAppStore()
  const [status, setStatus] = useState('检查中...')
  const [ping, setPing] = useState(0)
  const [lastCheck, setLastCheck] = useState('')
  const [dbSize, setDbSize] = useState('')
  const [cacheSize, setCacheSize] = useState(0)

  const checkConnection = async () => {
    const start = performance.now()
    try {
      const r = await fetch('https://overtrees.pythonanywhere.com/api/insights/ping')
      const ms = Math.round(performance.now() - start)
      const d = await r.json()
      setStatus(d.ok ? '🟢 正常' : '🔴 异常')
      setPing(ms)
      setLastCheck(new Date().toLocaleTimeString())
    } catch {
      setStatus('🔴 无法连接')
      setPing(0)
      setLastCheck(new Date().toLocaleTimeString())
    }
  }

  useEffect(() => {
    checkConnection()
    const timer = setInterval(checkConnection, 30000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    try {
      const s = localStorage.length
      let total = 0
      for (let i = 0; i < s; i++) {
        const k = localStorage.key(i)
        if (k) total += (localStorage.getItem(k) || '').length
      }
      setCacheSize(Math.round(total / 1024))
    } catch {}
  }, [])

  const clearLocalCache = () => {
    const keys = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && (k.startsWith('c_cols_') || k.startsWith('c_ordered') || k.startsWith('c_replen_') || k.startsWith('c_page'))) {
        keys.push(k)
      }
    }
    keys.forEach(k => localStorage.removeItem(k))
    setCacheSize(0)
    toast('缓存已清除')
  }

  const sections = [
    {
      title: '连接状态',
      items: [
        { label: '后端服务', value: status },
        { label: '响应延迟', value: ping > 0 ? `${ping}ms` : '-' },
        { label: '最后检测', value: lastCheck || '-' },
        { label: '当前渠道', value: channel === 'jd' ? '京东' : '其他渠道' },
      ]
    },
    {
      title: '系统信息',
      items: [
        { label: '版本号', value: `v${VERSION}` },
        { label: '构建日期', value: BUILD },
        { label: '前端框架', value: 'React 18 + TypeScript' },
        { label: '后端框架', value: 'FastAPI + SQLite' },
      ]
    },
    {
      title: '存储',
      items: [
        { label: '本地缓存', value: cacheSize > 0 ? `${cacheSize}KB` : '无' },
      ]
    },
  ]

  return (
    <div className="card" style={{maxWidth:500,margin:'0 auto'}}>
      <div className="section-title" style={{marginBottom:16}}>设置</div>

      {sections.map((sec, si) => (
        <div key={si} style={{marginBottom:20}}>
          <div style={{fontSize:13,fontWeight:600,color:'var(--muted)',marginBottom:8,textTransform:'uppercase',letterSpacing:0.5}}>
            {sec.title}
          </div>
          {sec.items.map((item, ii) => (
            <div key={ii} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'0.5px solid var(--border)'}}>
              <span style={{fontSize:14,color:'var(--text)'}}>{item.label}</span>
              <span style={{fontSize:14,fontWeight:500,color:item.label==='后端服务'&&status.includes('正常')?'var(--success)':item.label==='后端服务'&&status.includes('异常')?'var(--danger)':'var(--text)'}}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      ))}

      <div style={{display:'flex',gap:8,marginTop:8}}>
        <button onClick={checkConnection} className="btn btn-ghost" style={{flex:1,fontSize:13}}>
          刷新连接
        </button>
        <button onClick={clearLocalCache} className="btn btn-ghost" style={{flex:1,fontSize:13}}>
          清除缓存
        </button>
      </div>

      <div style={{textAlign:'center',marginTop:24,fontSize:11,color:'var(--muted2)'}}>
        SupplyKit · 供应链数据工作台
      </div>
    </div>
  )
}

function toast(msg) {
  const el = document.createElement('div')
  el.textContent = msg
  Object.assign(el.style, {
    position:'fixed',bottom:100,left:'50%',transform:'translateX(-50%)',
    background:'var(--text)',color:'var(--bg)',padding:'10px 24px',
    borderRadius:99,fontSize:14,zIndex:9999,fontWeight:600,
    boxShadow:'0 4px 12px rgba(0,0,0,0.2)'
  })
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 2000)
}