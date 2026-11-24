// src/utils/dict.ts - 枚举中文名。取值以接口文档为准。
import type {
  CallResult,
  CommissionStatus,
  CustomerStatus,
  DeliveryMode,
  FreightMode,
  FreightShipmentStatus,
  OrderStatus,
  PayStatus,
  PriceSource,
  RouteTripStatus,
  TripOrderStatus,
} from '@/types'

export const ORDER_STATUS: Record<OrderStatus, { label: string; type: string }> = {
  pending_approval: { label: '待审批', type: 'warning' },
  pending: { label: '待配送', type: 'primary' },
  delivering: { label: '配送中', type: 'info' },
  delivered: { label: '已送达', type: 'success' },
  cancelled: { label: '已取消', type: 'grey' },
  rejected: { label: '已驳回', type: 'danger' },
}

export const PAY_STATUS: Record<PayStatus, { label: string; type: string }> = {
  unpaid: { label: '未收款', type: 'warning' },
  partial: { label: '部分收款', type: 'primary' },
  paid: { label: '已结清', type: 'success' },
}

export const PAYMENT_METHOD: Record<string, string> = {
  wechat: '微信',
  alipay: '支付宝',
  cash: '现金',
  other: '其他',
  credit: '账期挂账',
  bank: '对公转账',
  online: '在线支付',
}

export const CUSTOMER_STATUS: Record<CustomerStatus, { label: string; type: string }> = {
  pending: { label: '待审核', type: 'warning' },
  active: { label: '正常', type: 'success' },
  order_disabled: { label: '禁止下单', type: 'danger' },
  login_disabled: { label: '禁止登录', type: 'danger' },
}

export const DELIVERY_MODE: Record<DeliveryMode, string> = {
  route: '跟车送',
  freight: '物流',
  local: '城区自送',
}

export const FREIGHT_MODE: Record<FreightMode, string> = {
  deduct: '包邮·客户垫付抵扣',
  store_paid: '包邮·本店付',
  customer_paid: '不包邮·客户自付',
  none: '—',
}

/** 客户成交价查询的价格来源标签（pricing.md §7）。 */
export const PRICE_SOURCE: Record<PriceSource, { label: string; type: 'success' | 'primary' | 'info' | 'grey' }> = {
  customer_fixed: { label: '客户专属价', type: 'success' },
  level_sku: { label: '等级SKU价', type: 'primary' },
  level_default: { label: '等级默认价', type: 'info' },
  suggested: { label: '建议零售价', type: 'grey' },
}

export const NOTIFICATION_TYPE: Record<string, { label: string; icon: string; color: string }> = {
  order: { label: '订单', icon: '📦', color: '#2563eb' },
  audit: { label: '审核', icon: '✅', color: '#ea580c' },
  stock: { label: '库存', icon: '📦', color: '#16a34a' },
  credit: { label: '账期', icon: '💳', color: '#7c3aed' },
  system: { label: '系统', icon: '🔔', color: '#64748b' },
}

// ---------- 出车 ----------
export const TRIP_STATUS: Record<RouteTripStatus, { label: string; type: string }> = {
  planned: { label: '未出车', type: 'primary' },
  delivering: { label: '配送中', type: 'warning' },
  finished: { label: '已收车', type: 'grey' },
  cancelled: { label: '已取消', type: 'danger' },
}

export const CALL_RESULT: Record<CallResult, { label: string; type: string }> = {
  none: { label: '未询', type: 'grey' },
  ordered: { label: '已下单', type: 'success' },
  declined: { label: '本次不要', type: 'warning' },
  unreachable: { label: '未接通', type: 'danger' },
}

/** 提成三态（finance.md §9.1）；销售端文案区别于结算页。 */
export const COMMISSION_STATUS: Record<CommissionStatus, { label: string; type: string }> = {
  estimated: { label: '预估', type: 'grey' },
  pending: { label: '待结算', type: 'primary' },
  settled: { label: '已结算', type: 'success' },
}

export const TRIP_ORDER_STATUS: Record<TripOrderStatus, { label: string; type: string }> = {
  pending: { label: '待处理', type: 'primary' },
  delivering: { label: '待送达', type: 'primary' },
  delivered: { label: '已送达', type: 'success' },
  cancelled: { label: '已退回', type: 'grey' },
}

export const FREIGHT_SHIPMENT_STATUS: Record<FreightShipmentStatus, { label: string; type: string }> = {
  open: { label: '待交车', type: 'warning' },
  handed_over: { label: '已交车', type: 'success' },
  cancelled: { label: '已取消', type: 'grey' },
}

/** 交车时补填运费的方式说明；customer_paid 不用填。 */
export const FREIGHT_FEE_HINT: Record<FreightMode, string> = {
  deduct: '客户垫付，从货款扣',
  store_paid: '本店付运费',
  customer_paid: '运费到付',
  none: '—',
}
