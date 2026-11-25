<template>
  <view class="receipts-page">
    <view v-if="!auth.isAdmin" class="no-auth">
      <text class="no-auth-icon">🔒</text>
      <text class="no-auth-title">无权限访问</text>
      <text class="no-auth-desc">采购入库功能仅管理员可用</text>
      <button class="btn-primary no-auth-btn" @tap="goBack">返回</button>
    </view>

    <block v-else>
      <view class="filter-bar">
        <view class="status-row">
          <text
            v-for="opt in statusOpts"
            :key="opt.value"
            class="status-opt"
            :class="{ on: status === opt.value }"
            @tap="onStatusChange(opt.value)"
          >{{ opt.label }}</text>
        </view>

        <view class="quick-row">
          <scroll-view scroll-x class="quick-scroll">
            <view class="quick-line">
              <view class="quick-pill" :class="{ on: spuId !== null }" @tap="openSpuSheet">
                <text v-if="spuId !== null" class="qp-text qp-ellipsis">{{ spuName }}</text>
                <text v-else class="qp-text">🔍 商品</text>
                <text v-if="spuId !== null" class="qp-clear" @tap.stop="clearSpu">×</text>
              </view>

              <view class="quick-pill" :class="{ on: vendorId !== null }" @tap="openVendorSheet">
                <text v-if="vendorId !== null" class="qp-text qp-ellipsis">{{ vendorLabel }}</text>
                <text v-else class="qp-text">供应商 ▾</text>
                <text v-if="vendorId !== null" class="qp-clear" @tap.stop="clearVendor">×</text>
              </view>

              <view class="quick-pill" :class="{ on: !!timeLabel }" @tap="openTimeSheet">
                <text v-if="timeLabel" class="qp-text qp-ellipsis">{{ timeLabel }}</text>
                <text v-else class="qp-text">时间 ▾</text>
                <text v-if="timeLabel" class="qp-clear" @tap.stop="clearTimeFilter">×</text>
              </view>

              <view class="quick-pill" :class="{ on: sourceType !== '' }" @tap="openSourceSheet">
                <text v-if="sourceType" class="qp-text qp-ellipsis">{{ sourceLabel }}</text>
                <text v-else class="qp-text">来源 ▾</text>
                <text v-if="sourceType" class="qp-clear" @tap.stop="clearSource">×</text>
              </view>
            </view>
          </scroll-view>
          <view v-if="hasExtraFilters" class="quick-reset" @tap="resetFilters">重置</view>
        </view>
      </view>

      <view class="list">
        <view v-if="loading && !list.length" class="page-loading">加载中...</view>

        <block v-else-if="list.length">
          <view v-for="r in list" :key="r.id" class="rc" @tap="goDetail(r.id)">
            <view class="rc-top">
              <text class="tag" :class="`tag-${sourceMeta(r).type}`">{{ sourceMeta(r).label }}</text>
              <text class="tag" :class="`tag-${statusMeta(r).type}`">{{ statusMeta(r).label }}</text>
              <text class="rc-time">{{ r.purchased_at ? formatDate(r.purchased_at) : '草稿待确认' }}</text>
            </view>

            <view class="rc-mid">
              <text class="rc-vendor">{{ r.vendor_name }}</text>
              <text v-if="r.order_no" class="rc-order">关联订单：{{ r.order_no }}</text>
              <view v-if="r.items?.length" class="goods">
                <text v-for="(it, i) in r.items.slice(0, 3)" :key="it.id || i" class="goods-line">
                  {{ itemLabel(it) }} × {{ it.quantity }} @ ¥{{ it.unit_cost }}
                </text>
                <text v-if="r.items.length > 3" class="goods-more">共 {{ r.items.length }} 项商品</text>
              </view>
            </view>

            <view class="rc-foot">
              <text v-if="toNum(r.paid_amount) > 0" class="rc-paid">已付 {{ formatMoney(r.paid_amount) }}</text>
              <text v-if="r.photos?.length" class="rc-photos">📷 {{ r.photos?.length }}张</text>
              <text class="rc-amt">{{ r.source_type === 'return' ? '-' : '' }}{{ formatMoney(r.total_amount) }}</text>
            </view>
          </view>
        </block>

        <empty-state
          v-else
          icon="📦"
          :text="hasActiveFilters ? '当前筛选条件下暂无进货单' : '暂无采购入库单'"
          :action="hasActiveFilters ? '重置筛选' : '+ 新建采购入库'"
          @action="onEmptyAction"
        />

        <view v-if="loadingMore" class="load-more">加载中...</view>
        <view v-else-if="noMore && list.length" class="load-more">没有更多了</view>
      </view>

      <view class="bottom-bar">
        <button class="btn-primary create-btn" @tap="goCreate">+ 新建采购入库</button>
      </view>
    </block>

    <!-- 按商品筛选 -->
    <view v-if="spuSheetVisible" class="sheet-mask">
      <view class="sheet-mask-bg" @tap="closeSpuSheet" @touchmove.stop.prevent></view>
      <view class="sheet" @tap.stop>
        <view class="sheet-hd">
          <text class="sheet-title">按商品筛选</text>
          <text class="sheet-close" @tap="closeSpuSheet">×</text>
        </view>
        <view class="sheet-search">
          <input
            v-model="spuKeyword"
            class="search-input"
            placeholder="搜索商品名称 / 编码"
            confirm-type="search"
          />
          <text v-if="spuKeyword" class="search-clear" @tap="spuKeyword = ''">×</text>
        </view>
        <scroll-view scroll-y class="sheet-body">
          <view class="pick-item" @tap="pickSpuAll">
            <view class="pi-main">
              <text class="pi-name">全部商品</text>
            </view>
            <text v-if="spuId === null" class="vi-check">✓</text>
          </view>
          <view v-if="spuLoading" class="sheet-empty">加载中...</view>
          <block v-else-if="spuList.length">
            <view v-for="s in spuList" :key="s.id" class="pick-item" @tap="pickSpu(s)">
              <view class="pi-main">
                <text class="pi-name">{{ s.name }}</text>
                <text class="pi-meta">{{ s.code }} · {{ s.base_unit }}</text>
              </view>
              <text v-if="spuId === s.id" class="vi-check">✓</text>
            </view>
          </block>
          <view v-else class="sheet-empty">未找到商品</view>
        </scroll-view>
      </view>
    </view>

    <!-- 按供应商筛选 -->
    <view v-if="vendorSheetVisible" class="sheet-mask">
      <view class="sheet-mask-bg" @tap="closeVendorSheet" @touchmove.stop.prevent></view>
      <view class="sheet" @tap.stop>
        <view class="sheet-hd">
          <text class="sheet-title">按供应商筛选</text>
          <text class="sheet-close" @tap="closeVendorSheet">×</text>
        </view>
        <view class="sheet-search">
          <input
            v-model="vendorKeyword"
            class="search-input"
            placeholder="搜索供应商名称 / 手机号"
            confirm-type="search"
          />
          <text v-if="vendorKeyword" class="search-clear" @tap="vendorKeyword = ''">×</text>
        </view>
        <scroll-view scroll-y class="sheet-body vendor-body">
          <view class="vendor-item" @tap="pickVendor(null, '')">
            <view class="vi-main">
              <text class="vi-name">全部供应商</text>
            </view>
            <text v-if="vendorId === null" class="vi-check">✓</text>
          </view>
          <view class="vendor-item" @tap="pickVendor(0, '自己进货')">
            <view class="vi-main">
              <text class="vi-name">自己进货（不记应付）</text>
              <text class="vi-sub">不产生供应商应付</text>
            </view>
            <text v-if="vendorId === 0" class="vi-check">✓</text>
          </view>
          <view
            v-for="v in filteredVendors"
            :key="v.id"
            class="vendor-item"
            @tap="pickVendor(v.id, v.name)"
          >
            <view class="vi-main">
              <text class="vi-name">{{ v.name }}</text>
              <text v-if="vendorSub(v)" class="vi-sub">{{ vendorSub(v) }}</text>
            </view>
            <text v-if="vendorId === v.id" class="vi-check">✓</text>
          </view>
          <view v-if="vendorLoading && !vendors.length" class="sheet-empty">加载中...</view>
          <view v-else-if="!filteredVendors.length" class="sheet-empty">
            {{ vendorKeyword ? '未找到匹配的供应商' : '暂无供应商' }}
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 按进货时间筛选 -->
    <view v-if="timeSheetVisible" class="sheet-mask">
      <view class="sheet-mask-bg" @tap="closeTimeSheet" @touchmove.stop.prevent></view>
      <view class="sheet" @tap.stop>
        <view class="sheet-hd">
          <text class="sheet-title">按进货时间筛选</text>
          <text class="sheet-close" @tap="closeTimeSheet">×</text>
        </view>
        <view class="time-body">
          <view class="time-quick">
            <text
              v-for="q in TIME_QUICKS"
              :key="q.key"
              class="time-pill"
              :class="{ on: quickActive(q.key) }"
              @tap="pickQuick(q.key)"
            >{{ q.label }}</text>
          </view>
          <view class="time-custom">
            <view class="tc-item">
              <text class="tc-label">开始日期</text>
              <picker mode="date" :value="tempFrom || ymd(0)" @change="onTempFromChange">
                <view class="tc-value" :class="{ empty: !tempFrom }">{{ tempFrom || '选择日期' }}</view>
              </picker>
            </view>
            <text class="tc-sep">~</text>
            <view class="tc-item">
              <text class="tc-label">结束日期</text>
              <picker mode="date" :value="tempTo || ymd(0)" @change="onTempToChange">
                <view class="tc-value" :class="{ empty: !tempTo }">{{ tempTo || '选择日期' }}</view>
              </picker>
            </view>
          </view>
        </view>
        <view class="sheet-actions">
          <button class="sa-btn ghost" @tap="clearTime">清空时间</button>
          <button class="sa-btn primary" @tap="confirmTime">确定</button>
        </view>
      </view>
    </view>

    <!-- 按来源筛选 -->
    <view v-if="sourceSheetVisible" class="sheet-mask">
      <view class="sheet-mask-bg" @tap="closeSourceSheet" @touchmove.stop.prevent></view>
      <view class="sheet" @tap.stop>
        <view class="sheet-hd">
          <text class="sheet-title">按来源筛选</text>
          <text class="sheet-close" @tap="closeSourceSheet">×</text>
        </view>
        <view class="source-list">
          <view
            v-for="opt in sourceOpts"
            :key="opt.value || 'all'"
            class="pick-item"
            @tap="pickSource(opt.value)"
          >
            <view class="pi-main">
              <text class="pi-name">{{ opt.label }}</text>
            </view>
            <text v-if="sourceType === opt.value" class="vi-check">✓</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onLoad, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import { useAuthStore } from '@/stores/auth'
import { purchaseApi, spuApi, vendorApi } from '@/api'
import { PURCHASE_SOURCE_TYPE, PURCHASE_STATUS } from '@/utils/dict'
import { formatDate, formatMoney, toNum, ymd } from '@/utils/format'
import type {
  PurchaseReceipt,
  PurchaseReceiptItem,
  PurchaseSourceType,
  PurchaseStatus,
  Spu,
  Vendor,
} from '@/types'

const auth = useAuthStore()

const list = ref<PurchaseReceipt[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const noMore = ref(false)
const page = ref(1)
const PAGE_SIZE = 20

const status = ref<PurchaseStatus | ''>('')
const sourceType = ref<PurchaseSourceType | ''>('')
const vendorId = ref<number | null>(null)
const vendorName = ref('')
const spuId = ref<number | null>(null)
const spuName = ref('')
const dateFrom = ref('')
const dateTo = ref('')

const statusOpts: { label: string; value: PurchaseStatus | '' }[] = [
  { label: '全部', value: '' },
  { label: PURCHASE_STATUS.draft.label, value: 'draft' },
  { label: PURCHASE_STATUS.confirmed.label, value: 'confirmed' },
  { label: PURCHASE_STATUS.cancelled.label, value: 'cancelled' },
]

const sourceOpts: { label: string; value: PurchaseSourceType | '' }[] = [
  { label: '全部来源', value: '' },
  { label: PURCHASE_SOURCE_TYPE.stock.label, value: 'stock' },
  { label: PURCHASE_SOURCE_TYPE.order.label, value: 'order' },
  { label: PURCHASE_SOURCE_TYPE.return.label, value: 'return' },
]

const hasExtraFilters = computed(
  () =>
    sourceType.value !== '' ||
    vendorId.value !== null ||
    spuId.value !== null ||
    !!dateFrom.value ||
    !!dateTo.value,
)
const hasActiveFilters = computed(() => status.value !== '' || hasExtraFilters.value)

const vendorLabel = computed(() => {
  if (vendorId.value === null) return ''
  if (vendorId.value === 0) return '自己进货'
  return vendorName.value || `供应商 #${vendorId.value}`
})

const sourceLabel = computed(() => (sourceType.value ? PURCHASE_SOURCE_TYPE[sourceType.value].label : ''))

function mmdd(s: string) {
  return s.slice(5)
}

function monthStart() {
  return ymd(1 - new Date().getDate())
}

const timeLabel = computed(() => {
  const from = dateFrom.value
  const to = dateTo.value
  if (!from && !to) return ''
  if (from && to) {
    const today = ymd(0)
    if (from === today && to === today) return '今天'
    if (from === ymd(-6) && to === today) return '近7天'
    if (from === monthStart() && to === today) return '本月'
    return `${mmdd(from)}~${mmdd(to)}`
  }
  return from ? `${mmdd(from)}起` : `至${mmdd(to)}`
})

function sourceMeta(r: PurchaseReceipt) {
  return PURCHASE_SOURCE_TYPE[r.source_type] || { label: r.source_type, type: 'grey' }
}

function statusMeta(r: PurchaseReceipt) {
  return PURCHASE_STATUS[r.status] || { label: r.status, type: 'grey' }
}

function itemLabel(it: PurchaseReceiptItem) {
  return it.sku_name || `${it.spu_name}(${it.base_unit})`
}

function fetchPage(pageNo: number) {
  return purchaseApi.list({
    page: pageNo,
    page_size: PAGE_SIZE,
    status: status.value || undefined,
    source_type: sourceType.value || undefined,
    vendor_id: vendorId.value !== null ? vendorId.value : undefined,
    spu_id: spuId.value ?? undefined,
    date_from: dateFrom.value || undefined,
    date_to: dateTo.value || undefined,
  })
}

async function reload() {
  page.value = 1
  noMore.value = false
  loading.value = true
  try {
    const res = await fetchPage(1)
    list.value = res.items
    noMore.value = list.value.length >= res.total
  } catch {
    /* request 层已提示 */
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (loading.value || loadingMore.value || noMore.value || !list.value.length) return
  loadingMore.value = true
  try {
    const next = page.value + 1
    const res = await fetchPage(next)
    list.value.push(...res.items)
    page.value = next
    noMore.value = list.value.length >= res.total
  } catch {
    /* request 层已提示 */
  } finally {
    loadingMore.value = false
  }
}

function onStatusChange(v: PurchaseStatus | '') {
  if (status.value === v) return
  status.value = v
  reload()
}

function resetFilters() {
  status.value = ''
  sourceType.value = ''
  vendorId.value = null
  vendorName.value = ''
  spuId.value = null
  spuName.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  reload()
}

function onEmptyAction() {
  if (hasActiveFilters.value) resetFilters()
  else goCreate()
}

/* ---------- 商品筛选 ---------- */

const spuSheetVisible = ref(false)
const spuKeyword = ref('')
const spuLoading = ref(false)
const spuList = ref<Spu[]>([])
let spuTimer: ReturnType<typeof setTimeout> | undefined
let spuSeq = 0

function openSpuSheet() {
  spuKeyword.value = ''
  spuSheetVisible.value = true
  void loadSpus()
}

function closeSpuSheet() {
  if (spuTimer) clearTimeout(spuTimer)
  spuSheetVisible.value = false
}

async function loadSpus() {
  const seq = ++spuSeq
  spuLoading.value = true
  try {
    const res = await spuApi.list({
      page: 1,
      page_size: 50,
      keyword: spuKeyword.value.trim() || undefined,
    })
    if (seq === spuSeq) spuList.value = res.items
  } catch {
    if (seq === spuSeq) spuList.value = []
  } finally {
    if (seq === spuSeq) spuLoading.value = false
  }
}

function pickSpu(s: Spu) {
  spuId.value = s.id
  spuName.value = s.name
  closeSpuSheet()
  reload()
}

function pickSpuAll() {
  spuId.value = null
  spuName.value = ''
  closeSpuSheet()
  reload()
}

function clearSpu() {
  spuId.value = null
  spuName.value = ''
  reload()
}

watch(spuKeyword, () => {
  if (!spuSheetVisible.value) return
  if (spuTimer) clearTimeout(spuTimer)
  spuTimer = setTimeout(() => {
    void loadSpus()
  }, 300)
})

/* ---------- 供应商筛选 ---------- */

const VENDOR_TYPE_LABEL: Record<string, string> = {
  market: '市场',
  origin: '产地',
  manufacturer: '厂家',
}

const vendorSheetVisible = ref(false)
const vendorKeyword = ref('')
const vendorLoading = ref(false)
const vendors = ref<Vendor[]>([])
let vendorsLoaded = false

const filteredVendors = computed(() => {
  const kw = vendorKeyword.value.trim().toLowerCase()
  if (!kw) return vendors.value
  return vendors.value.filter((v) => {
    const name = (v.name || '').toLowerCase()
    const phone = `${v.phone || ''} ${v.contact_phone || ''}`
    return name.includes(kw) || phone.includes(kw)
  })
})

function vendorSub(v: Vendor) {
  return [VENDOR_TYPE_LABEL[v.type], v.phone || v.contact_phone].filter(Boolean).join(' · ')
}

function openVendorSheet() {
  vendorKeyword.value = ''
  vendorSheetVisible.value = true
  if (!vendorsLoaded) void loadVendors()
}

function closeVendorSheet() {
  vendorSheetVisible.value = false
}

async function loadVendors() {
  if (vendorLoading.value) return
  vendorLoading.value = true
  try {
    const res = await vendorApi.list({ page: 1, page_size: 100 })
    vendors.value = res.items
    vendorsLoaded = true
  } catch {
    /* request 层已提示 */
  } finally {
    vendorLoading.value = false
  }
}

function pickVendor(id: number | null, name: string) {
  vendorId.value = id
  vendorName.value = id === 0 ? '自己进货' : name
  closeVendorSheet()
  reload()
}

function clearVendor() {
  vendorId.value = null
  vendorName.value = ''
  reload()
}

/* ---------- 时间筛选 ---------- */

type QuickKey = 'all' | 'today' | 'week' | 'month'

const TIME_QUICKS: { key: QuickKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'today', label: '今天' },
  { key: 'week', label: '近7天' },
  { key: 'month', label: '本月' },
]

const timeSheetVisible = ref(false)
const tempFrom = ref('')
const tempTo = ref('')

function openTimeSheet() {
  tempFrom.value = dateFrom.value
  tempTo.value = dateTo.value
  timeSheetVisible.value = true
}

function closeTimeSheet() {
  timeSheetVisible.value = false
}

function quickActive(key: QuickKey) {
  const today = ymd(0)
  if (key === 'all') return !tempFrom.value && !tempTo.value
  if (key === 'today') return tempFrom.value === today && tempTo.value === today
  if (key === 'week') return tempFrom.value === ymd(-6) && tempTo.value === today
  return tempFrom.value === monthStart() && tempTo.value === today
}

function pickQuick(key: QuickKey) {
  const today = ymd(0)
  if (key === 'all') {
    tempFrom.value = ''
    tempTo.value = ''
  } else if (key === 'today') {
    tempFrom.value = today
    tempTo.value = today
  } else if (key === 'week') {
    tempFrom.value = ymd(-6)
    tempTo.value = today
  } else {
    tempFrom.value = monthStart()
    tempTo.value = today
  }
}

function onTempFromChange(e: any) {
  tempFrom.value = e?.detail?.value || ''
}

function onTempToChange(e: any) {
  tempTo.value = e?.detail?.value || ''
}

function confirmTime() {
  if (tempFrom.value && tempTo.value && tempFrom.value > tempTo.value) {
    uni.showToast({ title: '开始日期不能晚于结束日期', icon: 'none' })
    return
  }
  dateFrom.value = tempFrom.value
  dateTo.value = tempTo.value
  timeSheetVisible.value = false
  reload()
}

function clearTime() {
  tempFrom.value = ''
  tempTo.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  timeSheetVisible.value = false
  reload()
}

function clearTimeFilter() {
  dateFrom.value = ''
  dateTo.value = ''
  reload()
}

/* ---------- 来源筛选 ---------- */

const sourceSheetVisible = ref(false)

function openSourceSheet() {
  sourceSheetVisible.value = true
}

function closeSourceSheet() {
  sourceSheetVisible.value = false
}

function pickSource(v: PurchaseSourceType | '') {
  sourceType.value = v
  sourceSheetVisible.value = false
  reload()
}

function clearSource() {
  sourceType.value = ''
  reload()
}

/* ---------- 导航 ---------- */

function goDetail(id: number) {
  uni.navigateTo({ url: `/pages/purchase/receipt-detail?id=${id}` })
}

function goCreate() {
  uni.navigateTo({ url: '/pages/purchase/receipt-form' })
}

function goBack() {
  uni.navigateBack({
    fail: () => uni.switchTab({ url: '/pages/me/index' }),
  })
}

let firstShow = true

onLoad(() => {
  if (auth.isAdmin) reload()
})

onShow(() => {
  if (firstShow) {
    firstShow = false
    return
  }
  if (auth.isAdmin) reload()
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
.receipts-page {
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

/* 筛选栏 */
.filter-bar {
  position: sticky;
  top: 0;
  z-index: 20;
  background: #fff;
  box-shadow: 0 4rpx 14rpx rgba(22, 35, 58, 0.04);
}
.status-row {
  display: flex;
  gap: 10rpx;
  padding: 18rpx 20rpx 0;
}
.status-opt {
  flex: 1;
  text-align: center;
  padding: 12rpx 0;
  border-radius: 12rpx;
  background: #f2f5f9;
  color: #5f6d82;
  font-size: 24rpx;
}
.status-opt.on {
  background: rgba(37, 99, 235, 0.1);
  color: $uni-color-primary;
  font-weight: 600;
}

.quick-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 14rpx 20rpx 16rpx;
}
.quick-scroll {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
}
.quick-line {
  display: inline-flex;
  align-items: center;
  gap: 10rpx;
}
.quick-pill {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 20rpx;
  border-radius: 24rpx;
  background: #f2f5f9;
  color: #5f6d82;
  font-size: 23rpx;
  line-height: 1.5;
}
.quick-pill.on {
  background: rgba(37, 99, 235, 0.1);
  color: $uni-color-primary;
  font-weight: 600;
}
.qp-text {
  display: inline-block;
}
.qp-ellipsis {
  max-width: 200rpx;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.qp-clear {
  flex: none;
  font-size: 26rpx;
  line-height: 1;
  padding: 0 2rpx;
  opacity: 0.7;
}
.quick-reset {
  flex: none;
  padding: 8rpx 18rpx;
  border-radius: 24rpx;
  font-size: 23rpx;
  color: $uni-color-primary;
  background: rgba(37, 99, 235, 0.08);
}

/* 列表 */
.list {
  padding: 4rpx 0 calc(160rpx + env(safe-area-inset-bottom));
}
.page-loading {
  text-align: center;
  padding: 80rpx 0;
  font-size: 24rpx;
  color: #a3aebd;
}
.rc {
  background: #fff;
  border-radius: 18rpx;
  padding: 22rpx;
  margin: 14rpx 20rpx 0;
  box-shadow: 0 4rpx 14rpx rgba(22, 35, 58, 0.05);
}
.rc-top {
  display: flex;
  align-items: center;
  gap: 10rpx;
}
.rc-top .tag {
  font-size: 19rpx;
  font-weight: 600;
  padding: 3rpx 12rpx;
  border-radius: 6rpx;
}
.tag-info {
  background: rgba(14, 116, 144, 0.1);
  color: #0e7490;
}
.rc-time {
  margin-left: auto;
  font-size: 20rpx;
  color: #a3aebd;
}
.rc-mid {
  margin-top: 12rpx;
}
.rc-vendor {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #1f2937;
}
.rc-order {
  display: block;
  margin-top: 4rpx;
  font-size: 21rpx;
  color: #8d99aa;
}
.goods {
  margin-top: 10rpx;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.goods-line {
  font-size: 22rpx;
  color: #6f7d92;
  line-height: 1.5;
}
.goods-more {
  font-size: 21rpx;
  color: #a3aebd;
}
.rc-foot {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  margin-top: 14rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid #f4f7fa;
}
.rc-paid {
  font-size: 20rpx;
  color: #16a34a;
}
.rc-photos {
  font-size: 20rpx;
  color: #a3aebd;
}
.rc-amt {
  margin-left: auto;
  font-size: 30rpx;
  font-weight: 700;
  color: #1f2937;
  font-variant-numeric: tabular-nums;
}

/* 底部操作栏 */
.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.97);
  border-top: 1rpx solid #e8ecf2;
}
.create-btn {
  width: 100%;
}

/* 弹层通用 */
.sheet-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}
.sheet-mask-bg {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(16, 25, 42, 0.45);
}
.sheet {
  position: relative;
  z-index: 2;
  width: 100%;
  max-height: 82vh;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 28rpx 28rpx 0 0;
  padding-bottom: env(safe-area-inset-bottom);
}
.sheet-hd {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 26rpx 30rpx 18rpx;
  border-bottom: 1rpx solid #eef1f5;
}
.sheet-title {
  flex: 1;
  font-size: 30rpx;
  font-weight: 600;
  color: #1f2937;
}
.sheet-close {
  margin-left: auto;
  font-size: 40rpx;
  line-height: 1;
  color: #9ca3af;
  padding: 4rpx 10rpx;
}
.sheet-search {
  display: flex;
  align-items: center;
  margin: 18rpx 26rpx 12rpx;
  padding: 0 20rpx;
  height: 74rpx;
  background: #f3f5f8;
  border-radius: 14rpx;
}
.search-input {
  flex: 1;
  font-size: 26rpx;
  color: #1f2937;
}
.search-clear {
  font-size: 32rpx;
  color: #9ca3af;
  padding: 0 6rpx;
}
.sheet-body {
  height: 56vh;
}
.vendor-body {
  height: 50vh;
}
.sheet-empty {
  padding: 70rpx 30rpx;
  text-align: center;
  font-size: 24rpx;
  color: #a3aebd;
}
.vi-check {
  flex: none;
  font-size: 30rpx;
  font-weight: 700;
  color: $uni-color-primary;
}

/* 供应商条目 */
.vendor-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 22rpx 30rpx;
  border-bottom: 1rpx solid #f5f6f8;
}
.vi-main {
  flex: 1;
  min-width: 0;
}
.vi-name {
  display: block;
  font-size: 27rpx;
  color: #1f2937;
  font-weight: 500;
}
.vi-sub {
  display: block;
  margin-top: 5rpx;
  font-size: 21rpx;
  color: #9ca3af;
}

/* 商品 / 来源条目 */
.pick-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 22rpx 30rpx;
  border-bottom: 1rpx solid #f5f6f8;
}
.pi-main {
  flex: 1;
  min-width: 0;
}
.pi-name {
  display: block;
  font-size: 27rpx;
  color: #1f2937;
  line-height: 1.45;
}
.pi-meta {
  display: block;
  margin-top: 5rpx;
  font-size: 21rpx;
  color: #9ca3af;
}
.source-list {
  padding-bottom: 16rpx;
}

/* 时间筛选弹窗 */
.time-body {
  padding: 8rpx 30rpx 24rpx;
}
.time-quick {
  display: flex;
  gap: 12rpx;
  margin: 12rpx 0 24rpx;
}
.time-pill {
  flex: 1;
  text-align: center;
  padding: 14rpx 0;
  border-radius: 12rpx;
  background: #f2f5f9;
  color: #5f6d82;
  font-size: 24rpx;
}
.time-pill.on {
  background: rgba(37, 99, 235, 0.1);
  color: $uni-color-primary;
  font-weight: 600;
}
.time-custom {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 20rpx 0 6rpx;
  border-top: 1rpx solid #eef1f5;
}
.tc-item {
  flex: 1;
  min-width: 0;
}
.tc-label {
  display: block;
  font-size: 20rpx;
  color: #8d99aa;
  margin-bottom: 8rpx;
}
.tc-value {
  height: 70rpx;
  line-height: 70rpx;
  padding: 0 16rpx;
  border-radius: 10rpx;
  background: #f7f9fc;
  border: 1rpx solid #eef2f7;
  font-size: 25rpx;
  color: #1f2937;
}
.tc-value.empty {
  color: #a3aebd;
}
.tc-sep {
  flex: none;
  margin-top: 24rpx;
  font-size: 24rpx;
  color: #cbd5e1;
}
.sheet-actions {
  display: flex;
  gap: 16rpx;
  padding: 16rpx 30rpx 20rpx;
  border-top: 1rpx solid #eef1f5;
}
.sa-btn {
  flex: 1;
  height: 84rpx;
  border-radius: 14rpx;
  font-size: 27rpx;
  font-weight: 600;
  line-height: 84rpx;
}
.sa-btn::after {
  border: none;
}
.sa-btn.ghost {
  background: #f3f6fa;
  color: #5b6a80;
}
.sa-btn.primary {
  background: $uni-color-primary;
  color: #fff;
}
</style>
