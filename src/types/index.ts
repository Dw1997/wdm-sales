// src/types/index.ts - Domain types for the sales-end.

export type Role = 'admin' | 'sales' | 'customer'

export interface UserInfo {
  id: number
  username: string
  real_name?: string
  phone?: string
  role: Role
  avatar?: string
  invite_code?: string
  region?: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: 'bearer'
  expires_in: number
}

// Product
export type ProductStatus = 'on_sale' | 'off_shelf' | 'draft'

export interface ProductUnit {
  name: string
  ratio: number
}

export interface StockBatch {
  batch_no: string
  production_date: string
  expiry_date: string
  quantity: number
  cost_price: number
}

export interface Product {
  id: number
  sku: string
  name: string
  category: string
  brand?: string
  spec?: string
  base_unit: string
  units: ProductUnit[]
  stock: number
  safety_stock: number
  expiry_warning_days: number
  batches: StockBatch[]
  cover?: string
  description?: string
  status: ProductStatus
}

export interface PriceResponse {
  product_id: number
  customer_id: number
  unit: string
  unit_price: number
  currency: 'CNY'
}

// Customer
export type CustomerStatus = 'pending' | 'active' | 'disabled'
export type CustomerLevel = 'bronze' | 'silver' | 'gold' | 'vip'

export interface Customer {
  id: number
  name: string
  phone: string
  address?: string
  shop_name?: string
  status: CustomerStatus
  level: CustomerLevel
  sales_id?: number
  sales_name?: string
  credit_limit: number
  used_credit: number
  available_credit: number
  invite_code?: string
  registered_at: string
  last_order_at?: string
  remark?: string
  // Additional fields for sales view
  today_gmv?: number
  month_gmv?: number
  total_orders?: number
  follow_up_count?: number
  last_follow_up_at?: string
}

export interface FollowUp {
  id: number
  customer_id: number
  customer_name: string
  sales_id: number
  sales_name?: string
  type: 'visit' | 'phone' | 'wechat' | 'note'
  content: string
  location?: string
  photos?: string[]
  created_at: string
}

// Sales
export interface Sales {
  id: number
  name: string
  phone: string
  real_name?: string
  invite_code: string
  total_customers: number
  active_customers: number
  total_gmv: number
  estimated_commission: number
  joined_at: string
  status: 'active' | 'disabled'
  region?: string
  remark?: string
  avatar?: string
}

export interface SalesPerformance {
  sales_id: number
  sales_name: string
  period_start: string
  period_end: string
  order_count: number
  gmv: number
  estimated_commission: number
  new_customers: number
  ranking?: number
}

// Order
export type OrderStatus =
  | 'pending_audit'
  | 'rejected'
  | 'paid'
  | 'picking'
  | 'shipped'
  | 'completed'
  | 'cancelled'

export type PaymentMethod = 'online' | 'credit' | 'wechat' | 'alipay' | 'cash' | 'bank'

export interface OrderItem {
  product_id: number
  product_name: string
  sku: string
  unit: string
  quantity: number
  unit_price: number
  subtotal: number
}

export interface Order {
  id: string
  customer_id: number
  customer_name: string
  sales_id?: number
  sales_name?: string
  status: OrderStatus
  payment_method: PaymentMethod
  total_amount: number
  paid_amount: number
  items: OrderItem[]
  remark?: string
  rejection_reason?: string
  delivery_address?: string
  created_at: string
  audited_at?: string
  shipped_at?: string
  completed_at?: string
}

// Finance
export interface CreditInfo {
  customer_id: number
  credit_limit: number
  used_credit: number
  available_credit: number
}

export interface Commission {
  id: number
  sales_id: number
  sales_name: string
  order_id: string
  customer_id: number
  customer_name: string
  order_amount: number
  commission_rate: number
  commission_amount: number
  status: 'pending' | 'settled'
  settled_at?: string
  created_at: string
}

// Promotion
export interface PromotionStats {
  invite_code: string
  invite_url: string
  total_visits: number
  total_registered: number
  pending_approvals: number
  approved: number
  rejected: number
}

export interface VisitRecord {
  id: number
  customer_id: number
  customer_name: string
  sales_id: number
  sales_name: string
  location: string
  latitude?: number
  longitude?: number
  photos: string[]
  content: string
  created_at: string
}

// Messages
export type MessageType = 'order' | 'audit' | 'stock' | 'system' | 'credit'

export interface Notification {
  id: number
  type: MessageType
  title: string
  content: string
  level: 'info' | 'warning' | 'success' | 'danger'
  read: boolean
  created_at: string
  link?: string
  data?: any
}

// Dashboard
export interface SalesDashboard {
  today_gmv: number
  today_orders: number
  today_new_customers: number
  today_visits: number
  month_gmv: number
  month_orders: number
  month_new_customers: number
  month_estimated_commission: number
  pending_orders: number
  pending_approvals: number
  expiring_batches: number
  low_stock_products: number
}

export interface TrendPoint {
  date: string
  gmv: number
  order_count: number
}

// Generic
export interface PageQuery {
  page?: number
  page_size?: number
  keyword?: string
  [k: string]: unknown
}

export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}
