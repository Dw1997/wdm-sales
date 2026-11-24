<template>
  <view class="trip-page">
    <scroll-view
      scroll-y
      class="content"
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
    >
      <view class="wrap">
        <view v-if="canPlan" class="admin-bar">
          <view class="admin-txt">
            <text class="admin-title">出车安排</text>
            <text class="admin-sub">排线路、定司机，司机端按趟询单送货</text>
          </view>
          <view class="admin-btn" @tap="goPlan">＋ 安排出车</view>
        </view>

        <!-- 按天分组 -->
        <view v-for="g in groups" :key="g.key" class="day">
          <view class="day-hd">
            <text class="day-key">{{ g.label }}</text>
            <text class="day-sub">{{ g.dateText }} · {{ g.trips.length }} 趟</text>
          </view>

          <view v-for="t in g.trips" :key="t.id" class="tcard" @tap="openTrip(t)">
            <view class="hd">
              <text class="name">{{ t.name || '出车' }}</text>
              <text v-if="t.auto_generated" class="pill auto">自动排车</text>
              <text class="pill" :class="`st-${t.status}`">{{ statusLabel(t.status) }}</text>
            </view>

            <view class="stops">
              <text class="pin">📍</text>
              <text class="stops-text">{{ t.stops_text || '未设置送货地点' }}</text>
            </view>

            <view class="meta">
              <text>{{ t.owner_name }}</text>
              <text class="dot">·</text>
              <text>询单 <b>{{ t.called_count }}/{{ t.customer_count }}</b></text>
              <text class="dot">·</text>
              <text>订单 <b>{{ t.order_count }}</b> 单 · <b>{{ formatMoney(t.order_amount) }}</b></text>
            </view>

            <view v-if="t.status === 'delivering'" class="bar">
              <view class="bar-txt">
                <text>已送达 {{ t.delivered_count }} / {{ t.order_count }} 单</text>
                <text>还剩 {{ Math.max(t.order_count - t.delivered_count, 0) }} 单</text>
              </view>
              <view class="track"><view class="fill" :style="{ width: progressOf(t) + '%' }" /></view>
            </view>

            <view class="foot">
              <text class="foot-sum">{{ footText(t) }}</text>
              <text class="foot-go">{{ goText(t) }} ›</text>
            </view>
          </view>
        </view>

        <empty-state
          v-if="!loading && !groups.length"
          icon="🚚"
          text="近期没有出车安排"
          :action="canPlan ? '去安排出车' : ''"
          padding="80rpx 32rpx"
          @action="goPlan"
        />

        <!-- 物流：不属于线路配送，单独交车 -->
        <view class="day-hd">
          <text class="day-key">物流</text>
          <text class="day-sub">不属于线路配送，单独交车</text>
        </view>
        <view class="fcard" @tap="goFreight">
          <view class="fico">零</view>
          <view class="ftext">
            <text class="fname">物流批次</text>
            <text class="fsub">{{ freightSummary }}</text>
          </view>
          <text class="fchev">›</text>
        </view>

        <!-- 历史：昨天及更早，折叠一行 -->
        <view v-if="pastTrips.length" class="past">
          <view class="past-row" @tap="showPast = !showPast">
            <text class="past-day">{{ pastLabel }}</text>
            <text class="past-sum">{{ pastTrips.length }} 趟已收车 {{ showPast ? '收起 ˄' : '展开 ˅' }}</text>
          </view>
          <view v-if="showPast" class="past-list">
            <view v-for="t in pastTrips" :key="t.id" class="past-item" @tap="openTrip(t)">
              <text class="past-name">{{ t.name || '出车' }}</text>
              <text class="past-meta">{{ t.delivered_count }}/{{ t.order_count }} 单 · {{ formatMoney(t.order_amount) }}</text>
              <text class="past-go">›</text>
            </view>
          </view>
        </view>

        <view class="tail">
          近期共 {{ trips.length }} 趟{{ canPlan ? ' · 到「安排出车」加一趟' : '' }}
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import { useAuthStore } from '@/stores/auth'
import { deliveryApi, freightApi } from '@/api'
import { cnDate, dayDiff, dayLabel, formatMoney, toNum, ymd } from '@/utils/format'
import { TRIP_STATUS } from '@/utils/dict'
import type { FreightShipment, RouteTrip, RouteTripStatus } from '@/types'

interface DayGroup {
  key: string
  label: string
  dateText: string
  trips: RouteTrip[]
}

const auth = useAuthStore()

const trips = ref<RouteTrip[]>([])
const shipments = ref<FreightShipment[]>([])
const loading = ref(true)
const refreshing = ref(false)
const showPast = ref(false)

const canPlan = computed(
  () => auth.isAdmin && (auth.can('delivery.route.manage') || !auth.permissions.length),
)

const groups = computed<DayGroup[]>(() => {
  const upcoming = trips.value
    .filter((t) => t.status !== 'cancelled' && dayDiff(t.trip_date) >= 0)
    .slice()
    .sort((a, b) => {
      if (a.trip_date !== b.trip_date) return a.trip_date < b.trip_date ? -1 : 1
      const rank = (s: RouteTripStatus) => (s === 'delivering' ? 0 : s === 'planned' ? 1 : 2)
      return rank(a.status) - rank(b.status)
    })
  const map = new Map<string, RouteTrip[]>()
  upcoming.forEach((t) => {
    const list = map.get(t.trip_date) || []
    list.push(t)
    map.set(t.trip_date, list)
  })
  return [...map.entries()].map(([date, list]) => ({
    key: date,
    label: dayLabel(date),
    dateText: cnDate(date),
    trips: list,
  }))
})

const pastTrips = computed(() =>
  trips.value
    .filter((t) => dayDiff(t.trip_date) < 0)
    .slice()
    .sort((a, b) => (a.trip_date < b.trip_date ? 1 : -1)),
)

const pastLabel = computed(() => {
  const first = pastTrips.value[0]
  return first ? dayLabel(first.trip_date) : ''
})

const freightSummary = computed(() => {
  const list = shipments.value
  if (!list.length) return '今天没有物流批次'
  const open = list.filter((s) => s.status === 'open')
  const orders = list.reduce((s, x) => s + x.order_count, 0)
  const amount = list.reduce((s, x) => s + toNum(x.order_amount), 0)
  const head = open.length ? `今天 ${open.length} 批待交车` : '今天都已交车'
  return `${head} · ${orders} 单 ¥${amount.toFixed(2)}`
})

function statusLabel(s: RouteTripStatus): string {
  return TRIP_STATUS[s]?.label || s
}

function progressOf(t: RouteTrip): number {
  if (t.order_count <= 0) return 0
  return Math.min(Math.round((t.delivered_count / t.order_count) * 100), 100)
}

function footText(t: RouteTrip): string {
  if (t.status === 'delivering') return '本趟在途，逐单确认送达'
  if (t.status === 'finished') return '本趟已收车，只能查看'
  return '出车前逐个询单，边打电话边录单'
}

function goText(t: RouteTrip): string {
  if (t.status === 'delivering') return '去送达'
  if (t.status === 'finished') return '查看'
  return '去询单'
}

async function load() {
  loading.value = true
  try {
    const [tripRes, freightRes] = await Promise.all([
      deliveryApi.listTrips({
        date_from: ymd(-7),
        date_to: ymd(30),
        page_size: 100,
        order_by: 'trip_date',
      }),
      freightApi.list({ date_from: ymd(0), date_to: ymd(1), page_size: 50 }).catch(() => null),
    ])
    trips.value = tripRes.items
    if (freightRes) shipments.value = freightRes.items.filter((s) => s.ship_date === ymd(0))
  } catch {
    /* 保留上一次数据 */
  } finally {
    loading.value = false
  }
}

async function onRefresh() {
  refreshing.value = true
  await load()
  refreshing.value = false
}

onShow(() => {
  auth.restore()
  if (!auth.isLoggedIn) {
    uni.reLaunch({ url: '/pages/auth/login' })
    return
  }
  load()
})

function openTrip(t: RouteTrip) {
  const id = t.id
  if (t.status === 'delivering' || t.status === 'finished') {
    uni.navigateTo({ url: `/pages/trip/deliver?id=${id}` })
    return
  }
  uni.navigateTo({ url: `/pages/trip/call-list?id=${id}` })
}

function goFreight() {
  uni.navigateTo({ url: '/pages/trip/freight' })
}

function goPlan() {
  uni.navigateTo({ url: '/pages/trip/plan' })
}
</script>

<style lang="scss" scoped>
.trip-page { min-height: 100vh; background: #f4f6f9; }
.content { height: 100vh; box-sizing: border-box; padding-top: var(--status-bar-height, 0px); }
/* H5 的 tabBar 是 fixed 覆盖层，滚动区要减掉它的高度（小程序 tabBar 不占视口，不用减） */
/* #ifdef H5 */
.content { height: calc(100vh - 50px); }
/* #endif */
.wrap { padding: 8rpx 16rpx 60rpx; }

/* 管理员操作条 */
.admin-bar {
  display: flex; align-items: center; gap: 16rpx;
  background: #fff; border-radius: 22rpx; padding: 22rpx 24rpx; margin-bottom: 20rpx;
  box-shadow: 0 4rpx 14rpx rgba(22, 35, 58, 0.05);
}
.admin-txt { flex: 1; min-width: 0; }
.admin-title { display: block; font-size: 28rpx; font-weight: 600; color: #1c2534; }
.admin-sub { display: block; margin-top: 4rpx; font-size: 21rpx; color: #8894a5; }
.admin-btn {
  flex: none; padding: 14rpx 26rpx; border-radius: 999rpx;
  background: $uni-color-primary; color: #fff; font-size: 24rpx; font-weight: 600;
}
.admin-btn:active { opacity: 0.85; }

/* 分组头 */
.day { margin-bottom: 8rpx; }
.day-hd { display: flex; align-items: baseline; gap: 12rpx; padding: 20rpx 8rpx 12rpx; }
.day-key { font-size: 27rpx; font-weight: 600; color: #1c2534; }
.day-sub { font-size: 21rpx; color: #8894a5; }

/* 趟次卡 */
.tcard {
  background: #fff; border-radius: 22rpx; padding: 26rpx 24rpx 0; margin-bottom: 16rpx;
  box-shadow: 0 4rpx 14rpx rgba(22, 35, 58, 0.05);
}
.tcard:active { background: #fafbfd; }
.tcard .hd { display: flex; align-items: center; gap: 10rpx; }
.tcard .name { flex: 1; min-width: 0; font-size: 30rpx; font-weight: 600; color: #1c2534; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pill { flex: none; font-size: 20rpx; line-height: 1.6; padding: 2rpx 14rpx; border-radius: 20rpx; }
.pill.auto { background: #eef2f8; color: #64748b; }
.st-planned { background: #e9f2ff; color: #2570b3; }
.st-delivering { background: #fff2dd; color: #a96a10; }
.st-finished { background: #f0f2f5; color: #77849a; }
.st-cancelled { background: #ffecee; color: #bc3742; }

.stops { display: flex; align-items: flex-start; gap: 6rpx; margin-top: 12rpx; }
.pin { font-size: 20rpx; line-height: 1.5; }
.stops-text { flex: 1; font-size: 22rpx; line-height: 1.5; color: #6b7280; }

.meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8rpx; margin-top: 10rpx; font-size: 21rpx; color: #6b7280; }
.meta b { color: #2f3b4d; font-weight: 600; }
.meta .dot { color: #cbd5e1; }

.bar { margin-top: 18rpx; }
.bar-txt { display: flex; justify-content: space-between; font-size: 21rpx; color: #8894a5; margin-bottom: 8rpx; }
.track { height: 8rpx; border-radius: 4rpx; background: #eef1f6; overflow: hidden; }
.fill { height: 100%; border-radius: 4rpx; background: linear-gradient(90deg, #60a5fa, $uni-color-primary); }

.foot { display: flex; align-items: center; justify-content: space-between; margin-top: 18rpx; padding: 16rpx 0 18rpx; border-top: 1rpx solid #eef1f5; }
.foot-sum { font-size: 21rpx; color: #8894a5; }
.foot-go { font-size: 23rpx; font-weight: 600; color: $uni-color-primary; }

/* 物流入口 */
.fcard { display: flex; align-items: center; gap: 20rpx; background: #fff; border-radius: 22rpx; padding: 24rpx; margin-bottom: 16rpx; }
.fico {
  width: 68rpx; height: 68rpx; border-radius: 18rpx; flex: none; font-size: 28rpx; font-weight: 700;
  background: #eef4ff; color: $uni-color-primary; display: flex; align-items: center; justify-content: center;
}
.ftext { flex: 1; min-width: 0; }
.fname { display: block; font-size: 28rpx; font-weight: 600; color: #1c2534; }
.fsub { display: block; margin-top: 4rpx; font-size: 21rpx; color: #8894a5; }
.fchev { font-size: 32rpx; color: #cbd5e1; }

/* 历史 */
.past { margin-top: 8rpx; }
.past-row { display: flex; align-items: center; justify-content: space-between; padding: 20rpx 12rpx; }
.past-day { font-size: 23rpx; color: #64738a; }
.past-sum { font-size: 21rpx; color: #8894a5; }
.past-list { background: #fff; border-radius: 18rpx; overflow: hidden; }
.past-item { display: flex; align-items: center; gap: 14rpx; padding: 22rpx 24rpx; border-top: 1rpx solid #eef1f5; }
.past-item:first-child { border-top: 0; }
.past-name { flex: 1; min-width: 0; font-size: 25rpx; color: #2f3b4d; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.past-meta { font-size: 21rpx; color: #8894a5; }
.past-go { font-size: 28rpx; color: #cbd5e1; }

.tail { text-align: center; font-size: 21rpx; color: #a8b3c2; padding: 18rpx 0 8rpx; }
</style>
