// src/api/request.ts - uni.request wrapper with mock fallback and auth header.
// When VITE_API_BASE_URL is empty, requests are routed to the in-memory mock.

import { authService } from './mock/services'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9000/api/v1'
const USE_MOCK = !BASE_URL

export interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
  params?: Record<string, any>
  showLoading?: boolean
}

function buildUrl(url: string, params?: Record<string, any>): string {
  if (!params) return url
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')
  if (!q) return url
  return url.includes('?') ? `${url}&${q}` : `${url}?${q}`
}

let tokenGetter: () => string = () => ''

export function setTokenGetter(fn: () => string) {
  tokenGetter = fn
}

/** Simulate a fetch against in-memory services. */
async function mockFetch(opts: RequestOptions): Promise<any> {
  const method = (opts.method || 'GET').toUpperCase()
  const url = buildUrl(opts.url, opts.params)
  const [path, queryStr] = url.split('?')
  const query: Record<string, any> = {}
  if (queryStr) {
    queryStr.split('&').forEach((kv) => {
      const [k, v] = kv.split('=')
      query[decodeURIComponent(k)] = decodeURIComponent(v)
    })
  }
  // Parse JSON body for POST/PUT
  let body: any = opts.data
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { /* keep as string */ }
  }

  // Simple routing table mirroring backend endpoints
  // ----- AUTH -----
  if (path === '/auth/login' && method === 'POST') return authService.login(body.username, body.password)
  if (path === '/auth/me' && method === 'GET') return authService.me()
  if (path === '/auth/logout' && method === 'POST') return authService.logout()

  // ----- SALES / DASHBOARD -----
  if (path === '/sales/me' && method === 'GET') return authService.me()
  if (path === '/sales/performance' && method === 'GET') return salesService.performance(query.period_start || dayjs().subtract(30, 'day').format('YYYY-MM-DD'), query.period_end || dayjs().format('YYYY-MM-DD'))
  if (path === '/sales/ranking' && method === 'GET') return salesService.ranking(query.period_start || dayjs().subtract(30, 'day').format('YYYY-MM-DD'), query.period_end || dayjs().format('YYYY-MM-DD'))
  if (path === '/sales/dashboard' && method === 'GET') return salesService.dashboard()
  if (path === '/sales/trend' && method === 'GET') return salesService.trend(Number(query.days) || 14)

  // ----- PRODUCTS -----
  if (path === '/products' && method === 'GET') return productService.list({ ...query })
  if (path === '/products/all' && method === 'GET') return productService.all()
  if (path === '/products/categories' && method === 'GET') return productService.categories()
  const productMatch = path.match(/^\/products\/(\d+)$/)
  if (productMatch && method === 'GET') return productService.get(Number(productMatch[1]))
  const priceMatch = path.match(/^\/products\/(\d+)\/price$/)
  if (priceMatch && method === 'GET') return productService.getPrice(Number(priceMatch[1]), Number(query.customer_id), query.unit)

  // ----- CUSTOMERS -----
  if (path === '/customers' && method === 'GET') return customerService.list({ ...query })
  if (path === '/customers/all' && method === 'GET') return customerService.all()
  if (path === '/customers/pending' && method === 'GET') return customerService.pendingApprovals()
  const custMatch = path.match(/^\/customers\/(\d+)$/)
  if (custMatch && method === 'GET') return customerService.get(Number(custMatch[1]))
  const approveMatch = path.match(/^\/customers\/(\d+)\/approve$/)
  if (approveMatch && method === 'POST') return customerService.approve(Number(approveMatch[1]), body.sales_id || 1)
  const rejectMatch = path.match(/^\/customers\/(\d+)\/reject$/)
  if (rejectMatch && method === 'POST') return customerService.reject(Number(rejectMatch[1]))
  const creditMatch = path.match(/^\/customers\/(\d+)\/credit-apply$/)
  if (creditMatch && method === 'POST') return customerService.applyCredit(Number(creditMatch[1]), body.amount, body.reason)
  const followUpsMatch = path.match(/^\/customers\/(\d+)\/follow-ups$/)
  if (followUpsMatch && method === 'GET') return customerService.followUps(Number(followUpsMatch[1]))
  if (path === '/customers/follow-ups' && method === 'POST') return customerService.addFollowUp(body)

  // ----- ORDERS -----
  if (path === '/orders' && method === 'GET') return orderService.list({ ...query })
  if (path === '/orders' && method === 'POST') return orderService.create(body)
  const orderMatch = path.match(/^\/orders\/([\w-]+)$/)
  if (orderMatch && method === 'GET') return orderService.get(orderMatch[1])
  const repurchaseMatch = path.match(/^\/orders\/([\w-]+)\/repurchase$/)
  if (repurchaseMatch && method === 'POST') return orderService.repurchase(repurchaseMatch[1])
  const historyMatch = path.match(/^\/customers\/(\d+)\/orders$/)
  if (historyMatch && method === 'GET') return orderService.historyByCustomer(Number(historyMatch[1]))

  // ----- FINANCE -----
  const creditInfoMatch = path.match(/^\/finance\/credit\/(\d+)$/)
  if (creditInfoMatch && method === 'GET') return financeService.getCredit(Number(creditInfoMatch[1]))
  if (path === '/finance/commissions' && method === 'GET') return financeService.listCommissions({ ...query })

  // ----- PROMOTION -----
  if (path === '/promotion/stats' && method === 'GET') return promotionService.stats()
  if (path === '/promotion/visits' && method === 'GET') return promotionService.listVisits()
  if (path === '/promotion/check-in' && method === 'POST') return promotionService.checkIn(body)

  // ----- MESSAGES -----
  if (path === '/messages' && method === 'GET') return messageService.list()
  if (path === '/messages/unread-count' && method === 'GET') return { count: await messageService.unreadCount() }
  const msgReadMatch = path.match(/^\/messages\/(\d+)\/read$/)
  if (msgReadMatch && method === 'POST') return messageService.markRead(Number(msgReadMatch[1]))
  if (path === '/messages/read-all' && method === 'POST') return messageService.markAllRead()

  throw { response: { status: 404, data: { detail: `Mock route not found: ${method} ${path}` } } }
}

// Lazy imports for mock services (avoid circular deps)
import { salesService } from './mock/services'
import { productService } from './mock/services'
import { customerService } from './mock/services'
import { orderService } from './mock/services'
import { financeService } from './mock/services'
import { promotionService } from './mock/services'
import { messageService } from './mock/services'
import dayjs from 'dayjs'

export async function request<T = any>(opts: RequestOptions): Promise<T> {
  if (opts.showLoading !== false) {
    uni.showLoading({ title: '加载中', mask: false })
  }
  try {
    if (USE_MOCK) {
      const data = await mockFetch(opts)
      return data as T
    }
    return await new Promise<T>((resolve, reject) => {
      const token = tokenGetter()
      const header: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (token) header.Authorization = `Bearer ${token}`
      uni.request({
        url: BASE_URL + buildUrl(opts.url, opts.params),
        method: opts.method || 'GET',
        data: opts.data,
        header,
        success: (res) => {
          const status = res.statusCode || 200
          if (status >= 200 && status < 300) {
            resolve((res.data as { data: T }).data)
          } else if (status === 401) {
            if (token) {
              uni.removeStorageSync('wdm_sales_access')
              uni.reLaunch({ url: '/pages/auth/login' })
            }
            reject(new Error((res.data as any)?.message || '登录状态已失效'))
          } else {
            const detail = (res.data as any)?.detail || (res.data as any)?.message || '请求失败'
            uni.showToast({ title: String(detail), icon: 'none' })
            reject(new Error(String(detail)))
          }
        },
        fail: (err) => {
          uni.showToast({ title: '网络异常', icon: 'none' })
          reject(err)
        },
      })
    })
  } finally {
    if (opts.showLoading !== false) uni.hideLoading()
  }
}
