import React, { useState, useEffect } from 'react'
import { api } from '../api/client'
import { useAppStore } from '../store/useAppStore'
import { clearCache, clearInflight } from '../api/client'
import { useToast } from '../components/Toast'

const VERSION = '1.0.0'
const BUILD = import.meta.env.VITE_BUILD_TIME || '2026-07-31'

// ── iOS 风格小组件 ────────────────────────────────────────────────────
const Group = ({ title, children }) => (
  <div style={{marginBottom:20}}>
    {title && <div style={{fontSize:13,fontWeight:400,color:'var(--muted2)',textTransform:'uppercase',letterSpacing:0.3,padding:'0 4px 6px 4px'}}>{title}</div>}
    <div style={{background:'var(--card)',borderRadius:32,overflow:'hidden',border:'1px solid var(--border)'}}>
      {children}
    </div>
  </div>
)

const Row = ({ label, value, sub, onClick, danger }) => (
  <div onClick={onClick} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',borderBottom:'1px solid var(--border)',cursor:onClick?'pointer':'default',minHeight:44,background:'var(--card)'}}>
    <div style={{flex:1}}>
      <div style={{fontSize:16,color:danger?'#ef4444':'var(--text)'}}>{label}</div>
      {sub && <div style={{fontSize:12,color:'var(--muted2)',marginTop:2}}>{sub}</div>}
    </div>
    <div style={{display:'flex',alignItems:'center',gap:6}}>
      {value && <span style={{fontSize:15,color:'var(--muted2)',maxWidth:160,textAlign:'right',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{value}</span>}
      {onClick && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{flexShrink:0,opacity:0.3}}><path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
    </div>
  </div>
)

const LastRow = ({ label, value, sub, onClick, danger }) => (
  <div onClick={onClick} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',borderBottom:'none',cursor:onClick?'pointer':'default',minHeight:44,background:'var(--card)'}}>
    <div style={{flex:1}}>
      <div style={{fontSize:16,color:danger?'#ef4444':'var(--text)'}}>{label}</div>
      {sub && <div style={{fontSize:12,color:'var(--muted2)',marginTop:2}}>{sub}</div>}
    </div>
    <div style={{display:'flex',alignItems:'center',gap:6}}>
      {value && <span style={{fontSize:15,color:'var(--muted2)',maxWidth:160,textAlign:'right',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{value}</span>}
      {onClick && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{flexShrink:0,opacity:0.3}}><path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
    </div>
  </div>
)

export default function SettingsPage() {
  const toast = useToast()
  const { channel, wsStatus } = useAppStore()
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
      setStatus(d.ok ? '正常' : '异常')
      setPing(ms)
      setLastCheck(new Date().toLocaleTimeString())
    } catch {
      setStatus('无法连接')
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
    toast.success('缓存已清除')
  }

  const [seeding, setSeeding] = useState(false)
  const [resetting, setResetting] = useState(false)

  const doSeed = async () => {
    setSeeding(true)
    try {
      const r = await fetch('https://overtrees.pythonanywhere.com/api/seed/fill', {method:'POST'})
      const d = await r.json()
      if (d.ok) {
        clearCache(); clearInflight()
        toast.success('种子数据已填充，即将刷新')
        setTimeout(() => window.location.reload(), 1500)
      } else toast.error('填充失败')
    } catch { toast.error('填充失败') }
    setSeeding(false)
  }

  const doReset = async () => {
    if (!confirm('确认重置所有数据？此操作不可恢复！')) return
    setResetting(true)
    try {
      await fetch('https://overtrees.pythonanywhere.com/api/seed/reset', {method:'POST'})
      clearCache(); clearInflight()
      useAppStore.setState({ dashboard: null, alerts: [], stockRisk: [] })
      toast.success('数据已重置，即将刷新')
      setTimeout(() => window.location.reload(), 1500)
    } catch { toast.error('重置失败') }
    setResetting(false)
  }

  const statusDot = (ok) => (
    <span style={{display:'inline-block',width:8,height:8,borderRadius:4,background:ok?'var(--success)':'#ef4444',marginRight:6,verticalAlign:'middle'}} />
  )

  return (
    <div style={{padding:'16px 0',maxWidth:500,margin:'0 auto'}}>
      {/* 连接状态 */}
      <Group title="连接状态">
        <Row label="后端服务" value={status} sub={`${ping}ms · ${lastCheck}`} />
        <Row label="实时连接" value={wsStatus === 'connected' ? '已连接' : wsStatus === 'polling' ? '轮询中' : '已断开'} />
        <LastRow label="当前渠道" value={channel === 'jd' ? '京东' : '其他渠道'} />
      </Group>

      {/* 操作 */}
      <Group title="操作">
        <Row label="刷新连接" onClick={checkConnection} />
        <LastRow label="清除本地缓存" sub={cacheSize > 0 ? `${cacheSize}KB` : '无缓存'} onClick={clearLocalCache} />
      </Group>

      {/* 系统信息 */}
      <Group title="系统信息">
        <Row label="版本号" value={`v${VERSION}`} />
        <Row label="构建日期" value={BUILD} />
        <Row label="前端" value="React 18 + TypeScript" />
        <LastRow label="后端" value="FastAPI + SQLite" />
      </Group>

      {/* 种子数据 */}
      <Group title="种子数据">
        <Row label="一键填充" sub="生成 12 SKU × 60 天 × 900 条模拟数据" onClick={doSeed} />
        <LastRow label="一键重置" sub="清空所有数据恢复初始状态" onClick={doReset} danger />
      </Group>

      <div style={{textAlign:'center',marginTop:24,fontSize:12,color:'var(--muted2)'}}>
        SupplyKit · 供应链数据工作台
      </div>
    </div>
  )
}