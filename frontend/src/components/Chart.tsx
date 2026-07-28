import { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts'

export default function Chart({ option, height = 260 }) {
  const ref = useRef(null)
  const inst = useRef(null)
  const [theme, setTheme] = useState<'light'|'dark'>('light')

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    setTheme(mq.matches ? 'dark' : 'light')
    const handler = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (!ref.current) return
    const timer = setTimeout(() => {
      if (!ref.current) return
      try {
        if (inst.current) { inst.current.dispose(); inst.current = null }
        const chart = echarts.init(ref.current, undefined, { renderer: 'canvas' })
        // 从 CSS 变量读取当前主题色，与页面保持一致
        const cs = getComputedStyle(document.documentElement)
        const textColor = cs.getPropertyValue('--text').trim() || '#0f172a'
        const mutedColor = cs.getPropertyValue('--muted').trim() || '#64748b'
        const opt = {
          backgroundColor: 'transparent',
          ...option,
          textStyle: { color: textColor, ...option.textStyle },
          title: { ...option.title, textStyle: { color: textColor, ...(option.title?.textStyle || {}) } },
          ...(option.legend ? { legend: { ...option.legend, textStyle: { color: mutedColor, ...(option.legend.textStyle || {}) } } } : {}),
          // 注入 series label 颜色，适配深色模式
          ...(option.series ? {
            series: (Array.isArray(option.series) ? option.series : [option.series]).filter(Boolean).map(s => ({
              ...s,
              label: s.label ? { ...s.label, color: textColor, textBorderColor: 'transparent', ...(s.label.color ? {color: s.label.color} : {}) } : s.label,
            }))
          } : {}),
        }
        chart.setOption(opt)
        inst.current = chart
        const resize = () => chart.resize()
        window.addEventListener('resize', resize)
        return () => { window.removeEventListener('resize', resize); try { chart.dispose() } catch(e) {} }
      } catch(e) { console.error('Chart error:', e) }
    }, 100)
    return () => clearTimeout(timer)
  }, [option, theme])
  return <div ref={ref} style={{ width: '100%', height }} />
}