// src/utils/dict.ts - Enum label helpers.
import type { OrderStatus, PaymentMethod, CustomerStatus, CustomerLevel, ProductStatus } from '@/types'

export const ORDER_STATUS: Record<OrderStatus, { label: string; type: string }> = {
  pending_audit: { label: '待审核', type: 'warning' },
  rejected: { label: '已驳回', type: 'danger' },
  paid: { label: '待分拣', type: 'primary' },
  picking: { label: '分拣中', type: 'primary' },
  shipped: { label: '已发货', type: 'info' },
  completed: { label: '已完成', type: 'success' },
  cancelled: { label: '已取消', type: 'grey' },
}

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  online: '在线支付',
  credit: '账期挂账',
  wechat: '微信',
  alipay: '支付宝',
  cash: '现金',
  bank: '对公转账',
}

export const CUSTOMER_STATUS: Record<CustomerStatus, { label: string; type: string }> = {
  pending: { label: '待审核', type: 'warning' },
  active: { label: '正常', type: 'success' },
  disabled: { label: '已禁用', type: 'danger' },
}

export const CUSTOMER_LEVEL: Record<CustomerLevel, { label: string; color: string }> = {
  bronze: { label: '青铜', color: '#9ca3af' },
  silver: { label: '白银', color: '#6b7280' },
  gold: { label: '黄金', color: '#ea580c' },
  vip: { label: 'VIP', color: '#dc2626' },
}

export const PRODUCT_STATUS: Record<ProductStatus, { label: string; type: string }> = {
  on_sale: { label: '在售', type: 'success' },
  off_shelf: { label: '下架', type: 'grey' },
  draft: { label: '草稿', type: 'warning' },
}

export const NOTIFICATION_TYPE: Record<string, { label: string; icon: string; color: string }> = {
  order: { label: '订单', icon: '📦', color: '#2563eb' },
  audit: { label: '审核', icon: '✅', color: '#ea580c' },
  stock: { label: '库存', icon: '📦', color: '#16a34a' },
  credit: { label: '账期', icon: '💳', color: '#7c3aed' },
  system: { label: '系统', icon: '🔔', color: '#64748b' },
}

export const FOLLOW_UP_TYPE: Record<string, { label: string; icon: string; color: string }> = {
  visit: { label: '上门拜访', icon: '🚶', color: '#2563eb' },
  phone: { label: '电话沟通', icon: '📞', color: '#16a34a' },
  wechat: { label: '微信沟通', icon: '💬', color: '#10b981' },
  note: { label: '备注', icon: '📝', color: '#6b7280' },
}
