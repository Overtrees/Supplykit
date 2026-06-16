import React, { useEffect } from 'react'
import * as echarts from 'echarts'
export default function Chart({ option, height = 260 }) {
  const ref = React.useRef(null)
  useEffect(() => {
    if (!ref.current) return
    const existing = echarts.getInstanceByDom(ref.current)
    if (existing) existing.dispose()
    const chart = echarts.init(ref.current)
    chart.setOption(option)
    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); chart.dispose() }
  }, [option])
  return <div ref={ref} style={{ width:'100%', height }} />
}
