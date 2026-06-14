import { create } from 'zustand'
import { api } from '../api/client'

const POLL_MS = Number(import.meta.env.VITE_POLL_INTERVAL_MS || 30000)
const WS_URL = import.meta.env.VITE_WS_URL || 'wss://overtrees.pythonanywhere.com/ws/events'

export const useAppStore = create((set, get) => ({
  dashboard: null,
  orders: [],
  orderTotal: 0,
  orderPage: 1,
  inventory: [],
  qualityLogs: [],
  alerts: [],
  wsStatus: 'idle',
  importLogs: [],
  poller: null,
  ws: null,

  async loadAll(page) {
    const p = page ?? get().orderPage
    try {
      const results = await Promise.allSettled([
        api.get('/api/dashboard/summary'),
        api.get(`/api/orders?page=${p}&page_size=8`),
        api.get('/api/inventory'),
        api.get('/api/quality-logs'),
        api.get('/api/alerts'),
      ])
      const [dashboard, orders, inventory, qualityLogs, alerts] = results.map(r =>
        r.status === 'fulfilled' ? r.value : { data: null }
      )
      set({
        dashboard: dashboard.data,
        orders: orders.data?.items || orders.data || [],
        orderTotal: orders.data?.total || (orders.data || []).length || 0,
        orderPage: orders.data?.page || p,
        inventory: inventory.data?.items || inventory.data || [],
        qualityLogs: qualityLogs.data || [],
        alerts: alerts.data || [],
      })
    } catch (e) {
      console.error('loadAll failed:', e)
    }
  },

  connectWebSocket() {
    const oldWs = get().ws
    if (oldWs) { try { oldWs.close() } catch(e) {} }

    try {
      const ws = new WebSocket(WS_URL)
      ws.onopen = () => {
        set({ wsStatus: 'connected', ws })
        get().loadAll().catch(() => {})
      }
      ws.onmessage = () => {
        // Any WS event → reload data for real-time updates
        get().loadAll().catch(() => {})
      }
      ws.onclose = () => {
        set({ wsStatus: 'polling', ws: null })
        setTimeout(() => connectWebSocket(), 10000)
      }
      ws.onerror = () => {
        set({ wsStatus: 'polling', ws: null })
        setTimeout(() => connectWebSocket(), 10000)
      }
    } catch(e) {
      set({ wsStatus: 'polling', ws: null })
    }
  },

  addImportLog(item) {
    set((state) => ({ importLogs: [item, ...state.importLogs].slice(0, 20) }))
  },

  setOrderPage(p) {
    set({ orderPage: p })
    api.get(`/api/orders?page=${p}&page_size=8`).then(r => {
      set({
        orders: r.data?.items || r.data || [],
        orderTotal: r.data?.total || (r.data || []).length || 0,
        orderPage: r.data?.page || p,
      })
    }).catch(() => {})
  },

  startPolling() {
    const old = get().poller
    if (old) clearInterval(old)
    get().loadAll().catch(() => {})
    // Try WebSocket first, fall back to polling
    get().connectWebSocket()
    const timer = setInterval(() => {
      // Only poll if WS is not connected
      if (get().wsStatus !== 'connected') {
        get().loadAll().catch(() => {})
      }
    }, POLL_MS)
    set({ poller: timer })
  },

  stopAll() {
    const oldPoller = get().poller
    if (oldPoller) clearInterval(oldPoller)
    const oldWs = get().ws
    if (oldWs) { try { oldWs.close() } catch(e) {} }
    set({ poller: null, ws: null })
  },
}))
