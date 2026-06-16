import { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts'

function responsiveOption(base, width) {
  if (!base || width === 0) return base
  const scale = width < 250 ? 0.7 : width < 350 ? 0.8 : width < 500 ? 0.9 : 1.0
  if (scale >= 1) return base

  // 保留原 option 引用，直接修改数值属性（不深拷贝以免丢失函数）
  const opt = Array.isArray(base) ? [...base] : Object.assign({}, base)
  const scaleVal = (v) => typeof v === 'number' ? Math.max(4, Math.round(v * scale)) : v

  if (opt.grid) {
    ['left','right','top','bottom'].forEach(k => { if (typeof opt.grid[k] === 'number') opt.grid[k] = scaleVal(opt.grid[k]) })
  }
  ;['xAxis','yAxis'].forEach(axisKey => {
    const axes = Array.isArray(opt[axisKey]) ? opt[axisKey] : opt[axisKey] ? [opt[axisKey]] : []
    axes.forEach(ax => {
      if (ax.axisLabel && typeof ax.axisLabel.fontSize === 'number') ax.axisLabel.fontSize = scaleVal(ax.axisLabel.fontSize)
      if (ax.nameTextStyle && typeof ax.nameTextStyle.fontSize === 'number') ax.nameTextStyle.fontSize = scaleVal(ax.nameTextStyle.fontSize)
    })
  })
  if (opt.legend) {
    if (typeof opt.legend.bottom === 'number') opt.legend.bottom = scaleVal(opt.legend.bottom)
    if (opt.legend.textStyle && typeof opt.legend.textStyle.fontSize === 'number') opt.legend.textStyle.fontSize = scaleVal(opt.legend.textStyle.fontSize)
    if (opt.legend.itemWidth) opt.legend.itemWidth = scaleVal(opt.legend.itemWidth)
    if (opt.legend.itemHeight) opt.legend.itemHeight = scaleVal(opt.legend.itemHeight)
  }
  if (opt.series) {
    opt.series.forEach(s => {
      if (s.label && typeof s.label.fontSize === 'number') s.label.fontSize = scaleVal(s.label.fontSize)
    })
  }
  return opt
}

export default function Chart({ option, height = 260 }) {
  const ref = useRef(null)
  const inst = useRef(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (!ref.current) return
    setWidth(ref.current.clientWidth || 400)
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width)
      }
    })
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!ref.current || width === 0) return
    const timer = setTimeout(() => {
      if (!ref.current) return
      try {
        if (inst.current) { inst.current.dispose(); inst.current = null }
        const chart = echarts.init(ref.current)
        const ropt = responsiveOption(option, width)
        chart.setOption(ropt)
        inst.current = chart
        const resize = () => chart.resize()
        window.addEventListener('resize', resize)
        return () => { window.removeEventListener('resize', resize); try { chart.dispose() } catch(e) {} }
      } catch(e) { console.error('Chart error:', e) }
    }, 100)
    return () => clearTimeout(timer)
  }, [option, width])

  return <div ref={ref} style={{ width: '100%', height }} />
}
