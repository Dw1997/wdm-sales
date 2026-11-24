<template>
  <view class="pq-page">
    <!-- 顶部固定：客户栏 + 搜索栏 -->
    <view class="top-sticky">
      <view v-if="selectedCustomer" class="cust-bar">
        <view class="cust-main" @tap="openPicker">
          <view class="cust-title-row">
            <text class="cust-name">{{ selectedCustomer.name }}</text>
            <text v-if="selectedCustomer.level_nickname" class="lv-tag">
              {{ selectedCustomer.level_nickname }}
            </text>
          </view>
          <text class="cust-sub">
            {{ customerLocation(selectedCustomer) || '点击切换客户' }}
          </text>
        </view>
        <view class="cust-actions">
          <view class="btn-switch" @tap="openPicker">切换</view>
          <view class="btn-contract" @tap="goExclusivePrices">专属价 ›</view>
        </view>
      </view>
      <view v-else class="cust-bar empty" @tap="openPicker">
        <view class="cust-main">
          <text class="cust-placeholder">请先选择客户</text>
          <text class="cust-sub">
            {{ auth.isAdmin ? '选择客户后查看全部 SKU 实时成交价' : '仅可查询归属自己的客户价格' }}
          </text>
        </view>
        <view class="btn-pick">选客户</view>
      </view>

      <view class="search-bar">
        <view class="search-box">
          <text class="search-ico">🔍</text>
          <input
            v-model="keyword"
            class="search-input"
            placeholder="搜商品名 / 商品编码 / 条码"
            confirm-type="search"
            :disabled="!selectedCustomer"
            @input="onKeywordInput"
            @confirm="onKeywordConfirm"
          />
          <view v-if="keyword" class="clear-btn" @tap="onClearKeyword">×</view>
        </view>
      </view>
    </view>

    <!-- 未选客户空态 -->
    <view v-if="!selectedCustomer" class="empty-box">
      <empty-state icon="🏷️" text="请先选择客户，查看该客户各规格成交价" padding="120rpx 40rpx 40rpx" />
      <view class="empty-pick-btn" @tap="openPicker">选择客户</view>
    </view>

    <!-- 已选客户：独立滚动结果区 -->
    <view v-else class="scroll-wrap">
      <scroll-view
        scroll-y
        class="list-scroll"
        :lower-threshold="120"
        :refresher-enabled="true"
        :refresher-triggered="refreshing"
        @refresherrefresh="onRefresh"
        @scrolltolower="onLoadMore"
      >
        <view class="body">
          <view class="summary-bar">
            <text class="summary-txt">共 {{ total }} 个规格</text>
            <text class="summary-hint">点击条目展开完整价格链</text>
          </view>

          <view v-if="loading && !rows.length" class="state-tip">加载中...</view>
          <empty-state
            v-else-if="!loading && !rows.length"
            icon="📦"
            :text="keyword.trim() ? '没有符合条件的规格' : '暂无商品规格'"
            padding="100rpx 32rpx"
          />

          <view v-else class="list">
            <view
              v-for="row in rows"
              :key="row.sku_id"
              class="price-card"
              :class="{ disabled: !row.is_enabled, expanded: !!expandedMap[row.sku_id] }"
              @tap="toggleExpand(row.sku_id)"
            >
              <view class="card-main">
                <view class="left">
                  <view class="spu-row">
                    <text class="spu-name">{{ row.spu_name }}</text>
                    <text v-if="!row.is_enabled" class="tag-disabled">已停用</text>
                  </view>
                  <view class="spec-row">
                    <text class="spec-txt">{{ row.sku_spec || '—' }}</text>
                    <text v-if="row.spu_code" class="code-txt">{{ row.spu_code }}</text>
                  </view>
                </view>
                <view class="right">
                  <text class="unit-price" :class="{ danger: row.below_min }">
                    {{ formatMoney(row.unit_price) }}
                  </text>
                  <text v-if="row.below_min" class="below-tag">低于最低售价</text>
                </view>
              </view>

              <view class="card-meta">
                <text class="source-tag" :class="`src-${sourceMeta(row.price_source).type}`">
                  {{ sourceMeta(row.price_source).label }}
                </text>
                <text class="set-at">
                  {{ row.price_source_set_at ? `设定 ${formatDate(row.price_source_set_at)}` : '—' }}
                </text>
                <text class="expand-arrow">{{ expandedMap[row.sku_id] ? '收起 ▴' : '详情 ▾' }}</text>
              </view>

              <view v-if="expandedMap[row.sku_id]" class="detail-grid" @tap.stop>
                <view class="detail-cell">
                  <text class="dk">建议零售价</text>
                  <text class="dv">{{ formatMoney(row.suggested_price) }}</text>
                </view>
                <view class="detail-cell">
                  <text class="dk">等级价</text>
                  <text class="dv">{{ formatMoney(row.level_price) }}</text>
                </view>
                <view class="detail-cell">
                  <text class="dk">最低售价</text>
                  <text class="dv" :class="{ warn: row.below_min }">{{ formatMoney(row.min_price) }}</text>
                </view>
                <view
                  v-if="auth.isAdmin && row.cost_price !== null && row.cost_price !== undefined"
                  class="detail-cell"
                >
                  <text class="dk">成本价</text>
                  <text class="dv">{{ formatMoney(row.cost_price) }}</text>
                </view>
                <view class="detail-cell">
                  <text class="dk">换算关系</text>
                  <text class="dv">1 个 = {{ formatQty(row.base_qty) }} {{ row.base_unit }}</text>
                </view>
                <view class="detail-cell">
                  <text class="dk">数量小数</text>
                  <text class="dv">{{ row.allow_decimal ? '允许' : '不允许' }}</text>
                </view>
              </view>
            </view>

            <view class="list-foot">
              <text v-if="loading">加载中...</text>
              <text v-else-if="hasMore">上拉加载更多</text>
              <text v-else>已显示全部 {{ total }} 条</text>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 客户选择底部弹层 -->
    <view v-if="pickerOpen" class="mask" @tap="closePicker">
      <view class="sheet" @tap.stop>
        <view class="sheet-hd">
          <view>
            <text class="sheet-title">选择客户</text>
            <text v-if="!auth.isAdmin" class="sheet-sub">仅显示归属自己的客户</text>
          </view>
          <text class="sheet-close" @tap="closePicker">✕</text>
        </view>
        <view class="sheet-search">
          <input
            v-model="pickerKeyword"
            class="sheet-input"
            placeholder="搜客户名称 / 联系人 / 电话"
            confirm-type="search"
            @input="onPickerSearchInput"
            @confirm="reloadCustomers"
          />
          <view v-if="pickerKeyword" class="clear-btn" @tap="clearPickerKeyword">×</view>
        </view>
        <scroll-view scroll-y class="sheet-list" @scrolltolower="loadMoreCustomers">
          <view v-if="pickerLoading && !pickerCustomers.length" class="state-tip">加载客户中...</view>
          <empty-state
            v-else-if="!pickerLoading && !pickerCustomers.length"
            icon="👥"
            text="没有匹配的客户"
            padding="60rpx 24rpx"
          />
          <view
            v-for="c in pickerCustomers"
            :key="c.id"
            class="cust-opt"
            :class="{ active: selectedCustomer?.id === c.id }"
            @tap="selectCustomer(c)"
          >
            <view class="opt-top">
              <text class="opt-name">{{ c.name }}</text>
              <text v-if="c.level_nickname" class="opt-lv">{{ c.level_nickname }}</text>
            </view>
            <view class="opt-sub">
              <text v-if="customerLocation(c)">{{ customerLocation(c) }}</text>
              <text v-if="c.phone">{{ c.phone }}</text>
              <text v-if="auth.isAdmin && c.sales_name">归属 {{ c.sales_name }}</text>
            </view>
          </view>
          <view v-if="pickerCustomers.length" class="list-foot">
            <text v-if="pickerLoading">加载中...</text>
            <text v-else-if="pickerHasMore">上拉加载更多</text>
            <text v-else>没有更多客户了</text>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { customerApi, priceApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import type { Customer, CustomerPriceRow, PriceSource } from '@/types'
import { PRICE_SOURCE } from '@/utils/dict'
import { formatDate, formatMoney, formatQty } from '@/utils/format'

const auth = useAuthStore()

const PAGE_SIZE = 20

const selectedCustomer = ref<Customer | null>(null)
const keyword = ref('')
const rows = ref<CustomerPriceRow[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const refreshing = ref(false)
const expandedMap = ref<Record<number, boolean>>({})

const hasMore = computed(() => rows.value.length < total.value)

let searchTimer: ReturnType<typeof setTimeout> | null = null

// ---------- 客户选择弹层 ----------
const pickerOpen = ref(false)
const pickerKeyword = ref('')
const pickerCustomers = ref<Customer[]>([])
const pickerPage = ref(1)
const pickerHasMore = ref(true)
const pickerLoading = ref(false)
let pickerTimer: ReturnType<typeof setTimeout> | null = null

function customerLocation(c: Customer): string {
  return [c.town || c.district || c.city, c.contact_name].filter(Boolean).join(' · ')
}

function sourceMeta(source: PriceSource) {
  return PRICE_SOURCE[source] || { label: source, type: 'grey' as const }
}

function toggleExpand(skuId: number) {
  expandedMap.value = {
    ...expandedMap.value,
    [skuId]: !expandedMap.value[skuId],
  }
}

async function fetchPrices(reset: boolean) {
  if (!selectedCustomer.value) return
  if (loading.value) return
  if (!reset && !hasMore.value) return

  const targetPage = reset ? 1 : page.value + 1
  loading.value = true
  try {
    const kw = keyword.value.trim()
    const res = await priceApi.customerPrices({
      customer_id: selectedCustomer.value.id,
      ...(kw ? { keyword: kw } : {}),
      page: targetPage,
      page_size: PAGE_SIZE,
    })
    if (reset) {
      rows.value = res.items
      expandedMap.value = {}
    } else {
      rows.value = rows.value.concat(res.items)
    }
    total.value = res.total
    page.value = res.page
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code
    if (code === 'forbidden' || code === 'not_found') {
      selectedCustomer.value = null
      rows.value = []
      total.value = 0
    }
  } finally {
    loading.value = false
  }
}

function onKeywordInput() {
  if (!selectedCustomer.value) return
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    fetchPrices(true)
  }, 300)
}

function onKeywordConfirm() {
  if (!selectedCustomer.value) return
  if (searchTimer) clearTimeout(searchTimer)
  fetchPrices(true)
}

function onClearKeyword() {
  keyword.value = ''
  if (searchTimer) clearTimeout(searchTimer)
  fetchPrices(true)
}

async function fetchCustomers(reset: boolean) {
  if (pickerLoading.value) return
  if (!reset && !pickerHasMore.value) return
  const targetPage = reset ? 1 : pickerPage.value + 1
  pickerLoading.value = true
  try {
    const kw = pickerKeyword.value.trim()
    const list = await customerApi.list({
      ...(kw ? { keyword: kw } : {}),
      page: targetPage,
      page_size: PAGE_SIZE,
    })
    if (reset) {
      pickerCustomers.value = list
    } else {
      pickerCustomers.value = pickerCustomers.value.concat(list)
    }
    pickerPage.value = targetPage
    pickerHasMore.value = list.length >= PAGE_SIZE
  } finally {
    pickerLoading.value = false
  }
}

function openPicker() {
  pickerOpen.value = true
  if (!pickerCustomers.value.length) {
    fetchCustomers(true)
  }
}

function closePicker() {
  pickerOpen.value = false
}

function reloadCustomers() {
  if (pickerTimer) clearTimeout(pickerTimer)
  pickerHasMore.value = true
  fetchCustomers(true)
}

function onPickerSearchInput() {
  if (pickerTimer) clearTimeout(pickerTimer)
  pickerTimer = setTimeout(() => {
    pickerHasMore.value = true
    fetchCustomers(true)
  }, 250)
}

function clearPickerKeyword() {
  pickerKeyword.value = ''
  reloadCustomers()
}

function loadMoreCustomers() {
  fetchCustomers(false)
}

function selectCustomer(c: Customer) {
  selectedCustomer.value = c
  pickerOpen.value = false
  fetchPrices(true)
}

function goExclusivePrices() {
  if (!selectedCustomer.value) return
  uni.navigateTo({ url: `/pages/customers/prices?customer_id=${selectedCustomer.value.id}` })
}

async function initByCustomerId(id: number) {
  try {
    selectedCustomer.value = await customerApi.get(id)
    await fetchPrices(true)
  } catch {
    selectedCustomer.value = null
    uni.showToast({ title: '无权查询该客户，请重新选择', icon: 'none' })
  }
}

onLoad((options) => {
  const id = Number(options?.customer_id)
  if (id > 0) {
    initByCustomerId(id)
  }
})

async function onRefresh() {
  if (!selectedCustomer.value) return
  refreshing.value = true
  try {
    await fetchPrices(true)
  } finally {
    refreshing.value = false
  }
}

function onLoadMore() {
  if (selectedCustomer.value && hasMore.value && !loading.value) {
    fetchPrices(false)
  }
}
</script>

<style lang="scss" scoped>
/* 锁死整页视口，顶部客户栏和搜索栏始终固定在顶部，仅下方价格列表滚动 */
.pq-page {
  position: fixed;
  top: var(--window-top, 0px);
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  background: #f5f6f8;
  overflow: hidden;
}

.top-sticky {
  flex: none;
  z-index: 10;
  background: #fff;
  border-bottom: 1rpx solid #edf0f5;
  box-shadow: 0 4rpx 14rpx rgba(22, 35, 58, 0.05);
}

.scroll-wrap {
  flex: 1;
  min-height: 0;
  position: relative;
}

.list-scroll {
  width: 100%;
  height: 100%;
}

/* 客户栏 */
.cust-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 20rpx 24rpx 14rpx;
}
.cust-bar.empty {
  background: #f0f6ff;
}
.cust-main {
  flex: 1;
  min-width: 0;
}
.cust-title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-wrap: wrap;
}
.cust-name {
  font-size: 30rpx;
  font-weight: 700;
  color: #1f2937;
}
.cust-placeholder {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: $uni-color-primary;
}
.lv-tag {
  font-size: 20rpx;
  padding: 2rpx 12rpx;
  border-radius: 8rpx;
  background: #eef4ff;
  color: $uni-color-primary;
  font-weight: 500;
}
.cust-sub {
  display: block;
  margin-top: 4rpx;
  font-size: 22rpx;
  color: #8894a5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cust-actions {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex: none;
}
.btn-switch {
  font-size: 23rpx;
  color: #4b5563;
  background: #f3f5f8;
  padding: 10rpx 20rpx;
  border-radius: 28rpx;
}
.btn-contract {
  font-size: 23rpx;
  color: $uni-color-primary;
  background: #eef4ff;
  padding: 10rpx 20rpx;
  border-radius: 28rpx;
  font-weight: 500;
}
.btn-pick {
  flex: none;
  font-size: 24rpx;
  color: #fff;
  background: $uni-color-primary;
  padding: 12rpx 26rpx;
  border-radius: 30rpx;
  font-weight: 500;
}

/* 搜索栏 */
.search-bar {
  padding: 8rpx 24rpx 18rpx;
}
.search-box {
  display: flex;
  align-items: center;
  gap: 12rpx;
  height: 70rpx;
  padding: 0 22rpx;
  border-radius: 35rpx;
  background: #f3f5f8;
}
.search-ico {
  font-size: 26rpx;
  color: #9ca3af;
}
.search-input {
  flex: 1;
  font-size: 26rpx;
  color: #1f2937;
}
.clear-btn {
  width: 38rpx;
  height: 38rpx;
  border-radius: 50%;
  background: #d1d5db;
  color: #fff;
  font-size: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
}

/* 空态 */
.empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.empty-pick-btn {
  padding: 18rpx 56rpx;
  border-radius: 40rpx;
  background: $uni-color-primary;
  color: #fff;
  font-size: 28rpx;
  font-weight: 600;
}

/* 主体 */
.body {
  padding: 16rpx 20rpx 40rpx;
}
.summary-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4rpx 8rpx 14rpx;
}
.summary-txt {
  font-size: 23rpx;
  color: #4b5563;
  font-weight: 500;
}
.summary-hint {
  font-size: 21rpx;
  color: #9ca3af;
}
.state-tip {
  text-align: center;
  padding: 80rpx 0;
  font-size: 26rpx;
  color: #9ca3af;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.price-card {
  background: #fff;
  border-radius: 18rpx;
  padding: 22rpx 24rpx;
  box-shadow: 0 4rpx 14rpx rgba(22, 35, 58, 0.04);
}
.price-card.disabled {
  opacity: 0.72;
}
.card-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}
.left {
  flex: 1;
  min-width: 0;
}
.spu-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
  flex-wrap: wrap;
}
.spu-name {
  font-size: 29rpx;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.35;
}
.tag-disabled {
  font-size: 19rpx;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
  background: #f3f4f6;
  color: #6b7280;
}
.spec-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 8rpx;
  flex-wrap: wrap;
}
.spec-txt {
  font-size: 24rpx;
  color: #4b5563;
}
.code-txt {
  font-size: 21rpx;
  color: #9ca3af;
}
.right {
  flex: none;
  text-align: right;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.unit-price {
  font-size: 34rpx;
  font-weight: 700;
  color: $uni-color-primary;
  line-height: 1.2;
}
.unit-price.danger {
  color: #dc2626;
}
.below-tag {
  margin-top: 6rpx;
  font-size: 19rpx;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
  background: #fef2f2;
  color: #dc2626;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 16rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid #f1f4f8;
}
.source-tag {
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  font-weight: 500;
}
.source-tag.src-success {
  background: #e8f8ee;
  color: #15803d;
}
.source-tag.src-primary {
  background: #eef4ff;
  color: $uni-color-primary;
}
.source-tag.src-info {
  background: #e0f2fe;
  color: #0369a1;
}
.source-tag.src-grey {
  background: #f3f4f6;
  color: #4b5563;
}
.set-at {
  flex: 1;
  font-size: 21rpx;
  color: #9ca3af;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.expand-arrow {
  flex: none;
  font-size: 21rpx;
  color: #8894a5;
}

/* 展开价格链 */
.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14rpx 20rpx;
  margin-top: 16rpx;
  padding: 18rpx 20rpx;
  border-radius: 12rpx;
  background: #f8fafc;
}
.detail-cell {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.dk {
  font-size: 21rpx;
  color: #8894a5;
}
.dv {
  font-size: 25rpx;
  font-weight: 600;
  color: #1f2937;
}
.dv.warn {
  color: #dc2626;
}

.list-foot {
  text-align: center;
  padding: 24rpx 0 12rpx;
  font-size: 22rpx;
  color: #9ca3af;
}

/* 客户选择弹层 */
.mask {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}
.sheet {
  background: #fff;
  border-radius: 28rpx 28rpx 0 0;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.sheet-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 28rpx 16rpx;
}
.sheet-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #1f2937;
}
.sheet-sub {
  display: block;
  margin-top: 4rpx;
  font-size: 22rpx;
  color: #8894a5;
}
.sheet-close {
  font-size: 34rpx;
  color: #9ca3af;
  padding: 8rpx 12rpx;
}
.sheet-search {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin: 0 24rpx 14rpx;
  padding: 0 22rpx;
  height: 70rpx;
  border-radius: 35rpx;
  background: #f3f5f8;
}
.sheet-input {
  flex: 1;
  font-size: 26rpx;
  color: #1f2937;
}
.sheet-list {
  flex: 1;
  height: 60vh;
  padding: 0 24rpx 28rpx;
  box-sizing: border-box;
}
.cust-opt {
  padding: 22rpx 16rpx;
  border-bottom: 1rpx solid #f1f4f8;
}
.cust-opt.active {
  background: #f0f6ff;
  border-radius: 12rpx;
}
.opt-top {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.opt-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #1f2937;
}
.opt-lv {
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 8rpx;
  background: #eef4ff;
  color: $uni-color-primary;
}
.opt-sub {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #8894a5;
}
</style>
