import { create } from 'zustand'
import { api } from '../api/client'

const POLL_MS = Number(import.meta.env.VITE_POLL_INTERVAL_MS || 20000)

export const useAppStore = create((set, get) => ({
  dashboard: null,
  orders: [],
  inventory: [],
  qualityLogs: [],
  wsStatus: 'polling',
  importLogs: [],
  poller: null,
  async loadAll() {
    const [dashboard, orders, inventory, qualityLogs] = await Promise.all([
      api.get('/api/dashboard/summary'),
      api.get('/api/orders'),
      api.get('/api/inventory'),
      api.get('/api/quality-logs'),
    ])
    set({
      dashboard: dashboard.data,
      orders: orders.data,
      inventory: inventory.data,
      qualityLogs: qualityLogs.data,
    })
  },
  addImportLog(item) {
    set((state) => ({ importLogs: [item, ...state.importLogs].slice(0, 20) }))
  },
  startPolling() {
    const old = get().poller
    if (old) clearInterval(old)
    get().loadAll()
    const timer = setInterval(() => {
      get().loadAll().catch(() => {})
    }, POLL_MS)
    set({ wsStatus: 'polling', poller: timer })
  },
  stopPolling() {
    const old = get().poller
    if (old) clearInterval(old)
    set({ poller: null })
  },
}))
