import React, { useState, useEffect } from 'react'
import { api } from '../api/client'
const API = import.meta.env.VITE_API_BASE_URL || 'https://overtrees.pythonanywhere.com'

// 智能列名匹配
const ALIAS = {
  "订单号":"order_no","订单编号":"order_no","采购单号":"order_no",
  "商品编号":"sku","货号":"sku",
  "商品名称":"product_name","产品名称":"product_name","名称":"product_name",
  "数量":"quantity","采购数量":"quantity","订货数量":"quantity",
  "单价":"unit_price","价格":"unit_price","采购价格":"unit_price",
  "金额":"total_amount","总金额":"total_amount","采购金额":"total_amount",
  "店铺":"store","店铺名":"store","门店":"store",
  "状态":"order_status","订单状态":"order_status",
  "日期":"ordered_at","订购时间":"ordered_at","下单时间":"ordered_at",
}
const SYSTEM_FIELDS = [
  {target:'order_no',label:'订单号',type:'string'},
  {target:'store',label:'店铺',type:'string'},
  {target:'warehouse',label:'仓库',type:'string'},
  {target:'sku',label:'SKU',type:'string'},
  {target:'product_name',label:'商品名称',type:'string'},
  {target:'quantity',label:'数量',type:'number'},
  {target:'unit_price',label:'单价',type:'number'},
  {target:'total_amount',label:'金额',type:'number'},
  {target:'order_status',label:'状态',type:'string'},
  {target:'ordered_at',label:'订购时间',type:'date'},
  {target:'supplier',label:'供应商',type:'string'},
  {target:'remark',label:'备注',type:'string'},
]

export default function CleansingPage() {
  const [step, setStep] = useState(0)
  const [file, setFile] = useState(null)
  const [columns, setColumns] = useState([])
  const [totalRows, setTotalRows] = useState(0)
  const [targetType, setTargetType] = useState('order')
  const [mapping, setMapping] = useState({})
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState('')

  const handleUpload = async (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setBusy('detect')
    const form = new FormData()
    form.append('file', f)
    try {
      const res = await api.post('/api/cleansing/detect', form)
      const d = res.data
      if (!d.ok) { alert('检测失败: ' + (d.error || JSON.stringify(d))); setBusy(''); return }
      setColumns(d.columns || [])
      setTotalRows(d.total || 0)
      // 智能匹配
      const auto = {}
      ;(d.columns || []).forEach(col => {
        const key = ALIAS[col.name]
        if (key) auto[col.name] = { target: key, type: 'string' }
      })
      if (Object.keys(auto).length > 0) setMapping(auto)
      setStep(1)
    } catch (err) { alert('网络错误: ' + err.message) }
    setBusy('')
  }

  return <div className="card">
    <div className="step-indicator">
      {['上传文件','字段映射','预览确认','完成'].map((l,i) => (
        <span key={i} className={'step' + (step===i?' active':'') + (step>i?' done':'')}>{step>i?'✓ ':''}{l}</span>
      ))}
      {busy && <span className="step" style={{color:'#1d4ed8'}}>⏳ {busy}...</span>}
    </div>
    {step === 0 && <div style={{textAlign:'center',padding:40}}>
      <div style={{fontSize:28,marginBottom:12,opacity:.3}}>🧹</div>
      <label style={{display:'inline-block',padding:'10px 24px',background:'#1d4ed8',color:'#fff',borderRadius:10,cursor:'pointer',fontSize:14,fontWeight:600}}>
        {busy==='detect'?'识别中...':'选择文件'}
        <input type="file" accept=".csv,.xlsx" style={{display:'none'}} onChange={handleUpload} disabled={busy==='detect'} />
      </label>
      <div className="small muted" style={{marginTop:8}}>支持 CSV / Excel，中文列名自动匹配</div>
      {columns.length > 0 && <div className="small muted" style={{marginTop:4}}>已识别 {columns.length} 列 · {totalRows} 行数据</div>}
    </div>}
  </div>
}
