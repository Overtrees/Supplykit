
import React, { useState, useEffect } from 'react'
const API = import.meta.env.VITE_API_BASE_URL || 'https://overtrees.pythonanywhere.com'
export default function RulesPage() {
  const [rules, setRules] = useState([])
  const [editing, setEditing] = useState(null)
  useEffect(() => { loadRules() }, [])
  const loadRules = async () => { try { const r=await fetch(API+'/api/rules'); setRules(await r.json()) } catch(e) {} }
  return <div className="card"><div className="section-title">规则引擎</div><div className="small muted">规则管理页待完善</div></div>
}
