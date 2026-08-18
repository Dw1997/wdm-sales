<template>
  <view class="order-detail-page">
    <scroll-view scroll-y="true" class="content">
      <view v-if="order" class="status-card">
        <view class="status-icon">{{ statusIcon }}</view>
        <view class="status-info">
          <text class="status-label">{{ statusLabel }}</text>
          <text class="status-desc">{{ statusDesc }}</text>
        </view>
      </view>

      <view v-if="order" class="customer-card">
        <view class="cust-row">
          <text class="shop-name">{{ order.customer_name }}</text>
          <text class="phone-btn" @tap="callCustomer">📞 联系客户</text>
        </view>
        <view class="addr-row" v-if="order.delivery_address">
          <text class="addr-icon">📍</text>
          <text class="addr-text">{{ order.delivery_address }}</text>
        </view>
      </view>

      <view v-if="order" class="items-card">
        <view class="card-title">商品明细</view>
        <view v-for="(it, i) in order.items" :key="i" class="item-row">
          <view class="item-info">
            <text class="item-name">{{ it.product_name }}</text>
            <text class="item-spec">{{ it.unit }} × {{ it.quantity }}</text>
          </view>
          <view class="item-price">
            <text class="unit-price">¥{{ it.unit_price.toFixed(2) }}</text>
            <text class="subtotal">¥{{ it.subtotal.toFixed(2) }}</text>
          </view>
        </view>
        <view class="total-row">
          <text class="total-label">合计</text>
          <text class="total">¥{{ formatQty(order.total_amount) }}</text>
        </view>
        <view class="pay-row">
          <text class="pay-label">支付方式</text>
          <text class="pay-value">{{ paymentLabel }}</text>
        </view>
      </view>

      <view v-if="order" class="info-card">
        <view class="info-row">
          <text class="info-label">订单号</text>
          <text class="info-value" selectable>{{ order.id }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">下单时间</text>
          <text class="info-value">{{ formatDate(order.created_at) }}</text>
        </view>
        <view v-if="order.audited_at" class="info-row">
          <text class="info-label">审核时间</text>
          <text class="info-value">{{ formatDate(order.audited_at) }}</text>
        </view>
        <view v-if="order.shipped_at" class="info-row">
          <text class="info-label">发货时间</text>
          <text class="info-value">{{ formatDate(order.shipped_at) }}</text>
        </view>
        <view v-if="order.remark" class="info-row">
          <text class="info-label">备注</text>
          <text class="info-value">{{ order.remark }}</text>
        </view>
        <view v-if="order.rejection_reason" class="info-row">
          <text class="info-label">驳回原因</text>
          <text class="info-value text-danger">{{ order.rejection_reason }}</text>
        </view>
      </view>
    </scroll-view>

    <view v-if="order" class="bottom-bar">
      <button class="btn-outline repurchase-btn" @tap="onRepurchase">再来一单</button>
      <button class="btn-primary follow-btn">查看物流</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { orderApi, customerApi } from '@/api'
import { useCartStore } from '@/stores/cart'
import { ORDER_STATUS, PAYMENT_METHOD } from '@/utils/dict'
import { formatQty, formatDate } from '@/utils/format'
import type { Order, Customer } from '@/types'

const order = ref<Order | null>(null)
const cart = useCartStore()

const statusLabel = computed(() => order.value ? ORDER_STATUS[order.value.status].label : '')
const statusIcon = computed(() => {
  if (!order.value) return ''
  const map: Record<string, string> = {
    pending_audit: '⏰',
    rejected: '❌',
    paid: '📦',
    picking: '📋',
    shipped: '🚚',
    completed: '✅',
    cancelled: '🚫',
  }
  return map[order.value.status] || ''
})
const statusDesc = computed(() => {
  if (!order.value) return ''
  const map: Record<string, string> = {
    pending_audit: '订单已提交，等待销售审核',
    rejected: '订单已被驳回',
    paid: '已确认，等待分拣',
    picking: '正在分拣中',
    shipped: '商品已发货',
    completed: '订单已完成',
    cancelled: '订单已取消',
  }
  return map[order.value.status] || ''
})
const paymentLabel = computed(() => order.value ? PAYMENT_METHOD[order.value.payment_method] : '')

async function load(id: string) {
  order.value = await orderApi.get(id)
}

function callCustomer() {
  if (order.value) {
    customerApi.get(order.value.customer_id).then((c) => {
      if (c) uni.makePhoneCall({ phoneNumber: c.phone })
    })
  }
}

async function onRepurchase() {
  if (!order.value) return
  uni.showLoading({ title: '加载中' })
  try {
    const data = await orderApi.repurchase(order.value.id)
    const customer = await customerApi.get(data.customer_id)
    if (customer) {
      cart.clear()
      cart.setCustomer(customer.id, customer.shop_name || customer.name)
      // Add items to cart
      for (const it of data.items) {
        const p = await import('@/api').then(m => m.productApi.get(it.product_id))
        if (p) await cart.addItem(p, it.unit, it.quantity)
      }
      uni.navigateTo({ url: '/pages/order/cart' })
    }
  } finally {
    uni.hideLoading()
  }
}

onLoad((opts: any) => {
  if (opts?.id) load(opts.id)
})
</script>

<style lang="scss" scoped>
.order-detail-page {
  min-height: 100vh;
  background: #f5f5f7;
  padding-bottom: 120rpx;
}
.content {
  height: calc(100vh - 120rpx);
}
.status-card {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  margin: 16rpx;
  border-radius: 16rpx;
  padding: 32rpx;
  display: flex;
  align-items: center;
  gap: 24rpx;
  color: #fff;
}
.status-icon {
  font-size: 64rpx;
}
.status-info {
  flex: 1;
}
.status-label {
  display: block;
  font-size: 36rpx;
  font-weight: 600;
  margin-bottom: 4rpx;
}
.status-desc {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
}
.customer-card, .items-card, .info-card {
  background: #fff;
  margin: 16rpx;
  border-radius: 16rpx;
  padding: 24rpx;
}
.cust-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}
.shop-name {
  font-size: 32rpx;
  font-weight: 600;
  color: #1f2937;
}
.phone-btn {
  background: rgba(37, 99, 235, 0.08);
  color: $uni-color-primary;
  padding: 8rpx 20rpx;
  border-radius: 24rpx;
  font-size: 24rpx;
}
.addr-row {
  display: flex;
  align-items: flex-start;
  gap: 8rpx;
}
.addr-icon {
  font-size: 24rpx;
}
.addr-text {
  flex: 1;
  font-size: 24rpx;
  color: #6b7280;
}
.card-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 16rpx;
  display: block;
}
.item-row {
  display: flex;
  justify-content: space-between;
  padding: 16rpx 0;
  border-bottom: 2rpx solid #f3f4f6;
  &:last-of-type { border-bottom: none; }
}
.item-info {
  flex: 1;
}
.item-name {
  font-size: 28rpx;
  color: #1f2937;
  display: block;
  margin-bottom: 4rpx;
}
.item-spec {
  font-size: 22rpx;
  color: #9ca3af;
}
.item-price {
  text-align: right;
}
.unit-price {
  display: block;
  font-size: 22rpx;
  color: #9ca3af;
}
.subtotal {
  font-size: 28rpx;
  color: #dc2626;
  font-weight: 500;
}
.total-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-top: 16rpx;
  border-top: 2rpx solid #f3f4f6;
  margin-top: 16rpx;
}
.total-label {
  font-size: 26rpx;
  color: #6b7280;
}
.total {
  font-size: 36rpx;
  font-weight: 600;
  color: #dc2626;
}
.pay-row {
  display: flex;
  justify-content: space-between;
  padding-top: 12rpx;
}
.pay-label, .pay-value {
  font-size: 24rpx;
  color: #6b7280;
}
.info-row {
  display: flex;
  justify-content: space-between;
  padding: 12rpx 0;
  border-bottom: 2rpx solid #f3f4f6;
  &:last-child { border-bottom: none; }
}
.info-label {
  font-size: 24rpx;
  color: #9ca3af;
}
.info-value {
  font-size: 24rpx;
  color: #1f2937;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  gap: 16rpx;
  background: #fff;
  padding: 16rpx 24rpx;
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.05);
}
.repurchase-btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  font-size: 28rpx;
}
.follow-btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  font-size: 28rpx;
}
</style>
