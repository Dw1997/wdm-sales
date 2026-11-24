<template>
  <view class="detail-page">
    <scroll-view scroll-y="true" class="content">
      <view v-if="loading" class="tip">加载中…</view>

      <template v-else-if="data">
        <!-- 销售信息条 -->
        <view class="profile card">
          <view class="avatar">{{ (data.sales_name || '销').charAt(0) }}</view>
          <view class="profile-meta">
            <view class="name-row">
              <text class="name">{{ data.sales_name }}</text>
              <text class="active-tag" :class="data.is_active ? 'on' : 'off'">{{ data.is_active ? '在职' : '停用' }}</text>
            </view>
            <text class="sub">归属客户 {{ data.customer_count }} 位 · 统计截至 {{ data.as_of_date }}</text>
          </view>
        </view>

        <!-- 今日 / 本月 -->
        <view class="card block">
          <view class="block-title">今日 / 本月</view>
          <view class="period-grid">
            <view class="period-col">
              <text class="col-label">今日</text>
              <text class="col-value text-money">{{ formatMoney(data.today.sales_amount) }}</text>
              <text class="col-sub">{{ data.today.order_count }} 单</text>
            </view>
            <view class="period-col">
              <text class="col-label">本月</text>
              <text class="col-value text-money">{{ formatMoney(data.month.sales_amount) }}</text>
              <text class="col-sub">{{ data.month.order_count }} 单</text>
            </view>
          </view>
          <view class="trend" v-if="dailyBars.length">
            <view class="trend-title">本月每日销售额</view>
            <view v-for="d in dailyBars" :key="d.date" class="trend-row">
              <text class="trend-date">{{ d.label }}</text>
              <view class="trend-track"><view class="trend-fill" :style="{ width: d.width + '%' }"></view></view>
              <text class="trend-amount">{{ formatMoney(d.sales_amount, false) }}</text>
            </view>
          </view>
        </view>

        <!-- 提成四态 -->
        <view class="card block">
          <view class="block-title">提成</view>
          <view class="commission-grid">
            <view class="comm-item">
              <text class="comm-value text-warning text-money">{{ formatMoney(data.commissions.estimated_amount) }}</text>
              <text class="comm-label">预估</text>
            </view>
            <view class="comm-item">
              <text class="comm-value text-primary text-money">{{ formatMoney(data.commissions.pending_amount) }}</text>
              <text class="comm-label">待结算</text>
            </view>
            <view class="comm-item">
              <text class="comm-value text-success text-money">{{ formatMoney(data.commissions.settled_amount) }}</text>
              <text class="comm-label">已结算</text>
            </view>
            <view class="comm-item">
              <text class="comm-value text-danger text-money">{{ formatMoney(data.commissions.clawback_amount) }}</text>
              <text class="comm-label">待抵扣</text>
            </view>
          </view>
          <view v-if="toNum(data.commissions.clawback_amount) > 0" class="clawback-note">
            待抵扣 {{ formatMoney(data.commissions.clawback_amount) }}：已发放订单发生退货，下次发放时从提成中扣回。
          </view>
        </view>
      </template>

      <view v-else class="tip">{{ errorMsg || '暂无数据' }}</view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { salesApi } from '@/api'
import { formatMoney, toNum } from '@/utils/format'
import type { SalesDashboard } from '@/types'

const data = ref<SalesDashboard | null>(null)
const loading = ref(true)
const errorMsg = ref('')

const dailyBars = computed(() => {
  const list = data.value?.month.daily_sales || []
  const max = Math.max(...list.map((d) => toNum(d.sales_amount)), 1)
  return list.map((d) => ({
    date: d.date,
    label: d.date.slice(5),
    sales_amount: d.sales_amount,
    width: Math.max(Math.round((toNum(d.sales_amount) / max) * 100), toNum(d.sales_amount) > 0 ? 4 : 0),
  }))
})

onLoad((options) => {
  const id = Number(options?.id)
  const name = options?.name ? decodeURIComponent(options.name) : '销售明细'
  uni.setNavigationBarTitle({ title: name })
  if (!id) {
    loading.value = false
    errorMsg.value = '缺少销售参数'
    return
  }
  salesApi
    .dashboard(id)
    .then((res) => {
      data.value = res
    })
    .catch(() => {
      errorMsg.value = '加载失败，请返回重试'
    })
    .finally(() => {
      loading.value = false
    })
})
</script>

<style lang="scss" scoped>
.detail-page {
  min-height: 100vh;
  background: #f5f5f7;
}
.content {
  min-height: 100vh;
  padding: 16rpx 0 40rpx;
  box-sizing: border-box;
}
.tip {
  text-align: center;
  color: #9ca3af;
  font-size: 28rpx;
  padding: 120rpx 32rpx;
}
.card {
  background: #fff;
  margin: 0 16rpx 16rpx;
  border-radius: 16rpx;
  padding: 28rpx;
}
.profile {
  display: flex;
  align-items: center;
  gap: 20rpx;
}
.avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: $uni-color-primary;
  color: #fff;
  font-size: 44rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.profile-meta {
  flex: 1;
  min-width: 0;
}
.name-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.name {
  font-size: 34rpx;
  font-weight: 600;
  color: #1f2937;
}
.active-tag {
  font-size: 20rpx;
  padding: 2rpx 12rpx;
  border-radius: 20rpx;
  &.on { color: #16a34a; background: #dcfce7; }
  &.off { color: #9ca3af; background: #f3f4f6; }
}
.sub {
  display: block;
  font-size: 24rpx;
  color: #6b7280;
  margin-top: 8rpx;
}
.block-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 20rpx;
}
.period-grid {
  display: flex;
}
.period-col {
  flex: 1;
  padding: 8rpx 0;
  &:first-child { border-right: 2rpx solid #f3f4f6; }
}
.col-label {
  display: block;
  font-size: 24rpx;
  color: #9ca3af;
}
.col-value {
  display: block;
  font-size: 38rpx;
  font-weight: 600;
  color: #1f2937;
  margin: 8rpx 0;
  font-variant-numeric: tabular-nums;
}
.col-sub {
  display: block;
  font-size: 24rpx;
  color: #6b7280;
}
.trend {
  margin-top: 24rpx;
  border-top: 2rpx solid #f3f4f6;
  padding-top: 20rpx;
}
.trend-title {
  font-size: 26rpx;
  color: #6b7280;
  margin-bottom: 12rpx;
}
.trend-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 10rpx;
}
.trend-date {
  width: 90rpx;
  font-size: 22rpx;
  color: #9ca3af;
}
.trend-track {
  flex: 1;
  height: 16rpx;
  background: #f3f4f6;
  border-radius: 8rpx;
  overflow: hidden;
}
.trend-fill {
  height: 100%;
  background: linear-gradient(90deg, #2563eb, #3b82f6);
  border-radius: 8rpx;
}
.trend-amount {
  width: 130rpx;
  text-align: right;
  font-size: 22rpx;
  color: #6b7280;
  font-variant-numeric: tabular-nums;
}
.commission-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.comm-item {
  width: calc(50% - 8rpx);
  background: #f9fafb;
  border-radius: 12rpx;
  padding: 20rpx;
  box-sizing: border-box;
}
.comm-value {
  display: block;
  font-size: 34rpx;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.comm-label {
  display: block;
  font-size: 24rpx;
  color: #6b7280;
  margin-top: 8rpx;
}
.clawback-note {
  margin-top: 20rpx;
  padding: 18rpx 20rpx;
  background: #fff7ed;
  border-radius: 10rpx;
  font-size: 24rpx;
  color: #c2410c;
  line-height: 1.5;
}
</style>
