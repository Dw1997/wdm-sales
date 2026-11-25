<template>
  <view class="call-page">
    <view class="tsum">
      <view class="tsum-row">
        <text class="tsum-title">经过地点 · 负责人 {{ trip?.owner_name || '—' }}</text>
        <text class="tsum-state" :class="{ go: readonly }">{{ readonly ? '已出车' : '出车前' }}</text>
      </view>
      <view class="tsum-stops">
        <text class="pin">📍</text>
        <text class="stops-text">{{ trip?.stops_text || '未设置送货地点' }}</text>
      </view>
      <view class="bar">
        <view class="bar-txt">
          <text>已询 {{ calledCount }} / {{ customers.length }} 家</text>
          <text>{{ calledCount === customers.length && customers.length ? '全部询完' : `还剩 ${customers.length - calledCount} 家` }}</text>
        </view>
        <view class="track"><view class="fill" :style="{ width: progress + '%' }" /></view>
      </view>
      <view v-if="!readonly && trip && (canPlan || canOperate)" class="tsum-ops">
        <view v-if="canPlan" class="tsum-btn" @tap="goPlan">修改安排</view>
        <view v-if="canOperate" class="tsum-btn go" @tap="goDeliver">去出车 ›</view>
      </view>
    </view>

    <!-- 视图切换：询单客户 / 本趟订单 -->
    <view class="view-tabs">
      <view class="vtab" :class="{ on: viewTab === 'calls' }" @tap="viewTab = 'calls'">
        <text>询单客户</text>
        <text class="vtab-n">{{ customers.length }}</text>
      </view>
      <view class="vtab" :class="{ on: viewTab === 'orders' }" @tap="viewTab = 'orders'">
        <text>本趟订单</text>
        <text class="vtab-n">{{ activeTripOrders.length }}</text>
      </view>
    </view>

    <!-- 询单客户视图 -->
    <template v-if="viewTab === 'calls'">
      <scroll-view scroll-x class="chips">
        <view
          v-for="f in filters"
          :key="f.key"
          class="chip"
          :class="{ on: filter === f.key }"
          @tap="filter = f.key"
        >
          <text>{{ f.label }}</text>
          <text class="chip-n">{{ f.count }}</text>
        </view>
      </scroll-view>

      <view v-if="readonly" class="readonly-note">
        本趟已出车，询单结果不能再改。补单直接进「录单」，送达在「送达」页处理。
      </view>

      <scroll-view scroll-y class="list">
        <view class="wrap">
          <view v-for="g in visibleGroups" :key="g.key">
            <view class="stop-hd">
              <text class="no">{{ g.no }}</text>
              <text class="stop-name">{{ g.name }}</text>
              <text class="stop-meta">{{ g.all.length }} 家 · 已询 {{ g.called }}</text>
            </view>

            <view
              v-for="c in g.rows"
              :key="c.customer_id"
              class="ccard"
              :class="{ ordered: c.call_result === 'ordered', muted: c.call_result === 'declined' }"
            >
              <view class="top">
                <view class="nm">
                  <text class="cname">{{ c.customer_name }}</text>
                  <text class="csub">
                    <template v-if="trip?.owner_name && c.sales_name">归属 {{ c.sales_name }} · </template>
                    上次 {{ c.last_order_date ? cnDate(c.last_order_date) : '从未下单' }}
                  </text>
                </view>
                <text class="st" :class="`st-${c.call_result}`">{{ callLabel(c.call_result) }}</text>
              </view>

              <view class="facts">
                <text>欠款</text>
                <text class="debt" :class="{ owe: toNum(c.ar_balance) > 0 }">{{ formatMoney(c.ar_balance) }}</text>
                <template v-if="g.key === 'tail'">
                  <text class="dot">·</text>
                  <text>{{ c.region_name }}</text>
                </template>
              </view>

              <view v-if="c.trip_order_ids.length || miniOrders(c.customer_id) || c.other_trip_order" class="flags">
                <text v-if="c.trip_order_ids.length" class="flag trip" @tap="openCustomerOrder(c)">
                  本趟 {{ c.trip_order_ids.length }} 单 {{ formatMoney(orderAmountOf(c.customer_id)) }} ›
                </text>
                <text v-if="miniOrders(c.customer_id)" class="flag mini">小程序已下单</text>
                <text v-if="c.other_trip_order" class="flag other">
                  已有 {{ cnDate(c.other_trip_order.trip_date) }} 订单
                </text>
              </view>

              <view class="ops">
                <view class="tel" @tap="call(c)">📞</view>
                <template v-if="c.call_result === 'ordered'">
                  <view class="rec light" @tap="openCustomerOrder(c)">查看已下单 ›</view>
                </template>
                <template v-else-if="readonly">
                  <view class="rec disabled">已出车，清单只读</view>
                </template>
                <template v-else>
                  <view class="rec" @tap="record(c)">＋ 录单</view>
                  <view
                    class="mini-btn"
                    :class="{ on: c.call_result === 'declined' }"
                    @tap="mark(c, 'declined')"
                  >本次不要</view>
                  <view
                    class="mini-btn"
                    :class="{ on: c.call_result === 'unreachable' }"
                    @tap="mark(c, 'unreachable')"
                  >未接通</view>
                </template>
              </view>
            </view>
          </view>

          <view v-if="!visibleGroups.length" class="empty-tip">这个筛选下没有客户</view>

          <view class="tail">
            {{ readonly ? '出车后清单只读' : `本趟共 ${customers.length} 家客户 · 打完电话逐个标记` }}
          </view>
        </view>
      </scroll-view>
    </template>

    <!-- 本趟已下单列表视图 -->
    <template v-else>
      <view class="order-summary">
        <text class="os-t">本趟共 <b>{{ activeTripOrders.length }}</b> 单</text>
        <text class="os-amt">合计 {{ formatMoney(activeOrdersTotal) }}</text>
      </view>

      <scroll-view scroll-y class="list">
        <view class="wrap">
          <view v-for="g in orderGroups" :key="g.key">
            <view class="stop-hd">
              <text class="no">{{ g.no }}</text>
              <text class="stop-name">{{ g.name }}</text>
              <text class="stop-meta">{{ g.orders.length }} 单 · {{ formatMoney(g.amount) }}</text>
            </view>

            <view
              v-for="o in g.orders"
              :key="o.order_id"
              class="ocard"
              @tap="goOrderDetail(o.order_id)"
            >
              <view class="top">
                <view class="nm">
                  <text class="cname">{{ o.customer_name }}</text>
                  <text class="csub">
                    {{ o.order_no }}
                    <template v-if="o.sales_name"> · 销售 {{ o.sales_name }}</template>
                  </text>
                </view>
                <view class="o-right">
                  <text class="o-amt">{{ formatMoney(o.delivered_amount ?? o.total_amount) }}</text>
                  <text class="ost" :class="`ost-${o.status}`">{{ tripOrderStatusLabel(o.status) }}</text>
                </view>
              </view>

              <view v-if="o.auto_joined || o.auto_moved || o.dispatch_note" class="o-tags">
                <text v-if="o.auto_joined" class="otag join">待排车自动加入</text>
                <text v-if="o.auto_moved" class="otag move">更晚趟次自动挪入</text>
                <text v-if="o.dispatch_note" class="o-note">{{ o.dispatch_note }}</text>
              </view>

              <view class="o-foot">
                <text class="o-foot-l">{{ o.region_name }}</text>
                <text class="o-foot-r">查看订单明细 ›</text>
              </view>
            </view>
          </view>

          <view v-if="!orderGroups.length" class="empty-tip">本趟还没有已下单订单</view>

          <view class="tail">点订单查看商品明细，未出车前可在询单页继续录单</view>
        </view>
      </scroll-view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { deliveryApi, orderApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { CALL_RESULT } from '@/utils/dict'
import { cnDate, formatMoney, toNum } from '@/utils/format'
import type { CallListCustomer, CallResult, Order, RouteTrip, RouteTripOrder, TripOrderStatus } from '@/types'

type FilterKey = 'all' | 'none' | 'ordered' | 'declined' | 'unreachable'
type ViewTab = 'calls' | 'orders'

interface StopGroup {
  key: string
  no: string
  name: string
  all: CallListCustomer[]
  rows: CallListCustomer[]
  called: number
}

interface OrderStopGroup {
  key: string
  no: string
  name: string
  orders: RouteTripOrder[]
  amount: number
}

const auth = useAuthStore()

const tripId = ref(0)
const trip = ref<RouteTrip | null>(null)
const customers = ref<CallListCustomer[]>([])
const tripOrders = ref<Order[]>([])
const routeTripOrders = ref<RouteTripOrder[]>([])
const viewTab = ref<ViewTab>('calls')
const filter = ref<FilterKey>('all')

const readonly = computed(() => !!trip.value && trip.value.status !== 'planned')
const canPlan = computed(
  () => auth.isAdmin && (auth.can('delivery.route.manage') || !auth.permissions.length),
)
const canOperate = computed(() => {
  const me = auth.user
  return auth.isAdmin || (!!me && trip.value?.owner_id === me.id)
})
const calledCount = computed(() => customers.value.filter((c) => c.call_result !== 'none').length)
const progress = computed(() => {
  if (!customers.value.length) return 0
  return Math.max(4, Math.round((calledCount.value / customers.value.length) * 100))
})

const activeTripOrders = computed(() =>
  routeTripOrders.value.filter((o) => o.status !== 'cancelled'),
)

const activeOrdersTotal = computed(() =>
  activeTripOrders.value.reduce((sum, o) => sum + toNum(o.delivered_amount ?? o.total_amount), 0),
)

const orderGroups = computed<OrderStopGroup[]>(() => {
  const map = new Map<number, RouteTripOrder[]>()
  activeTripOrders.value.forEach((o) => {
    const list = map.get(o.stop_seq) || []
    list.push(o)
    map.set(o.stop_seq, list)
  })
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([seq, list]) => ({
      key: `o-${seq}`,
      no: seq > 0 ? String(seq) : '·',
      name: list[0]?.region_name || '未分组',
      orders: list,
      amount: list.reduce((s, x) => s + toNum(x.delivered_amount ?? x.total_amount), 0),
    }))
})

const filters = computed(() => {
  const count = (k: FilterKey) =>
    k === 'all' ? customers.value.length : customers.value.filter((c) => c.call_result === k).length
  return [
    { key: 'all' as FilterKey, label: '全部', count: count('all') },
    { key: 'none' as FilterKey, label: '未询', count: count('none') },
    { key: 'ordered' as FilterKey, label: '已下单', count: count('ordered') },
    { key: 'declined' as FilterKey, label: '本次不要', count: count('declined') },
    { key: 'unreachable' as FilterKey, label: '未接通', count: count('unreachable') },
  ]
})

/** 后端已把「其他趟次已有订单」的客户排最后，这里按 stop_seq 切组，最后再单列一组。 */
const groups = computed<StopGroup[]>(() => {
  const normal = customers.value.filter((c) => !c.other_trip_order)
  const tail = customers.value.filter((c) => !!c.other_trip_order)
  const map = new Map<number, CallListCustomer[]>()
  normal.forEach((c) => {
    const list = map.get(c.stop_seq) || []
    list.push(c)
    map.set(c.stop_seq, list)
  })
  const out: StopGroup[] = [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([seq, list]) => ({
      key: `s${seq}`,
      no: String(seq),
      name: list[0]?.region_name || '—',
      all: list,
      rows: list,
      called: list.filter((c) => c.call_result !== 'none').length,
    }))
  if (tail.length) {
    out.push({
      key: 'tail',
      no: '末',
      name: '其他趟次已有订单',
      all: tail,
      rows: tail,
      called: tail.filter((c) => c.call_result !== 'none').length,
    })
  }
  return out
})

const visibleGroups = computed(() =>
  groups.value
    .map((g) => ({
      ...g,
      rows: g.rows.filter((c) => filter.value === 'all' || c.call_result === filter.value),
    }))
    .filter((g) => g.rows.length),
)

function callLabel(r: CallResult): string {
  return CALL_RESULT[r]?.label || r
}

function tripOrderStatusLabel(s: TripOrderStatus): string {
  return { pending: '待配送', delivering: '配送中', delivered: '已送达', cancelled: '已取消' }[s] || s
}

/** 本趟这个客户的订单（含小程序来源，用于金额与标记）。 */
function customerOrders(customerId: number): Order[] {
  return tripOrders.value.filter((o) => o.customer_id === customerId && o.status !== 'cancelled')
}

function orderAmountOf(customerId: number): number {
  return customerOrders(customerId).reduce((s, o) => s + toNum(o.total_amount), 0)
}

function miniOrders(customerId: number): boolean {
  return customerOrders(customerId).some((o) => o.source === 'miniprogram')
}

async function load() {
  if (!tripId.value) return
  try {
    const [t, list, orders, rtOrders] = await Promise.all([
      deliveryApi.getTrip(tripId.value),
      deliveryApi.callList(tripId.value),
      orderApi
        .list({ route_trip_id: tripId.value, page_size: 100 })
        .catch(() => ({ items: [] as Order[] })),
      deliveryApi.tripOrders(tripId.value).catch(() => [] as RouteTripOrder[]),
    ])
    trip.value = t
    customers.value = list
    tripOrders.value = orders.items
    routeTripOrders.value = rtOrders
    uni.setNavigationBarTitle({ title: t.name ? `${t.name} · 询单` : '询单清单' })
  } catch {
    /* 保留上一次数据 */
  }
}

onLoad((opts) => {
  tripId.value = Number((opts as Record<string, string>)?.id || 0)
  load()
})

onShow(() => {
  auth.restore()
  load()
})

function goPlan() {
  uni.navigateTo({ url: `/pages/trip/plan?id=${tripId.value}` })
}

function goDeliver() {
  uni.navigateTo({ url: `/pages/trip/deliver?id=${tripId.value}` })
}

function goOrderDetail(orderId: number) {
  uni.navigateTo({ url: `/pages/order/detail?id=${orderId}` })
}

function openCustomerOrder(c: CallListCustomer) {
  if (c.trip_order_ids.length === 1) {
    goOrderDetail(c.trip_order_ids[0])
    return
  }
  viewTab.value = 'orders'
}

function call(c: CallListCustomer) {
  if (!c.customer_phone) {
    uni.showToast({ title: '该客户没有登记电话', icon: 'none' })
    return
  }
  uni.makePhoneCall({
    phoneNumber: c.customer_phone,
    fail: () => undefined,
  })
}

function record(c: CallListCustomer) {
  uni.navigateTo({
    url: `/pages/order/create?customer_id=${c.customer_id}&route_trip_id=${tripId.value}`,
  })
}

/** 标记询单结果：再点一次恢复「未询」。 */
async function mark(c: CallListCustomer, result: Exclude<CallResult, 'none' | 'ordered'>) {
  if (readonly.value) return
  const next: CallResult = c.call_result === result ? 'none' : result
  const prev = c.call_result
  c.call_result = next
  try {
    const updated = await deliveryApi.markCall(tripId.value, c.customer_id, next)
    const idx = customers.value.findIndex((x) => x.customer_id === c.customer_id)
    if (idx >= 0) customers.value[idx] = { ...customers.value[idx], ...updated }
  } catch {
    const idx = customers.value.findIndex((x) => x.customer_id === c.customer_id)
    if (idx >= 0) customers.value[idx].call_result = prev
  }
}
</script>

<style lang="scss" scoped>
.call-page { height: 100vh; background: #f4f6f9; display: flex; flex-direction: column; box-sizing: border-box; }
/* H5 顶部有 44px 原生导航栏，100vh 会多出一屏底部被截掉 */
/* #ifdef H5 */
.call-page { height: calc(100vh - 44px); }
/* #endif */

/* 趟次信息条 */
.tsum {
  margin: 16rpx 16rpx 0; padding: 24rpx; border-radius: 22rpx; color: #fff;
  background: linear-gradient(140deg, #16233a, #263d59 62%, #2c4a68);
  box-shadow: 0 10rpx 24rpx rgba(22, 35, 58, 0.22);
}
.tsum-row { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; }
.tsum-title { font-size: 25rpx; font-weight: 600; }
.tsum-state { font-size: 20rpx; padding: 3rpx 14rpx; border-radius: 20rpx; background: rgba(255, 255, 255, 0.16); color: #e2e8f0; }
.tsum-state.go { background: rgba(251, 191, 36, 0.2); color: #fcd34d; }
.tsum-stops { display: flex; align-items: flex-start; gap: 6rpx; margin-top: 10rpx; }
.tsum-stops .pin { font-size: 20rpx; }
.stops-text { flex: 1; font-size: 21rpx; line-height: 1.5; color: rgba(255, 255, 255, 0.68); }
.bar { margin-top: 18rpx; }
.bar-txt { display: flex; justify-content: space-between; font-size: 21rpx; color: rgba(255, 255, 255, 0.7); margin-bottom: 8rpx; }
.track { height: 8rpx; border-radius: 4rpx; background: rgba(255, 255, 255, 0.18); overflow: hidden; }
.fill { height: 100%; border-radius: 4rpx; background: linear-gradient(90deg, #93c5fd, #e0f2fe); }

/* 管理员/司机的轻量操作 */
.tsum-ops {
  display: flex; align-items: center; gap: 14rpx;
  margin-top: 18rpx; padding-top: 16rpx; border-top: 1rpx solid rgba(255, 255, 255, 0.14);
}
.tsum-btn {
  flex: none; padding: 10rpx 24rpx; border-radius: 999rpx; font-size: 22rpx;
  background: rgba(255, 255, 255, 0.16); color: #e2e8f0;
}
.tsum-btn:active { opacity: 0.8; }
.tsum-btn.go { margin-left: auto; background: rgba(96, 165, 250, 0.28); color: #dbeafe; font-weight: 600; }

/* 视图切换 */
.view-tabs {
  flex: none; display: flex; gap: 10rpx; margin: 16rpx 16rpx 0; padding: 6rpx;
  border-radius: 16rpx; background: #e8edf5;
}
.vtab {
  flex: 1; height: 64rpx; border-radius: 12rpx;
  display: flex; align-items: center; justify-content: center; gap: 8rpx;
  font-size: 25rpx; font-weight: 500; color: #64738a;
}
.vtab.on { background: #fff; color: $uni-color-primary; font-weight: 600; box-shadow: 0 2rpx 8rpx rgba(22, 35, 58, 0.08); }
.vtab-n { font-size: 20rpx; opacity: 0.75; }

/* 筛选 */
.chips { white-space: nowrap; padding: 14rpx 16rpx 6rpx; flex: none; }
.chip {
  display: inline-flex; align-items: center; gap: 6rpx; margin-right: 12rpx;
  padding: 10rpx 20rpx; border-radius: 30rpx; background: #fff; color: #64738a; font-size: 23rpx;
}
.chip.on { background: $uni-color-primary; color: #fff; }
.chip-n { font-size: 20rpx; opacity: 0.7; }

.readonly-note {
  margin: 8rpx 16rpx 0; padding: 16rpx 20rpx; border-radius: 14rpx;
  background: #fff7e8; color: #a96a10; font-size: 21rpx; line-height: 1.5;
}

.order-summary {
  flex: none; display: flex; align-items: center; justify-content: space-between;
  margin: 14rpx 16rpx 4rpx; padding: 14rpx 20rpx; border-radius: 14rpx; background: #fff;
}
.os-t { font-size: 23rpx; color: #64738a; }
.os-t b { color: #1c2534; font-weight: 600; }
.os-amt { font-size: 26rpx; font-weight: 700; color: $uni-color-primary; }

.list { flex: 1; height: 0; }
.wrap { padding: 6rpx 16rpx 40rpx; }

.stop-hd { display: flex; align-items: center; gap: 12rpx; padding: 18rpx 6rpx 10rpx; }
.no {
  width: 36rpx; height: 36rpx; line-height: 36rpx; text-align: center; border-radius: 10rpx;
  background: #16233a; color: #fff; font-size: 20rpx; font-weight: 700; flex: none;
}
.stop-name { font-size: 25rpx; font-weight: 600; color: #1c2534; }
.stop-meta { font-size: 21rpx; color: #8894a5; }

/* 客户卡 */
.ccard { background: #fff; border-radius: 20rpx; padding: 22rpx 22rpx 20rpx; margin-bottom: 14rpx; }
.ccard.ordered { border-left: 6rpx solid #34d399; }
.ccard.muted { background: #fbfcfd; }
.top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12rpx; }
.nm { flex: 1; min-width: 0; }
.cname { display: block; font-size: 28rpx; font-weight: 600; color: #1c2534; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.csub { display: block; margin-top: 4rpx; font-size: 20rpx; color: #8894a5; }
.st { flex: none; font-size: 19rpx; padding: 3rpx 12rpx; border-radius: 14rpx; }
.st-none { background: #f0f2f5; color: #77849a; }
.st-ordered { background: #e6f7ee; color: #1f8459; }
.st-declined { background: #fff2dd; color: #a96a10; }
.st-unreachable { background: #ffecee; color: #bc3742; }

.facts { display: flex; flex-wrap: wrap; align-items: center; gap: 8rpx; margin-top: 10rpx; font-size: 21rpx; color: #8894a5; }
.facts .debt { color: #2f3b4d; font-weight: 600; }
.facts .debt.owe { color: #dc2626; }
.facts .dot { color: #cbd5e1; }

.flags { display: flex; flex-wrap: wrap; gap: 8rpx; margin-top: 12rpx; }
.flag { font-size: 19rpx; padding: 4rpx 12rpx; border-radius: 8rpx; }
.flag.trip { background: #e6f7ee; color: #1f8459; }
.flag.mini { background: #eef4ff; color: #2570b3; }
.flag.other { background: #f3f4f6; color: #6b7280; }

.ops { display: flex; align-items: center; gap: 10rpx; margin-top: 16rpx; }
.tel {
  width: 66rpx; height: 66rpx; border-radius: 50%; flex: none; font-size: 28rpx;
  background: #eef4ff; display: flex; align-items: center; justify-content: center;
}
.rec {
  flex: 1; height: 66rpx; border-radius: 12rpx; background: $uni-color-primary; color: #fff;
  font-size: 25rpx; font-weight: 600; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 6rpx 14rpx rgba(37, 99, 235, 0.2);
}
.rec.light { background: #e6f7ee; color: #1f8459; box-shadow: none; font-weight: 600; font-size: 23rpx; }
.rec.disabled { background: #f4f6f9; color: #8b98aa; box-shadow: none; font-weight: 500; font-size: 22rpx; }
.mini-btn {
  flex: none; height: 66rpx; padding: 0 16rpx; border-radius: 12rpx; background: #f4f6f9;
  color: #64738a; font-size: 21rpx; display: flex; align-items: center;
}
.mini-btn.on { background: #fff2dd; color: #a96a10; font-weight: 600; }

/* 本趟订单卡 */
.ocard { background: #fff; border-radius: 20rpx; padding: 22rpx 22rpx 0; margin-bottom: 14rpx; }
.ocard:active { background: #fafbfd; }
.o-right { flex: none; text-align: right; }
.o-amt { display: block; font-size: 27rpx; font-weight: 700; color: #1c2534; }
.ost { display: inline-block; margin-top: 4rpx; font-size: 19rpx; padding: 2rpx 12rpx; border-radius: 14rpx; }
.ost-pending { background: #e9f2ff; color: #2570b3; }
.ost-delivering { background: #fff2dd; color: #a96a10; }
.ost-delivered { background: #e6f7ee; color: #1f8459; }
.ost-cancelled { background: #f0f2f5; color: #77849a; }

.o-tags { display: flex; flex-wrap: wrap; align-items: center; gap: 8rpx; margin-top: 12rpx; }
.otag { font-size: 19rpx; padding: 3rpx 10rpx; border-radius: 8rpx; }
.otag.join { background: #eef4ff; color: #2570b3; }
.otag.move { background: #fff2dd; color: #a96a10; }
.o-note { font-size: 19rpx; color: #8894a5; }

.o-foot {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 14rpx; padding: 14rpx 0 16rpx; border-top: 1rpx solid #eef1f5;
}
.o-foot-l { font-size: 21rpx; color: #8894a5; }
.o-foot-r { font-size: 22rpx; font-weight: 600; color: $uni-color-primary; }

.empty-tip { text-align: center; font-size: 23rpx; color: #8894a5; padding: 60rpx 0; }
.tail { text-align: center; font-size: 20rpx; color: #a8b3c2; padding: 14rpx 0 4rpx; }
</style>
