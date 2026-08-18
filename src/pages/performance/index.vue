<template>
  <view class="performance-page">
    <scroll-view scroll-y="true" class="content">
      <view class="period-tabs">
        <view v-for="opt in periodOpts" :key="opt.value" class="period-tab" :class="{ active: period === opt.value }" @tap="onPeriodChange(opt.value)">{{ opt.label }}</view>
      </view>

      <view class="summary-card">
        <view class="summary-header">
          <view class="avatar">{{ auth.userInitial }}</view>
          <view class="sales-meta">
            <text class="sales-name">{{ auth.user?.real_name || '销售员' }}</text>
            <text class="sales-region">{{ auth.user?.region || '' }}</text>
          </view>
        </view>
        <view class="summary-grid" v-if="performance">
          <view class="summary-item">
            <text class="summary-value text-money">¥{{ formatQty(performance.gmv) }}</text>
            <text class="summary-label">销售额</text>
          </view>
          <view class="summary-item">
            <text class="summary-value text-warning text-money">¥{{ formatQty(performance.estimated_commission.toFixed(2)) }}</text>
            <text class="summary-label">预估提成</text>
          </view>
          <view class="summary-item">
            <text class="summary-value">{{ performance.order_count }}</text>
            <text class="summary-label">订单数</text>
          </view>
          <view class="summary-item">
            <text class="summary-value">{{ performance.new_customers }}</text>
            <text class="summary-label">新增客户</text>
          </view>
        </view>
      </view>

      <view class="section">
        <view class="section-title">排行榜</view>
        <view v-if="ranking.length">
          <view v-for="r in ranking" :key="r.sales_id" class="rank-item">
            <view class="rank-no" :class="`rank-${r.ranking}`">
              <text v-if="r.ranking <= 3" class="rank-medal">{{ ['🥇', '🥈', '🥉'][r.ranking - 1] }}</text>
              <text v-else class="rank-num">{{ r.ranking }}</text>
            </view>
            <view class="rank-info">
              <view class="rank-header">
                <text class="rank-name">{{ r.sales_name }}</text>
                <text v-if="r.sales_id === auth.user?.id" class="me-tag">我</text>
              </view>
              <view class="rank-bar">
                <view class="rank-bar-fill" :style="{ width: barWidth(r.gmv) + '%' }"></view>
              </view>
              <view class="rank-stats">
                <text class="rank-stat">GMV ¥{{ formatQty(r.gmv) }}</text>
                <text class="rank-divider">·</text>
                <text class="rank-stat">{{ r.order_count }} 单</text>
                <text class="rank-divider">·</text>
                <text class="rank-stat text-warning">提成 ¥{{ formatQty(r.estimated_commission.toFixed(2)) }}</text>
              </view>
            </view>
          </view>
        </view>
        <empty-state v-else icon="📊" text="暂无排名数据" padding="60rpx 0" />
      </view>

      <view class="section">
        <view class="section-title">最近提成</view>
        <view v-if="commissions.length">
          <view v-for="c in commissions.slice(0, 5)" :key="c.id" class="commission-item">
            <view class="commission-icon">💰</view>
            <view class="commission-info">
              <text class="commission-customer">{{ c.customer_name }}</text>
              <text class="commission-order">{{ c.order_id }} · ¥{{ formatQty(c.order_amount) }}</text>
            </view>
            <view class="commission-amount">
              <text class="amount-value text-warning">+¥{{ c.commission_amount.toFixed(2) }}</text>
              <text class="amount-status" :class="c.status === 'settled' ? 'text-success' : 'text-grey'">
                {{ c.status === 'settled' ? '已结算' : '待结算' }}
              </text>
            </view>
          </view>
        </view>
        <empty-state v-else icon="💰" text="暂无提成记录" padding="60rpx 0" />
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import { useAuthStore } from '@/stores/auth'
import { salesApi, financeApi } from '@/api'
import { formatQty } from '@/utils/format'
import type { SalesPerformance, Commission } from '@/types'
import dayjs from 'dayjs'

const auth = useAuthStore()
const period = ref('30')
const performance = ref<SalesPerformance | null>(null)
const ranking = ref<(SalesPerformance & { ranking: number })[]>([])
const commissions = ref<Commission[]>([])

const periodOpts = [
  { label: '今日', value: '1' },
  { label: '近 7 天', value: '7' },
  { label: '近 30 天', value: '30' },
  { label: '本月', value: 'month' },
]

const maxGmv = computed(() => Math.max(...ranking.value.map((r) => r.gmv), 1))

function barWidth(gmv: number) {
  return Math.round((gmv / maxGmv.value) * 100)
}

function getRange() {
  if (period.value === 'month') {
    return [dayjs().startOf('month').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')]
  }
  const days = Number(period.value)
  return [dayjs().subtract(days - 1, 'day').format('YYYY-MM-DD'), dayjs().format('YYYY-MM-DD')]
}

async function load() {
  const [start, end] = getRange()
  try {
    const [perf, rank, comms] = await Promise.all([
      salesApi.performance(start, end),
      salesApi.ranking(start, end),
      financeApi.commissions({ page: 1, page_size: 10 }),
    ])
    performance.value = perf
    ranking.value = rank
    commissions.value = comms.items
  } catch (e) {
    /* ignore */
  }
}

function onPeriodChange(v: string) {
  period.value = v
  load()
}

onShow(load)
onMounted(load)
</script>

<style lang="scss" scoped>
.performance-page {
  min-height: 100vh;
  background: #f5f5f7;
}
.content {
  height: 100vh;
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
}
.commission-info {
  flex: 1;
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
.commission-amount {
  text-align: right;
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
