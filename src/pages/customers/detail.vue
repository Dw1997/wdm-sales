<template>
  <view class="detail-page">
    <scroll-view scroll-y="true" class="content">
      <view v-if="customer" class="profile-section">
        <view class="shop-info">
          <view class="shop-header">
            <text class="shop-name">{{ customer.shop_name || customer.name }}</text>
            <view class="badges">
              <text class="level-tag" :style="{ background: levelBg, color: levelColor }">{{ levelLabel }}</text>
              <text class="status-tag" :class="`status-${statusType}`">{{ statusLabel }}</text>
            </view>
          </view>
          <view class="contact-row">
            <text class="contact-item" @tap="callPhone">📞 {{ formatPhone(customer.phone) }}</text>
            <text class="contact-item" v-if="customer.address">📍 {{ customer.address }}</text>
          </view>
        </view>

        <view class="action-bar">
          <view class="action-btn" @tap="callPhone">
            <text class="action-emoji">📞</text>
            <text class="action-label">电话</text>
          </view>
          <view class="action-btn" @tap="goFollowUp">
            <text class="action-emoji">📝</text>
            <text class="action-label">跟进</text>
          </view>
          <view class="action-btn" @tap="goOrderCreate">
            <text class="action-emoji">🛒</text>
            <text class="action-label">代下单</text>
          </view>
          <view class="action-btn" @tap="goOrderHistory">
            <text class="action-emoji">📋</text>
            <text class="action-label">订单</text>
          </view>
          <view class="action-btn" @tap="goCreditApply">
            <text class="action-emoji">💳</text>
            <text class="action-label">提额</text>
          </view>
        </view>
      </view>

      <view v-if="customer" class="credit-card">
        <view class="card-title">账期信息</view>
        <view class="credit-row">
          <view class="credit-item">
            <text class="credit-label">授信额度</text>
            <text class="credit-value">¥{{ formatQty(customer.credit_limit) }}</text>
          </view>
          <view class="credit-item">
            <text class="credit-label">已用欠款</text>
            <text class="credit-value text-danger">¥{{ formatQty(customer.used_credit) }}</text>
          </view>
          <view class="credit-item">
            <text class="credit-label">可用额度</text>
            <text class="credit-value" :class="customer.available_credit < customer.credit_limit * 0.2 ? 'text-danger' : 'text-success'">¥{{ formatQty(customer.available_credit) }}</text>
          </view>
        </view>
        <view class="usage-bar">
          <view class="usage-fill" :style="{ width: usagePercent + '%', background: usagePercent > 80 ? '#dc2626' : usagePercent > 60 ? '#ea580c' : '#16a34a' }"></view>
        </view>
        <text class="usage-text">使用率 {{ usagePercent }}%</text>
      </view>

      <view class="stats-card">
        <view class="stat-item">
          <text class="stat-value">¥{{ formatQty(customer?.month_gmv || 0) }}</text>
          <text class="stat-label">本月消费</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item">
          <text class="stat-value">{{ customer?.total_orders || 0 }}</text>
          <text class="stat-label">累计订单</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item">
          <text class="stat-value">{{ customer?.follow_up_count || 0 }}</text>
          <text class="stat-label">跟进次数</text>
        </view>
      </view>

      <view class="section">
        <view class="section-title-row">
          <text class="section-title">最近订单</text>
          <text class="more-link" @tap="goOrderHistory">查看全部 ›</text>
        </view>
        <view v-if="recentOrders.length">
          <order-card v-for="order in recentOrders" :key="order.id" :order="order" @tap="goOrderDetail(order.id)" />
        </view>
        <empty-state v-else icon="📋" text="暂无订单" padding="40rpx 0" />
      </view>

      <view class="section">
        <view class="section-title-row">
          <text class="section-title">跟进记录</text>
          <text class="more-link" @tap="goFollowUp">查看全部 ›</text>
        </view>
        <view v-if="followUps.length" class="timeline">
          <view v-for="f in followUps.slice(0, 3)" :key="f.id" class="timeline-item">
            <view class="timeline-dot" :style="{ background: followUpTypeColor(f.type) }">{{ followUpTypeIcon(f.type) }}</view>
            <view class="timeline-content">
              <text class="timeline-text">{{ f.content }}</text>
              <text class="timeline-time">{{ relativeTime(f.created_at) }}</text>
            </view>
          </view>
        </view>
        <empty-state v-else icon="📝" text="暂无跟进记录" padding="40rpx 0" />
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import OrderCard from '@/components/OrderCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import { customerApi, orderApi } from '@/api'
import { CUSTOMER_LEVEL, CUSTOMER_STATUS, FOLLOW_UP_TYPE } from '@/utils/dict'
import { formatQty, formatPhone, relativeTime } from '@/utils/format'
import type { Customer, Order, FollowUp } from '@/types'

const customerId = ref(0)
const customer = ref<Customer | null>(null)
const recentOrders = ref<Order[]>([])
const followUps = ref<FollowUp[]>([])

const levelLabel = computed(() => customer.value ? CUSTOMER_LEVEL[customer.value.level]?.label : '')
const levelColor = computed(() => customer.value ? CUSTOMER_LEVEL[customer.value.level]?.color : '#9ca3af')
const levelBg = computed(() => `${levelColor.value}1a`)
const statusLabel = computed(() => customer.value ? CUSTOMER_STATUS[customer.value.status]?.label : '')
const statusType = computed(() => customer.value ? CUSTOMER_STATUS[customer.value.status]?.type : 'grey')
const usagePercent = computed(() => {
  if (!customer.value || !customer.value.credit_limit) return 0
  return Math.round((customer.value.used_credit / customer.value.credit_limit) * 100)
})

function followUpTypeIcon(t: string) { return FOLLOW_UP_TYPE[t]?.icon || '📝' }
function followUpTypeColor(t: string) { return FOLLOW_UP_TYPE[t]?.color || '#6b7280' }

async function load() {
  if (!customerId.value) return
  customer.value = await customerApi.get(customerId.value)
  try {
    recentOrders.value = await customerApi.orderHistory(customerId.value)
  } catch (e) { /* ignore */ }
  try {
    followUps.value = await customerApi.followUps(customerId.value)
  } catch (e) { /* ignore */ }
}

function callPhone() {
  if (customer.value) uni.makePhoneCall({ phoneNumber: customer.value.phone })
}
function goFollowUp() {
  uni.navigateTo({ url: `/pages/customers/follow-up?id=${customerId.value}` })
}
function goOrderCreate() {
  uni.navigateTo({ url: `/pages/order/create?customer_id=${customerId.value}` })
}
function goOrderHistory() {
  uni.navigateTo({ url: `/pages/order/history?customer_id=${customerId.value}` })
}
function goOrderDetail(id: string) {
  uni.navigateTo({ url: `/pages/order/detail?id=${id}` })
}
function goCreditApply() {
  uni.navigateTo({ url: `/pages/customers/credit-apply?id=${customerId.value}` })
}

onLoad((opts: any) => {
  customerId.value = Number(opts?.id || 0)
  load()
})
</script>

<style lang="scss" scoped>
.detail-page {
  min-height: 100vh;
  background: #f5f5f7;
}
.content {
  height: 100vh;
}
.profile-section {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  padding: 32rpx;
  padding-top: 48rpx;
}
.shop-info {
  color: #fff;
  margin-bottom: 24rpx;
}
.shop-header {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 16rpx;
  flex-wrap: wrap;
}
.shop-name {
  font-size: 40rpx;
  font-weight: 600;
  color: #fff;
}
.badges {
  display: flex;
  gap: 8rpx;
}
.level-tag, .status-tag {
  padding: 4rpx 16rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
}
.status-tag { background: rgba(255, 255, 255, 0.2); color: #fff; }
.status-success { background: rgba(22, 163, 74, 0.3); }
.status-warning { background: rgba(234, 88, 12, 0.3); }
.status-danger { background: rgba(220, 38, 38, 0.3); }
.contact-row {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.contact-item {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.9);
}
.action-bar {
  display: flex;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 16rpx;
  padding: 16rpx 0;
}
.action-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
}
.action-emoji {
  font-size: 36rpx;
}
.action-label {
  font-size: 22rpx;
  color: #fff;
}
.credit-card {
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
}
.credit-row {
  display: flex;
  justify-content: space-around;
  margin-bottom: 16rpx;
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
  font-size: 30rpx;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.usage-bar {
  height: 12rpx;
  background: #f3f4f6;
  border-radius: 6rpx;
  overflow: hidden;
  margin-bottom: 8rpx;
}
.usage-fill {
  height: 100%;
  border-radius: 6rpx;
  transition: width 0.3s;
}
.usage-text {
  font-size: 22rpx;
  color: #6b7280;
}
.stats-card {
  display: flex;
  background: #fff;
  margin: 0 16rpx;
  border-radius: 16rpx;
  padding: 24rpx;
  align-items: center;
}
.stat-item {
  flex: 1;
  text-align: center;
}
.stat-value {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #1f2937;
  font-variant-numeric: tabular-nums;
}
.stat-label {
  display: block;
  font-size: 22rpx;
  color: #9ca3af;
  margin-top: 4rpx;
}
.stat-divider {
  width: 2rpx;
  height: 60rpx;
  background: #f3f4f6;
}
.section {
  background: #fff;
  margin: 16rpx;
  border-radius: 16rpx;
  padding: 24rpx;
}
.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}
.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1f2937;
}
.more-link {
  font-size: 24rpx;
  color: $uni-color-primary;
}
.timeline {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.timeline-item {
  display: flex;
  gap: 16rpx;
}
.timeline-dot {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  flex-shrink: 0;
}
.timeline-content {
  flex: 1;
  padding-top: 8rpx;
}
.timeline-text {
  display: block;
  font-size: 26rpx;
  color: #4b5563;
  line-height: 1.5;
}
.timeline-time {
  display: block;
  font-size: 22rpx;
  color: #9ca3af;
  margin-top: 4rpx;
}
</style>
