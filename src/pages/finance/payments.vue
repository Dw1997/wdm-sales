<template>
  <view class="page">
    <view class="filter-head">
      <view class="search-box">
        <input
          v-model="keyword"
          class="search-input"
          placeholder="搜索客户名 / 订单号 / 微信单号"
          confirm-type="search"
          @confirm="reload"
        />
        <text v-if="keyword" class="clear-btn" @tap="clearKeyword">✕</text>
      </view>
      <view class="tabs">
        <view
          v-for="tab in channelTabs"
          :key="tab.value"
          class="tab"
          :class="{ active: channel === tab.value }"
          @tap="selectChannel(tab.value)"
        >
          {{ tab.label }}
        </view>
      </view>
    </view>

    <scroll-view scroll-y class="list-scroll" @scrolltolower="loadMore">
      <view v-if="customerName" class="scope-tip">
        当前客户：{{ customerName }}
      </view>

      <view v-if="items.length" class="list">
        <view v-for="item in items" :key="item.id" class="card">
          <view class="card-top">
            <view class="top-left">
              <text class="cust-name">{{ item.customer_name }}</text>
              <text
                class="ch-tag"
                :class="item.channel === 'wx_miniprogram' ? 'wx' : 'off'"
              >
                {{ item.channel === 'wx_miniprogram' ? '小程序微信支付' : '线下登记' }}
              </text>
            </view>
            <text class="amt">{{ formatMoney(item.amount) }}</text>
          </view>

          <view class="meta-row">
            <text>{{ methodLabel(item.method) }} · {{ formatDate(item.paid_at) }}</text>
            <text>{{ item.operator_name || '—' }}</text>
          </view>

          <view v-if="item.wx_transaction_id" class="txn-row">
            微信单号：{{ item.wx_transaction_id }}
          </view>

          <view v-if="item.allocations && item.allocations.length" class="alloc-wrap">
            <view
              v-for="alloc in item.allocations"
              :key="`${item.id}-${alloc.order_id}`"
              class="alloc-chip"
              @tap="goOrderDetail(alloc.order_id)"
            >
              {{ alloc.order_no }}（{{ formatMoney(alloc.amount) }}）›
            </view>
          </view>

          <view v-if="item.remark" class="remark">{{ item.remark }}</view>
        </view>
      </view>

      <view v-else-if="!loading" class="empty">
        <text class="empty-txt">暂无支付记录</text>
      </view>

      <view v-if="loading" class="loading-tip">加载中...</view>
      <view v-else-if="items.length && !hasMore" class="loading-tip">没有更多了</view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { financeApi } from '@/api'
import type { PaymentRecordItem } from '@/types'
import { formatDate, formatMoney } from '@/utils/format'

const channelTabs = [
  { label: '全部', value: '' },
  { label: '小程序微信支付', value: 'wx_miniprogram' },
  { label: '线下登记', value: 'offline' },
] as const

const METHOD_MAP: Record<string, string> = {
  wechat: '微信',
  alipay: '支付宝',
  cash: '现金',
  other: '其他',
}

const customerId = ref<number | undefined>(undefined)
const customerName = ref('')
const keyword = ref('')
const channel = ref<'' | 'wx_miniprogram' | 'offline'>('')
const items = ref<PaymentRecordItem[]>([])
const page = ref(1)
const hasMore = ref(false)
const loading = ref(false)

function methodLabel(m: string): string {
  return METHOD_MAP[m] || m
}

async function fetchPage(reset: boolean) {
  if (loading.value) return
  const nextPage = reset ? 1 : page.value + 1
  loading.value = true
  try {
    const res = await financeApi.payments({
      customer_id: customerId.value,
      keyword: keyword.value.trim() || undefined,
      channel: channel.value || undefined,
      page: nextPage,
      page_size: 20,
    })
    const rows = res.items || []
    items.value = reset ? rows : items.value.concat(rows)
    page.value = nextPage
    hasMore.value = items.value.length < (res.total || 0)
  } finally {
    loading.value = false
  }
}

function reload() {
  fetchPage(true)
}

function loadMore() {
  if (!hasMore.value || loading.value) return
  fetchPage(false)
}

function selectChannel(val: '' | 'wx_miniprogram' | 'offline') {
  if (channel.value === val) return
  channel.value = val
  fetchPage(true)
}

function clearKeyword() {
  keyword.value = ''
  fetchPage(true)
}

function goOrderDetail(orderId: number) {
  uni.navigateTo({ url: `/pages/order/detail?id=${orderId}` })
}

onLoad((options) => {
  if (options?.customer_id) {
    customerId.value = Number(options.customer_id) || undefined
  }
  if (options?.customer_name) {
    customerName.value = decodeURIComponent(String(options.customer_name))
  }
  fetchPage(true)
})
</script>

<style scoped lang="scss">
.page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f6fa;
}

.filter-head {
  background: #ffffff;
  padding: 20rpx 24rpx 16rpx;
  border-bottom: 1rpx solid #ebeef5;
}

.search-box {
  display: flex;
  align-items: center;
  background: #f2f4f8;
  border-radius: 36rpx;
  padding: 12rpx 24rpx;
}

.search-input {
  flex: 1;
  font-size: 28rpx;
  color: #1f2937;
}

.clear-btn {
  font-size: 26rpx;
  color: #9ca3af;
  padding-left: 16rpx;
}

.tabs {
  display: flex;
  gap: 16rpx;
  margin-top: 16rpx;
}

.tab {
  padding: 10rpx 24rpx;
  border-radius: 28rpx;
  font-size: 26rpx;
  color: #4b5563;
  background: #f3f4f6;
}

.tab.active {
  background: #2563eb;
  color: #ffffff;
  font-weight: 600;
}

.list-scroll {
  flex: 1;
  height: 0;
}

.scope-tip {
  padding: 16rpx 24rpx 0;
  font-size: 26rpx;
  color: #2563eb;
  font-weight: 600;
}

.list {
  padding: 20rpx 24rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.card {
  background: #ffffff;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(15, 23, 42, 0.04);
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.top-left {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-wrap: wrap;
}

.cust-name {
  font-size: 30rpx;
  font-weight: 700;
  color: #111827;
}

.ch-tag {
  font-size: 22rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  font-weight: 600;
}

.ch-tag.wx {
  background: #e8f8ef;
  color: #07c160;
}

.ch-tag.off {
  background: #f3f4f6;
  color: #6b7280;
}

.amt {
  font-size: 32rpx;
  font-weight: 800;
  color: #15803d;
  flex: none;
}

.meta-row {
  margin-top: 12rpx;
  display: flex;
  justify-content: space-between;
  font-size: 24rpx;
  color: #6b7280;
}

.txn-row {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #374151;
  background: #f9fafb;
  padding: 8rpx 12rpx;
  border-radius: 8rpx;
  word-break: break-all;
}

.alloc-wrap {
  margin-top: 14rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.alloc-chip {
  font-size: 24rpx;
  color: #2563eb;
  background: #eff6ff;
  padding: 6rpx 14rpx;
  border-radius: 8rpx;
}

.remark {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #6b7280;
}

.empty {
  padding: 120rpx 0;
  text-align: center;
}

.empty-txt {
  font-size: 28rpx;
  color: #9ca3af;
}

.loading-tip {
  text-align: center;
  font-size: 24rpx;
  color: #9ca3af;
  padding: 24rpx 0 40rpx;
}
</style>
