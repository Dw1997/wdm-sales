<template>
  <view class="order-history-page">
    <view v-if="customerId" class="cust-bar">
      <view class="cust-box">
        <text class="cust-label">只看</text>
        <text class="cust-name">{{ customerName || `客户 #${customerId}` }}</text>
        <text class="cust-x" @tap="clearCustomer">×</text>
      </view>
    </view>

    <view class="filter-bar">
      <scroll-view scroll-x class="chip-row">
        <view class="chip-line">
          <text
            v-for="opt in statusOpts"
            :key="opt.value"
            class="chip"
            :class="{ on: status === opt.value }"
            @tap="onStatusChange(opt.value)"
          >{{ opt.label }}</text>
        </view>
      </scroll-view>
      <scroll-view scroll-x class="chip-row">
        <view class="chip-line">
          <text
            v-for="opt in modeOpts"
            :key="opt.value"
            class="chip"
            :class="{ on: deliveryMode === opt.value }"
            @tap="onModeChange(opt.value)"
          >{{ opt.label }}</text>
        </view>
      </scroll-view>
      <view class="meta-row">
        <text class="range" :class="{ on: rangeDays > 0 }" @tap="toggleRange">
          📅 {{ rangeLabel }}
        </text>
        <text class="sums"><text class="num">{{ list.length }}</text> 单 · 合计 <text class="num">{{ formatMoney(totalAmount) }}</text></text>
      </view>
    </view>

    <scroll-view scroll-y class="list" @scrolltolower="loadMore">
      <view v-if="list.length">
        <view
          v-for="o in list"
          :key="o.id"
          class="ord"
          @tap="goDetail(o.id)"
        >
          <view class="ord-top">
            <text class="ord-no">{{ o.order_no }}</text>
            <text class="ord-st" :class="`s-${ORDER_STATUS[o.status]?.type || 'grey'}`">
              {{ ORDER_STATUS[o.status]?.label || o.status }}
            </text>
          </view>
          <view class="ord-cust">
            <text class="cust-name2">{{ o.customer_name }}</text>
            <text class="ord-mode">· {{ DELIVERY_MODE[o.delivery_mode] || o.delivery_mode }}</text>
          </view>
          <view class="ord-goods">
            <text v-for="(it, i) in o.items.slice(0, 2)" :key="i" class="goods-line">
              {{ it.spu_name }} {{ it.sku_spec }} × {{ formatQty(it.quantity) }}{{ it.unit }}
            </text>
            <text v-if="o.items.length > 2" class="goods-more">等 {{ o.items.length }} 个商品</text>
          </view>
          <view class="ord-foot">
            <text class="ord-time">{{ formatDate(o.created_at) }}</text>
            <view class="ord-amt">
              <text class="amt">{{ formatMoney(o.total_amount) }}</text>
              <text class="due" :class="{ owe: toNum(o.unpaid_amount) > 0 }">
                {{ toNum(o.unpaid_amount) > 0 ? `未付 ${formatMoney(o.unpaid_amount)}` : '已结清' }}
              </text>
            </view>
          </view>
        </view>
      </view>
      <empty-state v-else-if="!loading" icon="📋" text="没有符合条件的订单" padding="120rpx 32rpx" />
      <view v-if="loadingMore" class="load-more">加载中...</view>
      <view v-else-if="noMore && list.length" class="load-more">没有更多了</view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import { customerApi, orderApi } from '@/api'
import { DELIVERY_MODE, ORDER_STATUS } from '@/utils/dict'
import { formatDate, formatMoney, formatQty, toNum } from '@/utils/format'
import type { Order } from '@/types'

const list = ref<Order[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const noMore = ref(false)
const page = ref(1)
const PAGE_SIZE = 20
const customerId = ref(0)
const customerName = ref('')
const status = ref('')
const deliveryMode = ref('')
/** 0 = 不按时间筛；7 / 30 = 最近 N 天下单 */
const rangeDays = ref(0)

const statusOpts = [
  { label: '全部', value: '' },
  { label: '待审批', value: 'pending_approval' },
  { label: '待配送', value: 'pending' },
  { label: '配送中', value: 'delivering' },
  { label: '已送达', value: 'delivered' },
  { label: '已取消', value: 'cancelled' },
]

const modeOpts = [
  { label: '全部配送方式', value: '' },
  { label: '跟车送', value: 'route' },
  { label: '物流', value: 'freight' },
  { label: '城区自送', value: 'local' },
]

const rangeLabel = computed(() =>
  rangeDays.value === 0 ? '下单日期：全部' : `下单日期：近 ${rangeDays.value} 天`,
)
const totalAmount = computed(() => list.value.reduce((sum, o) => sum + toNum(o.total_amount), 0))

function rangeParams() {
  if (!rangeDays.value) return {}
  const from = new Date()
  from.setDate(from.getDate() - rangeDays.value)
  return { created_at_from: from.toISOString() }
}

async function reload() {
  page.value = 1
  noMore.value = false
  loading.value = true
  try {
    const res = await orderApi.list({
      page: 1,
      page_size: PAGE_SIZE,
      status: status.value || undefined,
      delivery_mode: deliveryMode.value || undefined,
      customer_id: customerId.value || undefined,
      ...rangeParams(),
    })
    list.value = res.items
    noMore.value = list.value.length >= res.total
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (loadingMore.value || noMore.value) return
  loadingMore.value = true
  try {
    const next = page.value + 1
    const res = await orderApi.list({
      page: next,
      page_size: PAGE_SIZE,
      status: status.value || undefined,
      delivery_mode: deliveryMode.value || undefined,
      customer_id: customerId.value || undefined,
      ...rangeParams(),
    })
    list.value.push(...res.items)
    page.value = next
    noMore.value = list.value.length >= res.total
  } finally {
    loadingMore.value = false
  }
}

function onStatusChange(v: string) {
  status.value = status.value === v ? '' : v
  reload()
}
function onModeChange(v: string) {
  deliveryMode.value = deliveryMode.value === v ? '' : v
  reload()
}
function toggleRange() {
  rangeDays.value = rangeDays.value === 0 ? 7 : rangeDays.value === 7 ? 30 : 0
  reload()
}
function clearCustomer() {
  customerId.value = 0
  customerName.value = ''
  reload()
}

function goDetail(id: number) {
  uni.navigateTo({ url: `/pages/order/detail?id=${id}` })
}

async function loadCustomerName() {
  if (!customerId.value) return
  try {
    const c = await customerApi.get(customerId.value)
    customerName.value = c.name
  } catch {
    customerName.value = ''
  }
}

onLoad(async (opts: any) => {
  if (opts?.customer_id) customerId.value = Number(opts.customer_id)
  await loadCustomerName()
  await reload()
})

onShow(() => {
  if (list.value.length) reload()
})
</script>

<style lang="scss" scoped>
.order-history-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}
.cust-bar {
  padding: 14rpx 20rpx 0;
}
.cust-box {
  display: flex;
  align-items: center;
  gap: 10rpx;
  background: #fff;
  border-radius: 14rpx;
  padding: 14rpx 20rpx;
  box-shadow: 0 4rpx 14rpx rgba(22, 35, 58, 0.05);
  font-size: 23rpx;
  color: #8d99aa;
}
.cust-name {
  color: #1f2937;
  font-weight: 600;
  font-size: 25rpx;
}
.cust-x {
  margin-left: auto;
  font-size: 30rpx;
  color: #b3bdcb;
}
.filter-bar {
  background: #fff;
  margin-top: 14rpx;
  padding: 14rpx 0 12rpx;
}
.chip-row {
  white-space: nowrap;
  padding: 0 20rpx 10rpx;
}
.chip-line {
  display: flex;
  gap: 10rpx;
}
.chip {
  flex: none;
  padding: 8rpx 22rpx;
  border-radius: 24rpx;
  background: #f2f5f9;
  color: #5f6d82;
  font-size: 23rpx;
}
.chip.on {
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
  font-weight: 600;
}
.meta-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 0 20rpx;
  font-size: 21rpx;
  color: #8d99aa;
}
.range {
  padding: 6rpx 14rpx;
  border-radius: 10rpx;
  background: #f7f9fc;
  color: #5b6a80;
}
.range.on {
  background: #f2f7ff;
  color: #2563eb;
}
.sums {
  margin-left: auto;
}
.num {
  color: #1f2937;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.list {
  flex: 1;
  padding-bottom: 24rpx;
}
.ord {
  background: #fff;
  border-radius: 18rpx;
  padding: 22rpx;
  margin: 14rpx 20rpx 0;
  box-shadow: 0 4rpx 14rpx rgba(22, 35, 58, 0.05);
}
.ord-top {
  display: flex;
  align-items: center;
  gap: 10rpx;
}
.ord-no {
  font-size: 21rpx;
  color: #8d99aa;
  font-variant-numeric: tabular-nums;
}
.ord-st {
  margin-left: auto;
  font-size: 19rpx;
  padding: 3rpx 12rpx;
  border-radius: 6rpx;
  font-weight: 600;
}
.s-success {
  background: rgba(22, 163, 74, 0.1);
  color: #16a34a;
}
.s-primary {
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
}
.s-warning {
  background: rgba(234, 88, 12, 0.1);
  color: #ea580c;
}
.s-danger {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}
.s-grey {
  background: #f3f4f6;
  color: #6b7280;
}
.s-info {
  background: rgba(14, 116, 144, 0.1);
  color: #0e7490;
}
.ord-cust {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
  margin-top: 10rpx;
}
.cust-name2 {
  font-size: 28rpx;
  font-weight: 600;
  color: #1f2937;
}
.ord-mode {
  font-size: 21rpx;
  color: #9aa6b6;
}
.ord-goods {
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
.ord-foot {
  display: flex;
  align-items: flex-end;
  gap: 12rpx;
  margin-top: 14rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid #f4f7fa;
}
.ord-time {
  flex: 1;
  font-size: 20rpx;
  color: #a3aebd;
}
.ord-amt {
  text-align: right;
}
.amt {
  display: block;
  font-size: 29rpx;
  font-weight: 700;
  color: #1f2937;
  font-variant-numeric: tabular-nums;
}
.due {
  font-size: 19rpx;
  color: #a3aebd;
}
.due.owe {
  color: #c9343d;
  font-weight: 600;
}
.load-more {
  text-align: center;
  padding: 24rpx 0;
  font-size: 22rpx;
  color: #a9b4c2;
}
</style>
