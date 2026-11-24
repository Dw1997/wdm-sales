// src/types/index.ts - 与后端接口契约对齐的领域类型。
// 金额字段后端按两位小数的字符串下发（接口规范 §7），统一用 Money 表示。

export type Money = string | number

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface Warn {
  code: string
  message?: string
  [k: string]: unknown
}

// ---------- 身份 ----------
export type Role = 'admin' | 'sales' | 'customer' | 'vendor'

export interface UserInfo {
  id: number
  username: string
  real_name?: string | null
  phone?: string | null
  invite_code?: string | null
  role: Role
  role_name: string
  platform: string
  platforms: string[]
  permissions: string[]
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  role: Role
  platform: string
  user_id: number
}

// ---------- 商品 ----------
export interface Category {
  id: number
  name: string
  parent_id: number | null
  level: number
  sort_order: number
  icon?: string | null
  description?: string | null
  is_active: boolean
  children?: Category[]
}

export interface Spu {
  id: number
  code: string
  name: string
  category_id?: number | null
  brand?: string | null
  shelf_life_days?: number | null
  description?: string | null
  main_images: string[]
  detail_images: string[]
  status: number
  supplier_id: number
  is_miniprogram: boolean
  base_unit: string
  sku_count: number
  miniprogram_sku_count: number
}

export interface CatalogCategoryNode {
  id: number
  name: string
  icon_url?: string | null
  children: CatalogCategoryNode[]
}

export interface CatalogCategoriesResponse {
  has_frequent: boolean
  items: CatalogCategoryNode[]
}

export interface CatalogProductCard {
  spu_id: number
  code: string
  name: string
  image_url?: string | null
  base_unit: string
  price?: Money | null
  sku_count: number
  default_sku_id: number
  default_sku_unit: string
  default_sku_spec: string
  default_sku_allow_decimal: boolean
  default_sku_base_qty: Money
  default_sku_price?: Money | null
  default_sku_min_price?: Money | null
  is_frequent: boolean
}

export interface CatalogProductListResponse {
  items: CatalogProductCard[]
  total: number
  page: number
  page_size: number
}

export interface Sku {
  id: number
  spu_id: number
  barcode?: string | null
  specs: Record<string, string>
  remark?: string | null
  base_qty: Money
  allow_decimal: boolean
  is_enabled: boolean
  is_miniprogram: boolean
  suggested_price?: Money | null
  min_price?: Money | null
  spu_name?: string | null
  base_unit?: string | null
  category_id?: number | null
  category_path?: string | null
}

export interface QuoteItem {
  sku_id: number
  spu_name: string
  sku_spec: string
  unit: string
  base_qty: Money
  allow_decimal: boolean
  unit_price: Money
  price_source?: string | null
  min_price?: Money | null
  below_min?: boolean | null
  quantity?: Money | null
  amount?: Money | null
  is_enabled: boolean
  stock_on_hand?: Money | null
  stock_available?: Money | null
}

export interface QuoteResponse {
  customer_id: number
  customer_name: string
  level_id?: number | null
  level_name?: string | null
  items: QuoteItem[]
}

/** 价格查询内部四值来源（pricing.md §7）。 */
export type PriceSource = 'customer_fixed' | 'level_sku' | 'level_default' | 'suggested'

/** 客户成交价查询行（GET /prices/customer-prices，pricing.md §7）。 */
export interface CustomerPriceRow {
  sku_id: number
  spu_id: number
  spu_name: string
  spu_code: string
  sku_spec: string
  unit: string
  base_qty: Money
  base_unit: string
  allow_decimal: boolean
  is_enabled: boolean
  unit_price: Money
  price_source: PriceSource
  price_source_set_at?: string | null
  suggested_price: Money
  level_price: Money
  min_price: Money
  /** 仅管理员返回，销售为 null。 */
  cost_price?: Money | null
  below_min: boolean
}

export interface CustomerPriceQuery {
  customer_id: number
  spu_id?: number
  sku_id?: number
  keyword?: string
  page?: number
  page_size?: number
}

// ---------- 客户 ----------
export type CustomerStatus = 'pending' | 'active' | 'order_disabled' | 'login_disabled'
export type DeliveryMode = 'route' | 'freight' | 'local'
export type FreightMode = 'deduct' | 'store_paid' | 'customer_paid' | 'none'

export interface CustomerTag {
  id: number
  name: string
  sort_order: number
  is_active: boolean
}

export interface Customer {
  id: number
  name: string
  tag_id?: number | null
  tag_name?: string | null
  is_system?: boolean
  default_delivery_mode: DeliveryMode
  delivery_region_id?: number | null
  freight_line_id?: number | null
  default_freight_mode: Exclude<FreightMode, 'none'>
  credit_limit?: Money | null
  effective_credit_limit: Money
  credit_source: string
  level_default_credit_limit?: Money | null
  payment_term_type: string
  term_days?: number | null
  monthly_due_day?: number | null
  credit_note?: string | null
  created_by?: number | null
  created_by_name?: string | null
  reject_reason?: string | null
  audited_at?: string | null
  contact_name?: string | null
  contact_phone?: string | null
  phone?: string | null
  wechat_bound: boolean
  wechat_bound_at?: string | null
  level_id?: number | null
  level_code?: string | null
  level_nickname?: string | null
  status: CustomerStatus
  sales_id?: number | null
  sales_name?: string | null
  sales_is_admin?: boolean
  invite_code?: string | null
  referrer_customer_id?: number | null
  referrer_customer_name?: string | null
  referred_at?: string | null
  address?: string | null
  province?: string | null
  city?: string | null
  district?: string | null
  town?: string | null
  detail_address?: string | null
  /** 当前欠款（往来账余额，customers.md 决策 8） */
  ar_balance?: Money
  created_at?: string | null
  updated_at?: string | null
}

export interface CustomerResult {
  customer: Customer
  warnings: Warn[]
}

export interface CustomerAccount {
  customer_id: number
  ar_balance: Money
  overdue_amount: Money
  max_overdue_days: number
  effective_credit: Money
}

export interface SalesOption {
  id: number
  name: string
  is_admin: boolean
  is_owner: boolean
}

// ---------- 订单 ----------
export type OrderStatus =
  | 'pending_approval'
  | 'pending'
  | 'delivering'
  | 'delivered'
  | 'cancelled'
  | 'rejected'

export type PayStatus = 'unpaid' | 'partial' | 'paid'
export type OrderSource = 'route_call' | 'phone_in' | 'miniprogram' | 'counter'
export type ReturnStatus = 'none' | 'partial' | 'full'
export type PaymentMethod = 'wechat' | 'alipay' | 'cash' | 'other' | 'credit' | 'bank' | 'online'

export interface OrderItem {
  id: number
  sku_id: number
  spu_name: string
  sku_spec: string
  unit: string
  base_qty: Money
  unit_price: Money
  original_unit_price?: Money | null
  price_source: string
  min_price: Money
  quantity: Money
  delivered_quantity?: Money | null
  returned_quantity: Money
  restocked_quantity: Money
  amount: Money
  supplier_id?: number | null
  supplier_name?: string | null
  cost_status?: string | null
  /** 仅管理员返回：下单时的行提成比例快照 */
  commission_rate?: string | null
  /** 仅管理员返回：该 SKU 提成金额 */
  commission_amount?: Money | null
}

export interface OrderPayment {
  payment_id: number
  method: string
  channel?: 'offline' | 'wx_miniprogram' | string
  wx_transaction_id?: string | null
  amount: Money
  received_amount?: Money | null
  change_amount?: Money | null
  rounding_amount: Money
  paid_at: string
  operator_name?: string | null
}

export interface PaymentRecordAllocation {
  order_id: number
  order_no: string
  amount: Money
}

export interface PaymentRecordItem {
  id: number
  customer_id: number
  customer_name: string
  amount: Money
  rounding_amount: Money
  kind: 'receipt' | 'refund' | string
  method: 'wechat' | 'alipay' | 'cash' | 'other' | string
  channel: 'offline' | 'wx_miniprogram' | string
  wx_transaction_id?: string | null
  out_trade_no?: string | null
  paid_at: string
  operator_name?: string | null
  remark?: string | null
  allocations: PaymentRecordAllocation[]
}

export interface Order {
  id: number
  order_no: string
  customer_id: number
  customer_name: string
  is_walk_in: boolean
  customer_phone?: string | null
  sales_id?: number | null
  sales_name?: string | null
  source: OrderSource
  delivery_mode: DeliveryMode
  status: OrderStatus
  pay_status: PayStatus
  return_status: ReturnStatus
  total_amount: Money
  delivered_amount?: Money | null
  pending_price_adjustment?: {
    id: number
    reason?: string | null
    applicant_name?: string | null
    created_at: string
    items_count: number
    total_diff_amount: Money
  } | null
  paid_amount: Money
  discount_amount: Money
  customer_coupon_id?: number | null
  coupon_name?: string | null
  coupon_type?: string | null
  coupon_amount?: Money
  returned_amount: Money
  return_settled_amount: Money
  return_freight_cost: Money
  unpaid_amount: Money
  freight_mode: FreightMode
  freight_cost?: Money | null
  route_trip_id?: number | null
  freight_shipment_id?: number | null
  freight_line_id?: number | null
  freight_town_region_id?: number | null
  handed_over_at?: string | null
  pool_deadline?: string | null
  due_date?: string | null
  over_credit: boolean
  approval_stage?: string | null
  /** 自动挪单记录，只读展示（06 §3） */
  dispatch_note?: string | null
  reject_reason?: string | null
  created_by_type: string
  created_by_id?: number | null
  created_by_name?: string | null
  created_by_role?: string | null
  created_at: string
  delivered_at?: string | null
  remark?: string | null
  /** 订单总提成（销售与管理员均返回；无提成时为 null） */
  commission_amount?: Money | null
  print_count: number
  last_printed_at?: string | null
  version: number
  items: OrderItem[]
  payments: OrderPayment[]
  goods_cost?: Money | null
  profit?: Money | null
}

export interface OrderResult {
  order: Order
  warnings: Warn[]
}

// ---------- 消息 ----------
export interface Message {
  id: number
  type: string
  title: string
  content: string
  level: string
  read: boolean
  created_at: string
  link?: string | null
}

// ---------- 看板（仅管理员） ----------
export interface DashboardToday {
  sales_order_count: number
  sales_amount: Money
  pending_order_count: number
  pending_amount: Money
  trip_count: number
  trip_order_count: number
  trip_delivered_count: number
  freight_order_count: number
  freight_pending_count: number
  payment_amount: Money
  /** D29：今天送达订单的 Order.profit 之和，只到订单毛利，不减经营成本 */
  gross_profit: Money
}

export type TodoCode =
  | 'pool_orders'
  | 'pending_customers'
  | 'pending_returns'
  | 'credit_applications'
  | 'negative_stock'
  | 'no_upcoming_trip'

export interface DashboardTodo {
  code: TodoCode
  count: number
  data?: Record<string, unknown> | null
}

export interface DashboardOverview {
  generated_at: string
  today: DashboardToday
  todos: DashboardTodo[]
  money: {
    ar_total: Money
    ar_customer_count: number
    ar_overdue_total: Money
    ar_overdue_buckets: { key: string; amount: Money }[]
    ap_overdue_total: Money
    month_profit: {
      month: string
      sales_amount: Money
      goods_cost: Money
      freight_cost: Money
      operating_cost: Money
      profit: Money
    }
  }
}

// ---------- 销售个人看板（移动端首页，system.md「销售个人看板」） ----------
export interface MyDashboard {
  sales_id: number
  sales_name: string
  customer_count: number
  as_of_date: string
  today: { sales_amount: Money; order_count: number }
  month: {
    sales_amount: Money
    order_count: number
    daily_sales: { date: string; sales_amount: Money }[]
  }
}

// ---------- 线路趟次（delivery.md §1.3） ----------
export type RouteTripStatus = 'planned' | 'delivering' | 'finished' | 'cancelled'

export interface RouteStop {
  region_id: number
  region_name: string
  parent_region_name?: string | null
  seq: number
  origin: string
  customer_count: number
}

export interface RouteTrip {
  id: number
  trip_date: string
  name: string | null
  owner_id: number
  owner_name: string
  template_id: number | null
  auto_generated: boolean
  status: RouteTripStatus
  departed_at: string | null
  finished_at: string | null
  stops: RouteStop[]
  stops_text: string
  customer_count: number
  called_count: number
  order_count: number
  order_amount: Money
  delivered_count: number
  created_at: string
}

// ---------- 出车单张订单（GET /route-trips/{id}/orders） ----------
export type TripOrderStatus = 'pending' | 'delivering' | 'delivered' | 'cancelled'

export interface RouteTripOrder {
  order_id: number
  order_no: string
  customer_id: number
  customer_name: string
  customer_phone?: string | null
  region_id: number
  region_name: string
  stop_seq: number
  sort_no: number
  total_amount: Money
  delivered_amount?: Money | null
  status: TripOrderStatus
  auto_joined: boolean
  auto_moved: boolean
  dispatch_note?: string | null
  sales_id?: number | null
  sales_name?: string | null
}

// ---------- 询单清单（delivery.md §5） ----------
export type CallResult = 'none' | 'ordered' | 'declined' | 'unreachable'

export interface OtherTripOrder {
  order_id: number
  trip_id: number
  trip_date: string
}

export interface CallListCustomer {
  customer_id: number
  customer_name: string
  customer_phone?: string | null
  region_id: number
  region_name: string
  stop_seq: number
  sales_id?: number | null
  sales_name?: string | null
  last_order_date?: string | null
  ar_balance: Money
  call_result: CallResult
  trip_order_ids: number[]
  other_trip_order?: OtherTripOrder | null
}

// ---------- 出车草稿 / 安排出车（delivery.md §3） ----------
export type RouteStopOrigin = 'manual' | 'template' | 'auto'

export interface RouteStopIn {
  region_id: number
  origin?: RouteStopOrigin
}

export interface RouteTripDraftIn {
  trip_date: string
  county_region_ids?: number[]
  template_id?: number | null
  stops?: RouteStopIn[]
  trip_id?: number | null
  exclude_order_ids?: number[]
}

export interface RouteTripDraftOrder {
  order_id: number
  order_no: string
  customer_id: number
  customer_name: string
  region_name: string
  total_amount: Money
  pool_deadline: string
  excluded: boolean
}

export interface RouteTripMoveOrder {
  order_id: number
  order_no: string
  customer_id: number
  customer_name: string
  from_trip_id: number
  from_trip_date: string
  to_trip_id: number
  to_trip_date: string
  total_amount: Money
}

export interface RouteTripDraft {
  stops: RouteStop[]
  customer_count: number
  join_orders: RouteTripDraftOrder[]
  join_order_count: number
  move_orders: RouteTripMoveOrder[]
  move_order_count: number
  return_orders: RouteTripDraftOrder[]
  warnings: Warn[]
}

export interface RouteTripCreatePayload {
  trip_date: string
  name?: string
  owner_id: number
  template_id?: number | null
  stops: RouteStopIn[]
  exclude_order_ids?: number[]
}

export interface RouteTripSaveResult {
  route_trip: RouteTrip
  joined_orders: RouteTripOrder[]
  returned_orders: RouteTripOrder[]
  moved_orders: RouteTripOrder[]
  warnings: Warn[]
}

// ---------- 常用路线（delivery.md §4） ----------
export type TemplateScheduleType = 'none' | 'weekly' | 'monthly'

export interface RouteTemplate {
  id: number
  name: string
  remark?: string | null
  is_active: boolean
  stops: {
    region_id: number
    region_name: string
    parent_region_name?: string | null
    seq: number
    origin: RouteStopOrigin
  }[]
  stops_text: string
  schedule_type: TemplateScheduleType
  schedule_weekdays: number[]
  schedule_month_days: number[]
  default_owner_id?: number | null
  default_owner_name?: string | null
  next_trip_date?: string | null
}

// ---------- 县城沿线（delivery.md §4.3） ----------
export interface CountyCorridorSummary {
  county_region_id: number
  county_name: string
  town_count: number
  customer_count: number
}

// ---------- 行政区划 ----------
export interface RegionNode {
  id: number
  name: string
  parent_id: number | null
  level: number
  sort_order: number
  customer_count: number
  full_name?: string | null
  has_children?: boolean
  children?: RegionNode[]
}

export interface RegionSelection {
  id: number
  level: number
  name: string
  full_name: string
  province: string
  city: string
  district: string
  town: string
}

// ---------- 物流线路（delivery.md §1.5） ----------
export interface FreightLineSchedule {
  depart_time: string
  label?: string | null
}

export interface FreightLineStop {
  id: number
  town_region_id: number
  town_name: string
  level?: number
  seq: number
  customer_count?: number
}

export interface FreightLine {
  id: number
  name: string
  plate_no?: string | null
  driver_name?: string | null
  driver_phone?: string | null
  schedules: FreightLineSchedule[]
  cutoff_minutes: number
  is_active: boolean
  stops: FreightLineStop[]
  customer_count?: number
}

// ---------- 物流批次（delivery.md §9） ----------
export type FreightShipmentStatus = 'open' | 'handed_over' | 'cancelled'

export interface FreightShipment {
  id: number
  line_id: number
  line_name: string
  plate_no?: string | null
  driver_name?: string | null
  driver_phone?: string | null
  ship_date: string
  depart_time: string
  schedule_label?: string | null
  cutoff_at: string
  status: FreightShipmentStatus
  customer_count: number
  order_count: number
  order_amount: Money
  handed_over_count: number
  freight_fee: Money
  handed_over_at?: string | null
}

export interface FreightShipmentOrder {
  order_id: number
  order_no: string
  customer_id: number
  customer_name: string
  customer_phone?: string | null
  town_region_id: number
  town_name: string
  stop_seq?: number | null
  stop_removed: boolean
  customer_address?: string | null
  total_amount: Money
  freight_mode: FreightMode
  freight_cost?: Money | null
  status: 'pending' | 'delivered' | 'cancelled'
  handed_over_at?: string | null
  handed_over_by?: number | null
  handed_over_by_name?: string | null
  sales_id?: number | null
  sales_name?: string | null
}

export interface FreightShipmentDetail extends FreightShipment {
  orders: FreightShipmentOrder[]
}

export interface FreightHandoverPayload {
  orders?: { order_id: number; freight_cost?: number }[]
  total_freight?: number
}

export interface FreightHandoverResult {
  orders: FreightShipmentOrder[]
  shipment: FreightShipment
  warnings: Warn[]
}

// ---------- 以下为尚未接入后端的旧域类型（推广 / 业绩 / 拜访） ----------
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

/** 业绩页「我的业绩」（system.md「业绩」）。金额是后端两位小数字符串。 */
export interface SalesPerformance {
  sales_id: number
  sales_name: string
  period_start: string
  period_end: string
  order_count: number
  gmv: Money
  new_customers: number
  estimated_commission: Money
  /** 还没抵扣完的退货冲销，跨月累计；销售端提示「下次发工资扣 ¥X」。 */
  clawback_amount: Money
  recent_commissions: RecentCommission[]
}

/** 提成状态：预估（未达结算条件）/ 待结算（送达且付清）/ 已结算。 */
export type CommissionStatus = 'estimated' | 'pending' | 'settled'

/** 业绩页「最近提成」一行。 */
export interface RecentCommission {
  order_id: number
  order_no: string
  customer_name: string
  order_date: string
  order_amount: Money
  commission_amount: Money
  status: CommissionStatus
  clawback_amount: Money
}

/** 排行榜一行；金额是两位小数字符串。 */
export interface SalesRankingItem {
  ranking: number
  sales_id: number
  sales_name: string
  order_count: number
  gmv: Money
  new_customers: number
  estimated_commission: Money
}

/** 排行榜响应：全店汇总 + 各销售排行。 */
export interface SalesRanking {
  total: {
    order_count: number
    gmv: Money
    new_customers: number
    estimated_commission: Money
  }
  items: SalesRankingItem[]
}

/** 管理员提成明细行（/finance/commissions，Web 提成页用；移动端保留门面）。 */
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

/** 管理员点某销售进的二级页数据（GET /sales/{id}/dashboard）。 */
export interface SalesDashboard {
  sales_id: number
  sales_name: string
  is_active: boolean
  customer_count: number
  as_of_date: string
  today: { sales_amount: Money; order_count: number }
  month: {
    sales_amount: Money
    order_count: number
    daily_sales: { date: string; sales_amount: Money }[]
  }
  commissions: {
    estimated_amount: Money
    pending_amount: Money
    settled_amount: Money
    clawback_amount: Money
  }
}

export interface PromotionStats {
  invite_code: string
  invite_url: string
  qrcode_url?: string
  total_visits: number
  total_registered: number
  pending_approvals: number
  approved: number
  rejected: number
}

export interface PromotionQrcode {
  invite_code: string
  scene: string
  invite_url: string
  qrcode_url: string
  unavailable_reason?: string | null
}

export interface PromotionUrlLink {
  account_id?: number | null
  account_name: string
  invite_code: string
  url_link: string
  expire_days: number
  unavailable_reason?: string | null
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

export interface PageQuery {
  page?: number
  page_size?: number
  keyword?: string
  [k: string]: unknown
}

/** @deprecated 旧分页类型，仅未迁移页面使用；新接口用 Page<T>。 */
export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

// ---------- 常购商品（orders.md §8） ----------
export interface FrequentSku {
  sku_id: number
  spu_name: string
  sku_spec: string
  unit: string
  order_count: number
  last_ordered_at: string
  last_quantity: Money
  /** 上次成交价（订单行售价快照），不是当前报价 */
  last_unit_price?: Money | null
}

// ---------- 客户专属价（customer_sku_prices） ----------
export interface CustomerSkuPrice {
  id: number
  customer_id: number
  customer_name: string
  sku_id: number
  spu_id: number
  spu_name: string
  sku_specs: Record<string, string>
  sku_remark?: string | null
  price: Money
  min_price?: Money | null
  below_min: boolean
  updated_by_name?: string | null
  created_at: string
  updated_at: string
}

export interface CustomerSkuPricePreview {
  customer_id: number
  sku_id: number
  suggested_price: Money
  level_price: Money
  final_price: Money
  price_source: 'customer_fixed' | 'level_sku' | 'level_default' | 'suggested'
  customer_sku_price_id?: number | null
}

// ---------- 退货单（return_orders） ----------
export type ReturnDisposition = 'restock' | 'write_off'
export type ReturnFreightMode = 'none' | 'deduct' | 'store_paid' | 'customer_paid'
export type RefundMethod = 'credit' | 'wechat' | 'alipay' | 'cash'

export interface ReturnItemIn {
  order_item_id: number
  quantity: number
  disposition: ReturnDisposition
}

export interface ReturnCreatePayload {
  order_id: number
  reason: string
  items: ReturnItemIn[]
  return_freight_mode: ReturnFreightMode
  freight_cost?: number
  refund_method?: RefundMethod
}

export interface ReturnItemOut {
  order_item_id: number
  sku_id?: number | null
  spu_name: string
  sku_spec: string
  unit: string
  quantity: Money
  disposition: ReturnDisposition
  unit_price: Money
  amount: Money
}

export interface ReturnPreview {
  items: ReturnItemOut[]
  goods_amount: Money
  freight_compensation_amount: Money
  total_credit_amount: Money
  original_unpaid_amount: Money
  original_offset_amount: Money
  refundable_amount: Money
  refund_method: RefundMethod
}

export interface ReturnOrderSummary {
  id: number
  return_no: string
  order_id: number
  order_no: string
  customer_id: number
  customer_name: string
  status: 'pending' | 'confirmed' | 'rejected'
  reason: string
  refund_method: RefundMethod
  goods_amount: Money
  refund_amount: Money
  credit_amount: Money
  created_at: string
}

export interface ReturnResult {
  return_order: ReturnOrderSummary
  order: Order
  warnings: { code: string; message: string }[]
}

/** 退货单详情（return_service.to_out），比列表多明细、结算与确认信息。 */
export interface ReturnOrderDetail extends ReturnOrderSummary {
  return_freight_mode: ReturnFreightMode
  freight_cost?: Money | null
  freight_compensation_amount: Money
  total_credit_amount: Money
  original_offset_amount: Money
  settled_amount: Money
  available_credit_amount: Money
  settlement_status: string
  items: ReturnItemOut[]
  created_by_id?: number | null
  created_by_name?: string | null
  created_by_role: string
  confirmed_at?: string | null
  confirmed_by_name?: string | null
  reject_reason?: string | null
}

// ---------- 订单审批（orders.md §订单审批） ----------
export interface OrderApproval {
  id: number
  order_id: number
  stage: 'sales' | 'admin'
  action: 'submit' | 'approve' | 'reject' | 'auto_pass' | 'customer_cancel'
  operator_id?: number | null
  operator_name?: string | null
  order_amount: Money
  occupied_credit?: Money | null
  effective_credit?: Money | null
  comment?: string | null
  created_at: string
}

/** `GET /order-approvals` 的 scope=pending 列表项（orders.md §5、D29）。 */
export interface OrderApprovalPreviousStep {
  operator_name: string | null
  created_at: string
  comment: string | null
}

export interface OrderApprovalItem {
  order: Order
  stage: 'sales' | 'admin'
  amount_before: Money | null
  ar_balance: Money
  effective_credit: Money | null
  occupied_credit: Money | null
  overdue_amount: Money
  submitted_at: string
  /** 后端算好的已等待小时数，≥ 24 标红 */
  waiting_hours: number
  previous_step: OrderApprovalPreviousStep | null
}

// ---------- 调额申请（customers.md §授信、credit.py） ----------
export interface CreditApplication {
  id: number
  customer_id: number
  customer_name?: string | null
  sales_id: number
  sales_name?: string | null
  current_limit: Money
  requested_limit: Money
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  approved_limit?: Money | null
  reviewer_id?: number | null
  reviewer_name?: string | null
  reviewed_at?: string | null
  review_comment?: string | null
  created_at?: string | null
}
