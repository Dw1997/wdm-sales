<template>
  <view class="trip-page">
    <!-- 顶部四板块分段栏 -->
    <view class="seg-wrap">
      <view class="seg-bar">
        <view
          v-for="item in segTabs"
          :key="item.key"
          class="seg-item"
          :class="{ on: activeTab === item.key }"
          @tap="activeTab = item.key"
        >
          <text class="seg-txt">{{ item.label }}</text>
          <text v-if="item.badge > 0" class="seg-badge">{{ item.badge > 99 ? '99+' : item.badge }}</text>
        </view>
      </view>
    </view>

    <scroll-view
      scroll-y
      class="content"
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
    >
      <view class="wrap">
        <!-- 板块一：路线出车 -->
        <template v-if="activeTab === 'route'">
          <view v-if="canPlan" class="admin-bar">
            <view class="admin-txt">
              <text class="admin-title">出车安排</text>
              <text class="admin-sub">排线路、定司机，司机端按趟询单送货</text>
            </view>
            <view class="admin-btn" @tap="goPlan">＋ 安排出车</view>
          </view>

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

              <view
                v-if="t.status === 'planned' && (canPlan || canOperate(t))"
                class="ops-row"
              >
                <text class="foot-go" @tap.stop="openTrip(t)">去询单 ›</text>
                <view class="ops-btns">
                  <view v-if="canPlan" class="op-btn" @tap.stop="goEdit(t)">修改</view>
                  <view v-if="canPlan" class="op-btn danger" @tap.stop="cancelTrip(t)">取消</view>
                  <view v-if="canOperate(t)" class="op-btn primary" @tap.stop="goDeliver(t)">去出车</view>
                </view>
              </view>
              <view v-else class="foot">
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
            近期共 {{ trips.length }} 趟{{ canPlan ? ' · 点顶部「安排出车」加一趟' : '' }}
          </view>
        </template>

        <!-- 板块二：物流交车（直接展示今天/明天批次，点击直达交车页） -->
        <template v-else-if="activeTab === 'freight'">
          <view class="dtabs">
            <view class="dtab" :class="{ on: freightDay === 0 }" @tap="freightDay = 0">
              <text class="dtab-t">今天</text>
              <text class="dtab-s">{{ cnDate(todayStr) }}</text>
            </view>
            <view class="dtab" :class="{ on: freightDay === 1 }" @tap="freightDay = 1">
              <text class="dtab-t">明天</text>
              <text class="dtab-s">{{ cnDate(tomorrowStr) }}</text>
            </view>
          </view>

          <view v-for="s in freightDayList" :key="s.id" class="tcard" @tap="goFreight(s.id)">
            <view class="hd">
              <text class="name">{{ s.line_name }}</text>
              <text v-if="s.schedule_label || s.depart_time" class="pill auto">
                {{ s.schedule_label ? `${s.schedule_label} ` : '' }}{{ s.depart_time }}
              </text>
              <text class="pill" :class="s.status === 'open' ? 'st-delivering' : 'st-finished'">
                {{ s.status === 'open' ? '待交车' : '已交车' }}
              </text>
            </view>

            <view class="meta">
              <text>{{ s.plate_no || '未登记车牌' }}</text>
              <template v-if="s.driver_name">
                <text class="dot">·</text>
                <text>司机 {{ s.driver_name }}</text>
              </template>
              <text class="dot">·</text>
              <text>订单 <b>{{ s.order_count }}</b> 单 · <b>{{ formatMoney(s.order_amount) }}</b></text>
            </view>

            <view class="fcut" :class="{ over: s.status !== 'open' }">
              <text>🕒</text>
              <text class="fcut-t">
                截单 {{ clockOf(s.cutoff_at) }} ·
                {{ s.status === 'open' ? timeLeft(s.cutoff_at) : `已交车 ${s.handed_over_count} / ${s.order_count} 单` }}
              </text>
            </view>

            <view v-if="s.handed_over_count > 0 && s.order_count > 0" class="bar">
              <view class="track">
                <view class="fill" :style="{ width: freightProgress(s) + '%' }" />
              </view>
            </view>

            <view class="foot">
              <text class="foot-sum">{{ s.status === 'open' ? '按乡镇顺序装车 · 交车即送达' : '已交车，只能查看' }}</text>
              <text class="foot-go">{{ s.status === 'open' ? '去交车 ›' : '查看 ›' }}</text>
            </view>
          </view>

          <empty-state
            v-if="!loading && !freightDayList.length"
            icon="🚛"
            :text="freightDay === 0 ? '今天没有物流批次' : '明天还没有排批次'"
            padding="80rpx 32rpx"
          />

          <view v-if="freightTail" class="tail">{{ freightTail }}</view>

          <view class="fpast">
            <text class="fpast-day">昨天 · {{ cnDate(yesterdayStr) }}</text>
            <text class="fpast-sum">{{ freightPastSummary }}</text>
          </view>

          <view class="fnotice">
            <text class="fnotice-t">交车后这些订单算送达</text>
            <text class="fnotice-s">
              扣库存、记应收；包邮订单的运费计入成本、重算利润。运费没填也能交，系统会提示补录。
            </text>
          </view>
        </template>

        <!-- 板块三：城区自送 -->
        <direct-deliver-list
          v-else-if="activeTab === 'local'"
          mode="local"
          :pending-orders="localPending"
          :done-orders="localDone"
          :loading="loading"
          :is-admin="auth.isAdmin"
          @delivered="load"
        />

        <!-- 板块四：门店自提 -->
        <direct-deliver-list
          v-else
          mode="pickup"
          :pending-orders="pickupPending"
          :done-orders="pickupDone"
          :loading="loading"
          :is-admin="auth.isAdmin"
          @delivered="load"
        />
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import DirectDeliverList from '@/components/DirectDeliverList.vue'
import { useAuthStore } from '@/stores/auth'
import { deliveryApi, freightApi, orderApi } from '@/api'
import { clockOf, cnDate, dayDiff, dayLabel, formatMoney, timeLeft, ymd } from '@/utils/format'
import { TRIP_STATUS } from '@/utils/dict'
import type { FreightShipment, Order, RouteTrip, RouteTripStatus } from '@/types'

type SectionTab = 'route' | 'freight' | 'local' | 'pickup'

interface DayGroup {
  key: string
  label: string
  dateText: string
  trips: RouteTrip[]
}

const auth = useAuthStore()

const todayStr = ymd(0)
const tomorrowStr = ymd(1)
const yesterdayStr = ymd(-1)

const activeTab = ref<SectionTab>('route')
const freightDay = ref<0 | 1>(0)
const trips = ref<RouteTrip[]>([])
const shipments = ref<FreightShipment[]>([])
const localPending = ref<Order[]>([])
const localDone = ref<Order[]>([])
const pickupPending = ref<Order[]>([])
const pickupDone = ref<Order[]>([])
const loading = ref(true)
const refreshing = ref(false)
const showPast = ref(false)
const cancelling = ref(false)

const canPlan = computed(
  () => auth.isAdmin && (auth.can('delivery.route.manage') || !auth.permissions.length),
)

function canOperate(t: RouteTrip): boolean {
  const me = auth.user
  return auth.isAdmin || (!!me && t.owner_id === me.id)
}

const activeTripCount = computed(
  () => trips.value.filter((t) => (t.status === 'planned' || t.status === 'delivering') && dayDiff(t.trip_date) >= 0).length,
)

const openFreightCount = computed(
  () => shipments.value.filter((s) => s.ship_date === todayStr && s.status === 'open').length,
)

const freightDayList = computed(() =>
  shipments.value.filter((s) => s.ship_date === (freightDay.value === 0 ? todayStr : tomorrowStr)),
)

const freightPastSummary = computed(() => {
  const past = shipments.value.filter((s) => s.ship_date < todayStr)
  if (!past.length) return '暂无交车记录'
  const orders = past.reduce((sum, b) => sum + b.order_count, 0)
  return `已交车 ${orders} 单`
})

const freightTail = computed(() => {
  const list = freightDayList.value
  if (!list.length) return freightDay.value === 0 ? '今天还没有批次，截单前由 Web 端排批次' : ''
  const open = list.filter((b) => b.status === 'open').length
  return freightDay.value === 0
    ? `${open} 个批次待交车，交车后算送达`
    : `明天共 ${list.length} 个批次`
})

const segTabs = computed(() => [
  { key: 'route' as SectionTab, label: '路线出车', badge: activeTripCount.value },
  { key: 'freight' as SectionTab, label: '物流', badge: openFreightCount.value },
  { key: 'local' as SectionTab, label: '城区自送', badge: localPending.value.length },
  { key: 'pickup' as SectionTab, label: '自提', badge: pickupPending.value.length },
])

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

function statusLabel(s: RouteTripStatus): string {
  return TRIP_STATUS[s]?.label || s
}

function progressOf(t: RouteTrip): number {
  if (t.order_count <= 0) return 0
  return Math.min(Math.round((t.delivered_count / t.order_count) * 100), 100)
}

function freightProgress(s: FreightShipment): number {
  if (s.order_count <= 0) return 0
  return Math.min(Math.round((s.handed_over_count / s.order_count) * 100), 100)
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

function isDeliveredToday(o: Order, todayStr: string): boolean {
  const ts = o.delivered_at || o.created_at || ''
  return ts.slice(0, 10) === todayStr
}

async function load() {
  loading.value = true
  const curToday = ymd(0)
  try {
    const [tripRes, freightRes, localPendingRes, localDoneRes, pickupPendingRes, pickupDoneRes] =
      await Promise.all([
        deliveryApi.listTrips({
          date_from: ymd(-7),
          date_to: ymd(30),
          page_size: 100,
          order_by: 'trip_date',
        }),
        freightApi.list({ date_from: ymd(-1), date_to: ymd(1), page_size: 100 }).catch(() => null),
        orderApi.list({ delivery_mode: 'local', status: 'pending', page_size: 100 }).catch(() => null),
        orderApi.list({ delivery_mode: 'local', status: 'delivered', page_size: 50 }).catch(() => null),
        orderApi.list({ delivery_mode: 'pickup', status: 'pending', page_size: 100 }).catch(() => null),
        orderApi.list({ delivery_mode: 'pickup', status: 'delivered', page_size: 50 }).catch(() => null),
      ])
    trips.value = tripRes.items
    if (freightRes) shipments.value = freightRes.items
    if (localPendingRes) localPending.value = localPendingRes.items
    if (localDoneRes) localDone.value = localDoneRes.items.filter((o) => isDeliveredToday(o, curToday))
    if (pickupPendingRes) pickupPending.value = pickupPendingRes.items
    if (pickupDoneRes) pickupDone.value = pickupDoneRes.items.filter((o) => isDeliveredToday(o, curToday))
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

function goFreight(id?: number) {
  uni.navigateTo({ url: id ? `/pages/trip/freight?id=${id}` : '/pages/trip/freight' })
}

function goPlan() {
  uni.navigateTo({ url: '/pages/trip/plan' })
}

function goEdit(t: RouteTrip) {
  uni.navigateTo({ url: `/pages/trip/plan?id=${t.id}` })
}

function goDeliver(t: RouteTrip) {
  uni.navigateTo({ url: `/pages/trip/deliver?id=${t.id}` })
}

async function cancelTrip(t: RouteTrip) {
  if (cancelling.value) return
  const label = t.name || cnDate(t.trip_date) + ' 出车'
  const tip = t.order_count > 0 ? `本趟 ${t.order_count} 张订单将退回待排车。` : ''
  const confirmed = await new Promise<boolean>((resolve) => {
    uni.showModal({
      title: '取消出车',
      content: `确定取消「${label}」吗？${tip}`,
      confirmText: '确定取消',
      confirmColor: '#dc2626',
      success: (r) => resolve(!!r.confirm),
      fail: () => resolve(false),
    })
  })
  if (!confirmed) return

  cancelling.value = true
  try {
    const res = await deliveryApi.cancelTrip(t.id)
    const returned = res.returned_orders?.length || 0
    const warnings = res.warnings || []
    const summary = `已取消出车${returned ? `，${returned} 单已退回待排车` : ''}`
    if (warnings.length) {
      uni.showModal({
        title: '已取消出车',
        content: [
          summary,
          ...warnings.map((w) => w.message || w.code),
        ].join('\n'),
        showCancel: false,
      })
    } else {
      uni.showToast({ title: summary, icon: 'none' })
    }
    await load()
  } catch {
    /* request 已提示 */
  } finally {
    cancelling.value = false
  }
}
</script>

<style lang="scss" scoped>
.trip-page {
  height: 100vh; background: #f4f6f9; display: flex; flex-direction: column; box-sizing: border-box;
}
/* H5 的 tabBar 是 fixed 覆盖层，页面容器减掉它的高度（小程序 tabBar 不占视口，不用减） */
/* #ifdef H5 */
.trip-page { height: calc(100vh - 50px); }
/* #endif */

/* 顶部四板块分段栏 */
.seg-wrap {
  flex: none;
  background: #fff;
  padding: calc(var(--status-bar-height, 0px) + 12rpx) 16rpx 14rpx;
  border-bottom: 1rpx solid #eef1f5;
}
.seg-bar {
  display: flex; align-items: center; gap: 8rpx;
  background: #f2f5fa; border-radius: 16rpx; padding: 6rpx;
}
.seg-item {
  flex: 1; min-width: 0; height: 64rpx; border-radius: 12rpx;
  display: flex; align-items: center; justify-content: center; gap: 6rpx;
  color: #64738a; font-size: 24rpx; font-weight: 500;
}
.seg-item.on {
  background: #fff; color: $uni-color-primary; font-weight: 600;
  box-shadow: 0 2rpx 8rpx rgba(22, 35, 58, 0.08);
}
.seg-txt { white-space: nowrap; }
.seg-badge {
  min-width: 30rpx; height: 30rpx; line-height: 30rpx; padding: 0 8rpx;
  border-radius: 999rpx; text-align: center; font-size: 18rpx; font-weight: 600;
  background: #e2e8f0; color: #475569; box-sizing: border-box;
}
.seg-item.on .seg-badge { background: #eef4ff; color: $uni-color-primary; }

.content { flex: 1; height: 0; }
.wrap { padding: 16rpx 16rpx 60rpx; }

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
.day-hd { display: flex; align-items: baseline; gap: 12rpx; padding: 12rpx 8rpx 12rpx; }
.day-key { font-size: 27rpx; font-weight: 600; color: #1c2534; }
.day-sub { font-size: 21rpx; color: #8894a5; }

/* 趟次/批次卡 */
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

/* 待出车趟次的操作行（管理员/司机） */
.ops-row {
  display: flex; align-items: center; justify-content: space-between; gap: 12rpx;
  margin-top: 18rpx; padding: 16rpx 0 18rpx; border-top: 1rpx solid #eef1f5;
}
.ops-btns { display: flex; align-items: center; gap: 12rpx; }
.op-btn { padding: 10rpx 22rpx; border-radius: 999rpx; font-size: 22rpx; background: #f2f5fa; color: #475569; }
.op-btn:active { opacity: 0.8; }
.op-btn.danger { background: #ffecee; color: #bc3742; }
.op-btn.primary { background: $uni-color-primary; color: #fff; font-weight: 600; }

/* 物流板块：今天/明天切换 + 截单提示 + 昨日记录 + 说明 */
.dtabs { display: flex; gap: 12rpx; margin-bottom: 16rpx; }
.dtab {
  flex: 1; padding: 16rpx 12rpx; border-radius: 18rpx; background: #fff; text-align: center;
  border: 2rpx solid transparent; box-shadow: 0 4rpx 12rpx rgba(22, 35, 58, 0.04);
}
.dtab.on { background: #eef4ff; border-color: rgba(37, 99, 235, 0.32); }
.dtab-t { display: block; font-size: 27rpx; font-weight: 600; color: #1c2534; }
.dtab.on .dtab-t { color: $uni-color-primary; }
.dtab-s { display: block; margin-top: 4rpx; font-size: 20rpx; color: #8894a5; }
.fcut { display: flex; align-items: center; gap: 8rpx; margin-top: 12rpx; font-size: 21rpx; color: #a96a10; }
.fcut.over { color: #8894a5; }
.fcut-t { flex: 1; min-width: 0; }
.fpast {
  display: flex; align-items: center; justify-content: space-between;
  background: #fff; border-radius: 18rpx; padding: 22rpx 24rpx; margin-top: 16rpx;
}
.fpast-day { font-size: 24rpx; color: #2f3b4d; }
.fpast-sum { font-size: 22rpx; color: #8894a5; }
.fnotice {
  margin-top: 16rpx; padding: 20rpx 24rpx; border-radius: 18rpx; background: #edf1f7;
}
.fnotice-t { display: block; font-size: 24rpx; font-weight: 600; color: #1c2534; }
.fnotice-s { display: block; margin-top: 8rpx; font-size: 21rpx; line-height: 1.6; color: #64738a; }

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
