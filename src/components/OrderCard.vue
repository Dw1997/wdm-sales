<template>
  <view class="order-card" @tap="$emit('tap')">
    <view class="card-top">
      <text class="order-id">{{ order.id }}</text>
      <text class="status-tag" :class="`status-${statusType}`">{{ statusLabel }}</text>
    </view>
    <view class="card-customer">
      <text class="customer-name">{{ order.customer_name }}</text>
      <text class="customer-meta">· {{ order.sales_name }}</text>
    </view>
    <view class="items">
      <text v-for="(it, i) in order.items.slice(0, 2)" :key="i" class="item-text">
        {{ it.product_name }} × {{ it.quantity }}{{ it.unit }}
      </text>
      <text v-if="order.items.length > 2" class="item-more">等 {{ order.items.length }} 种商品</text>
    </view>
    <view class="card-foot">
      <view class="amount-wrap">
        <text class="amount-label">合计</text>
        <text class="amount">¥{{ formatQty(order.total_amount) }}</text>
      </view>
      <text class="payment">{{ paymentLabel }}</text>
    </view>
    <view class="card-time">{{ formatDate(order.created_at) }}</view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Order } from '@/types'
import { ORDER_STATUS, PAYMENT_METHOD } from '@/utils/dict'
import { formatQty, formatDate } from '@/utils/format'

const props = defineProps<{ order: Order }>()
defineEmits<{ tap: [] }>()

const statusLabel = computed(() => ORDER_STATUS[props.order.status]?.label || props.order.status)
const statusType = computed(() => ORDER_STATUS[props.order.status]?.type || 'grey')
const paymentLabel = computed(() => PAYMENT_METHOD[props.order.payment_method] || props.order.payment_method)
</script>

<style lang="scss" scoped>
.order-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}
.order-id {
  font-size: 26rpx;
  color: #6b7280;
  font-family: -apple-system, sans-serif;
}
.status-tag {
  font-size: 22rpx;
  padding: 4rpx 16rpx;
  border-radius: 8rpx;
}
.status-warning { background: rgba(234, 88, 12, 0.1); color: #ea580c; }
.status-danger { background: rgba(220, 38, 38, 0.1); color: #dc2626; }
.status-primary { background: rgba(37, 99, 235, 0.1); color: #2563eb; }
.status-info { background: rgba(100, 116, 139, 0.1); color: #64748b; }
.status-success { background: rgba(22, 163, 74, 0.1); color: #16a34a; }
.status-grey { background: #f3f4f6; color: #6b7280; }
.card-customer {
  display: flex;
  gap: 8rpx;
  margin-bottom: 12rpx;
}
.customer-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #1f2937;
}
.customer-meta {
  font-size: 24rpx;
  color: #9ca3af;
  align-self: flex-end;
}
.items {
  background: #f9fafb;
  border-radius: 8rpx;
  padding: 16rpx;
  margin-bottom: 12rpx;
}
.item-text {
  display: block;
  font-size: 24rpx;
  color: #6b7280;
  margin-bottom: 4rpx;
}
.item-more {
  display: block;
  font-size: 22rpx;
  color: #9ca3af;
}
.card-foot {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.amount-wrap {
  display: flex;
  align-items: baseline;
  gap: 4rpx;
}
.amount-label {
  font-size: 22rpx;
  color: #9ca3af;
}
.amount {
  font-size: 32rpx;
  font-weight: 600;
  color: #dc2626;
  font-family: -apple-system, sans-serif;
  font-variant-numeric: tabular-nums;
}
.payment {
  font-size: 22rpx;
  color: #6b7280;
}
.card-time {
  font-size: 22rpx;
  color: #9ca3af;
  margin-top: 12rpx;
  padding-top: 12rpx;
  border-top: 2rpx solid #f3f4f6;
}
</style>
