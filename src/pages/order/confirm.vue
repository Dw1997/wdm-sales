<template>
  <view class="confirm-page">
    <scroll-view scroll-y="true" class="content">
      <view class="customer-card">
        <view class="card-header">
          <text class="card-title">下单客户</text>
        </view>
        <view class="cust-info">
          <text class="shop-name">{{ cart.customerName }}</text>
          <text class="cust-phone" v-if="customer">{{ formatPhone(customer.phone) }}</text>
        </view>
        <view class="cust-addr" v-if="customer?.address">
          <text>📍 {{ customer.address }}</text>
        </view>
      </view>

      <view v-if="credit" class="credit-card">
        <view class="card-title">账期信息</view>
        <view class="credit-row">
          <view class="credit-item">
            <text class="credit-label">授信额度</text>
            <text class="credit-value">¥{{ formatQty(credit.credit_limit) }}</text>
          </view>
          <view class="credit-item">
            <text class="credit-label">可用</text>
            <text class="credit-value" :class="credit.available_credit < cart.totalAmount ? 'text-danger' : 'text-success'">¥{{ formatQty(credit.available_credit) }}</text>
          </view>
          <view class="credit-item">
            <text class="credit-label">本单</text>
            <text class="credit-value text-warning">¥{{ formatQty(cart.totalAmount.toFixed(2)) }}</text>
          </view>
        </view>
        <view v-if="credit.available_credit < cart.totalAmount" class="credit-warn">
          <text>⚠️ 可用额度不足，将进入审核流程</text>
        </view>
      </view>

      <view class="items-card">
        <view class="card-title">商品明细 ({{ cart.totalCount }} 件)</view>
        <view v-for="(item, i) in cart.items" :key="i" class="item-row">
          <image class="cover" :src="item.product.cover || defaultCover" mode="aspectFill" />
          <view class="item-info">
            <text class="item-name">{{ item.product.name }}</text>
            <text class="item-spec">{{ item.unit }} × {{ item.quantity }}</text>
            <text class="item-subtotal">¥{{ item.subtotal.toFixed(2) }}</text>
          </view>
        </view>
        <view class="total-row">
          <text class="total-label">合计</text>
          <text class="total-amount">¥{{ formatQty(cart.totalAmount.toFixed(2)) }}</text>
        </view>
      </view>

      <view class="form-card">
        <view class="form-item">
          <text class="form-label">支付方式</text>
          <view class="payment-tabs">
            <view v-for="opt in paymentOpts" :key="opt.value" class="payment-tab" :class="{ active: paymentMethod === opt.value }" @tap="paymentMethod = opt.value">
              <text class="payment-icon">{{ opt.icon }}</text>
              <text class="payment-label">{{ opt.label }}</text>
            </view>
          </view>
        </view>
        <view class="form-item">
          <text class="form-label">备注</text>
          <textarea class="form-textarea" v-model="remark" placeholder="选填，如：客户要求本周三前送达" maxlength="200" />
        </view>
      </view>
    </scroll-view>

    <view class="bottom-bar">
      <view class="amount-wrap">
        <text class="amount-label">应付</text>
        <text class="amount">¥{{ formatQty(cart.totalAmount.toFixed(2)) }}</text>
      </view>
      <button class="btn-primary submit-btn" :loading="submitting" @tap="onSubmit">提交订单</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useCartStore } from '@/stores/cart'
import { customerApi, orderApi, financeApi } from '@/api'
import { formatQty, formatPhone } from '@/utils/format'
import type { Customer, CreditInfo, Order } from '@/types'

const cart = useCartStore()
const customer = ref<Customer | null>(null)
const credit = ref<CreditInfo | null>(null)
const paymentMethod = ref<Order['payment_method']>('credit')
const remark = ref('')
const submitting = ref(false)

const defaultCover = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="%23f3f4f6"/><text x="100" y="105" text-anchor="middle" font-size="60" fill="%239ca3af">📦</text></svg>'

const paymentOpts = [
  { value: 'credit', label: '账期挂账', icon: '💳' },
  { value: 'online', label: '在线支付', icon: '⚡' },
  { value: 'wechat', label: '微信', icon: '💚' },
  { value: 'bank', label: '对公转账', icon: '🏦' },
]

async function load() {
  if (!cart.customerId) {
    uni.showToast({ title: '请先选择客户', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 800)
    return
  }
  customer.value = await customerApi.get(cart.customerId)
  if (customer.value && customer.value.credit_limit > 0) {
    credit.value = await financeApi.credit(cart.customerId)
  }
}

async function onSubmit() {
  if (cart.isEmpty) {
    uni.showToast({ title: '购物车为空', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    const order = await orderApi.create({
      customer_id: cart.customerId!,
      payment_method: paymentMethod.value,
      remark: remark.value,
      items: cart.items.map((it) => ({
        product_id: it.product.id,
        quantity: it.quantity,
        unit: it.unit,
      })),
    })
    uni.showToast({ title: '订单已创建', icon: 'success' })
    cart.clear()
    setTimeout(() => {
      uni.redirectTo({ url: `/pages/order/detail?id=${order.id}` })
    }, 800)
  } finally {
    submitting.value = false
  }
}

onMounted(load)
</script>

<style lang="scss" scoped>
.confirm-page {
  min-height: 100vh;
  background: #f5f5f7;
  padding-bottom: 120rpx;
}
.content {
  height: calc(100vh - 120rpx);
}
.customer-card, .credit-card, .items-card, .form-card {
  background: #fff;
  margin: 16rpx;
  border-radius: 16rpx;
  padding: 24rpx;
}
.card-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 16rpx;
  display: block;
}
.cust-info {
  display: flex;
  align-items: baseline;
  gap: 16rpx;
  margin-bottom: 8rpx;
}
.shop-name {
  font-size: 32rpx;
  font-weight: 600;
  color: #1f2937;
}
.cust-phone {
  font-size: 26rpx;
  color: #6b7280;
  font-variant-numeric: tabular-nums;
}
.cust-addr {
  font-size: 24rpx;
  color: #6b7280;
}
.credit-row {
  display: flex;
  justify-content: space-around;
}
.credit-item {
  text-align: center;
}
.credit-label {
  display: block;
  font-size: 22rpx;
  color: #9ca3af;
  margin-bottom: 4rpx;
}
.credit-value {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.credit-warn {
  background: rgba(234, 88, 12, 0.08);
  color: #ea580c;
  padding: 12rpx 16rpx;
  border-radius: 8rpx;
  font-size: 24rpx;
  margin-top: 16rpx;
  text-align: center;
}
.item-row {
  display: flex;
  gap: 16rpx;
  padding: 16rpx 0;
  border-bottom: 2rpx solid #f3f4f6;
  &:last-of-type { border-bottom: none; }
}
.cover {
  width: 100rpx;
  height: 100rpx;
  border-radius: 8rpx;
  background: #f3f4f6;
  flex-shrink: 0;
}
.item-info {
  flex: 1;
}
.item-name {
  font-size: 26rpx;
  color: #1f2937;
  display: block;
  margin-bottom: 4rpx;
}
.item-spec {
  font-size: 22rpx;
  color: #9ca3af;
}
.item-subtotal {
  font-size: 26rpx;
  color: #dc2626;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
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
.total-amount {
  font-size: 36rpx;
  font-weight: 600;
  color: #dc2626;
  font-variant-numeric: tabular-nums;
}
.form-item {
  margin-bottom: 24rpx;
}
.form-label {
  display: block;
  font-size: 26rpx;
  color: #6b7280;
  margin-bottom: 12rpx;
}
.payment-tabs {
  display: flex;
  gap: 12rpx;
  flex-wrap: wrap;
}
.payment-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
  padding: 16rpx 8rpx;
  background: #f9fafb;
  border-radius: 12rpx;
  border: 2rpx solid transparent;
}
.payment-tab.active {
  background: rgba(37, 99, 235, 0.05);
  border-color: $uni-color-primary;
}
.payment-icon {
  font-size: 32rpx;
}
.payment-label {
  font-size: 22rpx;
  color: #4b5563;
}
.form-textarea {
  width: 100%;
  height: 120rpx;
  border: 2rpx solid #e5e7eb;
  border-radius: 12rpx;
  padding: 16rpx 24rpx;
  font-size: 26rpx;
  box-sizing: border-box;
}
.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  background: #fff;
  padding: 16rpx 24rpx;
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.05);
}
.amount-wrap {
  flex: 1;
}
.amount-label {
  font-size: 22rpx;
  color: #9ca3af;
}
.amount {
  display: block;
  font-size: 36rpx;
  font-weight: 600;
  color: #dc2626;
  font-variant-numeric: tabular-nums;
}
.submit-btn {
  width: 280rpx;
  height: 80rpx;
  line-height: 80rpx;
  font-size: 28rpx;
}
</style>
