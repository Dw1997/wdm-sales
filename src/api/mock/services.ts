// src/api/mock/services.ts - In-memory CRUD services for sales-end.
import dayjs from 'dayjs'
import {
  salesList,
  customers,
  products,
  orders,
  commissions,
  followUps,
  visitRecords,
  notifications,
  counters,
  currentSalesId,
} from './db'
import type {
  UserInfo,
  TokenResponse,
  Product,
  PriceResponse,
  Customer,
  FollowUp,
  SalesPerformance,
  Order,
  OrderItem,
  Commission,
  CreditInfo,
  VisitRecord,
  Notification,
  SalesDashboard,
  TrendPoint,
  PromotionStats,
  PageQuery,
  PageResult,
} from '@/types'

const delay = (ms = 300) => new Promise<void>((r) => setTimeout(r, ms))

function paginate<T>(items: T[], q: PageQuery): PageResult<T> {
  const page = Number(q.page ?? 1)
  const pageSize = Number(q.page_size ?? 20)
  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    page,
    page_size: pageSize,
  }
}

// ===========================================================================
// Auth
// ===========================================================================
export const authService = {
  async login(username: string, password: string) {
    await delay(300)
    if (!username || password.length < 6) {
      throw { response: { status: 401, data: { detail: '用户名或密码错误' } } }
    }
    const sales = salesList.find((s) => s.username === username) || salesList[0]
    return {
      access_token: `mock-access-${sales.id}-${Date.now()}`,
      refresh_token: `mock-refresh-${sales.id}-${Date.now()}`,
      token_type: 'bearer' as const,
      expires_in: 3600,
    }
  },
  async me(): Promise<UserInfo> {
    await delay(100)
    const s = salesList.find((x) => x.id === currentSalesId)!
    return {
      id: s.id,
      username: s.username,
      real_name: s.real_name,
      phone: s.phone,
      role: 'sales',
      avatar: s.avatar,
      invite_code: s.invite_code,
      region: s.region,
    }
  },
  async logout() {
    await delay(50)
  },
}

// ===========================================================================
// Products (with offline cache)
// ===========================================================================
export const productService = {
  async list(q: PageQuery = {}): Promise<PageResult<Product>> {
    await delay()
    let result = [...products]
    if (q.keyword) {
      const k = String(q.keyword).toLowerCase()
      result = result.filter(
        (p) => p.name.toLowerCase().includes(k) || p.sku.toLowerCase().includes(k) || (p.brand || '').toLowerCase().includes(k),
      )
    }
    if (q.category) result = result.filter((p) => p.category === q.category)
    return paginate(result, q)
  },
  async all(): Promise<Product[]> {
    await delay(50)
    return [...products]
  },
  async categories(): Promise<string[]> {
    await delay(50)
    return Array.from(new Set(products.map((p) => p.category)))
  },
  async get(id: number): Promise<Product | null> {
    await delay(50)
    return products.find((p) => p.id === id) ?? null
  },
  async getPrice(productId: number, customerId: number, unit = '包'): Promise<PriceResponse> {
    await delay(50)
    // Server-side price resolution (price isolation rule)
    const product = products.find((p) => p.id === productId)
    if (!product) throw { response: { status: 404 } }
    const customer = customers.find((c) => c.id === customerId)
    // Base reference price table
    const ref: Record<string, number> = { 1: 3.5, 2: 2.5, 3: 2.5, 4: 1.5, 5: 13, 6: 3.8, 7: 8, 8: 5 }
    let price = ref[productId] ?? 0
    if (customer) {
      // Tier-based pricing
      const tierPrice: Record<string, number> = { bronze: price, silver: price * 0.95, gold: price * 0.9, vip: price * 0.85 }
      price = tierPrice[customer.level] ?? price
      // Multiply by unit ratio if non-base unit
      const unitObj = product.units.find((u) => u.name === unit)
      if (unitObj && unitObj.ratio > 1) {
        price = Number((price * unitObj.ratio * 0.9).toFixed(2)) // box discount 10%
      }
    }
    return { product_id: productId, customer_id: customerId, unit, unit_price: Number(price.toFixed(2)), currency: 'CNY' }
  },
}

// ===========================================================================
// Customers (sales-owned)
// ===========================================================================
export const customerService = {
  async list(q: PageQuery = {}): Promise<PageResult<Customer>> {
    await delay()
    let result = [...customers]
    if (q.keyword) {
      const k = String(q.keyword).toLowerCase()
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(k) ||
          c.phone.includes(k) ||
          (c.shop_name || '').toLowerCase().includes(k),
      )
    }
    if (q.status) result = result.filter((c) => c.status === q.status)
    if (q.level) result = result.filter((c) => c.level === q.level)
    return paginate(result, q)
  },
  async all(): Promise<Customer[]> {
    await delay(50)
    return [...customers]
  },
  async get(id: number): Promise<Customer | null> {
    await delay(50)
    const c = customers.find((c) => c.id === id)
    if (!c) return null
    return {
      ...c,
      month_gmv: orders.filter((o) => o.customer_id === id && dayjs(o.created_at).isAfter(dayjs().subtract(30, 'day'))).reduce((s, o) => s + o.total_amount, 0),
      total_orders: orders.filter((o) => o.customer_id === id).length,
    }
  },
  async pendingApprovals(): Promise<Customer[]> {
    await delay()
    return customers.filter((c) => c.status === 'pending')
  },
  async approve(id: number, salesId: number): Promise<Customer> {
    await delay()
    const idx = customers.findIndex((c) => c.id === id)
    if (idx < 0) throw new Error('客户不存在')
    customers[idx].status = 'active'
    const s = salesList.find((x) => x.id === salesId)
    if (s) {
      customers[idx].sales_id = s.id
      customers[idx].sales_name = s.name
    }
    return customers[idx]
  },
  async reject(id: number): Promise<Customer> {
    await delay()
    const idx = customers.findIndex((c) => c.id === id)
    if (idx < 0) throw new Error('客户不存在')
    customers[idx].status = 'disabled'
    return customers[idx]
  },
  async applyCredit(id: number, amount: number, reason: string): Promise<{ id: number; status: string }> {
    await delay()
    // In real impl, this would create an approval workflow
    const c = customers.find((c) => c.id === id)
    if (!c) throw new Error('客户不存在')
    // Mock: approve immediately
    c.credit_limit += amount
    c.available_credit += amount
    return { id: Math.floor(Math.random() * 10000), status: 'approved' }
  },
  async followUps(customerId: number): Promise<FollowUp[]> {
    await delay()
    return followUps.filter((f) => f.customer_id === customerId)
  },
  async addFollowUp(payload: Omit<FollowUp, 'id' | 'created_at'>): Promise<FollowUp> {
    await delay()
    const newF: FollowUp = {
      ...payload,
      id: counters.followUp++,
      created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    }
    followUps.unshift(newF)
    return newF
  },
}

// ===========================================================================
// Sales / Performance
// ===========================================================================
export const salesService = {
  async me(): Promise<UserInfo> {
    return authService.me()
  },
  async performance(start: string, end: string): Promise<SalesPerformance> {
    await delay()
    const myOrders = orders.filter((o) => o.sales_id === currentSalesId)
    const filtered = myOrders.filter((o) => {
      const d = dayjs(o.created_at)
      return d.isAfter(dayjs(start).subtract(1, 'day')) && d.isBefore(dayjs(end).add(1, 'day'))
    })
    const gmv = filtered.reduce((sum, o) => sum + o.total_amount, 0)
    const newCustomers = customers.filter(
      (c) => c.sales_id === currentSalesId && dayjs(c.registered_at).isAfter(dayjs(start).subtract(1, 'day')) && dayjs(c.registered_at).isBefore(dayjs(end).add(1, 'day')),
    ).length
    return {
      sales_id: currentSalesId,
      sales_name: salesList.find((s) => s.id === currentSalesId)!.name,
      period_start: start,
      period_end: end,
      order_count: filtered.length,
      gmv,
      estimated_commission: gmv * 0.05,
      new_customers: newCustomers,
    }
  },
  async ranking(start: string, end: string): Promise<(SalesPerformance & { ranking: number })[]> {
    await delay()
    const perfs = await Promise.all(
      salesList.map(async (s) => {
        const myOrders = orders.filter((o) => o.sales_id === s.id)
        const filtered = myOrders.filter((o) => {
          const d = dayjs(o.created_at)
          return d.isAfter(dayjs(start).subtract(1, 'day')) && d.isBefore(dayjs(end).add(1, 'day'))
        })
        const gmv = filtered.reduce((sum, o) => sum + o.total_amount, 0)
        return {
          sales_id: s.id,
          sales_name: s.name,
          period_start: start,
          period_end: end,
          order_count: filtered.length,
          gmv,
          estimated_commission: gmv * 0.05,
          new_customers: customers.filter(
            (c) => c.sales_id === s.id && dayjs(c.registered_at).isAfter(dayjs(start).subtract(1, 'day')) && dayjs(c.registered_at).isBefore(dayjs(end).add(1, 'day')),
          ).length,
        }
      }),
    )
    return perfs
      .sort((a, b) => b.gmv - a.gmv)
      .map((p, i) => ({ ...p, ranking: i + 1 }))
  },
  async dashboard(): Promise<SalesDashboard> {
    await delay()
    const today = dayjs().format('YYYY-MM-DD')
    const monthStart = dayjs().startOf('month').format('YYYY-MM-DD')
    const todayOrders = orders.filter((o) => dayjs(o.created_at).format('YYYY-MM-DD') === today && o.sales_id === currentSalesId)
    const monthOrders = orders.filter((o) => dayjs(o.created_at).isAfter(dayjs(monthStart).subtract(1, 'day')) && o.sales_id === currentSalesId)
    return {
      today_gmv: todayOrders.reduce((s, o) => s + o.total_amount, 0),
      today_orders: todayOrders.length,
      today_new_customers: customers.filter((c) => dayjs(c.registered_at).format('YYYY-MM-DD') === today).length,
      today_visits: visitRecords.filter((v) => dayjs(v.created_at).format('YYYY-MM-DD') === today).length,
      month_gmv: monthOrders.reduce((s, o) => s + o.total_amount, 0),
      month_orders: monthOrders.length,
      month_new_customers: customers.filter((c) => dayjs(c.registered_at).isAfter(dayjs(monthStart).subtract(1, 'day'))).length,
      month_estimated_commission: monthOrders.reduce((s, o) => s + o.total_amount, 0) * 0.05,
      pending_orders: orders.filter((o) => o.status === 'pending_audit' && o.sales_id === currentSalesId).length,
      pending_approvals: customers.filter((c) => c.status === 'pending' && c.sales_id === currentSalesId).length,
      expiring_batches: products.reduce(
        (s, p) =>
          s +
          p.batches.filter((b) => {
            const days = dayjs(b.expiry_date).diff(dayjs(), 'day')
            return days >= 0 && days <= p.expiry_warning_days
          }).length,
        0,
      ),
      low_stock_products: products.filter((p) => p.stock < p.safety_stock).length,
    }
  },
  async trend(days = 14): Promise<TrendPoint[]> {
    await delay()
    const out: TrendPoint[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = dayjs().subtract(i, 'day').format('YYYY-MM-DD')
      const dayOrders = orders.filter((o) => dayjs(o.created_at).format('YYYY-MM-DD') === d && o.sales_id === currentSalesId)
      out.push({ date: d, gmv: dayOrders.reduce((s, o) => s + o.total_amount, 0), order_count: dayOrders.length })
    }
    return out
  },
}

// ===========================================================================
// Orders
// ===========================================================================
export const orderService = {
  async list(q: PageQuery = {}): Promise<PageResult<Order>> {
    await delay()
    let result = orders.filter((o) => o.sales_id === currentSalesId)
    if (q.keyword) {
      const k = String(q.keyword).toLowerCase()
      result = result.filter(
        (o) => o.id.toLowerCase().includes(k) || o.customer_name.toLowerCase().includes(k),
      )
    }
    if (q.status) result = result.filter((o) => o.status === q.status)
    if (q.customer_id) result = result.filter((o) => o.customer_id === Number(q.customer_id))
    return paginate(
      [...result].sort((a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf()),
      q,
    )
  },
  async get(id: string): Promise<Order | null> {
    await delay(50)
    return orders.find((o) => o.id === id) ?? null
  },
  async create(payload: {
    customer_id: number
    items: { product_id: number; quantity: number; unit: string }[]
    payment_method: Order['payment_method']
    remark?: string
  }): Promise<Order> {
    await delay()
    const customer = customers.find((c) => c.id === payload.customer_id)
    if (!customer) throw new Error('客户不存在')
    const items: OrderItem[] = []
    for (const it of payload.items) {
      const product = products.find((p) => p.id === it.product_id)
      if (!product) throw new Error(`商品 ${it.product_id} 不存在`)
      const price = await productService.getPrice(it.product_id, customer.id, it.unit)
      items.push({
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        unit: it.unit,
        quantity: it.quantity,
        unit_price: price.unit_price,
        subtotal: Number((price.unit_price * it.quantity).toFixed(2)),
      })
    }
    const total = items.reduce((s, it) => s + it.subtotal, 0)
    const newOrder: Order = {
      id: `ORD${String(counters.order++).padStart(6, '0')}`,
      customer_id: customer.id,
      customer_name: customer.shop_name || customer.name,
      sales_id: currentSalesId,
      sales_name: salesList.find((s) => s.id === currentSalesId)?.name,
      status: 'pending_audit',
      payment_method: payload.payment_method,
      total_amount: Number(total.toFixed(2)),
      paid_amount: 0,
      items,
      remark: payload.remark,
      created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      delivery_address: customer.address,
    }
    orders.unshift(newOrder)
    return newOrder
  },
  async repurchase(orderId: string): Promise<{ customer_id: number; items: { product_id: number; quantity: number; unit: string }[] }> {
    await delay(50)
    const order = orders.find((o) => o.id === orderId)
    if (!order) throw new Error('订单不存在')
    return {
      customer_id: order.customer_id,
      items: order.items.map((it) => ({ product_id: it.product_id, quantity: it.quantity, unit: it.unit })),
    }
  },
  async historyByCustomer(customerId: number, limit = 5): Promise<Order[]> {
    await delay(50)
    return orders
      .filter((o) => o.customer_id === customerId)
      .sort((a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf())
      .slice(0, limit)
  },
}

// ===========================================================================
// Finance
// ===========================================================================
export const financeService = {
  async getCredit(customerId: number): Promise<CreditInfo> {
    await delay(50)
    const c = customers.find((x) => x.id === customerId)
    if (!c) throw new Error('客户不存在')
    return {
      customer_id: customerId,
      credit_limit: c.credit_limit,
      used_credit: c.used_credit,
      available_credit: c.available_credit,
    }
  },
  async listCommissions(q: PageQuery = {}): Promise<PageResult<Commission>> {
    await delay()
    let result = commissions.filter((c) => c.sales_id === currentSalesId)
    if (q.status) result = result.filter((c) => c.status === q.status)
    return paginate(
      [...result].sort((a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf()),
      q,
    )
  },
}

// ===========================================================================
// Promotion
// ===========================================================================
export const promotionService = {
  async stats(): Promise<PromotionStats> {
    await delay(50)
    const sales = salesList.find((s) => s.id === currentSalesId)!
    const myCustomers = customers.filter((c) => c.sales_id === currentSalesId)
    return {
      invite_code: sales.invite_code,
      invite_url: `https://m.example.com/register?invite=${sales.invite_code}`,
      total_visits: 156,
      total_registered: myCustomers.length,
      pending_approvals: myCustomers.filter((c) => c.status === 'pending').length,
      approved: myCustomers.filter((c) => c.status === 'active').length,
      rejected: myCustomers.filter((c) => c.status === 'disabled').length,
    }
  },
  async listVisits(): Promise<VisitRecord[]> {
    await delay()
    return [...visitRecords].sort((a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf())
  },
  async checkIn(payload: { customer_id: number; customer_name: string; location: string; latitude?: number; longitude?: number; photos: string[]; content: string }): Promise<VisitRecord> {
    await delay()
    const newV: VisitRecord = {
      id: counters.visit++,
      sales_id: currentSalesId,
      sales_name: salesList.find((s) => s.id === currentSalesId)!.name,
      created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      ...payload,
    }
    visitRecords.unshift(newV)
    return newV
  },
}

// ===========================================================================
// Messages
// ===========================================================================
export const messageService = {
  async list(): Promise<Notification[]> {
    await delay()
    return [...notifications].sort((a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf())
  },
  async markRead(id: number): Promise<void> {
    await delay(50)
    const n = notifications.find((x) => x.id === id)
    if (n) n.read = true
  },
  async markAllRead(): Promise<void> {
    await delay(50)
    notifications.forEach((n) => (n.read = true))
  },
  async unreadCount(): Promise<number> {
    return notifications.filter((n) => !n.read).length
  },
}
