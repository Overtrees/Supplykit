import { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts'

export default function Chart({ option, height = 260 }) {
  const ref = useRef(null)
  const inst = useRef(null)
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    setDark(mq.matches)
    const handler = (e) => setDark(e.matches)
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
        const opt = {
          backgroundColor: 'transparent',
          ...option,
          // 自动注入暗黑文字色
          ...(dark ? {
            textStyle: { color: '#f1f5f9' },
            title: { textStyle: { color: '#f1f5f9' } },
            legend: { ...option.legend, textStyle: { ...option.legend?.textStyle, color: '#94a3b8' } },
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
  }, [option, dark])
  return <div ref={ref} style={{ width: '100%', height }} />
}
