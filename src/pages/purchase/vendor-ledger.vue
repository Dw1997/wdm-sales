<template>
  <view class="vl-page">
    <view v-if="!auth.isAdmin" class="no-auth">
      <text class="no-auth-icon">🔒</text>
      <text class="no-auth-title">无权限访问</text>
      <text class="no-auth-desc">供应商往来功能仅管理员可用</text>
      <button class="btn-primary no-auth-btn" @tap="goBack">返回</button>
    </view>

    <block v-else>
      <!-- 顶部账户汇总 -->
      <view class="account-card">
        <view class="ac-top">
          <view class="ac-vendor-wrap">
            <text class="ac-vendor">{{ displayName }}</text>
            <text class="ac-sub">当前应付余额</text>
          </view>
          <text class="ac-balance" :class="balanceClass">{{ balanceText }}</text>
        </view>

        <view class="ac-stats">
          <view class="ac-stat">
            <text class="acs-label">累计进货</text>
            <text class="acs-val">{{ formatMoney(account?.total_purchases) }}</text>
          </view>
          <view class="ac-divider" />
          <view class="ac-stat">
            <text class="acs-label">累计付款</text>
            <text class="acs-val">{{ formatMoney(account?.total_payments) }}</text>
          </view>
        </view>

        <view v-if="account?.linked_customer_id" class="ac-link-tip">
          同时为本店客户「{{ account.linked_customer_name || '#' + account.linked_customer_id }}」，客户应收
          {{ formatMoney(account.customer_ar_balance) }}（两本账分开核算，不支持移动端自动对冲）
        </view>
      </view>

      <!-- 日期筛选 -->
      <view class="filter-bar">
        <view class="range-row">
          <view
            v-for="opt in rangeOpts"
            :key="opt.value"
            class="pill"
            :class="{ on: rangeKey === opt.value }"
            @tap="selectRange(opt.value)"
          >{{ opt.label }}</view>
        </view>

        <view v-if="rangeKey === 'custom'" class="custom-date-row">
          <view class="date-box">
            <picker mode="date" :value="dateFrom" :end="dateTo || todayStr" @change="onDateFromChange">
              <view class="date-picker">
                <text :class="{ muted: !dateFrom }">{{ dateFrom || '开始日期' }}</text>
                <text class="date-arrow">▾</text>
              </view>
            </picker>
          </view>
          <text class="date-sep">至</text>
          <view class="date-box">
            <picker mode="date" :value="dateTo" :start="dateFrom || '2020-01-01'" :end="todayStr" @change="onDateToChange">
              <view class="date-picker">
                <text :class="{ muted: !dateTo }">{{ dateTo || '结束日期' }}</text>
                <text class="date-arrow">▾</text>
              </view>
            </picker>
          </view>
        </view>
      </view>

      <!-- 流水列表 -->
      <view class="list">
        <view v-if="loading && !list.length" class="page-loading">加载中...</view>

        <block v-else-if="list.length">
          <view v-for="item in list" :key="item.id" class="lc">
            <view class="lc-top">
              <view class="lc-left">
                <text class="tag" :class="`tag-${ledgerMeta(item).type}`">
                  {{ ledgerMeta(item).label }}
                </text>
                <text class="lc-time">{{ formatDate(item.occurred_at) }}</text>
              </view>
              <text class="lc-amount" :class="amountClass(item)">{{ amountText(item) }}</text>
            </view>

            <view class="lc-mid">
              <view class="lc-meta-list">
                <text v-if="item.purchase_receipt_id" class="lc-meta">进货单 #{{ item.purchase_receipt_id }}</text>
                <text v-if="item.operator_name" class="lc-meta">操作人 {{ item.operator_name }}</text>
              </view>
              <text class="lc-balance">{{ balanceAfterText(item) }}</text>
            </view>

            <text v-if="item.remark" class="lc-remark">{{ item.remark }}</text>

            <view v-if="item.proof_images?.length" class="lc-proofs">
              <image
                v-for="(url, idx) in item.proof_images"
                :key="`${item.id}-${idx}`"
                class="lc-proof-img"
                :src="url"
                mode="aspectFill"
                @tap="previewProofs(item.proof_images!, idx)"
              />
            </view>
          </view>
        </block>

        <empty-state
          v-else-if="!loading"
          icon="📄"
          :text="hasDateFilter ? '该时间段内暂无往来流水' : '暂无往来流水'"
          :action="hasDateFilter ? '查看全部' : ''"
          @action="resetRange"
        />

        <view v-if="loadingMore" class="load-more">加载中...</view>
        <view v-else-if="noMore && list.length" class="load-more">没有更多了</view>
      </view>

      <!-- 底部登记付款按钮 -->
      <view class="bottom-bar">
        <button class="btn-primary pay-btn" @tap="payVisible = true">登记付款</button>
      </view>
    </block>

    <vendor-pay-sheet
      :visible="payVisible"
      :vendor-id="vendorId"
      :vendor-name="displayName"
      :payable-balance="account?.payable_balance ?? 0"
      @close="payVisible = false"
      @paid="onPaid"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import VendorPaySheet from '@/components/VendorPaySheet.vue'
import { useAuthStore } from '@/stores/auth'
import { vendorFinanceApi } from '@/api'
import { VENDOR_LEDGER_TYPE } from '@/utils/dict'
import { formatDate, formatMoney, toNum, ymd } from '@/utils/format'
import type { VendorAccount, VendorLedgerItem, VendorPaymentResult } from '@/types'

type RangeKey = 'all' | 'month' | '30d' | 'custom'

const auth = useAuthStore()

const vendorId = ref(0)
const initialName = ref('')
const account = ref<VendorAccount | null>(null)

const list = ref<VendorLedgerItem[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const noMore = ref(false)
const page = ref(1)
const PAGE_SIZE = 20
let listSeq = 0

const rangeKey = ref<RangeKey>('all')
const dateFrom = ref('')
const dateTo = ref('')
const todayStr = ymd()

const payVisible = ref(false)

const rangeOpts: { label: string; value: RangeKey }[] = [
  { label: '全部', value: 'all' },
  { label: '本月', value: 'month' },
  { label: '近 30 天', value: '30d' },
  { label: '自定义', value: 'custom' },
]

const displayName = computed(() => account.value?.vendor_name || initialName.value || '供应商')
const hasDateFilter = computed(() => !!dateFrom.value || !!dateTo.value)

const balanceNum = computed(() => toNum(account.value?.payable_balance))
const balanceClass = computed(() => {
  if (balanceNum.value > 0) return 'owed'
  if (balanceNum.value < 0) return 'prepaid'
  return 'settled'
})
const balanceText = computed(() => {
  if (balanceNum.value > 0) return formatMoney(balanceNum.value)
  if (balanceNum.value < 0) return `预付 ${formatMoney(-balanceNum.value)}`
  return '已结清'
})

function ledgerMeta(item: VendorLedgerItem) {
  return VENDOR_LEDGER_TYPE[item.type] || { label: item.type, type: 'grey' }
}

function amountClass(item: VendorLedgerItem) {
  const n = toNum(item.amount)
  if (n > 0) return 'inc'
  if (n < 0) return 'dec'
  return ''
}

function amountText(item: VendorLedgerItem) {
  const n = toNum(item.amount)
  if (n > 0) return `+${formatMoney(n)}`
  if (n < 0) return `-${formatMoney(-n)}`
  return formatMoney(0)
}

function balanceAfterText(item: VendorLedgerItem) {
  const bal = toNum(item.balance_after)
  if (bal < 0) return `预付 ${formatMoney(-bal)}`
  return `余额 ${formatMoney(bal)}`
}

function monthStartYmd() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${m}-01`
}

function selectRange(key: RangeKey) {
  rangeKey.value = key
  if (key === 'all') {
    dateFrom.value = ''
    dateTo.value = ''
    reloadLedger()
  } else if (key === 'month') {
    dateFrom.value = monthStartYmd()
    dateTo.value = ymd()
    reloadLedger()
  } else if (key === '30d') {
    dateFrom.value = ymd(-29)
    dateTo.value = ymd()
    reloadLedger()
  } else {
    if (!dateFrom.value) dateFrom.value = ymd(-29)
    if (!dateTo.value) dateTo.value = ymd()
    reloadLedger()
  }
}

function resetRange() {
  selectRange('all')
}

function onDateFromChange(e: any) {
  dateFrom.value = e?.detail?.value || ''
  reloadLedger()
}

function onDateToChange(e: any) {
  dateTo.value = e?.detail?.value || ''
  reloadLedger()
}

async function loadAccount() {
  if (!vendorId.value) return
  try {
    const res = await vendorFinanceApi.account(vendorId.value)
    account.value = res
    if (res.vendor_name) {
      uni.setNavigationBarTitle({ title: `${res.vendor_name} · 往来` })
    }
  } catch {
    /* 错误由全局 toast 提示 */
  }
}

async function loadLedger(reset = false) {
  if (!vendorId.value) return
  const targetPage = reset ? 1 : page.value + 1
  if (!reset && (loadingMore.value || noMore.value)) return

  const seq = ++listSeq
  if (reset) {
    loading.value = true
    noMore.value = false
  } else {
    loadingMore.value = true
  }

  try {
    const res = await vendorFinanceApi.ledger(vendorId.value, {
      date_from: dateFrom.value || undefined,
      date_to: dateTo.value || undefined,
      page: targetPage,
      page_size: PAGE_SIZE,
    })
    if (seq !== listSeq) return
    const items = res.items || []
    list.value = reset ? items : [...list.value, ...items]
    page.value = targetPage
    noMore.value = list.value.length >= res.total || items.length < PAGE_SIZE
  } catch {
    /* ignore */
  } finally {
    if (seq === listSeq) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

function reloadLedger() {
  loadLedger(true)
}

async function refreshAll() {
  await Promise.all([loadAccount(), loadLedger(true)])
}

function onPaid(_result: VendorPaymentResult) {
  refreshAll()
}

function previewProofs(urls: string[], currentIndex: number) {
  uni.previewImage({
    urls,
    current: urls[currentIndex] || urls[0],
  })
}

function goBack() {
  uni.navigateBack()
}

onLoad((options) => {
  const id = Number(options?.vendorId || 0)
  if (id > 0) vendorId.value = id
  if (options?.vendorName) {
    try {
      initialName.value = decodeURIComponent(String(options.vendorName))
    } catch {
      initialName.value = String(options.vendorName)
    }
    uni.setNavigationBarTitle({ title: `${initialName.value} · 往来` })
  }
  if (auth.isAdmin && vendorId.value > 0) {
    refreshAll()
  }
})

onPullDownRefresh(async () => {
  if (auth.isAdmin && vendorId.value > 0) {
    await refreshAll()
  }
  uni.stopPullDownRefresh()
})

onReachBottom(() => {
  if (auth.isAdmin && vendorId.value > 0) {
    loadLedger(false)
  }
})
</script>

<style lang="scss" scoped>
.vl-page {
  min-height: 100vh;
  background: #f5f5f7;
  padding-bottom: calc(132rpx + env(safe-area-inset-bottom));
}

.no-auth {
  padding: 160rpx 48rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}
.no-auth-icon {
  font-size: 72rpx;
}
.no-auth-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1f2937;
}
.no-auth-desc {
  font-size: 26rpx;
  color: #6b7280;
}
.no-auth-btn {
  margin-top: 20rpx;
  width: 240rpx;
}

.account-card {
  margin: 16rpx;
  padding: 28rpx;
  border-radius: 20rpx;
  background: #ffffff;
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.05);
}
.ac-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}
.ac-vendor-wrap {
  min-width: 0;
  flex: 1;
}
.ac-vendor {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #111827;
}
.ac-sub {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #6b7280;
}
.ac-balance {
  flex-shrink: 0;
  font-size: 40rpx;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  &.owed {
    color: #dc2626;
  }
  &.prepaid {
    color: #16a34a;
  }
  &.settled {
    font-size: 30rpx;
    color: #9ca3af;
  }
}

.ac-stats {
  display: flex;
  align-items: center;
  margin-top: 24rpx;
  padding-top: 20rpx;
  border-top: 2rpx solid #f3f4f6;
}
.ac-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.ac-divider {
  width: 2rpx;
  height: 52rpx;
  background: #f3f4f6;
  margin: 0 24rpx;
}
.acs-label {
  font-size: 24rpx;
  color: #6b7280;
}
.acs-val {
  font-size: 30rpx;
  font-weight: 600;
  color: #1f2937;
  font-variant-numeric: tabular-nums;
}

.ac-link-tip {
  margin-top: 20rpx;
  padding: 14rpx 18rpx;
  border-radius: 12rpx;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 22rpx;
  line-height: 1.5;
}

.filter-bar {
  margin: 0 16rpx 12rpx;
  padding: 16rpx 20rpx;
  border-radius: 16rpx;
  background: #ffffff;
}
.range-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-wrap: wrap;
}
.pill {
  padding: 10rpx 22rpx;
  border-radius: 999rpx;
  background: #f3f4f6;
  color: #4b5563;
  font-size: 24rpx;
  &.on {
    background: #eff6ff;
    color: #2563eb;
    font-weight: 600;
  }
}

.custom-date-row {
  margin-top: 16rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.date-box {
  flex: 1;
}
.date-picker {
  height: 68rpx;
  padding: 0 20rpx;
  border-radius: 12rpx;
  background: #f9fafb;
  border: 2rpx solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 26rpx;
  color: #1f2937;
  .muted {
    color: #9ca3af;
  }
}
.date-arrow {
  font-size: 22rpx;
  color: #9ca3af;
}
.date-sep {
  font-size: 24rpx;
  color: #6b7280;
}

.list {
  padding: 4rpx 16rpx 24rpx;
}
.page-loading,
.load-more {
  text-align: center;
  padding: 28rpx 0;
  font-size: 24rpx;
  color: #9ca3af;
}

.lc {
  margin-bottom: 14rpx;
  padding: 22rpx 24rpx;
  border-radius: 16rpx;
  background: #ffffff;
}
.lc-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.lc-left {
  display: flex;
  align-items: center;
  gap: 12rpx;
  min-width: 0;
}
.lc-time {
  font-size: 24rpx;
  color: #6b7280;
}
.lc-amount {
  flex-shrink: 0;
  font-size: 32rpx;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #1f2937;
  &.inc {
    color: #dc2626;
  }
  &.dec {
    color: #16a34a;
  }
}

.lc-mid {
  margin-top: 12rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.lc-meta-list {
  display: flex;
  align-items: center;
  gap: 16rpx;
  flex-wrap: wrap;
}
.lc-meta {
  font-size: 24rpx;
  color: #6b7280;
}
.lc-balance {
  flex-shrink: 0;
  font-size: 24rpx;
  color: #4b5563;
  font-variant-numeric: tabular-nums;
}

.lc-remark {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #4b5563;
  line-height: 1.45;
}

.lc-proofs {
  margin-top: 14rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.lc-proof-img {
  width: 112rpx;
  height: 112rpx;
  border-radius: 10rpx;
  background: #f3f4f6;
}

.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
  background: #ffffff;
  box-shadow: 0 -4rpx 16rpx rgba(15, 23, 42, 0.06);
}
.pay-btn {
  width: 100%;
  height: 84rpx;
  line-height: 84rpx;
  border-radius: 14rpx;
  font-size: 30rpx;
  font-weight: 600;
}
</style>
