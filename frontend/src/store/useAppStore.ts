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

  orderSearch: '',
  orderStatus: '',
  orderLoading: false,
  dataLoaded: false,
  sidebarOpen: false,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),

  async loadAll(page) {
    const p = page ?? get().orderPage
    const s = get().orderSearch
    const st = get().orderStatus
    try {
      const results = await Promise.allSettled([
        api.get('/api/dashboard/summary'),
        api.get(`/api/orders?page=${p}&page_size=8&search=${encodeURIComponent(s)}&status=${encodeURIComponent(st)}`),
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
        dataLoaded: true,
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

  setOrderPage(p, search, status) {
    const s = search ?? get().orderSearch
    const st = status ?? get().orderStatus
    set({ orderPage: p, orderSearch: s, orderStatus: st, orderLoading: true })
    api.get(`/api/orders?page=${p}&page_size=8&search=${encodeURIComponent(s)}&status=${encodeURIComponent(st)}`).then(r => {
      set({
        orders: r.data?.items || r.data || [],
        orderTotal: r.data?.total || (r.data || []).length || 0,
        orderPage: r.data?.page || p,
        orderLoading: false,
      })
    }).catch(() => set({ orderLoading: false }))
  },

  setOrderFilter(search, status) {
    set({ orderSearch: search, orderStatus: status, orderPage: 1, orderLoading: true })
    api.get(`/api/orders?page=1&page_size=8&search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`).then(r => {
      set({
        orders: r.data?.items || r.data || [],
        orderTotal: r.data?.total || (r.data || []).length || 0,
        orderPage: 1,
        orderLoading: false,
      })
    }).catch(() => set({ orderLoading: false }))
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
