import { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts'

function responsiveOption(base, width) {
  if (!base) return base
  // 根据容器宽度缩放字号和间距
  const scale = width < 250 ? 0.7 : width < 350 ? 0.8 : width < 500 ? 0.9 : 1.0
  if (scale >= 1) return base

  const opt = JSON.parse(JSON.stringify(base))
  // 缩放 grid
  if (opt.grid) {
    ['left','right','top','bottom'].forEach(k => {
      if (typeof opt.grid[k] === 'number') opt.grid[k] = Math.round(opt.grid[k] * scale)
    })
  }
  // 缩放 xAxis/yAxis 标签
  ;['xAxis','yAxis'].forEach(axisKey => {
    const axes = Array.isArray(opt[axisKey]) ? opt[axisKey] : opt[axisKey] ? [opt[axisKey]] : []
    axes.forEach(ax => {
      if (ax.axisLabel && typeof ax.axisLabel.fontSize === 'number') {
        ax.axisLabel.fontSize = Math.max(8, Math.round(ax.axisLabel.fontSize * scale))
      }
      if (ax.nameTextStyle && typeof ax.nameTextStyle.fontSize === 'number') {
        ax.nameTextStyle.fontSize = Math.max(8, Math.round(ax.nameTextStyle.fontSize * scale))
      }
    })
  })
  // 缩放图例
  if (opt.legend) {
    if (typeof opt.legend.bottom === 'number') opt.legend.bottom = Math.round(opt.legend.bottom * scale)
    if (opt.legend.textStyle && typeof opt.legend.textStyle.fontSize === 'number') {
      opt.legend.textStyle.fontSize = Math.max(8, Math.round(opt.legend.textStyle.fontSize * scale))
    }
  }
  // 缩放 series 内 label
  if (opt.series) {
    opt.series.forEach(s => {
      if (s.label && typeof s.label.fontSize === 'number') {
        s.label.fontSize = Math.max(8, Math.round(s.label.fontSize * scale))
      }
    })
  }
  return opt
}

export default function Chart({ option, height = 260 }) {
  const ref = useRef(null)
  const inst = useRef(null)
  const [width, setWidth] = useState(400)

  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width)
      }
    })
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!ref.current) return
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
