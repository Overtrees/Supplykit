import { create } from 'zustand'
import { api, clearCache, clearInflight } from '../api/client'

const POLL_MS = Number(import.meta.env.VITE_POLL_INTERVAL_MS || 30000)
const WS_URL = import.meta.env.VITE_WS_URL || 'wss://overtrees.pythonanywhere.com/ws/events'

export const useAppStore = create((set, get) => ({
  channel: localStorage.getItem('c_channel') || 'jd',
  channelVersion: 0,
  dashboard: null,
  orders: [],
  orderTotal: 0,
  orderPage: 1,
  inventory: [],
  qualityLogs: [],
  alerts: [],
  stockRisk: [],
  loading: false,  // 统一 loading 状态
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
  hammerPanel: null,
  setHammerPanel: (panel) => set({ hammerPanel: panel }),
  hammerSearch: '',
  setHammerSearch: (text) => set({ hammerSearch: text }),
  hammerData: JSON.parse(localStorage.getItem('c_hammer_data') || '{}'),
  hammerWhType: localStorage.getItem('c_wh_type_' + (localStorage.getItem('c_channel') || 'jd')) || 'own',
  setHammerWhType: (v) => { localStorage.setItem('c_wh_type_' + get().channel, v); set({ hammerWhType: v }) },
  hammerInsightsTab: 'replen',
  setHammerInsightsTab: (t) => set({ hammerInsightsTab: t }),
  hammerCleansingChannel: 'jd',
  setHammerCleansingChannel: (c) => set({ hammerCleansingChannel: c }),
  hammerRulesTab: 'rules',
  setHammerRulesTab: (t) => set({ hammerRulesTab: t }),
  hammerRuleNewVersion: 0,
  bumpHammerRuleNew: () => set((s) => ({ hammerRuleNewVersion: s.hammerRuleNewVersion + 1 })),
  hammerRulesMode: localStorage.getItem('c_replen_mode_' + (localStorage.getItem('c_channel') || 'jd')) || ((localStorage.getItem('c_channel') || 'jd') === 'jd' ? 'bbcc' : 'traditional'),
  setHammerRulesMode: (m) => { localStorage.setItem('c_replen_mode_' + get().channel, m); set({ hammerRulesMode: m }) },
  hammerDashPeriod: localStorage.getItem('c_dash_period_' + (localStorage.getItem('c_channel') || 'jd')) || 'month',
  customDateStart: '',
  customDateEnd: '',
  setHammerDashPeriod: (p) => { localStorage.setItem('c_dash_period_' + get().channel, p); set({ hammerDashPeriod: p, customDateStart: '', customDateEnd: '' }) },
  setCustomDate: (start, end) => { set({ customDateStart: start, customDateEnd: end, hammerDashPeriod: 'custom' }); get().loadAll() },
  hammerReplenMode: localStorage.getItem('c_replen_mode_' + (localStorage.getItem('c_channel') || 'jd')) || ((localStorage.getItem('c_channel') || 'jd') === 'jd' ? 'bbcc' : 'traditional'),
  setHammerReplenMode: (m) => { localStorage.setItem('c_replen_mode_' + get().channel, m); set({ hammerReplenMode: m }) },
  hammerCols: {},
  setHammerCols: (pageKey, cols) => set((s) => ({ hammerCols: { ...s.hammerCols, [pageKey]: cols } })),
  setHammerData: (page, data) => {
    const ch = get().channel
    const channelData = get().hammerData[ch] || {}
    const hd = { ...get().hammerData, [ch]: { ...channelData, [page]: data } }
    localStorage.setItem('c_hammer_data', JSON.stringify(hd))
    set({ hammerData: hd })
  },
  setChannel: (ch) => { localStorage.setItem('c_channel', ch); clearCache(); clearInflight(); set({ channel: ch, dataLoaded: false, loading: true, hammerWhType: localStorage.getItem('c_wh_type_' + ch) || 'own', hammerDashPeriod: localStorage.getItem('c_dash_period_' + ch) || 'month', hammerReplenMode: localStorage.getItem('c_replen_mode_' + ch) || (ch === 'jd' ? 'bbcc' : 'traditional'), hammerRulesMode: localStorage.getItem('c_replen_mode_' + ch) || (ch === 'jd' ? 'bbcc' : 'traditional') }) },

  async loadAll(page) {
    set({ loading: true, orderLoading: true })
    const ch = get().channel
    const s = get().hammerSearch || ''
    const st = get().orderStatus || ''
    const p = page || get().orderPage || 1
    const ds = get().hammerDashPeriod
    const cds = get().customDateStart
    const cde = get().customDateEnd
    var dashUrl = '/api/dashboard/summary'
    if (ds === 'custom' && cds && cde) dashUrl += '?start_date=' + cds + '&end_date=' + cde
    try {
      const results = await Promise.allSettled([
        api.get(dashUrl),
        api.get('/api/orders?page=' + p + '&page_size=30&search=' + encodeURIComponent(s) + '&status=' + encodeURIComponent(st)),
        api.get('/api/inventory'),
        api.get('/api/quality-logs'),
        api.get('/api/alerts'),
        api.get('/api/dashboard/stock-risk'),
      ])
      const [dashboard, orders, inventory, qualityLogs, alerts, stockRisk] = results.map(r =>
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
        stockRisk: stockRisk.data || [],
        dataLoaded: true,
        loading: false,
        orderLoading: false,
      })
    } catch (e) {
      console.error('loadAll failed:', e)
      set({ loading: false, orderLoading: false })
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
    get().loadAll(p)
  },

  setOrderFilterLocal(search, status) {
    set({ orderSearch: search, orderStatus: status, orderPage: 1 })
    get().loadAll(1)
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
