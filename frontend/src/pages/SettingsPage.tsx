import React, { useState, useEffect } from 'react'
import { api } from '../api/client'
import { useAppStore } from '../store/useAppStore'
import { clearCache, clearInflight } from '../api/client'
import { useToast } from '../components/Toast'
import { t } from "../locale"
import ConfirmDialog from '../components/ConfirmDialog'

const VERSION = '1.0.0'
const BUILD = new Date().toISOString().slice(0,10)
const API = import.meta.env.VITE_API_BASE_URL || 'https://overtrees.pythonanywhere.com'

const Group = ({ title, children }) => (
  <div style={{marginBottom:20}}>
    {title && <div style={{fontSize:13,fontWeight:400,color:'var(--muted2)',textTransform:'uppercase',letterSpacing:0.3,padding:'0 16px 6px 16px'}}>{title}</div>}
    <div style={{background:'var(--card)',borderRadius:32,overflow:'hidden'}}>
      {children}
    </div>
  </div>
)

const Row = ({ label, value, sub, onClick, danger, loading }) => (
  <div onClick={loading ? undefined : onClick} className={onClick && !loading ? 'clickable' : ''} style={{padding:'0 16px',cursor:onClick && !loading ? 'pointer' : 'default',background:'var(--card)',opacity:loading?0.5:1}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 0',minHeight:48,borderBottom:'1px solid var(--border)'}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:16,color:danger?'#ef4444':'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:6}}>
          {loading && <span style={{display:'inline-block',width:14,height:14,border:'2px solid var(--primary)',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.6s linear infinite'}} />}
          {label}
        </div>
        {sub && <div style={{fontSize:12,color:'var(--muted2)',marginTop:2}}>{sub}</div>}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0,marginLeft:8}}>
        {value && <span style={{fontSize:15,color:'var(--muted2)',maxWidth:160,textAlign:'right',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{value}</span>}
        {onClick && !loading && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{flexShrink:0,opacity:0.3}}><path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </div>
    </div>
  </div>
)

const LastRow = ({ label, value, sub, onClick, danger, loading }) => (
  <div onClick={loading ? undefined : onClick} className={onClick && !loading ? 'clickable' : ''} style={{padding:'0 16px',cursor:onClick && !loading ? 'pointer' : 'default',background:'var(--card)',opacity:loading?0.5:1}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 0',minHeight:48}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:16,color:danger?'#ef4444':'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:6}}>
          {loading && <span style={{display:'inline-block',width:14,height:14,border:'2px solid var(--danger)',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.6s linear infinite'}} />}
          {label}
        </div>
        {sub && <div style={{fontSize:12,color:'var(--muted2)',marginTop:2}}>{sub}</div>}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0,marginLeft:8}}>
        {value && <span style={{fontSize:15,color:'var(--muted2)',maxWidth:160,textAlign:'right',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{value}</span>}
        {onClick && !loading && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{flexShrink:0,opacity:0.3}}><path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </div>
    </div>
  </div>
)

function RecycleBin({ onClose }) {
  var [rules, setRules] = useState([])
  useEffect(function() {
    var header = document.querySelector('header')
    if (header) header.style.display = 'none'
    return function() { if (header) header.style.display = '' }
  }, [])
  var [orders, setOrders] = useState([])
  var [loading, setLoading] = useState(true)

  useEffect(function() {
    setLoading(true)
    Promise.all([
      fetch(API + '/api/rules?channel=all').then(function(r) { return r.json() }),
      fetch(API + '/api/orders?page=1&page_size=200').then(function(r) { return r.json() }),
    ]).then(function([rData, oData]) {
      var items = rData.data || rData || []
      setRules(items.filter(function(x) { return x.is_active === 0 }))
      var o = oData.data || oData || []
      setOrders(Array.isArray(o) ? o.filter(function(x) { return x.deleted_at }) : [])
      setLoading(false)
    }).catch(function() { setLoading(false) })
  }, [])

  var restore = async function(type, id) {
    await fetch(API + '/api/' + type + '/' + id + '/restore', {method:'POST'})
    if (type === 'rules') setRules(rules.filter(function(x) { return x.id !== id }))
    else setOrders(orders.filter(function(x) { return x.id !== id }))
  }

  return <div style={{display:'flex',flexDirection:'column',minHeight:'100%',background:'var(--bg)',padding:'0 0 calc(0px + env(safe-area-inset-bottom, 20px))',boxSizing:'border-box'}}>
    <div style={{position:'fixed',left:0,right:0,top:0,zIndex:5001,display:'flex',justifyContent:'space-between',alignItems:'center',padding:'calc(env(safe-area-inset-top, 0px) + 12px) 16px 12px 16px',background:'transparent'}}>
      <div style={{fontSize:16,fontWeight:600,color:'var(--text)',background:'var(--card)',padding:'0 14px',borderRadius:99,minHeight:48,display:'flex',alignItems:'center',marginLeft:16}}>{t("settings.recycle_bin")}</div>
      <div onClick={onClose} className="clickable" style={{width:48,height:48,borderRadius:'50%',background:'var(--card)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,marginRight:16}}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
      </div>
    </div>
    <div style={{padding:'calc(env(safe-area-inset-top, 0px) + 44px) 16px 16px',maxWidth:500,margin:'0 auto',width:'100%'}}>
    {loading ? <div style={{padding:'0 4px'}}>{[1,2,3].map(function(i) {
      return <div key={i} style={{background:'var(--card)',borderRadius:32,padding:16,marginBottom:8}}>
        <div className="skeleton" style={{width:'40%',height:14,marginBottom:8}} />
        <div className="skeleton" style={{width:'70%',height:14}} />
      </div>
    })}</div> : <>
      <div style={{fontSize:13,fontWeight:600,color:'var(--muted2)',textTransform:'uppercase',letterSpacing:0.3,padding:'0 4px 6px 4px',marginBottom:0}}>{t("recycle.deleted_rules")}</div>
      <div style={{background:'var(--card)',borderRadius:32,overflow:'hidden'}}>
      {rules.length === 0 ? <div className="small muted" style={{padding:'20px',textAlign:'center',fontSize:13}}>{t("recycle.empty_rules")}</div> : rules.map(function(r) {
        return <div key={r.id} onClick={function(){restore('rules', r.id)}} className="clickable" style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',borderBottom:'1px solid var(--border)'}}>
          <span style={{fontSize:14,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{r.name}</span>
          <span style={{fontSize:12,fontWeight:600,color:'#fff',background:'var(--primary)',padding:'4px 12px',borderRadius:99,flexShrink:0}}>{t("common.restore")}</span>
        </div>
      })}
      </div>
      <div style={{fontSize:13,fontWeight:600,color:'var(--muted2)',textTransform:'uppercase',letterSpacing:0.3,padding:'0 4px 6px 4px',marginTop:16,marginBottom:0}}>{t("recycle.deleted_orders")}</div>
      <div style={{background:'var(--card)',borderRadius:32,overflow:'hidden'}}>
      {orders.length === 0 ? <div className="small muted" style={{padding:'20px',textAlign:'center',fontSize:13}}>{t("recycle.empty_orders")}</div> : orders.map(function(o) {
        return <div key={o.id} onClick={function(){restore('orders', o.id)}} className="clickable" style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',borderBottom:'1px solid var(--border)'}}>
          <span style={{fontSize:14,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{o.order_no} - {o.product_name}</span>
          <span style={{fontSize:12,fontWeight:600,color:'#fff',background:'var(--primary)',padding:'4px 12px',borderRadius:99,flexShrink:0}}>{t("common.restore")}</span>
        </div>
      })}
      </div>
    </>}
    </div>
  </div>
}

export default function SettingsPage() {
  const toast = useToast()
  const { channel, wsStatus } = useAppStore()
  const [status, setStatus] = useState('检查中...')
  const [ping, setPing] = useState(0)
  const [lastCheck, setLastCheck] = useState('')
  const [dbSize, setDbSize] = useState('')
  const [cacheSize, setCacheSize] = useState(0)
  const [confirm, setConfirm] = useState(null) // {type:'fill'|'reset'}
  const [refreshing, setRefreshing] = useState(false)


  const checkConnection = async () => {
    setRefreshing(true)
    const start = performance.now()
    try {
      const r = await fetch(API + '/api/insights/ping')
      const ms = Math.round(performance.now() - start)
      const d = await r.json()
      setStatus(d.ok ? '正常' : '异常')
      setPing(ms)
      setLastCheck(new Date().toLocaleTimeString())
      if (d.ok) toast.success('连接正常 · ' + ms + 'ms')
    } catch {
      setStatus('无法连接')
      setPing(0)
      setLastCheck(new Date().toLocaleTimeString())
      toast.error('连接失败')
    }
    setRefreshing(false)
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
    setConfirm(null)
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
    setConfirm(null)
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

  return <>
    {confirm === 'recycle' ? <RecycleBin onClose={() => setConfirm(null)} /> : <div style={{padding:'16px 0',maxWidth:500,margin:'0 auto'}}>
      <Group title="连接状态">
        <Row label="后端服务" value={status} sub={`${ping}ms · ${lastCheck}`} />
        <Row label="实时连接" value={wsStatus === 'connected' ? '已连接' : wsStatus === 'polling' ? '轮询中' : '已断开'} />
        <LastRow label="当前渠道" value={channel === 'jd' ? '京东' : '其他渠道'} />
      </Group>

      <Group title="操作">
        <Row label="刷新连接" onClick={checkConnection} loading={refreshing} />
        <Row label="清除本地缓存" sub={cacheSize > 0 ? `${cacheSize}KB` : '无缓存'} onClick={() => { if (cacheSize > 0) setConfirm('cache'); else toast.success('暂无缓存需要清除') }} />
        <LastRow label="回收站" sub="查看已删除的规则和订单，可恢复或永久删除" onClick={() => setConfirm('recycle')} />
      </Group>

      <Group title="系统信息">
        <Row label="版本号" value={`v${VERSION}`} />
        <Row label="构建日期" value={BUILD} />
        <Row label="前端" value="React 18 + TypeScript" />
        <LastRow label="后端" value="FastAPI + SQLite" />
      </Group>

      <Group title="界面">
        <Row label="重置欢迎页" sub="重新显示首次使用引导" onClick={() => { localStorage.removeItem('c_welcome_seen'); toast.success('欢迎页已重置') }} />
      </Group>

      <Group title="种子数据">
        <Row label="一键填充" sub="生成 12 SKU × 60 天 × 900 条模拟数据" onClick={() => setConfirm('fill')} loading={seeding} />
        <LastRow label="一键重置" sub="清空所有数据恢复初始状态" onClick={() => setConfirm('reset')} danger loading={resetting} />
      </Group>

      <div style={{textAlign:'center',marginTop:24,fontSize:12,color:'var(--muted2)'}}>
        SupplyKit · 供应链数据工作台
      </div>

      {/* 确认弹窗 */}
      {confirm === 'fill' && (
        <ConfirmDialog
          open
          title="生成种子数据？"
          desc="将生成 160 个商品、60 天订单、9 个仓库库存等模拟数据，覆盖现有数据。"
          confirmLabel="生成"
          onConfirm={doSeed}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'reset' && (
        <ConfirmDialog
          open
          title="重置所有数据？"
          desc="此操作不可恢复。将清空订单、库存、商品、规则等全部数据。"
          confirmLabel="重置"
          onConfirm={doReset}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'cache' && (
        <ConfirmDialog
          open
          title="清除本地缓存？"
          desc="将清除列配置、搜索记录等本地缓存数据，不影响服务器数据。"
          confirmLabel="清除"
          onConfirm={() => { clearLocalCache(); setConfirm(null) }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>}
</>
}