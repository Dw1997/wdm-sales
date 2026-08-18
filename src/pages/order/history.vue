<template>
  <view class="order-history-page">
    <view class="filter-bar">
      <view class="status-tabs">
        <text v-for="opt in statusOpts" :key="opt.value" class="status-tab" :class="{ active: query.status === opt.value }" @tap="onStatusChange(opt.value)">{{ opt.label }}</text>
      </view>
    </view>
    <scroll-view scroll-y="true" class="list" @scrolltolower="loadMore">
      <view v-if="list.length">
        <order-card v-for="order in list" :key="order.id" :order="order" @tap="goDetail(order.id)" />
      </view>
      <empty-state v-else-if="!loading" icon="📋" text="暂无订单" padding="120rpx 32rpx" />
      <view v-if="loadingMore" class="load-more">加载中...</view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import OrderCard from '@/components/OrderCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import { orderApi } from '@/api'
import type { Order, PageQuery } from '@/types'

const list = ref<Order[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const customerId = ref(0)
const query = reactive<PageQuery>({ page: 1, page_size: 20, status: '' })

const statusOpts = [
  { label: '全部', value: '' },
  { label: '待审核', value: 'pending_audit' },
  { label: '待分拣', value: 'paid' },
  { label: '已发货', value: 'shipped' },
  { label: '已完成', value: 'completed' },
]

async function reload() {
  query.page = 1
  loading.value = true
  try {
    const q: PageQuery = { ...query }
    if (customerId.value) q.customer_id = customerId.value
    const res = await orderApi.list(q)
    list.value = res.items
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (loadingMore.value) return
  loadingMore.value = true
  try {
    const next = Number(query.page) + 1
    const q: PageQuery = { ...query, page: next }
    if (customerId.value) q.customer_id = customerId.value
    const res = await orderApi.list(q)
    list.value.push(...res.items)
    query.page = next
  } finally {
    loadingMore.value = false
  }
}

function onStatusChange(v: string) {
  query.status = v
  reload()
}

function goDetail(id: string) {
  uni.navigateTo({ url: `/pages/order/detail?id=${id}` })
}

onLoad((opts: any) => {
  if (opts?.customer_id) customerId.value = Number(opts.customer_id)
  reload()
})

onShow(reload)
</script>

<style lang="scss" scoped>
.order-history-page {
  min-height: 100vh;
  background: #f5f5f7;
  display: flex;
  flex-direction: column;
}
.filter-bar {
  background: #fff;
  padding: 16rpx;
  border-bottom: 2rpx solid #f3f4f6;
}
.status-tabs {
  display: flex;
  gap: 8rpx;
  overflow-x: auto;
}
.status-tab {
  flex: 1;
  text-align: center;
  padding: 12rpx 16rpx;
  background: #f3f4f6;
  border-radius: 24rpx;
  font-size: 24rpx;
  color: #6b7280;
  white-space: nowrap;
}
.status-tab.active {
  background: $uni-color-primary;
  color: #fff;
}
.list {
  flex: 1;
}
</style>
