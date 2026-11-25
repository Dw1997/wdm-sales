<template>
  <view class="vp-page">
    <view v-if="!auth.isAdmin" class="no-auth">
      <text class="no-auth-icon">🔒</text>
      <text class="no-auth-title">无权限访问</text>
      <text class="no-auth-desc">供应商付款功能仅管理员可用</text>
      <button class="btn-primary no-auth-btn" @tap="goBack">返回</button>
    </view>

    <block v-else>
      <!-- 汇总 -->
      <view class="summary-card">
        <view class="summary-main">
          <text class="summary-label">当前总应付</text>
          <text class="summary-amount">{{ formatMoney(totalPayable) }}</text>
        </view>
        <view class="summary-side">
          <text class="summary-owed">{{ owedCount }} 家</text>
          <text class="summary-owed-label">欠款供应商</text>
        </view>
      </view>

      <!-- 搜索与筛选 -->
      <view class="filter-bar">
        <view class="search-wrap">
          <text class="search-icon">🔍</text>
          <input
            v-model="keyword"
            class="search-input"
            placeholder="搜索名称 / 手机号 / 联系人"
            placeholder-class="search-placeholder"
            confirm-type="search"
            @confirm="onSearchConfirm"
          />
          <text v-if="keyword" class="search-clear" @tap="clearKeyword">×</text>
        </view>

        <view class="filter-row">
          <scroll-view scroll-x class="filter-scroll" :show-scrollbar="false">
            <view class="filter-line">
              <view class="pill" :class="{ on: onlyOwed }" @tap="toggleOwed">仅看欠款</view>
              <view
                v-for="opt in typeOpts"
                :key="opt.value || 'all'"
                class="pill"
                :class="{ on: type === opt.value }"
                @tap="setType(opt.value)"
              >{{ opt.label }}</view>
            </view>
          </scroll-view>
          <view class="sort-pill" @tap="toggleSort">
            {{ sortLabel }}<text class="sort-arrow">{{ orderBy === 'payable_desc' ? '↓' : '↑' }}</text>
          </view>
        </view>
      </view>

      <!-- 列表 -->
      <view class="list">
        <view v-if="loading && !list.length" class="page-loading">加载中...</view>

        <block v-else-if="list.length">
          <view v-for="item in list" :key="item.vendor_id" class="vc">
            <view class="vc-hd">
              <view class="vc-main">
                <view class="vc-title">
                  <text class="vc-name">{{ item.name }}</text>
                  <text class="tag" :class="`tag-${vendorMeta(item).type}`">
                    {{ vendorMeta(item).label }}
                  </text>
                </view>
                <text v-if="contactText(item)" class="vc-contact">{{ contactText(item) }}</text>
              </view>
              <view class="vc-balance">
                <text class="vcb-label">当前应付</text>
                <text class="vcb-value" :class="balanceClass(item)">{{ balanceText(item) }}</text>
              </view>
            </view>

            <view class="vc-last">
              最近付款 {{ item.last_paid_at ? formatDate(item.last_paid_at, 'YYYY-MM-DD') : '—' }}
            </view>

            <view class="vc-actions">
              <button class="vc-btn ghost" @tap="goLedger(item)">看往来</button>
              <button class="vc-btn primary" @tap="openPay(item)">付款</button>
            </view>
          </view>
        </block>

        <empty-state
          v-else-if="!loading"
          icon="💳"
          :text="hasActiveFilters ? '当前筛选条件下暂无供应商' : '暂无供应商应付记录'"
          :action="hasActiveFilters ? '重置筛选' : ''"
          @action="onEmptyAction"
        />

        <view v-if="loadingMore" class="load-more">加载中...</view>
        <view v-else-if="noMore && list.length" class="load-more">没有更多了</view>
      </view>
    </block>

    <vendor-pay-sheet
      :visible="payVisible"
      :vendor-id="payTarget?.vendor_id ?? 0"
      :vendor-name="payTarget?.name ?? ''"
      :payable-balance="payTarget?.payable_balance ?? 0"
      @close="payVisible = false"
      @paid="onPaid"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import VendorPaySheet from '@/components/VendorPaySheet.vue'
import { useAuthStore } from '@/stores/auth'
import { vendorFinanceApi } from '@/api'
import { VENDOR_TYPE } from '@/utils/dict'
import { formatDate, formatMoney, toNum } from '@/utils/format'
import type { VendorPayableItem, VendorPaymentResult, VendorType } from '@/types'

const auth = useAuthStore()

const list = ref<VendorPayableItem[]>([])
const totalPayable = ref(0)
const owedCount = ref(0)
const loading = ref(false)
const loadingMore = ref(false)
const noMore = ref(false)
const page = ref(1)
const PAGE_SIZE = 20
let listSeq = 0

const keyword = ref('')
const onlyOwed = ref(false)
const type = ref<VendorType | ''>('')
const orderBy = ref<'payable_desc' | 'payable_asc'>('payable_desc')

const typeOpts: { label: string; value: VendorType | '' }[] = [
  { label: '全部', value: '' },
  { label: VENDOR_TYPE.market.label, value: 'market' },
  { label: VENDOR_TYPE.origin.label, value: 'origin' },
  { label: VENDOR_TYPE.manufacturer.label, value: 'manufacturer' },
]

const sortLabel = computed(() =>
  orderBy.value === 'payable_desc' ? '应付从高到低' : '应付从低到高',
)
const hasActiveFilters = computed(
  () => !!keyword.value.trim() || onlyOwed.value || type.value !== '',
)

function vendorMeta(item: VendorPayableItem) {
  return VENDOR_TYPE[item.type] || { label: item.type, type: 'grey' }
}

function balanceClass(item: VendorPayableItem) {
  const bal = toNum(item.payable_balance)
  if (bal > 0) return 'owed'
  if (bal < 0) return 'prepaid'
  return 'settled'
}

function balanceText(item: VendorPayableItem) {
  const bal = toNum(item.payable_balance)
  if (bal > 0) return formatMoney(bal)
  if (bal < 0) return `预付 ${formatMoney(-bal)}`
  return '已结清'
}

function contactText(item: VendorPayableItem) {
  return [item.contact_name, item.contact_phone || item.phone].filter(Boolean).join(' · ')
}

/* ---------- 列表 ---------- */

function fetchPage(pageNo: number) {
  return vendorFinanceApi.payables({
    page: pageNo,
    page_size: PAGE_SIZE,
    keyword: keyword.value.trim() || undefined,
    type: type.value || undefined,
    only_owed: onlyOwed.value || undefined,
    order_by: orderBy.value,
  })
}

async function reload() {
  const seq = ++listSeq
  page.value = 1
  noMore.value = false
  loading.value = true
  try {
    const res = await fetchPage(1)
    if (seq !== listSeq) return
    list.value = res.items
    totalPayable.value = toNum(res.total_payable)
    owedCount.value = res.owed_count
    noMore.value = list.value.length >= res.total
  } catch {
    /* request 层已提示 */
  } finally {
    if (seq === listSeq) loading.value = false
  }
}

async function loadMore() {
  if (loading.value || loadingMore.value || noMore.value || !list.value.length) return
  const seq = listSeq
  loadingMore.value = true
  try {
    const next = page.value + 1
    const res = await fetchPage(next)
    if (seq !== listSeq) return
    list.value.push(...res.items)
    page.value = next
    noMore.value = list.value.length >= res.total
  } catch {
    /* request 层已提示 */
  } finally {
    loadingMore.value = false
  }
}

/* ---------- 搜索与筛选 ---------- */

let searchTimer: ReturnType<typeof setTimeout> | undefined
let suppressSearch = false

watch(keyword, () => {
  if (suppressSearch) {
    suppressSearch = false
    return
  }
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    if (auth.isAdmin) void reload()
  }, 300)
})

function onSearchConfirm() {
  if (searchTimer) clearTimeout(searchTimer)
  void reload()
}

function clearKeyword() {
  if (!keyword.value) return
  if (searchTimer) clearTimeout(searchTimer)
  suppressSearch = true
  keyword.value = ''
  void reload()
}

function toggleOwed() {
  onlyOwed.value = !onlyOwed.value
  void reload()
}

function setType(v: VendorType | '') {
  if (type.value === v) return
  type.value = v
  void reload()
}

function toggleSort() {
  orderBy.value = orderBy.value === 'payable_desc' ? 'payable_asc' : 'payable_desc'
  void reload()
}

function resetFilters() {
  if (searchTimer) clearTimeout(searchTimer)
  suppressSearch = !!keyword.value
  keyword.value = ''
  onlyOwed.value = false
  type.value = ''
  orderBy.value = 'payable_desc'
  void reload()
}

function onEmptyAction() {
  if (hasActiveFilters.value) resetFilters()
}

/* ---------- 付款 ---------- */

const payVisible = ref(false)
const payTarget = ref<VendorPayableItem | null>(null)

function openPay(item: VendorPayableItem) {
  payTarget.value = item
  payVisible.value = true
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function onPaid(res: VendorPaymentResult) {
  const item = list.value.find((v) => v.vendor_id === payTarget.value?.vendor_id)
  if (!item) return

  const oldBal = toNum(item.payable_balance)
  const newBal = toNum(res.payable_balance)

  item.payable_balance = res.payable_balance
  item.last_paid_at = res.payment?.paid_at || item.last_paid_at

  const delta = Math.max(oldBal, 0) - Math.max(newBal, 0)
  if (delta !== 0) {
    totalPayable.value = Math.max(0, round2(totalPayable.value - delta))
  }
  if (oldBal > 0 && newBal <= 0) {
    owedCount.value = Math.max(0, owedCount.value - 1)
  } else if (oldBal <= 0 && newBal > 0) {
    owedCount.value += 1
  }
}

/* ---------- 导航与生命周期 ---------- */

function goLedger(item: VendorPayableItem) {
  uni.navigateTo({
    url: `/pages/purchase/vendor-ledger?vendorId=${item.vendor_id}&vendorName=${encodeURIComponent(item.name)}`,
  })
}

function goBack() {
  uni.navigateBack({
    fail: () => uni.switchTab({ url: '/pages/me/index' }),
  })
}

let firstShow = true

onLoad(() => {
  if (auth.isAdmin) void reload()
})

onShow(() => {
  if (firstShow) {
    firstShow = false
    return
  }
  if (auth.isAdmin) void reload()
})

onPullDownRefresh(async () => {
  try {
    if (auth.isAdmin) await reload()
  } finally {
    uni.stopPullDownRefresh()
  }
})

onReachBottom(loadMore)
</script>

<style lang="scss" scoped>
.vp-page {
  min-height: 100vh;
  background: #f5f7fa;
}

/* 无权限 */
.no-auth {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 56rpx;
}
.no-auth-icon {
  font-size: 96rpx;
  margin-bottom: 20rpx;
}
.no-auth-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1f2937;
}
.no-auth-desc {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #9ca3af;
}
.no-auth-btn {
  width: 100%;
  margin-top: 48rpx;
}

/* 汇总卡 */
.summary-card {
  display: flex;
  align-items: center;
  margin: 20rpx 20rpx 0;
  padding: 28rpx 30rpx;
  border-radius: 22rpx;
  background: linear-gradient(135deg, #2563eb 0%, #3b82f6 55%, #60a5fa 100%);
  box-shadow: 0 10rpx 24rpx rgba(37, 99, 235, 0.18);
  color: #fff;
}
.summary-main {
  flex: 1;
  min-width: 0;
}
.summary-label {
  display: block;
  font-size: 22rpx;
  opacity: 0.82;
}
.summary-amount {
  display: block;
  margin-top: 8rpx;
  font-size: 48rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
  font-variant-numeric: tabular-nums;
}
.summary-side {
  flex: none;
  text-align: right;
  padding-left: 24rpx;
  border-left: 1rpx solid rgba(255, 255, 255, 0.24);
}
.summary-owed {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.summary-owed-label {
  display: block;
  margin-top: 6rpx;
  font-size: 21rpx;
  opacity: 0.82;
}

/* 搜索与筛选 */
.filter-bar {
  margin-top: 20rpx;
  background: #fff;
  box-shadow: 0 4rpx 14rpx rgba(22, 35, 58, 0.04);
}
.search-wrap {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin: 18rpx 20rpx 0;
  padding: 0 20rpx;
  height: 74rpx;
  background: #f3f5f8;
  border-radius: 14rpx;
}
.search-icon {
  font-size: 24rpx;
  opacity: 0.6;
}
.search-input {
  flex: 1;
  font-size: 26rpx;
  color: #1f2937;
}
.search-placeholder {
  font-size: 25rpx;
  color: #a3aebd;
}
.search-clear {
  font-size: 32rpx;
  color: #9ca3af;
  padding: 0 6rpx;
}
.filter-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 14rpx 20rpx 16rpx;
}
.filter-scroll {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
}
.filter-line {
  display: inline-flex;
  align-items: center;
  gap: 10rpx;
}
.pill {
  flex: none;
  padding: 9rpx 20rpx;
  border-radius: 24rpx;
  background: #f2f5f9;
  color: #5f6d82;
  font-size: 23rpx;
  line-height: 1.5;
}
.pill.on {
  background: rgba(37, 99, 235, 0.1);
  color: $uni-color-primary;
  font-weight: 600;
}
.sort-pill {
  flex: none;
  padding: 9rpx 16rpx;
  border-radius: 24rpx;
  background: rgba(37, 99, 235, 0.08);
  color: $uni-color-primary;
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1.5;
}
.sort-arrow {
  margin-left: 6rpx;
}

/* 列表 */
.list {
  padding: 4rpx 0 40rpx;
}
.page-loading {
  text-align: center;
  padding: 80rpx 0;
  font-size: 24rpx;
  color: #a3aebd;
}
.vc {
  background: #fff;
  border-radius: 18rpx;
  padding: 22rpx;
  margin: 14rpx 20rpx 0;
  box-shadow: 0 4rpx 14rpx rgba(22, 35, 58, 0.05);
}
.vc-hd {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
}
.vc-main {
  flex: 1;
  min-width: 0;
}
.vc-title {
  display: flex;
  align-items: center;
  gap: 10rpx;
  min-width: 0;
}
.vc-name {
  font-size: 29rpx;
  font-weight: 600;
  color: #1f2937;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.tag {
  flex: none;
  font-size: 19rpx;
  font-weight: 600;
  padding: 3rpx 12rpx;
  border-radius: 6rpx;
}
.tag-primary {
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
}
.tag-success {
  background: rgba(22, 163, 74, 0.1);
  color: #16a34a;
}
.tag-info {
  background: rgba(14, 116, 144, 0.1);
  color: #0e7490;
}
.tag-grey {
  background: #f1f5f9;
  color: #64748b;
}
.vc-contact {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #8d99aa;
}
.vc-balance {
  flex: none;
  text-align: right;
}
.vcb-label {
  display: block;
  font-size: 20rpx;
  color: #9ca3af;
}
.vcb-value {
  display: block;
  margin-top: 4rpx;
  font-size: 30rpx;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  &.owed {
    color: #dc2626;
  }
  &.settled {
    color: #9ca3af;
  }
  &.prepaid {
    color: #16a34a;
  }
}
.vc-last {
  margin-top: 12rpx;
  font-size: 21rpx;
  color: #a3aebd;
}
.vc-actions {
  display: flex;
  gap: 14rpx;
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #f4f7fa;
}
.vc-btn {
  flex: 1;
  height: 68rpx;
  line-height: 68rpx;
  margin: 0;
  border-radius: 12rpx;
  font-size: 25rpx;
  font-weight: 600;
  &::after {
    border: none;
  }
  &.ghost {
    background: #f2f5f9;
    color: #5b6a80;
  }
  &.primary {
    background: $uni-color-primary;
    color: #fff;
  }
}
.load-more {
  text-align: center;
  padding: 24rpx 0 10rpx;
  font-size: 22rpx;
  color: #a3aebd;
}
</style>
