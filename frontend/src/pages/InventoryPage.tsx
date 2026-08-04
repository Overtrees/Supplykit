import React, { useState, useMemo, useEffect, useRef } from 'react'
import { api } from '../api/client'
import EmptyState from '../components/EmptyState'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAppStore } from '../store/useAppStore'

const API = import.meta.env.VITE_API_BASE_URL || 'https://overtrees.pythonanywhere.com'
const WH_COLS = {
  own: [
    {id:'warehouse',label:'仓库'},{id:'sku',label:'SKU'},{id:'barcode',label:'69码'},{id:'name',label:'商品'},
    {id:'begin',label:'期初库存'},{id:'transit',label:'在途'},{id:'month_in',label:'当月采购入库'},
    {id:'month_out',label:'当月出库'},{id:'avail',label:'可用'},{id:'turnover',label:'在库周转'},
  ],
  platform: [
    {id:'channel',label:'平台'},{id:'warehouse',label:'仓库'},{id:'sku',label:'SKU'},{id:'barcode',label:'69码'},{id:'name',label:'商品'},
    {id:'transit',label:'在途'},{id:'avail',label:'可用'},
  ],
  platform_b: [
    {id:'channel',label:'平台'},{id:'warehouse',label:'仓库'},{id:'sku',label:'SKU'},{id:'barcode',label:'69码'},{id:'name',label:'商品'},
    {id:'transit',label:'供应商-B仓'},{id:'c_transit',label:'B-C调拨在途'},{id:'avail',label:'可用'},
  ],
}
const COL_KEY='c_cols_inventory'
const getVis=(wt)=>{try{return JSON.parse(localStorage.getItem(COL_KEY+'_'+wt)||'null')}catch{return null}}

interface InventoryPageProps { highlightSku?: string }

export default function InventoryPage({ highlightSku }: InventoryPageProps) {
  const toast = useToast()
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)
  const [visCols, setVisCols] = useState(() => {const wt='own';return getVis(wt)||WH_COLS[wt].map(c=>c.id)})
  const [confirmDel, setConfirmDel] = useState(null)
  const [monthRange, setMonthRange] = useState('')
  const { channel: globalChannel, hammerWhType, hammerCols, hammerSearch } = useAppStore()
  const whType = hammerWhType

  useEffect(() => {
    const saved = hammerCols?.['inventory_'+whType]
    if (saved) setVisCols(saved)
    else {
      const ls = getVis(whType)
      if (ls) setVisCols(ls)
      else setVisCols(WH_COLS[whType].map(c => c.id))
    }
  }, [hammerCols, whType])

  const loadInv = async () => {
    setLoading(true)
    try {
      const r = await api.get('/api/insights/with-sales?wh_type=' + whType + '&channel=' + globalChannel)
      const data = r.data || []
      setInventory(data)
      if (data.length > 0) {
        const s = data[0].month_start?.slice(5) || ''
        const e = data[0].month_end?.slice(5) || ''
        setMonthRange(`${s}至${e}`)
      }
    } catch(e) { setInventory([]) }
    setLoading(false)
  }
  useEffect(() => { loadInv() }, [whType, globalChannel])

  const s = hammerSearch || ''
  const fl = useMemo(() => {
    if (!s) return inventory
    const q = s.toLowerCase()
    return inventory.filter(x => (x.sku||'').toLowerCase().includes(q) || (x.product_name||'').toLowerCase().includes(q) || (x.store||'').toLowerCase().includes(q))
  }, [inventory, s])

  const totalTurnover = useMemo(() => {
    const valid = inventory.filter(x => x.turnover_days != null)
    return valid.length > 0
      ? (valid.reduce((s,x) => s + x.turnover_days, 0) / valid.length).toFixed(1)
      : null
  }, [inventory])

  const delInv = async () => {
    if (!confirmDel) return
    try {
      const r = await fetch(`${API}/api/inventory/${confirmDel}`, {method:'DELETE'})
      if (r.ok) { toast.success('已删除'); setConfirmDel(null); loadInv() }
      else toast.error('删除失败')
    } catch(e) { toast.error('删除失败: '+e.message) }
    setConfirmDel(null)
  }

  return <div className='card'>
    <div className='section-title' style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
      <span>进销存 <span className='small muted'>共 {inventory.length} 条</span></span>
    </div>
    {loading ? <div>{[1,2,3,4].map(i=><div key={i} className='skeleton' style={{height:36,marginBottom:4}}/>)}</div>
    : fl.length === 0
      ? <EmptyState icon='package' title={s?'无匹配':'暂无数据'} desc={s?'换个关键词试试':'通过清洗导入数据'} />
      : <div style={{overflowX:'auto'}}>
        <div style={{fontSize:11,color:'var(--muted2)',marginBottom:4}}>显示 {visCols.length}/{WH_COLS[whType].length} 列</div>
      <table><colgroup>{visCols.map(id=>{const col=WH_COLS[whType].find(c=>c.id===id);return col?<col key={col.id} />:null})}</colgroup>
        <thead><tr>{visCols.map(id=>{const col=WH_COLS[whType].find(c=>c.id===id);if(!col)return null;let el;if(col.id==='month_in')el=<th key={col.id}>{col.label}<br/><span className='small' style={{fontWeight:400}}>{monthRange}</span></th>;else if(col.id==='month_out')el=<th key={col.id}>{col.label}<br/><span className='small' style={{fontWeight:400}}>{monthRange}</span></th>;else el=<th key={col.id}>{col.label}</th>;return el})}</tr></thead>
      <tbody>{fl.map(x => {
        const isHL = highlightSku && x.sku === highlightSku
        const visCells = visCols.map(function(id){const col=WH_COLS[whType].find(function(c){return c.id===id});if(!col)return null;var el;if(col.id==='warehouse')el=React.createElement('td',{key:col.id,className:'col-store'},x.warehouse||'-');else if(col.id==='channel')el=React.createElement('td',{key:col.id,style:{fontSize:11}},x.channel==='other'?'其他':'京东');else if(col.id==='sku')el=React.createElement('td',{key:col.id,className:'mono col-sku'},x.sku);else if(col.id==='barcode')el=React.createElement('td',{key:col.id,className:'mono',style:{fontSize:11}},x.barcode||'-');else if(col.id==='name')el=React.createElement('td',{key:col.id,className:'col-name'},x.product_name);else if(col.id==='begin')el=React.createElement('td',{key:col.id,className:'col-qty',style:{fontWeight:600}},x.beginning_stock??'-');else if(col.id==='transit')el=React.createElement('td',{key:col.id,className:'col-qty'},x.in_transit_qty);else if(col.id==='c_transit')el=React.createElement('td',{key:col.id,className:'col-qty'},x.c_transit||0);else if(col.id==='month_in')el=React.createElement('td',{key:col.id,className:'col-qty'},x.month_inbound??0);else if(col.id==='month_out')el=React.createElement('td',{key:col.id,className:'col-qty',style:{fontWeight:600}},x.month_outbound??0);else if(col.id==='avail')el=React.createElement('td',{key:col.id,className:'col-qty',style:{fontWeight:600}},x.available_qty);else if(col.id==='turnover'){var tc=x.turnover_days;el=React.createElement('td',{key:col.id,className:'col-qty',style:{fontWeight:600,color:tc!=null&&tc>30?'#ef4444':tc!=null&&tc>15?'var(--warning)':'var(--text)'}},tc!=null?tc+'天':'∞')}else el=React.createElement('td',{key:col.id,className:'small muted',style:{fontSize:11}},'-');return el})
        return React.createElement('tr',{key:x.id,id:'hl-'+x.sku,style:isHL?{background:'rgba(245,158,11,0.15)',outline:'2px solid #f59e0b'}:{}},visCells)
      })}
      </tbody>
      {whType === 'own' && totalTurnover != null && <tfoot>
        <tr style={{fontWeight:700,borderTop:'2px solid var(--border)'}}>
          <td colSpan={5} style={{textAlign:'right',fontSize:12}}>合计</td>
          <td>{inventory.reduce((s,x)=>s+(x.month_inbound||0),0)}</td>
          <td>{inventory.reduce((s,x)=>s+(x.month_outbound||0),0)}</td>
          <td>{inventory.reduce((s,x)=>s+(x.available_qty||0),0)}</td>
          <td style={{fontSize:13}}>{totalTurnover} 天</td>
          <td></td>
        </tr>
      </tfoot>}
              </table>
    </div>}
    <ConfirmDialog open={!!confirmDel} title='删除库存记录' desc='删除后不可恢复' confirmLabel='删除' onConfirm={delInv} onCancel={()=>setConfirmDel(null)} />
  </div>
}
