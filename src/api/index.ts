// src/api/index.ts - 公开 API 门面：页面只从这里导入。
// 路径与字段以 docs/00-core/api/ 为准。

import { request, uploadImage } from './request'
import type {
  CallListCustomer,
  CallResult,
  CatalogCategoriesResponse,
  CatalogProductListResponse,
  Category,
  Commission,
  CountyCorridorSummary,
  CreditApplication,
  Customer,
  CustomerAccount,
  CustomerPriceQuery,
  CustomerPriceRow,
  CustomerResult,
  CustomerSkuPrice,
  CustomerSkuPricePreview,
  DashboardOverview,
  DeliveryMode,
  FreightHandoverPayload,
  FreightHandoverResult,
  FreightLine,
  FreightMode,
  FreightShipment,
  FreightShipmentDetail,
  FrequentSku,
  Message,
  Money,
  MyDashboard,
  Order,
  OrderApproval,
  OrderApprovalItem,
  OrderResult,
  Page,
  PageQuery,
  PaymentRecordItem,
  PageResult,
  PromotionQrcode,
  PromotionStats,
  PromotionUrlLink,
  PurchaseConfirmPayload,
  PurchaseCreatePayload,
  PurchasePlanPreviewPayload,
  PurchasePlanPreviewResult,
  PurchasePlanToReceiptsPayload,
  PurchasePlanToReceiptsResult,
  PurchaseReceipt,
  PurchaseResult,
  PurchaseSourceType,
  PurchaseStatus,
  PurchaseUpdatePayload,
  QuoteResponse,
  RegionNode,
  ReturnCreatePayload,
  ReturnOrderDetail,
  ReturnPreview,
  ReturnResult,
  RouteTemplate,
  RouteTrip,
  RouteTripCreatePayload,
  RouteTripDraft,
  RouteTripDraftIn,
  RouteTripOrder,
  RouteTripSaveResult,
  SalesDashboard,
  SalesOption,
  SalesPerformance,
  SalesRanking,
  Sku,
  Spu,
  TokenResponse,
  UserInfo,
  Vendor,
  VendorAccount,
  VendorLedgerItem,
  VendorPayablePage,
  VendorPaymentPayload,
  VendorPaymentResult,
  VisitRecord,
  Warn,
} from '@/types'

// ---------- 上传 ----------
export const uploadApi = {
  image: (filePath: string) => uploadImage(filePath),
}

// ---------- 身份 ----------
export const authApi = {
  login: (phone: string, password: string) =>
    request<TokenResponse>({
      url: '/auth/login',
      method: 'POST',
      data: { phone, password, platform: 'app' },
      showLoading: false,
      idempotent: false,
      /* 登录失败由登录页显示错误条：不弹 toast，401 不跳登录页 */
      silent: true,
    }),
  me: () => request<UserInfo>({ url: '/auth/me', showLoading: false }),
  logout: () => request<void>({ url: '/auth/logout', method: 'POST', showLoading: false }),
}

// ---------- 商品与报价 ----------
export const spuApi = {
  list: (q: PageQuery = {}) => request<Page<Spu>>({ url: '/spus', params: q, showLoading: false }),
  get: (id: number) => request<Spu>({ url: `/spus/${id}`, showLoading: false }),
  skus: (spuId: number, q: PageQuery = {}) =>
    request<Page<Sku>>({ url: `/spus/${spuId}/skus`, params: q, showLoading: false }),
  categories: () => request<Category[]>({ url: '/categories/tree', showLoading: false }),
  catalogCategories: (customerId?: number | null) =>
    request<CatalogCategoriesResponse>({
      url: '/spus/catalog/categories',
      params: customerId ? { customer_id: customerId } : undefined,
      showLoading: false,
    }),
  catalog: (params: {
    customer_id?: number
    category_id?: number
    frequent?: boolean
    keyword?: string
    page?: number
    page_size?: number
  } = {}) =>
    request<CatalogProductListResponse>({
      url: '/spus/catalog',
      params,
      showLoading: false,
    }),
}

export const priceApi = {
  /** 批量报价：传客户 + SKU，返回客户成交价、最低售价与库存。 */
  quote: (customerId: number, skuIds: number[]) =>
    request<QuoteResponse>({
      url: '/prices/quote',
      method: 'POST',
      data: { customer_id: customerId, items: skuIds.map((sku_id) => ({ sku_id })) },
      showLoading: false,
      idempotent: false,
    }),

  /** 客户 SKU 成交价查询（pricing.md §7）：销售仅可查自己客户，且不含成本。 */
  customerPrices: (params: CustomerPriceQuery) =>
    request<Page<CustomerPriceRow>>({
      url: '/prices/customer-prices',
      params: { ...params },
      showLoading: false,
    }),
}

export const skuApi = {
  get: (id: number) => request<Sku>({ url: `/skus/${id}`, showLoading: false }),
}

/** 客户专属价（pricing.md §4）：列表 / 改价 / 删除 / 单 SKU 价格链路预览。 */
export const skuPriceApi = {
  list: (customerId: number, opts: { belowMin?: boolean } = {}) =>
    request<CustomerSkuPrice[]>({
      url: '/customer-sku-prices',
      params: {
        customer_id: customerId,
        ...(opts.belowMin === undefined ? {} : { below_min: opts.belowMin }),
      },
      showLoading: false,
    }),
  upsert: (customerId: number, skuId: number, price: number) =>
    request<CustomerSkuPrice>({
      url: `/customer-sku-prices/${customerId}/${skuId}`,
      method: 'PUT',
      data: { price },
    }),
  remove: (customerId: number, skuId: number) =>
    request<void>({
      url: `/customer-sku-prices/${customerId}/${skuId}`,
      method: 'DELETE',
    }),
  preview: (customerId: number, skuId: number) =>
    request<CustomerSkuPricePreview>({
      url: `/customer-sku-prices/${customerId}/${skuId}/preview`,
      showLoading: false,
    }),
}

export interface CustomerTag {
  id: number
  name: string
  sort_order: number
  is_active: boolean
}

export const customerTagApi = {
  list: (params: { is_active?: boolean } = {}) =>
    request<CustomerTag[]>({ url: '/customer-tags', params, showLoading: false }),
}

export interface CustomerLevel {
  id: number
  level_id: string
  nickname: string
  applicable_tag_ids?: number[]
  applicable_tags?: { id: number; name: string }[]
  description?: string | null
  default_credit_limit: Money
  is_active: boolean
  customer_count: number
}

export const customerLevelApi = {
  list: () => request<CustomerLevel[]>({ url: '/customer-levels', showLoading: false }),
}

// ---------- 客户 ----------
export const customerApi = {
  /** 后端返回裸数组（无 total），分页用 page / page_size；`order_by` 见 customers.md §2。 */
  list: (q: PageQuery = {}) =>
    request<Customer[]>({ url: '/customers', params: q, showLoading: false }),
  get: (id: number) => request<Customer>({ url: `/customers/${id}`, showLoading: false }),
  account: (id: number) =>
    request<CustomerAccount>({ url: `/customers/${id}/account`, showLoading: false }),
  salesOptions: () => request<SalesOption[]>({ url: '/customers/sales-options' }),

  /** 新建客户：管理员与销售均可选标签与等级（不选默认「默认售价」），创建即生效。 */
  create: (payload: {
    name: string
    phone: string
    contact_name?: string | null
    contact_phone?: string | null
    tag_id?: number | null
    sales_id?: number | null
    referrer_customer_id?: number | null
    level_id?: number | null
    province?: string | null
    city?: string | null
    district?: string | null
    town?: string | null
    detail_address?: string | null
    address?: string | null
    default_delivery_mode?: DeliveryMode
    delivery_region_id?: number | null
    freight_line_id?: number | null
    default_freight_mode?: Exclude<FreightMode, 'none'>
  }) => request<CustomerResult>({ url: '/customers', method: 'POST', data: payload }),

  /** 改资料：移动端只改联系信息、地址、等级（送货地点/归属/额度在 Web 端）。 */
  update: (id: number, payload: Record<string, unknown>) =>
    request<Customer>({ url: `/customers/${id}`, method: 'PUT', data: payload }),

  /** 改等级：销售和管理员均从管理员维护的启用等级中选择（不含 walk_in）。 */
  assignLevel: (id: number, levelId: number) =>
    request<Customer>({ url: `/customers/${id}/level`, method: 'PUT', data: { level_id: levelId } }),

  /** 常购商品（orders.md §8），带上次成交价。 */
  frequentSkus: (id: number, limit = 12) =>
    request<FrequentSku[]>({
      url: `/customers/${id}/frequent-skus`,
      params: { limit },
      showLoading: false,
    }),

  audit: (
    id: number,
    payload: {
      approved: boolean
      level_id?: number
      tag_id?: number | null
      sales_id?: number
      name?: string
      contact_name?: string
      delivery_region_id?: number | null
      default_delivery_mode?: 'route' | 'freight' | 'local'
      address?: string
      detail_address?: string
      referrer_customer_id?: number | null
      reason?: string
    },
  ) => request<void>({ url: `/customers/${id}/audit`, method: 'POST', data: payload }),

  // 以下为尚未迁移的页面在用（推广/跟进域，后端接口未实现）
  all: () =>
    request<Customer[]>({ url: '/customers', params: { page: 1, page_size: 100 }, showLoading: false }),
  pending: () => request<Customer[]>({ url: '/customers', params: { status: 'pending' } }),
  approve: (id: number, sales_id: number) =>
    request<void>({ url: `/customers/${id}/audit`, method: 'POST', data: { approved: true, sales_id } }),
  reject: (id: number, reason = '审核未通过') =>
    request<void>({ url: `/customers/${id}/audit`, method: 'POST', data: { approved: false, reason } }),
  orderHistory: (customerId: number) =>
    request<Page<Order>>({
      url: '/orders',
      params: { customer_id: customerId, page: 1, page_size: 5 },
      showLoading: false,
    }),
}

// ---------- 订单 ----------
export interface CreateOrderItem {
  sku_id: number
  quantity: number
  unit_price?: number
  save_as_customer_price?: boolean
}

export interface CreateOrderPayload {
  customer_id: number
  source: 'route_call' | 'phone_in'
  delivery_mode: 'route' | 'freight' | 'local'
  items: CreateOrderItem[]
  remark?: string
  route_trip_id?: number
  freight_line_id?: number
  ship_date?: string
  freight_mode?: 'deduct' | 'store_paid' | 'customer_paid'
  freight_cost?: number
  merge_into_order_id?: number
  customer_coupon_id?: number
}

export interface AvailableCoupon {
  id: number
  coupon_code: string
  name: string
  coupon_type: string
  amount: string
  min_order_amount: string
  valid_from: string
  valid_to: string
  usable: boolean
  unusable_reason?: string | null
  deduct_amount: string
}

export const couponApi = {
  customerAvailable: (customerId: number, orderAmount = '0.00') =>
    request<{ items: AvailableCoupon[]; recommended_coupon_id: number | null }>({
      url: '/coupons/customer-available',
      params: { customer_id: customerId, order_amount: orderAmount },
      showLoading: false,
    }),
}

export const orderApi = {
  list: (q: PageQuery = {}) => request<Page<Order>>({ url: '/orders', params: q, showLoading: false }),
  get: (id: number) => request<Order>({ url: `/orders/${id}`, showLoading: false }),
  create: (payload: CreateOrderPayload) =>
    request<OrderResult>({ url: '/orders', method: 'POST', data: payload }),
  cancel: (id: number, reason: string) =>
    request<OrderResult>({ url: `/orders/${id}/cancel`, method: 'POST', data: { reason } }),
  /** 审批记录，时间正序（orders.md「审批记录」）。 */
  approvals: (id: number) =>
    request<OrderApproval[]>({ url: `/orders/${id}/approvals`, showLoading: false }),
  approve: (id: number, comment?: string) =>
    request<OrderResult>({ url: `/orders/${id}/approve`, method: 'POST', data: { comment } }),
  reject: (id: number, reason: string) =>
    request<OrderResult>({ url: `/orders/${id}/reject`, method: 'POST', data: { reason } }),
}

/** 跨订单待审批列表（orders.md §5、D29）：额度 / 欠款 / 等待时长都由后端给。 */
export const orderApprovalApi = {
  list: (q: PageQuery = {}) =>
    request<Page<OrderApprovalItem>>({
      url: '/order-approvals',
      params: q,
      showLoading: false,
    }),
}

/** 退货单：金额先 preview 再提交（06 §5，前端不算金额）。 */
export const returnApi = {
  preview: (payload: ReturnCreatePayload) =>
    request<ReturnPreview>({
      url: '/return-orders/preview',
      method: 'POST',
      data: payload,
      showLoading: false,
      idempotent: false,
    }),
  create: (payload: ReturnCreatePayload) =>
    request<ReturnResult>({ url: '/return-orders', method: 'POST', data: payload }),
  list: (q: PageQuery = {}) =>
    request<Page<ReturnOrderDetail>>({ url: '/return-orders', params: q, showLoading: false }),
  get: (id: number) =>
    request<ReturnOrderDetail>({ url: `/return-orders/${id}`, showLoading: false }),
  /** 确认：不传字段表示沿用销售提交时的明细与结算方式。 */
  confirm: (id: number, payload: Record<string, unknown> = {}) =>
    request<ReturnResult>({ url: `/return-orders/${id}/confirm`, method: 'POST', data: payload }),
  reject: (id: number, reason: string) =>
    request<ReturnResult>({
      url: `/return-orders/${id}/reject`,
      method: 'POST',
      data: { reason },
    }),
}

// ---------- 供应商与采购入库（purchases.md） ----------
export const vendorApi = {
  list: (params: {
    page?: number
    page_size?: number
    keyword?: string
    type?: string
    status?: string
  } = {}) => request<Page<Vendor>>({ url: '/vendors', params, showLoading: false }),
}

export const vendorFinanceApi = {
  payables: (params: {
    keyword?: string
    type?: string
    only_owed?: boolean
    order_by?: 'payable_desc' | 'payable_asc' | 'id'
    page?: number
    page_size?: number
  } = {}) =>
    request<VendorPayablePage>({ url: '/vendors/payables', params, showLoading: false }),

  account: (vendorId: number) =>
    request<VendorAccount>({ url: `/vendors/${vendorId}/account`, showLoading: false }),

  ledger: (
    vendorId: number,
    params: {
      date_from?: string
      date_to?: string
      page?: number
      page_size?: number
    } = {},
  ) =>
    request<Page<VendorLedgerItem>>({
      url: `/vendors/${vendorId}/ledger`,
      params,
      showLoading: false,
    }),

  pay: (payload: VendorPaymentPayload, opts: { idempotencyKey?: string } = {}) =>
    request<VendorPaymentResult>({
      url: '/vendor-payments',
      method: 'POST',
      data: payload,
      idempotencyKey: opts.idempotencyKey,
    }),
}

export const purchaseApi = {
  list: (params: {
    page?: number
    page_size?: number
    source_type?: PurchaseSourceType | ''
    status?: PurchaseStatus | ''
    vendor_id?: number
    spu_id?: number
    sku_id?: number
    date_from?: string
    date_to?: string
  } = {}) =>
    request<Page<PurchaseReceipt>>({
      url: '/purchase-receipts',
      params,
      showLoading: false,
    }),

  get: (id: number) =>
    request<PurchaseReceipt>({ url: `/purchase-receipts/${id}`, showLoading: false }),

  create: (payload: PurchaseCreatePayload) =>
    request<PurchaseReceipt>({ url: '/purchase-receipts', method: 'POST', data: payload }),

  update: (id: number, payload: PurchaseUpdatePayload) =>
    request<PurchaseResult>({
      url: `/purchase-receipts/${id}`,
      method: 'PUT',
      data: payload,
    }),

  confirm: (id: number, payload: PurchaseConfirmPayload) =>
    request<PurchaseResult>({
      url: `/purchase-receipts/${id}/confirm`,
      method: 'POST',
      data: payload,
    }),

  cancel: (id: number, version: number) =>
    request<PurchaseReceipt>({
      url: `/purchase-receipts/${id}/cancel`,
      method: 'POST',
      data: { version },
      idempotent: false,
    }),
}

export const purchasePlanApi = {
  preview: (payload: PurchasePlanPreviewPayload = {}) =>
    request<PurchasePlanPreviewResult>({
      url: '/purchase-plans/preview',
      method: 'POST',
      data: payload,
      showLoading: false,
      idempotent: false,
    }),

  toReceipts: (payload: PurchasePlanToReceiptsPayload) =>
    request<PurchasePlanToReceiptsResult>({
      url: '/purchase-plans/to-receipts',
      method: 'POST',
      data: payload,
    }),
}

// ---------- 财务与提额 ----------
export const financeApi = {
  commissions: (q: PageQuery = {}) =>
    request<PageResult<Commission>>({ url: '/finance/commissions', params: q, showLoading: false }),
  payments: (params: {
    customer_id?: number
    order_id?: number
    keyword?: string
    channel?: 'offline' | 'wx_miniprogram'
    method?: string
    kind?: string
    date_from?: string
    date_to?: string
    page?: number
    page_size?: number
  } = {}) =>
    request<Page<PaymentRecordItem>>({
      url: '/finance/payments',
      params,
      showLoading: false,
    }),
}

export const creditApi = {
  create: (customerId: number, requestedLimit: number, reason: string) =>
    request<unknown>({
      url: '/credit-applications',
      method: 'POST',
      data: { customer_id: customerId, requested_limit: requestedLimit, reason },
    }),
  /** 后端返回裸数组，不分页（credit_applications.py）。 */
  list: (status = 'pending') =>
    request<CreditApplication[]>({
      url: '/credit-applications',
      params: { status, page_size: 100 },
      showLoading: false,
    }),
  /** 审批意见必填（后端 comment_required）；approvedLimit 不传表示按申请额度批。 */
  approve: (id: number, approvedLimit: number | undefined, comment: string) =>
    request<unknown>({
      url: `/credit-applications/${id}/approve`,
      method: 'POST',
      data: { approved_limit: approvedLimit, comment },
    }),
  reject: (id: number, comment: string) =>
    request<unknown>({
      url: `/credit-applications/${id}/reject`,
      method: 'POST',
      data: { comment },
    }),
}

// ---------- 看板（仅管理员） ----------
export const dashboardApi = {
  overview: (refresh = false) =>
    request<DashboardOverview>({
      url: '/dashboard/overview',
      params: refresh ? { refresh: true } : undefined,
      showLoading: false,
    }),
}

// ---------- 出车 / 线路（delivery.md） ----------
export const deliveryApi = {
  listTrips: (params: {
    date_from?: string
    date_to?: string
    status?: string
    owner_id?: number
    keyword?: string
    order_by?: string
    page?: number
    page_size?: number
  } = {}) =>
    request<Page<RouteTrip>>({ url: '/route-trips', params, showLoading: false }),

  getTrip: (id: number) => request<RouteTrip>({ url: `/route-trips/${id}`, showLoading: false }),

  /** 出车草稿预览：返回将列入询单的客户数、自动加入 / 挪单的订单。 */
  draftTrip: (payload: RouteTripDraftIn) =>
    request<RouteTripDraft>({
      url: '/route-trips/draft',
      method: 'POST',
      data: payload,
      showLoading: false,
      idempotent: false,
    }),

  createTrip: (payload: RouteTripCreatePayload) =>
    request<RouteTripSaveResult>({ url: '/route-trips', method: 'POST', data: payload }),

  updateTrip: (id: number, payload: Partial<RouteTripCreatePayload>) =>
    request<RouteTripSaveResult>({ url: `/route-trips/${id}`, method: 'PUT', data: payload }),

  cancelTrip: (id: number) =>
    request<{ route_trip: RouteTrip; returned_orders: RouteTripOrder[]; warnings?: Warn[] }>({
      url: `/route-trips/${id}/cancel`,
      method: 'POST',
    }),

  tripOrders: (id: number) =>
    request<RouteTripOrder[]>({ url: `/route-trips/${id}/orders`, showLoading: false }),

  callList: (id: number) =>
    request<CallListCustomer[]>({ url: `/route-trips/${id}/call-list`, showLoading: false }),

  /** 标记询单结果；传 none 表示恢复未询。 */
  markCall: (id: number, customerId: number, callResult: CallResult, opts: { idempotencyKey?: string } = {}) =>
    request<CallListCustomer>({
      url: `/route-trips/${id}/calls/${customerId}`,
      method: 'PUT',
      data: { call_result: callResult },
      idempotencyKey: opts.idempotencyKey,
    }),

  departTrip: (id: number, opts: { idempotencyKey?: string } = {}) =>
    request<{ route_trip: RouteTrip }>({
      url: `/route-trips/${id}/depart`,
      method: 'POST',
      idempotencyKey: opts.idempotencyKey,
    }),

  finishTrip: (id: number, opts: { idempotencyKey?: string } = {}) =>
    request<{ route_trip: RouteTrip }>({
      url: `/route-trips/${id}/finish`,
      method: 'POST',
      idempotencyKey: opts.idempotencyKey,
    }),

  templates: (isActive?: boolean) =>
    request<RouteTemplate[]>({
      url: '/route-templates',
      params: isActive === undefined ? undefined : { is_active: isActive },
      showLoading: false,
    }),

  corridors: () =>
    request<CountyCorridorSummary[]>({ url: '/county-corridors', showLoading: false }),

  corridor: (countyRegionId: number) =>
    request<{
      county_region_id: number
      county_name: string
      customer_count: number
      towns: { region_id: number; region_name: string; parent_region_name?: string | null; seq: number; customer_count: number }[]
    }>({ url: `/county-corridors/${countyRegionId}`, showLoading: false }),
}

// ---------- 物流线路与批次（delivery.md §8 / §9） ----------
export const freightApi = {
  lines: (isActive?: boolean) =>
    request<FreightLine[]>({
      url: '/freight-lines',
      params: isActive === undefined ? undefined : { is_active: isActive },
      showLoading: false,
    }),

  list: (params: { date_from?: string; date_to?: string; line_id?: number; status?: string; page?: number; page_size?: number } = {}) =>
    request<Page<FreightShipment>>({ url: '/freight-shipments', params, showLoading: false }),

  get: (id: number) =>
    request<FreightShipmentDetail>({ url: `/freight-shipments/${id}`, showLoading: false }),

  /** 整车运费按订单金额占比分摊（服务端算，前端不自己分）。 */
  allocate: (id: number, totalFreight: number, orderIds?: number[]) =>
    request<{ order_id: number; freight_cost: Money }[]>({
      url: `/freight-shipments/${id}/allocate-freight`,
      method: 'POST',
      data: { total_freight: totalFreight, order_ids: orderIds },
      showLoading: false,
    }),

  handOver: (id: number, payload: FreightHandoverPayload, opts: { idempotencyKey?: string } = {}) =>
    request<FreightHandoverResult>({
      url: `/freight-shipments/${id}/hand-over`,
      method: 'POST',
      data: payload,
      idempotencyKey: opts.idempotencyKey,
    }),
}

// ---------- 行政区划 ----------
export const regionApi = {
  tree: () => request<RegionNode[]>({ url: '/regions/tree', showLoading: false }),
  list: (params: { parent_id?: number; level?: number; keyword?: string; limit?: number } = {}) =>
    request<RegionNode[]>({ url: '/regions', params, showLoading: false }),
  get: (id: number) => request<RegionNode>({ url: `/regions/${id}`, showLoading: false }),
}

// ---------- 订单送达 / 改挂 ----------
export const deliveryOrderApi = {
  deliver: (
    orderId: number,
    items: { order_item_id: number; delivered_quantity: number }[] | null,
    opts: { idempotencyKey?: string; cancelReason?: string } = {},
  ) =>
    request<OrderResult>({
      url: `/orders/${orderId}/deliver`,
      method: 'POST',
      data: { items, cancel_reason: opts.cancelReason },
      idempotencyKey: opts.idempotencyKey,
    }),

  createPriceAdjustment: (
    orderId: number,
    payload: { items: { order_item_id: number; new_unit_price: string }[]; reason?: string },
    opts: { idempotencyKey?: string } = {},
  ) =>
    request<{ adjustment: { id: number; status: string }; order: Order }>({
      url: `/orders/${orderId}/price-adjustments`,
      method: 'POST',
      data: payload,
      idempotencyKey: opts.idempotencyKey,
    }),

  reschedule: (
    orderId: number,
    payload: { target: 'trip' | 'pool' | 'freight'; trip_id?: number; reason?: string },
    opts: { idempotencyKey?: string } = {},
  ) =>
    request<OrderResult>({
      url: `/orders/${orderId}/reschedule`,
      method: 'POST',
      data: payload,
      idempotencyKey: opts.idempotencyKey,
    }),
}

// ---------- 消息 ----------
export const messageApi = {
  list: (q: PageQuery = {}) =>
    request<Message[]>({ url: '/messages', params: q, showLoading: false }),
  unreadCount: () =>
    request<{ count: number }>({ url: '/messages/unread-count', showLoading: false }),
  markRead: (id: number) =>
    request<void>({ url: `/messages/${id}/read`, method: 'POST', showLoading: false }),
  markAllRead: () =>
    request<void>({ url: '/messages/read-all', method: 'POST', showLoading: false }),
}

// ---------- 推广与拜访签到（customers.md §10） ----------
export const promotionApi = {
  stats: () => request<PromotionStats>({ url: '/promotion/stats', showLoading: false }),
  qrcode: (refresh = false, options: { silent?: boolean } = {}) =>
    request<PromotionQrcode>({
      url: '/promotion/qrcode',
      params: refresh ? { refresh: true } : undefined,
      showLoading: false,
      silent: options.silent,
    }),
  urlLink: () =>
    request<PromotionUrlLink>({
      url: '/promotion/url-link',
      method: 'POST',
      showLoading: false,
    }),
  visits: (params: { customer_id?: number; limit?: number } = {}) =>
    request<VisitRecord[]>({ url: '/promotion/visits', params, showLoading: false }),
  checkIn: (payload: {
    customer_id: number
    customer_name?: string
    location: string
    latitude?: number
    longitude?: number
    photos: string[]
    content: string
  }) => request<VisitRecord>({ url: '/promotion/check-in', method: 'POST', data: payload }),
}

// ---------- 业绩 ----------
export const salesApi = {
  /** 移动端首页两格数据：销售看自己（system.md「销售个人看板」）。 */
  myDashboard: () =>
    request<MyDashboard>({ url: '/sales/me/dashboard', showLoading: false }),
  performance: (start: string, end: string) =>
    request<SalesPerformance>({
      url: '/sales/me/performance',
      params: { period_start: start, period_end: end },
      showLoading: false,
    }),
  /** 管理员看全店汇总 + 各销售排行（system.md「业绩」）。 */
  ranking: (start: string, end: string) =>
    request<SalesRanking>({
      url: '/sales/ranking',
      params: { period_start: start, period_end: end },
      showLoading: false,
    }),
  /** 管理员点某销售看今日/本月/客户数/提成明细（仅管理员）。 */
  dashboard: (salesId: number) =>
    request<SalesDashboard>({
      url: `/sales/${salesId}/dashboard`,
      showLoading: false,
    }),
}
