// src/api/index.ts - Public API facade.
import { request } from './request'
import type {
  UserInfo,
  TokenResponse,
  Product,
  PriceResponse,
  Customer,
  FollowUp,
  SalesPerformance,
  Order,
  Commission,
  CreditInfo,
  Notification,
  SalesDashboard,
  TrendPoint,
  PromotionStats,
  VisitRecord,
  PageQuery,
  PageResult,
} from '@/types'

export const authApi = {
  login: (phone: string, password: string) =>
    request<TokenResponse>({ url: '/auth/login', method: 'POST', data: { phone, password, platform: 'app' }, showLoading: false }),
  me: () => request<UserInfo>({ url: '/auth/me', showLoading: false }),
  logout: () => request<void>({ url: '/auth/logout', method: 'POST', showLoading: false }),
}

export const salesApi = {
  me: () => request<UserInfo>({ url: '/sales/me', showLoading: false }),
  dashboard: () => request<SalesDashboard>({ url: '/sales/dashboard', showLoading: false }),
  performance: (start: string, end: string) =>
    request<SalesPerformance>({ url: '/sales/performance', params: { period_start: start, period_end: end }, showLoading: false }),
  ranking: (start: string, end: string) =>
    request<(SalesPerformance & { ranking: number })[]>({ url: '/sales/ranking', params: { period_start: start, period_end: end }, showLoading: false }),
  trend: (days = 14) => request<TrendPoint[]>({ url: '/sales/trend', params: { days }, showLoading: false }),
}

export const productApi = {
  list: (q: PageQuery = {}) => request<PageResult<Product>>({ url: '/products', params: q }),
  all: () => request<Product[]>({ url: '/products/all', showLoading: false }),
  categories: () => request<string[]>({ url: '/products/categories', showLoading: false }),
  get: (id: number) => request<Product>({ url: `/products/${id}`, showLoading: false }),
  price: (productId: number, customerId: number, unit = '包') =>
    request<PriceResponse>({ url: `/products/${productId}/price`, params: { customer_id: customerId, unit }, showLoading: false }),
}

export const customerApi = {
  list: (q: PageQuery = {}) => request<PageResult<Customer>>({ url: '/customers', params: q }),
  all: () => request<Customer[]>({ url: '/customers/all', showLoading: false }),
  pending: () => request<Customer[]>({ url: '/customers/pending' }),
  get: (id: number) => request<Customer>({ url: `/customers/${id}` }),
  approve: (id: number, sales_id: number) => request<Customer>({ url: `/customers/${id}/approve`, method: 'POST', data: { sales_id } }),
  reject: (id: number) => request<Customer>({ url: `/customers/${id}/reject`, method: 'POST' }),
  applyCredit: (id: number, amount: number, reason: string) =>
    request<{ id: number; status: string }>({ url: `/customers/${id}/credit-apply`, method: 'POST', data: { amount, reason } }),
  followUps: (customerId: number) => request<FollowUp[]>({ url: `/customers/${customerId}/follow-ups` }),
  addFollowUp: (payload: Omit<FollowUp, 'id' | 'created_at'>) =>
    request<FollowUp>({ url: '/customers/follow-ups', method: 'POST', data: payload }),
  orderHistory: (customerId: number) => request<Order[]>({ url: `/customers/${customerId}/orders`, showLoading: false }),
}

export const orderApi = {
  list: (q: PageQuery = {}) => request<PageResult<Order>>({ url: '/orders', params: q }),
  get: (id: string) => request<Order>({ url: `/orders/${id}` }),
  create: (payload: { customer_id: number; items: { product_id: number; quantity: number; unit: string }[]; payment_method: Order['payment_method']; remark?: string }) =>
    request<Order>({ url: '/orders', method: 'POST', data: payload }),
  repurchase: (orderId: string) => request<{ customer_id: number; items: { product_id: number; quantity: number; unit: string }[] }>({ url: `/orders/${orderId}/repurchase`, method: 'POST' }),
}

export const financeApi = {
  credit: (customerId: number) => request<CreditInfo>({ url: `/finance/credit/${customerId}`, showLoading: false }),
  commissions: (q: PageQuery = {}) => request<PageResult<Commission>>({ url: '/finance/commissions', params: q }),
}

export const promotionApi = {
  stats: () => request<PromotionStats>({ url: '/promotion/stats', showLoading: false }),
  visits: () => request<VisitRecord[]>({ url: '/promotion/visits' }),
  checkIn: (payload: { customer_id: number; customer_name: string; location: string; latitude?: number; longitude?: number; photos: string[]; content: string }) =>
    request<VisitRecord>({ url: '/promotion/check-in', method: 'POST', data: payload }),
}

export const messageApi = {
  list: () => request<Notification[]>({ url: '/messages', showLoading: false }),
  unreadCount: () => request<{ count: number }>({ url: '/messages/unread-count', showLoading: false }),
  markRead: (id: number) => request<void>({ url: `/messages/${id}/read`, method: 'POST', showLoading: false }),
  markAllRead: () => request<void>({ url: '/messages/read-all', method: 'POST', showLoading: false }),
}
