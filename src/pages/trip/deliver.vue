<template>
  <view class="deliver-page">
    <!-- 趟次信息条 -->
    <view class="tsum">
      <view class="row">
        <view class="l">
          <text class="t1">负责人 {{ trip?.owner_name || '—' }} · {{ orders.length }} 单</text>
          <text class="t2">{{ trip?.stops_text || '未设置送货地点' }}</text>
        </view>
        <text class="sync" :class="{ ok: pending === 0 }" @tap="syncNow">
          {{ pending > 0 ? `⟳ 待同步 ${pending} 条` : '✓ 已同步' }}
        </text>
      </view>
      <view class="bar">
        <view class="bar-txt">
          <text>已送达 {{ deliveredCount }} / {{ orders.length }} 单</text>
          <text>{{ handledCount === orders.length ? '全部处理完' : `还剩 ${orders.length - handledCount} 单` }}</text>
        </view>
        <view class="track"><view class="fill" :style="{ width: progress + '%' }" /></view>
      </view>
    </view>

    <scroll-view scroll-y class="list">
      <view class="wrap">
        <!-- 未出车 -->
        <view v-if="state === 'planned'" class="depart">
          <text class="depart-t">还没出车</text>
          <text class="depart-p">
            出车后本趟 {{ orders.length }} 张待配送订单变为「配送中」，询单清单只读；之后新下的跟车送订单不再进本趟。
          </text>
          <view class="depart-btn" @tap="depart">
            {{ trip?.status === 'planned' ? '确认出车' : '已出车' }}
          </view>
        </view>

        <view v-else-if="state === 'finished'" class="done-note">
          本趟已收车 · {{ trip?.finished_at ? clockOf(trip.finished_at) : '' }}，只能查看
        </view>

        <!-- 站点分组 -->
        <view v-for="g in groups" :key="g.key">
          <view class="stop-hd" :class="{ now: g.isNow }">
            <text class="no">{{ g.no }}</text>
            <text class="stop-name">{{ g.name }}</text>
            <text v-if="g.isNow" class="now-tag">当前站</text>
            <text class="stop-meta">{{ g.rows.length }} 单 · {{ pendingOf(g) ? `${pendingOf(g)} 单待处理` : '已送完' }}</text>
          </view>

          <view
            v-for="row in g.rows"
            :key="row.order.id"
            class="ocard"
            :class="{ done: effStatus(row) === 'delivered', returned: effStatus(row) === 'cancelled' }"
            @tap="toggle(row.order.id)"
          >
            <view class="head">
              <view class="tx">
                <text class="cname">{{ row.order.customer_name }}</text>
                <text class="ono">{{ row.order.order_no }} · {{ row.order.items.length }} 个规格</text>
              </view>
              <view class="amt">
                <text class="money">{{ formatMoney(amountOf(row)) }}</text>
                <text class="stat" :class="`i-${effStatus(row)}`">
                  {{ statusLabel(row) }}<template v-if="row.pendingSync"> · 待同步</template>
                </text>
              </view>
            </view>

            <view v-if="openId === row.order.id" class="body" @tap.stop>
              <!-- 未出车 / 已收车：明细只读 -->
              <template v-if="state === 'planned' || state === 'finished'">
                <view v-for="it in row.order.items" :key="it.id" class="line">
                  <view class="line-nm">
                    <text class="ln">{{ it.spu_name }}</text>
                    <text class="ls">{{ it.sku_spec || '—' }} · {{ it.unit }}</text>
                  </view>
                  <text class="line-q">
                    {{ effStatus(row) === 'delivered' ? '实送' : '下单' }} {{ formatQty(it.delivered_quantity ?? it.quantity) }}
                  </text>
                </view>
                <view v-if="effStatus(row) === 'delivered'" class="sumline">
                  <text>实送金额</text>
                  <text class="sv">{{ formatMoney(row.order.delivered_amount ?? row.order.total_amount) }}</text>
                </view>
                <view class="hint">
                  {{ state === 'planned' ? '未出车，出车后才能确认实送数量。' : '本趟已收车，明细只读。' }}
                </view>
              </template>

              <!-- 已送达 -->
              <template v-else-if="effStatus(row) === 'delivered'">
                <view v-for="it in row.order.items" :key="it.id" class="line">
                  <view class="line-nm">
                    <text class="ln">{{ it.spu_name }}</text>
                    <text class="ls">{{ it.sku_spec || '—' }} · {{ it.unit }}</text>
                  </view>
                  <text class="line-q">实送 {{ formatQty(it.delivered_quantity ?? qtyOf(it)) }}</text>
                </view>
                <view class="sumline">
                  <text>实送金额</text>
                  <text class="sv">{{ formatMoney(row.order.delivered_amount ?? row.order.total_amount) }}</text>
                </view>
                <view class="paid">
                  <text class="paid-l">{{ row.order.pay_status === 'paid' ? '已登记收款' : '还没收款' }}</text>
                  <text v-if="row.order.pay_status === 'paid'" class="ok-txt">✓ 已收讫</text>
                  <text v-else class="pay-link" @tap="collect(row.order)">立即登记收款 ›</text>
                </view>
                <view class="hint">
                  送达 {{ row.order.delivered_at ? clockOf(row.order.delivered_at) : '—' }} · {{
                    row.order.sales_name || trip?.owner_name || ''
                  }} · 已扣库存、记应收
                </view>
              </template>

              <!-- 待送达 -->
              <template v-else>
                <view v-if="row.order.pending_price_adjustment" class="adj-banner">
                  <text class="adj-b-t">改价审批中（暂不可确认送达）</text>
                  <text class="adj-b-s">
                    申请人：{{ row.order.pending_price_adjustment.applicant_name || '—' }} ·
                    差额 {{ formatMoney(row.order.pending_price_adjustment.total_diff_amount) }} ·
                    {{ row.order.pending_price_adjustment.reason || '等待管理员审批' }}
                  </text>
                </view>

                <view v-for="it in row.order.items" :key="it.id" class="line">
                  <view class="line-nm">
                    <text class="ln">{{ it.spu_name }}</text>
                    <text class="ls">
                      {{ it.sku_spec || '—' }} · {{ it.unit }} ·
                      <text
                        v-if="it.original_unit_price != null && toNum(it.original_unit_price) !== toNum(it.unit_price)"
                        class="orig-p"
                      >{{ formatMoney(it.original_unit_price) }}</text>
                      {{ formatMoney(it.unit_price) }}
                    </text>
                  </view>
                  <text class="line-q">下单 {{ formatQty(it.quantity) }}</text>
                  <view class="stepper">
                    <view class="step" @tap="step(row.order.id, it.id, -1)">−</view>
                    <text class="q" :class="{ small: qtyOf(it) < toNum(it.quantity) }">{{ formatQty(qtyOf(it)) }}</text>
                    <view class="step" @tap="step(row.order.id, it.id, 1)">+</view>
                  </view>
                </view>

                <view class="sumline">
                  <text>实送金额 <text class="mc">（以服务端返回为准）</text></text>
                  <text class="sv">{{ formatMoney(previewAmount(row.order)) }}</text>
                </view>
                <view class="sumline tight">
                  <text>送完这单后欠款</text>
                  <text class="sv debt">{{ formatMoney(debtAfter(row)) }}</text>
                </view>

                <view v-if="state === 'delivering'" class="acts">
                  <view
                    class="btn-main"
                    :class="{
                      loading: submitting === row.order.id,
                      off: Boolean(row.order.pending_price_adjustment),
                      danger: !row.order.pending_price_adjustment && isAllZero(row.order),
                    }"
                    @tap="deliver(row)"
                  >
                    {{
                      row.order.pending_price_adjustment
                        ? '改价审批中'
                        : isAllZero(row.order)
                          ? '整单拒收(取消)'
                          : '确认送达'
                    }}
                  </view>
                  <view
                    v-if="!row.order.pending_price_adjustment"
                    class="btn-sub"
                    @tap="openAdjust(row.order)"
                  >申请降价</view>
                  <view class="btn-line" @tap="openReject(row.order.id)">没送成</view>
                </view>

                <view v-if="adjustId === row.order.id" class="reject">
                  <text class="rj-t">送达前申请改价（审批通过后才可送达）</text>
                  <view v-for="it in row.order.items" :key="`adj-${it.id}`" class="adj-row">
                    <view class="adj-nm">
                      <text class="ln">{{ it.spu_name }}</text>
                      <text class="ls">原价 {{ formatMoney(it.unit_price) }} × {{ formatQty(it.quantity) }}</text>
                    </view>
                    <input
                      v-model="adjustPrices[it.id]"
                      type="digit"
                      class="adj-inp"
                      placeholder="新单价"
                    />
                  </view>
                  <input
                    v-model="adjustReason"
                    class="adj-reason"
                    placeholder="填写降价原因（必填，如：本批货品质偏次客户要求降价）"
                  />
                  <view class="rj-acts">
                    <view class="rj-no" @tap="adjustId = null">取消</view>
                    <view class="rj-ok adj-ok" @tap="submitAdjust(row.order)">
                      {{ adjustSubmitting ? '提交中...' : '提交改价申请' }}
                    </view>
                  </view>
                </view>

                <view v-if="rejectId === row.order.id" class="reject">
                  <text class="rj-t">退回原因</text>
                  <view class="rchips">
                    <text
                      v-for="r in REASONS"
                      :key="r"
                      class="rchip"
                      :class="{ on: reason === r }"
                      @tap="reason = r"
                    >{{ r }}</text>
                  </view>
                  <text class="rj-tip">退回目标：待排车（默认）· 退回后订单回「待配送」，实送数量清空</text>
                  <view class="rj-acts">
                    <view class="rj-no" @tap="rejectId = null">取消</view>
                    <view class="rj-ok" @tap="reject(row)">确认退回</view>
                  </view>
                </view>

                <view class="hint">实送数量不能超过下单数量；库存不足只提示，不阻止送达。</view>
              </template>
            </view>
          </view>
        </view>

        <empty-state v-if="!loading && !orders.length" icon="📦" text="本趟还没有订单" padding="90rpx 32rpx" />
      </view>
    </scroll-view>

    <!-- 底部收车 -->
    <view class="footer">
      <view class="foot-info">
        <text class="fi-t">{{ footTitle }}</text>
        <text class="fi-s">{{ footSub }}</text>
      </view>
      <view
        class="finish-btn"
        :class="{ off: !canFinish, loading: finishing }"
        @tap="finish"
      >{{ state === 'finished' ? '已收车' : '收车' }}</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import { deliveryApi, deliveryOrderApi, orderApi } from '@/api'
import {
  enqueue,
  flushQueue,
  listOps,
  pendingCount,
  refreshPendingCount,
  watchNetwork,
} from '@/utils/offline-queue'
import { clockOf, formatMoney, formatQty, toNum } from '@/utils/format'
import type { CallListCustomer, Order, OrderItem, RouteTrip, TripOrderStatus } from '@/types'

interface ViewRow {
  order: Order
  stopSeq: number
  regionName: string
  pendingSync: boolean
}

interface StopGroup {
  key: string
  no: string
  name: string
  rows: ViewRow[]
  isNow: boolean
}

const REASONS = ['客户不要了', '缺货没带', '地址不对', '改下次送']

const tripId = ref(0)
const trip = ref<RouteTrip | null>(null)
const orders = ref<Order[]>([])
const balances = ref<Record<number, number>>({})
const loading = ref(true)
const openId = ref<number | null>(null)
const rejectId = ref<number | null>(null)
const reason = ref(REASONS[0])
const adjustId = ref<number | null>(null)
const adjustReason = ref('')
const adjustSubmitting = ref(false)
const adjustPrices = reactive<Record<number, string>>({})
const submitting = ref(0)
const finishing = ref(false)
const pendingDeliver = ref<Set<number>>(new Set())
const pendingReturn = ref<Set<number>>(new Set())
const qty = reactive<Record<number, number>>({})

const pending = computed(() => pendingCount.value)
const state = computed<'planned' | 'delivering' | 'finished'>(() => {
  const s = trip.value?.status
  if (s === 'planned') return 'planned'
  if (s === 'finished' || s === 'cancelled') return 'finished'
  return 'delivering'
})

/** 队列里还没同步的操作要覆盖在服务端状态之上，否则断网时页面会「弹回去」。 */
function effStatus(row: ViewRow): TripOrderStatus {
  if (pendingReturn.value.has(row.order.id)) return 'cancelled'
  if (pendingDeliver.value.has(row.order.id)) return 'delivered'
  return row.order.status === 'delivering' ? 'delivering' : (row.order.status as TripOrderStatus)
}

function statusLabel(row: ViewRow): string {
  const s = effStatus(row)
  if (s === 'delivered') return '已送达'
  if (s === 'cancelled') return '已退回/取消'
  if (row.order.pending_price_adjustment) return '改价审批中'
  return '待处理'
}

function isAllZero(order: Order): boolean {
  return order.items.length > 0 && order.items.every((it) => qtyOf(it) <= 0)
}

const deliveredCount = computed(
  () => orders.value.filter((o) => (pendingDeliver.value.has(o.id) ? true : o.status === 'delivered')).length,
)

const handledCount = computed(
  () =>
    orders.value.filter((o) => {
      const id = o.id
      if (pendingDeliver.value.has(id) || pendingReturn.value.has(id)) return true
      return o.status === 'delivered' || o.status === 'cancelled'
    }).length,
)

const progress = computed(() => {
  if (!orders.value.length) return 0
  return Math.max(4, Math.round((handledCount.value / orders.value.length) * 100))
})

const metaMap = ref<Map<number, { stop_seq: number; region_name: string }>>(new Map())

const rows = computed<ViewRow[]>(() =>
  orders.value.map((o) => {
    const meta = metaMap.value.get(o.id)
    return {
      order: o,
      stopSeq: meta?.stop_seq || 0,
      regionName: meta?.region_name || '—',
      pendingSync: pendingDeliver.value.has(o.id) || pendingReturn.value.has(o.id),
    }
  }),
)

/** 按站点分组；第一个还有待处理订单的站点标「当前站」。 */
const groups = computed<StopGroup[]>(() => {
  const map = new Map<number, ViewRow[]>()
  rows.value.forEach((r) => {
    const list = map.get(r.stopSeq) || []
    list.push(r)
    map.set(r.stopSeq, list)
  })
  const out: StopGroup[] = [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([seq, list]) => ({
      key: `s${seq}`,
      no: String(seq),
      name: list[0]?.regionName || '—',
      rows: list,
      isNow: false,
    }))
  const idx = out.findIndex((g) => g.rows.some((r) => isUnhandled(r)))
  if (idx >= 0 && state.value === 'delivering') out[idx].isNow = true
  return out
})

function isUnhandled(row: ViewRow): boolean {
  const s = effStatus(row)
  return s !== 'delivered' && s !== 'cancelled'
}

function pendingOf(g: StopGroup): number {
  return g.rows.filter((r) => isUnhandled(r)).length
}

function qtyOf(it: OrderItem): number {
  return qty[it.id] ?? toNum(it.delivered_quantity ?? it.quantity)
}

function step(orderId: number, itemId: number, delta: number) {
  const row = orders.value.find((o) => o.id === orderId)
  const it = row?.items.find((x) => x.id === itemId)
  if (!it) return
  const max = toNum(it.quantity)
  const current = qtyOf(it)
  const stepSize = Number.isInteger(max) ? 1 : 0.5
  const next = Math.min(max, Math.max(0, Math.round((current + delta * stepSize) * 100) / 100))
  qty[itemId] = next
}

function previewAmount(order: Order): number {
  return order.items.reduce((s, it) => s + qtyOf(it) * toNum(it.unit_price), 0)
}

function amountOf(row: ViewRow): number {
  if (effStatus(row) === 'delivered') {
    return toNum(row.order.delivered_amount ?? row.order.total_amount)
  }
  return toNum(row.order.total_amount)
}

function debtAfter(row: ViewRow): number {
  const base = balances.value[row.order.customer_id] || 0
  return base + previewAmount(row.order)
}

const canFinish = computed(
  () => state.value === 'delivering' && orders.value.length > 0 && handledCount.value === orders.value.length,
)

const footTitle = computed(() => {
  if (state.value === 'planned') return '出车前'
  if (state.value === 'finished') return '本趟已收车'
  if (!canFinish.value) return `还有 ${orders.value.length - handledCount.value} 单未处理`
  return `本趟 ${orders.value.length} 单已全部处理`
})

const footSub = computed(() => {
  if (state.value === 'planned') return '确认出车后才能逐单送达'
  if (state.value === 'finished') return `${deliveredCount.value} 单送达 · ${orders.value.length - deliveredCount.value} 单退回`
  if (!canFinish.value) return '全部送达 / 退回后才能收车'
  return '收车后状态变「已完成」'
})

function refreshPendingMarks() {
  const ops = listOps()
  pendingDeliver.value = new Set(ops.filter((o) => o.kind === 'deliver' && o.refId).map((o) => o.refId as number))
  pendingReturn.value = new Set(ops.filter((o) => o.kind === 'reschedule' && o.refId).map((o) => o.refId as number))
  refreshPendingCount()
}

async function load() {
  if (!tripId.value) return
  loading.value = true
  try {
    const [t, meta, orderPage, callList] = await Promise.all([
      deliveryApi.getTrip(tripId.value),
      deliveryApi.tripOrders(tripId.value).catch(() => []),
      orderApi.list({ route_trip_id: tripId.value, page_size: 100 }),
      deliveryApi.callList(tripId.value).catch(() => [] as CallListCustomer[]),
    ])
    trip.value = t
    metaMap.value = new Map(
      (meta as { order_id: number; stop_seq: number; region_name: string }[]).map((m) => [
        m.order_id,
        { stop_seq: m.stop_seq, region_name: m.region_name },
      ]),
    )
    orders.value = orderPage.items
    balances.value = Object.fromEntries(
      (callList as CallListCustomer[]).map((c) => [c.customer_id, toNum(c.ar_balance)]),
    )
    uni.setNavigationBarTitle({ title: t.name ? `${t.name} · 送达` : '送达' })
  } catch {
    /* 保留上一次数据 */
  } finally {
    loading.value = false
  }
}

let stopWatch: (() => void) | undefined

onLoad((opts) => {
  tripId.value = Number((opts as Record<string, string>)?.id || 0)
  refreshPendingMarks()
  load()
  stopWatch = watchNetwork(async (r) => {
    refreshPendingMarks()
    if (r.synced) {
      uni.showToast({ title: `已同步 ${r.synced} 条`, icon: 'none' })
      await load()
    }
  })
})

onShow(() => {
  refreshPendingMarks()
  load()
})

onUnload(() => {
  stopWatch?.()
})

function toggle(id: number) {
  openId.value = openId.value === id ? null : id
  rejectId.value = null
  adjustId.value = null
}

function openReject(id: number) {
  openId.value = id
  rejectId.value = id
  adjustId.value = null
}

function openAdjust(order: Order) {
  openId.value = order.id
  adjustId.value = order.id
  rejectId.value = null
  adjustReason.value = ''
  order.items.forEach((it) => {
    adjustPrices[it.id] = String(toNum(it.unit_price))
  })
}

async function submitAdjust(order: Order) {
  if (adjustSubmitting.value) return
  const items: { order_item_id: number; new_unit_price: string }[] = []
  for (const it of order.items) {
    const raw = (adjustPrices[it.id] ?? '').trim()
    const num = Number(raw)
    if (!raw || !Number.isFinite(num) || num < 0) {
      uni.showToast({ title: `${it.spu_name} 单价不合法`, icon: 'none' })
      return
    }
    if (num !== toNum(it.unit_price)) {
      items.push({ order_item_id: it.id, new_unit_price: num.toFixed(2) })
    }
  }
  if (!items.length) {
    uni.showToast({ title: '请至少修改一个商品的单价', icon: 'none' })
    return
  }
  const reasonText = adjustReason.value.trim()
  if (!reasonText) {
    uni.showToast({ title: '请填写降价原因', icon: 'none' })
    return
  }
  adjustSubmitting.value = true
  try {
    const res = await deliveryOrderApi.createPriceAdjustment(order.id, { items, reason: reasonText })
    adjustId.value = null
    uni.showToast({
      title: res.adjustment.status === 'approved' ? '改价已生效' : '改价申请已提交，等待管理员审批',
      icon: 'none',
    })
    await load()
  } catch {
    /* 请求封装已提示 */
  } finally {
    adjustSubmitting.value = false
  }
}

async function syncNow() {
  if (!pendingCount.value) {
    await load()
    uni.showToast({ title: '已是最新', icon: 'none' })
    return
  }
  const r = await flushQueue()
  refreshPendingMarks()
  if (r.synced) await load()
  uni.showToast({
    title: r.left ? `还有 ${r.left} 条未同步` : r.failed ? `同步完成，${r.failed} 条被拒绝` : '已全部同步',
    icon: 'none',
  })
}

async function depart() {
  if (!trip.value || trip.value.status !== 'planned') return
  uni.showModal({
    title: '确认出车',
    content: `本趟 ${orders.value.length} 张订单将变为「配送中」`,
    success: async (res) => {
      if (!res.confirm) return
      try {
        await deliveryApi.departTrip(tripId.value)
        uni.showToast({ title: '已出车', icon: 'none' })
        await load()
      } catch {
        /* 请求封装已提示 */
      }
    },
  })
}

async function deliver(row: ViewRow) {
  if (state.value !== 'delivering' || submitting.value) return
  const order = row.order
  if (order.pending_price_adjustment) {
    uni.showToast({ title: '改价审批中，请等待管理员审批后再送达', icon: 'none' })
    return
  }
  const items = order.items.map((it) => ({
    order_item_id: it.id,
    delivered_quantity: qtyOf(it),
  }))
  const allZero = items.length > 0 && items.every((it) => it.delivered_quantity <= 0)
  if (allZero) {
    uni.showModal({
      title: '确认整单拒收？',
      content: '全部商品实送为 0，提交后订单将直接取消并退还优惠券。',
      editable: true,
      placeholderText: '可填写拒收原因（默认：客户现场整单拒收）',
      success: async (res) => {
        if (!res.confirm) return
        const cancelReason = (res.content || '').trim() || '客户现场整单拒收'
        await submitDeliver(order, items, true, cancelReason)
      },
    })
    return
  }
  await submitDeliver(order, items, false)
}

async function submitDeliver(
  order: Order,
  items: { order_item_id: number; delivered_quantity: number }[],
  allZero: boolean,
  cancelReason?: string,
) {
  const keep = (it: OrderItem) => qtyOf(it)
  submitting.value = order.id
  enqueue({
    kind: allZero ? 'reschedule' : 'deliver',
    label: allZero ? `整单拒收 ${order.customer_name}` : `送达 ${order.customer_name}`,
    refId: order.id,
    url: `/orders/${order.id}/deliver`,
    method: 'POST',
    data: allZero ? { items, cancel_reason: cancelReason } : { items },
  })
  // 本地先落一份实送数量，断网时明细也能显示对的数量
  order.items.forEach((it) => {
    it.delivered_quantity = keep(it)
  })
  refreshPendingMarks()
  const r = await flushQueue()
  submitting.value = 0
  refreshPendingMarks()
  openId.value = null
  if (r.left) {
    uni.showToast({ title: `已存本地队列 · 待同步 ${r.left} 条`, icon: 'none' })
    return
  }
  uni.showToast({ title: allZero ? '已按整单拒收取消订单' : '已送达', icon: 'none' })
  await load()
}

async function reject(row: ViewRow) {
  if (state.value !== 'delivering') return
  const order = row.order
  enqueue({
    kind: 'reschedule',
    label: `退回 ${order.customer_name}`,
    refId: order.id,
    url: `/orders/${order.id}/reschedule`,
    method: 'POST',
    data: { target: 'pool', reason: reason.value },
  })
  refreshPendingMarks()
  rejectId.value = null
  openId.value = null
  const r = await flushQueue()
  refreshPendingMarks()
  if (r.left) {
    uni.showToast({ title: `已退回待排车 · 待同步 ${r.left} 条`, icon: 'none' })
    return
  }
  uni.showToast({ title: `已退回待排车（${reason.value}）`, icon: 'none' })
  await load()
}

async function finish() {
  if (!canFinish.value || finishing.value) return
  finishing.value = true
  try {
    await deliveryApi.finishTrip(tripId.value)
    uni.showToast({ title: '已收车', icon: 'none' })
    await load()
  } catch {
    /* 请求封装已提示 */
  } finally {
    finishing.value = false
  }
}

function collect(order: Order) {
  uni.showToast({ title: '登记收款在「欠款」菜单，尚未开发', icon: 'none' })
}
</script>

<style lang="scss" scoped>
.deliver-page { height: 100vh; background: #f4f6f9; display: flex; flex-direction: column; box-sizing: border-box; }
/* H5 顶部有 44px 原生导航栏，100vh 会多出一屏底部被截掉 */
/* #ifdef H5 */
.deliver-page { height: calc(100vh - 44px); }
/* #endif */

/* 信息条 */
.tsum {
  margin: 16rpx 16rpx 0; padding: 22rpx 24rpx; border-radius: 22rpx; color: #fff;
  background: linear-gradient(140deg, #16233a, #263d59 62%, #2c4a68);
  box-shadow: 0 10rpx 24rpx rgba(22, 35, 58, 0.22);
}
.row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16rpx; }
.l { flex: 1; min-width: 0; }
.t1 { display: block; font-size: 25rpx; font-weight: 600; }
.t2 { display: block; margin-top: 6rpx; font-size: 21rpx; line-height: 1.5; color: rgba(255, 255, 255, 0.66); }
.sync { flex: none; font-size: 20rpx; padding: 4rpx 12rpx; border-radius: 20rpx; background: rgba(251, 191, 36, 0.18); color: #fcd34d; }
.sync.ok { background: rgba(52, 211, 153, 0.18); color: #6ee7b7; }
.bar { margin-top: 18rpx; }
.bar-txt { display: flex; justify-content: space-between; font-size: 21rpx; color: rgba(255, 255, 255, 0.7); margin-bottom: 8rpx; }
.track { height: 8rpx; border-radius: 4rpx; background: rgba(255, 255, 255, 0.18); overflow: hidden; }
.fill { height: 100%; border-radius: 4rpx; background: linear-gradient(90deg, #93c5fd, #e0f2fe); }

.list { flex: 1; height: 0; }
.wrap { padding: 16rpx 16rpx 30rpx; }

/* 出车确认 */
.depart { background: #fff; border-radius: 22rpx; padding: 28rpx 24rpx; margin-bottom: 16rpx; }
.depart-t { display: block; font-size: 29rpx; font-weight: 600; color: #1c2534; }
.depart-p { display: block; margin-top: 12rpx; font-size: 22rpx; line-height: 1.6; color: #6b7280; }
.depart-btn {
  margin-top: 24rpx; height: 84rpx; border-radius: 16rpx; background: $uni-color-primary; color: #fff;
  font-size: 28rpx; font-weight: 600; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 10rpx 22rpx rgba(37, 99, 235, 0.22);
}
.done-note { padding: 14rpx 20rpx; margin-bottom: 12rpx; border-radius: 14rpx; background: #eef2f8; color: #64738a; font-size: 21rpx; }

/* 站点 */
.stop-hd { display: flex; align-items: center; gap: 10rpx; padding: 18rpx 6rpx 10rpx; }
.no {
  width: 36rpx; height: 36rpx; line-height: 36rpx; text-align: center; border-radius: 10rpx;
  background: #cbd5e1; color: #fff; font-size: 20rpx; font-weight: 700; flex: none;
}
.stop-hd.now .no { background: $uni-color-primary; }
.stop-name { font-size: 25rpx; font-weight: 600; color: #1c2534; }
.now-tag { font-size: 18rpx; padding: 2rpx 10rpx; border-radius: 12rpx; background: #e9f2ff; color: #2570b3; }
.stop-meta { margin-left: auto; font-size: 20rpx; color: #8894a5; }

/* 订单卡 */
.ocard { background: #fff; border-radius: 20rpx; padding: 22rpx; margin-bottom: 14rpx; }
.ocard.done { background: #fcfefd; }
.ocard.returned { background: #fbfcfd; }
.head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14rpx; }
.tx { flex: 1; min-width: 0; }
.cname { display: block; font-size: 28rpx; font-weight: 600; color: #1c2534; }
.ono { display: block; margin-top: 4rpx; font-size: 20rpx; color: #8894a5; }
.amt { text-align: right; flex: none; }
.money { display: block; font-size: 28rpx; font-weight: 600; color: #1c2534; font-variant-numeric: tabular-nums; }
.stat { display: inline-block; margin-top: 4rpx; font-size: 19rpx; padding: 2rpx 10rpx; border-radius: 8rpx; }
.i-delivered { background: #e6f7ee; color: #1f8459; }
.i-cancelled { background: #f0f2f5; color: #77849a; }
.i-pending, .i-delivering { background: #fff2dd; color: #a96a10; }

.body { margin-top: 16rpx; border-top: 1rpx solid #eef1f5; padding-top: 12rpx; }
.line { display: flex; align-items: center; gap: 14rpx; padding: 12rpx 0; }
.line-nm { flex: 1; min-width: 0; }
.ln { display: block; font-size: 25rpx; color: #2f3b4d; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ls { display: block; font-size: 20rpx; color: #9aa6b6; }
.line-q { flex: none; font-size: 21rpx; color: #8894a5; }

.stepper { flex: none; display: flex; align-items: center; gap: 8rpx; }
.step {
  width: 52rpx; height: 52rpx; border-radius: 12rpx; background: #f1f4f9; color: #46536a;
  font-size: 30rpx; line-height: 50rpx; text-align: center;
}
.q { min-width: 56rpx; text-align: center; font-size: 26rpx; font-weight: 600; color: #1c2534; }
.q.small { color: #dc2626; }

.sumline { display: flex; align-items: center; justify-content: space-between; padding: 14rpx 0; border-top: 1rpx solid #f2f5f8; font-size: 22rpx; color: #6b7280; }
.sumline.tight { border-top: 0; padding-top: 0; }
.sv { font-size: 27rpx; font-weight: 600; color: #1c2534; font-variant-numeric: tabular-nums; }
.sv.debt { color: #dc2626; }
.mc { color: #a8b3c2; font-size: 19rpx; }

.paid { display: flex; align-items: center; justify-content: space-between; padding: 12rpx 0; border-top: 1rpx solid #f2f5f8; }
.paid-l { font-size: 22rpx; color: #6b7280; }
.ok-txt { font-size: 22rpx; color: #1f8459; font-weight: 600; }
.pay-link { font-size: 22rpx; color: $uni-color-primary; font-weight: 600; }

.acts { display: flex; gap: 12rpx; margin-top: 16rpx; }
.btn-main {
  flex: 1; height: 78rpx; border-radius: 14rpx; background: $uni-color-primary; color: #fff;
  font-size: 27rpx; font-weight: 600; display: flex; align-items: center; justify-content: center;
}
.btn-main.loading { opacity: 0.6; }
.btn-main.off { background: #cbd5e1; color: #64748b; }
.btn-main.danger { background: #dc2626; }
.btn-sub {
  flex: 0 0 164rpx; height: 78rpx; border-radius: 14rpx; border: 1rpx solid #f59e0b; background: #fffbeb;
  color: #b45309; font-size: 24rpx; font-weight: 600;
  display: flex; align-items: center; justify-content: center;
}
.btn-line {
  flex: 0 0 144rpx; height: 78rpx; border-radius: 14rpx; border: 1rpx solid #e2e8f0; background: #fff;
  color: #64738a; font-size: 24rpx; font-weight: 600;
  display: flex; align-items: center; justify-content: center;
}
.adj-banner {
  margin-bottom: 14rpx; padding: 14rpx 16rpx; border-radius: 12rpx;
  background: #fffbeb; border: 1rpx solid #fde68a;
}
.adj-b-t { display: block; font-size: 23rpx; font-weight: 600; color: #b45309; }
.adj-b-s { display: block; margin-top: 4rpx; font-size: 20rpx; line-height: 1.45; color: #92400e; }
.orig-p { text-decoration: line-through; color: #9aa6b6; margin-right: 6rpx; }
.adj-row { display: flex; align-items: center; gap: 12rpx; margin-top: 12rpx; }
.adj-nm { flex: 1; min-width: 0; }
.adj-inp {
  width: 180rpx; height: 64rpx; padding: 0 16rpx; border-radius: 10rpx;
  background: #fff; border: 1rpx solid #dbe3ee; font-size: 24rpx; text-align: right;
}
.adj-reason {
  margin-top: 14rpx; height: 68rpx; padding: 0 16rpx; border-radius: 10rpx;
  background: #fff; border: 1rpx solid #dbe3ee; font-size: 23rpx;
}
.rj-ok.adj-ok { background: #2563eb; }

.reject { margin-top: 16rpx; padding: 18rpx; border-radius: 14rpx; background: #f7f9fc; }
.rj-t { display: block; font-size: 23rpx; font-weight: 600; color: #2f3b4d; }
.rchips { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 12rpx; }
.rchip { padding: 8rpx 18rpx; border-radius: 24rpx; background: #fff; color: #64738a; font-size: 21rpx; border: 1rpx solid #e6ebf2; }
.rchip.on { background: #e9f2ff; border-color: rgba(37, 99, 235, 0.4); color: #2570b3; font-weight: 600; }
.rj-tip { display: block; margin-top: 12rpx; font-size: 20rpx; line-height: 1.5; color: #8894a5; }
.rj-acts { display: flex; gap: 12rpx; margin-top: 16rpx; }
.rj-no, .rj-ok { flex: 1; height: 68rpx; border-radius: 12rpx; font-size: 24rpx; display: flex; align-items: center; justify-content: center; }
.rj-no { background: #fff; border: 1rpx solid #e2e8f0; color: #64738a; }
.rj-ok { background: #dc2626; color: #fff; font-weight: 600; }

.hint { margin-top: 12rpx; font-size: 20rpx; line-height: 1.5; color: #a8b3c2; }

/* 底部 */
.footer {
  flex: none; display: flex; align-items: center; gap: 16rpx; padding: 16rpx 24rpx;
  background: #fff; border-top: 1rpx solid #eef1f5; padding-bottom: calc(16rpx + constant(safe-area-inset-bottom));
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
}
.foot-info { flex: 1; min-width: 0; }
.fi-t { display: block; font-size: 24rpx; font-weight: 600; color: #1c2534; }
.fi-s { display: block; margin-top: 2rpx; font-size: 20rpx; color: #8894a5; }
.finish-btn {
  flex: none; width: 220rpx; height: 80rpx; border-radius: 16rpx; background: $uni-color-primary; color: #fff;
  font-size: 27rpx; font-weight: 600; display: flex; align-items: center; justify-content: center;
}
.finish-btn.off { background: #e8edf4; color: #9aa6b6; }
.finish-btn.loading { opacity: 0.6; }
</style>
