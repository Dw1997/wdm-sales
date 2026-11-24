<template>
  <view class="performance-page">
    <scroll-view scroll-y="true" class="content" refresher-enabled :refresher-triggered="refreshing" @refresherrefresh="onRefresh">
      <view class="period-tabs">
        <view v-for="opt in periodOpts" :key="opt.value" class="period-tab" :class="{ active: period === opt.value }" @tap="onPeriodChange(opt.value)">{{ opt.label }}</view>
      </view>

      <!-- 汇总卡：销售看自己，管理员标「全店」 -->
      <view class="summary-card">
        <view class="summary-header">
          <view class="avatar">{{ auth.isAdmin ? '店' : auth.userInitial }}</view>
          <view class="sales-meta">
            <text class="sales-name">{{ auth.isAdmin ? '全店业绩' : (myPerformance?.sales_name || auth.user?.real_name || '销售员') }}</text>
            <text class="sales-region">{{ auth.isAdmin ? '管理员 · 全店' : (auth.user?.role_name || '') }}</text>
          </view>
          <text class="period-caption">{{ periodLabel }}</text>
        </view>
        <view class="summary-grid" v-if="summary">
          <view class="summary-item">
            <text class="summary-value text-money">{{ formatMoney(summary.gmv) }}</text>
            <text class="summary-label">销售额</text>
          </view>
          <view class="summary-item">
            <text class="summary-value text-warning text-money">{{ formatMoney(summary.estimated_commission) }}</text>
            <text class="summary-label">预估提成</text>
          </view>
          <view class="summary-item">
            <text class="summary-value">{{ summary.order_count }}</text>
            <text class="summary-label">订单数</text>
          </view>
          <view class="summary-item">
            <text class="summary-value">{{ summary.new_customers }}</text>
            <text class="summary-label">新增客户</text>
          </view>
        </view>
        <view class="summary-empty" v-else>暂无业绩数据</view>
      </view>

      <!-- 待抵扣提示：只有销售看，且金额 > 0 -->
      <view v-if="!auth.isAdmin && toNum(myPerformance?.clawback_amount) > 0" class="clawback-tip">
        <text class="clawback-icon">!</text>
        <text class="clawback-text">已发放订单发生退货，下次发工资扣 {{ formatMoney(myPerformance?.clawback_amount) }}</text>
      </view>

      <!-- 管理员：排行榜 -->
      <view v-if="auth.isAdmin" class="section">
        <view class="section-title">销售排行榜</view>
        <view v-if="rankingItems.length">
          <view v-for="r in rankingItems" :key="r.sales_id" class="rank-item" @tap="goDetail(r)">
            <view class="rank-no" :class="`rank-${r.ranking}`">
              <text v-if="r.ranking <= 3" class="rank-medal">{{ ['🥇', '🥈', '🥉'][r.ranking - 1] }}</text>
              <text v-else class="rank-num">{{ r.ranking }}</text>
            </view>
            <view class="rank-info">
              <view class="rank-header">
                <text class="rank-name">{{ r.sales_name }}</text>
                <text v-if="r.sales_id === auth.user?.id" class="me-tag">我</text>
                <text class="rank-arrow">›</text>
              </view>
              <view class="rank-bar">
                <view class="rank-bar-fill" :style="{ width: barWidth(r.gmv) + '%' }"></view>
              </view>
              <view class="rank-stats">
                <text class="rank-stat">销售额 {{ formatMoney(r.gmv) }}</text>
                <text class="rank-divider">·</text>
                <text class="rank-stat">{{ r.order_count }} 单</text>
                <text class="rank-divider">·</text>
                <text class="rank-stat text-warning">提成 {{ formatMoney(r.estimated_commission) }}</text>
              </view>
            </view>
          </view>
        </view>
        <empty-state v-else icon="📊" text="暂无排名数据" padding="60rpx 0" />
      </view>

      <!-- 销售：最近提成；管理员不显示（那是销售个人工资事项） -->
      <view v-if="!auth.isAdmin" class="section">
        <view class="section-title">最近提成</view>
        <view v-if="recentCommissions.length">
          <view v-for="c in recentCommissions" :key="c.order_id" class="commission-item" @tap="goOrderDetail(c.order_id)">
            <view class="commission-icon">💰</view>
            <view class="commission-info">
              <text class="commission-customer">{{ c.customer_name }}</text>
              <text class="commission-order">{{ c.order_no }} · {{ formatDate(c.order_date, 'YYYY-MM-DD') }} · {{ formatMoney(c.order_amount) }}</text>
              <text v-if="toNum(c.clawback_amount) > 0" class="commission-clawback">退货待扣 {{ formatMoney(c.clawback_amount) }}</text>
            </view>
            <view class="commission-amount">
              <text class="amount-value text-warning">+{{ formatMoney(c.commission_amount) }}</text>
              <text class="amount-status" :class="statusClass(c.status)">{{ statusLabel(c.status) }}</text>
            </view>
          </view>
        </view>
        <empty-state v-else icon="💰" text="暂无提成记录" padding="60rpx 0" />
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import { useAuthStore } from '@/stores/auth'
import { salesApi } from '@/api'
import { formatMoney, formatDate, toNum } from '@/utils/format'
import { COMMISSION_STATUS } from '@/utils/dict'
import type { SalesPerformance, SalesRanking, SalesRankingItem, RecentCommission, Money } from '@/types'
import dayjs from 'dayjs'

const auth = useAuthStore()
const period = ref('30')
const refreshing = ref(false)
const myPerformance = ref<SalesPerformance | null>(null)
const ranking = ref<SalesRanking>({ total: { order_count: 0, gmv: '0.00', new_customers: 0, estimated_commission: '0.00' }, items: [] })

const periodOpts = [
  { label: '今日', value: '1' },
  { label: '近 7 天', value: '7' },
  { label: '近 30 天', value: '30' },
  { label: '本月', value: 'month' },
]

const periodLabel = computed(() => periodOpts.find((o) => o.value === period.value)?.label || '')
const rankingItems = computed(() => ranking.value.items)
const recentCommissions = computed<RecentCommission[]>(() => myPerformance.value?.recent_commissions || [])
const maxGmv = computed(() => Math.max(...rankingItems.value.map((r) => toNum(r.gmv)), 1))
/** 汇总卡取数：销售用自己的业绩，管理员用全店汇总。 */
const summary = computed<{
  gmv: Money
  estimated_commission: Money
  order_count: number
  new_customers: number
} | null>(() => {
  if (auth.isAdmin) {
    const total = ranking.value.total
    if (!ranking.value.items.length && !total.order_count) return null
    return total
  }
  return myPerformance.value
})

function barWidth(gmv: Money) {
  return Math.round((toNum(gmv) / maxGmv.value) * 100)
}

function statusLabel(status: RecentCommission['status']) {
  return COMMISSION_STATUS[status]?.label || status
}

function statusClass(status: RecentCommission['status']) {
  return status === 'settled' ? 'text-success' : status === 'pending' ? 'text-primary' : 'text-grey'
}

function getRange(): [string, string] {
  if (period.value === 'month') {
    return [dayjs().startOf('month').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')]
  }
  const days = Number(period.value)
  return [dayjs().subtract(days - 1, 'day').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')]
}

async function load() {
  const [start, end] = getRange()
  try {
    if (auth.isAdmin) {
      ranking.value = await salesApi.ranking(start, end)
      myPerformance.value = null
    } else {
      const [perf] = await Promise.all([salesApi.performance(start, end)])
      myPerformance.value = perf
      ranking.value = { total: { order_count: 0, gmv: '0.00', new_customers: 0, estimated_commission: '0.00' }, items: [] }
    }
  } catch (e) {
    /* 错误由 request.ts 统一 toast */
  }
}

function onPeriodChange(v: string) {
  period.value = v
  load()
}

async function onRefresh() {
  refreshing.value = true
  await load()
  refreshing.value = false
}

function goDetail(r: SalesRankingItem) {
  uni.navigateTo({
    url: `/pages/performance/sales-detail?id=${r.sales_id}&name=${encodeURIComponent(r.sales_name)}`,
  })
}

function goOrderDetail(orderId: number) {
  uni.navigateTo({ url: `/pages/order/detail?id=${orderId}` })
}

onShow(load)
</script>

<style lang="scss" scoped>
.performance-page {
  min-height: 100vh;
  background: #f5f5f7;
}
.content {
  height: calc(100vh - var(--window-top, 0px));
  box-sizing: border-box;
}
.period-tabs {
  display: flex;
  background: #fff;
  padding: 16rpx;
  gap: 8rpx;
}
.period-tab {
  flex: 1;
  text-align: center;
  padding: 16rpx 0;
  background: #f3f4f6;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: #6b7280;
}
.period-tab.active {
  background: $uni-color-primary;
  color: #fff;
}
.summary-card {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  margin: 16rpx;
  border-radius: 20rpx;
  padding: 32rpx;
  color: #fff;
  box-shadow: 0 8rpx 24rpx rgba(37, 99, 235, 0.3);
}
.summary-header {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 24rpx;
}
.avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  font-size: 44rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sales-meta {
  flex: 1;
}
.sales-name {
  display: block;
  font-size: 36rpx;
  font-weight: 600;
}
.sales-region {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
}
.period-caption {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.85);
  background: rgba(255, 255, 255, 0.18);
  padding: 6rpx 16rpx;
  border-radius: 20rpx;
}
.summary-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.summary-item {
  width: calc(50% - 8rpx);
  background: rgba(255, 255, 255, 0.15);
  border-radius: 12rpx;
  padding: 16rpx;
}
.summary-value {
  display: block;
  font-size: 36rpx;
  font-weight: 600;
  color: #fff;
  font-variant-numeric: tabular-nums;
}
.summary-label {
  display: block;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 4rpx;
}
.summary-empty {
  text-align: center;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.85);
  padding: 24rpx 0;
}
.clawback-tip {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin: 0 16rpx 16rpx;
  padding: 20rpx 24rpx;
  background: #fff7ed;
  border: 2rpx solid #fed7aa;
  border-radius: 12rpx;
}
.clawback-icon {
  width: 36rpx;
  height: 36rpx;
  flex-shrink: 0;
  border-radius: 50%;
  background: #ea580c;
  color: #fff;
  font-size: 24rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.clawback-text {
  flex: 1;
  font-size: 26rpx;
  color: #c2410c;
  line-height: 1.4;
}
.section {
  background: #fff;
  margin: 16rpx;
  border-radius: 16rpx;
  padding: 24rpx;
}
.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 16rpx;
  display: block;
}
.rank-item {
  display: flex;
  gap: 16rpx;
  padding: 16rpx 0;
  border-bottom: 2rpx solid #f3f4f6;
  &:last-child { border-bottom: none; }
}
.rank-no {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.rank-medal {
  font-size: 40rpx;
}
.rank-num {
  font-size: 28rpx;
  font-weight: 600;
  color: #6b7280;
}
.rank-info {
  flex: 1;
}
.rank-header {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 8rpx;
}
.rank-name {
  font-size: 28rpx;
  font-weight: 500;
  color: #1f2937;
}
.me-tag {
  background: $uni-color-primary;
  color: #fff;
  padding: 0 8rpx;
  border-radius: 4rpx;
  font-size: 20rpx;
}
.rank-arrow {
  margin-left: auto;
  font-size: 36rpx;
  color: #cbd5e1;
}
.rank-bar {
  height: 12rpx;
  background: #f3f4f6;
  border-radius: 6rpx;
  overflow: hidden;
  margin-bottom: 8rpx;
}
.rank-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #2563eb, #3b82f6);
  border-radius: 6rpx;
}
.rank-stats {
  display: flex;
  gap: 8rpx;
  align-items: center;
  flex-wrap: wrap;
  font-size: 22rpx;
  color: #6b7280;
}
.rank-divider {
  color: #e5e7eb;
}
.commission-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 0;
  border-bottom: 2rpx solid #f3f4f6;
  &:last-child { border-bottom: none; }
}
.commission-icon {
  width: 56rpx;
  height: 56rpx;
  border-radius: 12rpx;
  background: rgba(234, 88, 12, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  flex-shrink: 0;
}
.commission-info {
  flex: 1;
  min-width: 0;
}
.commission-customer {
  display: block;
  font-size: 28rpx;
  font-weight: 500;
  color: #1f2937;
}
.commission-order {
  display: block;
  font-size: 22rpx;
  color: #9ca3af;
  margin-top: 4rpx;
}
.commission-clawback {
  display: block;
  font-size: 22rpx;
  color: #c2410c;
  margin-top: 4rpx;
}
.commission-amount {
  text-align: right;
  flex-shrink: 0;
}
.amount-value {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.amount-status {
  display: block;
  font-size: 22rpx;
  margin-top: 4rpx;
}
</style>
