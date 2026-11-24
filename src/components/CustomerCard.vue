<template>
  <view class="customer-card" @tap="$emit('tap')">
    <view class="card-top">
      <view class="shop-info">
        <text class="shop-name">{{ customer.name }}</text>
        <view class="badges">
          <text v-if="customer.level_nickname" class="tag tag-level">{{ customer.level_nickname }}</text>
          <text class="tag" :class="`tag-${statusType}`">{{ statusLabel }}</text>
        </view>
      </view>
      <view v-if="customer.phone" class="phone-wrap" @tap.stop="callPhone">
        <text class="phone">{{ formatPhone(customer.phone) }}</text>
      </view>
    </view>
    <view class="card-meta">
      <text class="meta-item">{{ customer.town || customer.address || '未设置地点' }}</text>
      <text class="meta-divider">|</text>
      <text class="meta-item">{{ deliveryLabel }}</text>
    </view>
    <view v-if="customer.sales_name || customer.contact_name" class="card-foot">
      <text v-if="customer.sales_name" class="foot-text">归属 {{ customer.sales_name }}</text>
      <text v-if="customer.contact_name" class="foot-text">· 联系人 {{ customer.contact_name }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Customer } from '@/types'
import { CUSTOMER_STATUS, DELIVERY_MODE } from '@/utils/dict'
import { formatPhone } from '@/utils/format'

const props = defineProps<{ customer: Customer }>()
defineEmits<{ tap: []; call: [] }>()

const statusLabel = computed(() => CUSTOMER_STATUS[props.customer.status]?.label || props.customer.status)
const statusType = computed(() => CUSTOMER_STATUS[props.customer.status]?.type || 'grey')
const deliveryLabel = computed(
  () => DELIVERY_MODE[props.customer.default_delivery_mode] || props.customer.default_delivery_mode,
)

function callPhone() {
  if (props.customer.phone) uni.makePhoneCall({ phoneNumber: props.customer.phone })
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
.tag-level { background: rgba(37, 99, 235, 0.08); color: #2563eb; }
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
