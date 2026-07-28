import React from 'react'
import { IconAlert } from './Icons'

interface Props { children: React.ReactNode }
interface State { err: Error | null }

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { err: null }
  static getDerivedStateFromError(err: Error) { return { err } }
  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: 24, background: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.3)', borderRadius: 26, margin: 12 }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}><IconAlert size={20} /></div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--danger)', marginBottom: 4 }}>组件渲染错误</div>
          <div style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--danger)', marginBottom: 8 }}>{this.state.err.message}</div>
          <button onClick={() => this.setState({ err: null })} style={{ padding: '6px 14px', fontSize: 12, border: '1px solid rgba(225,29,72,0.3)', borderRadius: 26, background: 'var(--card)', color: 'var(--danger)', cursor: 'pointer' }}>重试</button>
        </div>
      )
    }
    return this.props.children
  }
}