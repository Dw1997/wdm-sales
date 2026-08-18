<template>
  <view class="customer-card" @tap="$emit('tap')">
    <view class="card-top">
      <view class="shop-info">
        <text class="shop-name">{{ customer.shop_name || customer.name }}</text>
        <view class="badges">
          <text class="tag" :style="{ background: levelBg, color: levelColor }">{{ levelLabel }}</text>
          <text class="tag" :class="`tag-${statusType}`">{{ statusLabel }}</text>
        </view>
      </view>
      <view class="phone-wrap" @tap.stop="callPhone">
        <text class="phone">{{ formatPhone(customer.phone) }}</text>
      </view>
    </view>
    <view class="card-meta">
      <text class="meta-item">本月 ¥{{ formatQty(customer.month_gmv || 0) }}</text>
      <text class="meta-divider">|</text>
      <text class="meta-item">累计 {{ customer.total_orders || 0 }} 单</text>
      <text class="meta-divider">|</text>
      <text class="meta-item" :class="customer.available_credit < customer.credit_limit * 0.2 ? 'text-danger' : ''">
        额度 ¥{{ formatQty(customer.available_credit) }}
      </text>
    </view>
    <view v-if="customer.last_order_at || customer.last_follow_up_at" class="card-foot">
      <text class="foot-text">最近下单 {{ relativeTime(customer.last_order_at) }}</text>
      <text v-if="customer.last_follow_up_at" class="foot-text">· 跟进 {{ relativeTime(customer.last_follow_up_at) }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Customer } from '@/types'
import { CUSTOMER_LEVEL, CUSTOMER_STATUS } from '@/utils/dict'
import { formatQty, formatPhone, relativeTime } from '@/utils/format'

const props = defineProps<{ customer: Customer }>()
defineEmits<{ tap: []; call: [] }>()

const levelLabel = computed(() => CUSTOMER_LEVEL[props.customer.level]?.label || props.customer.level)
const levelColor = computed(() => CUSTOMER_LEVEL[props.customer.level]?.color || '#9ca3af')
const levelBg = computed(() => `${CUSTOMER_LEVEL[props.customer.level]?.color || '#9ca3af'}1a`)
const statusLabel = computed(() => CUSTOMER_STATUS[props.customer.status]?.label || props.customer.status)
const statusType = computed(() => CUSTOMER_STATUS[props.customer.status]?.type || 'grey')

function callPhone() {
  uni.makePhoneCall({ phoneNumber: props.customer.phone })
}
</script>

<style lang="scss" scoped>
.customer-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16rpx;
}
.shop-info {
  flex: 1;
  min-width: 0;
}
.shop-name {
  font-size: 32rpx;
  font-weight: 600;
  color: #1f2937;
  display: block;
  margin-bottom: 8rpx;
}
.badges {
  display: flex;
  gap: 8rpx;
}
.tag {
  display: inline-block;
  padding: 2rpx 12rpx;
  border-radius: 6rpx;
  font-size: 20rpx;
  line-height: 1.6;
}
.tag-success { background: rgba(22, 163, 74, 0.1); color: #16a34a; }
.tag-warning { background: rgba(234, 88, 12, 0.1); color: #ea580c; }
.tag-danger { background: rgba(220, 38, 38, 0.1); color: #dc2626; }
.tag-grey { background: #f3f4f6; color: #6b7280; }
.phone-wrap {
  padding: 8rpx 16rpx;
  background: rgba(37, 99, 235, 0.08);
  border-radius: 8rpx;
}
.phone {
  font-size: 24rpx;
  color: $uni-color-primary;
  font-variant-numeric: tabular-nums;
}
.card-meta {
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-size: 24rpx;
  color: #6b7280;
  margin-bottom: 12rpx;
}
.meta-divider {
  color: #e5e7eb;
}
.card-foot {
  display: flex;
  gap: 8rpx;
  font-size: 22rpx;
  color: #9ca3af;
  padding-top: 12rpx;
  border-top: 2rpx solid #f3f4f6;
}
</style>
