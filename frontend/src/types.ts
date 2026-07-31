// ── 统一 API 响应 ──
export interface ApiResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

// ── 看板 ──
export interface DashboardSummary {
  gmv: number
  pending_count: number
  refund_count: number
  low_stock_count: number
  total_orders: number
  total_products: number
  total_suppliers: number
  active_alerts: number
}

export interface DashboardData {
  summary: DashboardSummary
  trend: { 日期: string; 订单数: number; GMV: number }[]
  stores: { name: string; gmv: number; orders: number; low_stock: number }[]
  status_distribution: { name: string; value: number }[]
  category_distribution: { name: string; value: number }[]
  periods: Record<string, { gmv: number; orders: number }>
  funnel: Record<string, { count: number; percentage: number }>
  health_index: { score: number; total: number; ok: number }
}

// ── 库存 ──
export interface InventoryItem {
  id: number
  sku: string
  product_name: string
  store: string
  warehouse: string
  warehouse_type: 'own' | 'platform' | 'platform_b'
  channel: string
  available_qty: number
  in_transit_qty: number
  safety_qty: number
  daily_sales: number
  month_inbound: number
  month_outbound: number
  beginning_stock: number
  turnover_days: number | null
  c_transit?: number
}

// ── 补货建议 ──
export interface ReplenishmentItem {
  sku: string
  product_name: string
  warehouse: string
  b_stock: number
  c_stock: number
  in_transit_qty: number
  daily_sales: number
  daily_sales_7: number
  daily_sales_14: number
  daily_sales_28: number
  suggested_qty: number
  b_suggested: number
  cur_turn: number | null
  after_turn: number | null
  combined_turnover: number | null
  combined_turnover_current: number | null
  note: string
  ordered: boolean
}

// ── 采购建议 ──
export interface PurchaseItem {
  sku: string
  product_name: string
  daily_sales: number
  daily_sales_14: number
  daily_sales_28: number
  sys_total: number
  actual_purchase: number
  note: string
}

// ── 订单 ──
export interface OrderItem {
  id: number
  order_no: string
  sku: string
  product_name: string
  store: string
  warehouse: string
  quantity: number
  total_amount: number
  order_status: string
  ordered_at: string
  platform: string
  barcode?: string
}

// ── 商品 ──
export interface ProductItem {
  id: number
  sku: string
  product_name: string
  store: string
  category: string
  price: number
  box_qty: number
  status: string
  barcode: string
  weight: number
  volume: number
  channel: string
}

// ── 规则 ──
export interface RuleItem {
  id: number
  name: string
  event: string
  condition_json: string
  alert_type: string
  alert_title: string
  alert_desc: string
  severity: string
  is_active: number
  channel: string
}

// ── 告警 ──
export interface AlertItem {
  id: number
  alert_type: string
  title: string
  description: string
  severity: string
  status: string
  related_sku: string
  channel: string
}

// ── 配置 ──
export interface ReplenishmentConfig {
  lead_time_days?: string
  safety_multiplier?: string
  b_to_c_days?: string
  c_safety_days?: string
  ship_to_b_days?: string
  purchase_lead_days?: string
  purchase_safety_days?: string
  moq?: string
  max_turnover_days?: string
  turnover_warning_15?: string
  turnover_warning_90?: string
  replenishment_mode?: string
  [key: string]: string | undefined
}

// ── 库存风险 ──
export interface StockRiskItem {
  sku: string
  product_name: string
  warehouse: string
  type: 'B' | 'C'
  available_qty: number
  daily_sales: number
  days_to_empty: number
  c_gap?: number
  c_avail?: number
  c_transit?: number
}