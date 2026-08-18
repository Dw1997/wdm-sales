<template>
  <view class="customers-page">
    <view class="search-bar">
      <input class="search-input" v-model="keyword" placeholder="搜索客户姓名 / 手机 / 店铺" confirm-type="search" @confirm="reload" />
      <view class="filter-btn" @tap="showFilter = !showFilter">
        <text>筛选</text>
      </view>
    </view>
    <view v-if="showFilter" class="filter-panel">
      <view class="filter-row">
        <text class="filter-label">状态</text>
        <view class="filter-tags">
          <text v-for="opt in statusOpts" :key="opt.value" class="filter-tag" :class="{ active: query.status === opt.value }" @tap="toggleStatus(opt.value)">{{ opt.label }}</text>
        </view>
      </view>
      <view class="filter-row">
        <text class="filter-label">等级</text>
        <view class="filter-tags">
          <text v-for="opt in levelOpts" :key="opt.value" class="filter-tag" :class="{ active: query.level === opt.value }" @tap="toggleLevel(opt.value)">{{ opt.label }}</text>
        </view>
      </view>
    </view>

    <scroll-view scroll-y="true" class="list" @scrolltolower="loadMore">
      <view v-if="list.length">
        <customer-card v-for="c in list" :key="c.id" :customer="c" @tap="goDetail(c.id)" @call="() => {}" />
      </view>
      <empty-state v-else-if="!loading" icon="👥" text="暂无客户" action="去推广" @action="goPromotion" />
      <view v-if="loadingMore" class="load-more">加载中...</view>
      <view v-else-if="noMore && list.length" class="load-more">没有更多了</view>
    </scroll-view>

    <view class="fab" @tap="goPromotion">
      <text class="fab-icon">+</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import CustomerCard from '@/components/CustomerCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import { customerApi } from '@/api'
import type { Customer, PageQuery } from '@/types'

const keyword = ref('')
const showFilter = ref(false)
const list = ref<Customer[]>([])
const total = ref(0)
const loading = ref(false)
const loadingMore = ref(false)
const noMore = ref(false)
const query = reactive<PageQuery>({ page: 1, page_size: 20, status: '', level: '' })

const statusOpts = [
  { label: '全部', value: '' },
  { label: '待审核', value: 'pending' },
  { label: '正常', value: 'active' },
  { label: '已禁用', value: 'disabled' },
]
const levelOpts = [
  { label: '全部', value: '' },
  { label: '青铜', value: 'bronze' },
  { label: '白银', value: 'silver' },
  { label: '黄金', value: 'gold' },
  { label: 'VIP', value: 'vip' },
]

async function reload() {
  query.page = 1
  noMore.value = false
  loading.value = true
  try {
    const res = await customerApi.list({ ...query, keyword: keyword.value })
    list.value = res.items
    total.value = res.total
    noMore.value = list.value.length >= res.total
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (loadingMore.value || noMore.value) return
  loadingMore.value = true
  try {
    const next = Number(query.page) + 1
    const res = await customerApi.list({ ...query, page: next, keyword: keyword.value })
    list.value.push(...res.items)
    query.page = next
    noMore.value = list.value.length >= res.total
  } finally {
    loadingMore.value = false
  }
}

function toggleStatus(v: string) {
  query.status = query.status === v ? '' : v
  reload()
}
function toggleLevel(v: string) {
  query.level = query.level === v ? '' : v
  reload()
}

function goDetail(id: number) {
  uni.navigateTo({ url: `/pages/customers/detail?id=${id}` })
}
function goPromotion() {
  uni.switchTab({ url: '/pages/promotion/index' })
}

onShow(reload)
onPullDownRefresh(async () => {
  await reload()
  uni.stopPullDownRefresh()
})
onMounted(reload)
</script>

<style lang="scss" scoped>
.customers-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.search-bar {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx;
  background: #fff;
}
.search-input {
  flex: 1;
  height: 72rpx;
  background: #f3f4f6;
  border-radius: 36rpx;
  padding: 0 32rpx;
  font-size: 26rpx;
}
.filter-btn {
  padding: 12rpx 24rpx;
  color: $uni-color-primary;
  font-size: 26rpx;
}
.filter-panel {
  background: #fff;
  padding: 16rpx;
  border-bottom: 2rpx solid #f3f4f6;
}
.filter-row {
  display: flex;
  align-items: center;
  margin-bottom: 12rpx;
  gap: 16rpx;
}
.filter-label {
  width: 80rpx;
  font-size: 24rpx;
  color: #6b7280;
}
.filter-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}
.filter-tag {
  padding: 6rpx 20rpx;
  border-radius: 20rpx;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 22rpx;
}
.filter-tag.active {
  background: $uni-color-primary;
  color: #fff;
}
.list {
  flex: 1;
  padding-bottom: 32rpx;
}
.fab {
  position: fixed;
  right: 32rpx;
  bottom: 160rpx;
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: $uni-color-primary;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(37, 99, 235, 0.4);
}
.fab-icon {
  font-size: 56rpx;
  font-weight: 300;
  line-height: 1;
}
</style>
