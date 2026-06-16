import React, { useEffect } from 'react'
import * as echarts from 'echarts'
export default function Chart({ option, height = 260 }) {
  const ref = React.useRef(null)
  const chartRef = React.useRef(null)
  useEffect(() => {
    if (!ref.current) return
    setTimeout(() => {
      try {
        if (chartRef.current) {
          chartRef.current.dispose()
          chartRef.current = null
        }
        const chart = echarts.init(ref.current)
        chart.setOption(option)
        chartRef.current = chart
        const onResize = () => chart.resize()
        window.addEventListener('resize', onResize)
        return () => { window.removeEventListener('resize', onResize); try { chart.dispose() } catch(e) {} }
      } catch(e) {}
    }, 0)
  }, [option])
  return <div ref={ref} style={{ width:'100%', height }} />
}
