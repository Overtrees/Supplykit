import React from 'react'
import EmptyState from './EmptyState'

interface Props { children: React.ReactNode }
interface State { err: Error | null }

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { err: null }
  static getDerivedStateFromError(err: Error) { return { err } }
  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: 24, background: '#fef2f2', border: '1px solid #dc2626', borderRadius: 12, margin: 12 }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>⚠️</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#991b1b', marginBottom: 4 }}>组件渲染错误</div>
          <div style={{ fontSize: 13, fontFamily: 'monospace', color: '#dc2626', marginBottom: 8 }}>{this.state.err.message}</div>
          <button onClick={() => this.setState({ err: null })} style={{ padding: '6px 14px', fontSize: 12, border: '1px solid #fca5a5', borderRadius: 6, background: '#fff', color: '#991b1b', cursor: 'pointer' }}>重试</button>
        </div>
      )
    }
    return this.props.children
  }
}
