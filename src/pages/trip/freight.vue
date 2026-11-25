<template>
  <view class="freight-page">
    <!-- ============ 批次列表 ============ -->
    <template v-if="view === 'list'">
      <view class="dtabs">
        <view class="dtab" :class="{ on: day === 0 }" @tap="day = 0">
          <text class="dtab-t">今天</text>
          <text class="dtab-s">{{ cnDate(today) }}</text>
        </view>
        <view class="dtab" :class="{ on: day === 1 }" @tap="day = 1">
          <text class="dtab-t">明天</text>
          <text class="dtab-s">{{ cnDate(tomorrow) }}</text>
        </view>
      </view>

      <scroll-view scroll-y class="list" refresher-enabled :refresher-triggered="refreshing" @refresherrefresh="onRefresh">
        <view class="wrap">
          <view v-for="b in dayList" :key="b.id" class="bcard" @tap="openDetail(b)">
            <view class="bhd">
              <text class="bline">{{ b.line_name }}</text>
              <text class="pill" :class="b.status === 'open' ? 'open' : 'done'">
                {{ statusLabel(b.status) }}
              </text>
            </view>
            <view class="bsub">
              <text>{{ b.plate_no || '未登记车牌' }}</text>
              <text class="dot">·</text>
              <text>发车 {{ b.depart_time }}{{ b.schedule_label ? `（${b.schedule_label}）` : '' }}</text>
              <text class="dot">·</text>
              <text>{{ b.order_count }} 单 · {{ formatMoney(b.order_amount) }}</text>
            </view>
            <view class="bcut" :class="{ over: b.status !== 'open' }">
              <text>🕒</text>
              <text class="bcut-t">
                截单 {{ clockOf(b.cutoff_at) }} ·
                {{ b.status === 'open' ? timeLeft(b.cutoff_at) : `已交车 ${b.handed_over_count} / ${b.order_count} 单` }}
              </text>
            </view>
            <view v-if="b.handed_over_count > 0 && b.order_count > 0" class="prog">
              <view class="pg-fill" :style="{ width: Math.round((b.handed_over_count / b.order_count) * 100) + '%' }" />
            </view>
            <view class="bfoot">
              <text class="bsum">{{ b.status === 'open' ? '按乡镇顺序装车 · 交车即送达' : '已交车，只能查看' }}</text>
              <text class="bgo">{{ b.status === 'open' ? '去交车' : '查看' }} ›</text>
            </view>
          </view>

          <empty-state
            v-if="!loading && !dayList.length"
            icon="🚛"
            :text="day === 0 ? '今天没有物流批次' : '明天还没有排批次'"
            padding="90rpx 32rpx"
          />

          <view class="btail">{{ btail }}</view>

          <view class="past">
            <text class="past-day">{{ yesterdayLabel }}</text>
            <text class="past-sum">{{ pastSummary }}</text>
          </view>

          <view class="notice">
            <text class="notice-t">交车后这些订单算送达</text>
            <text class="notice-s">
              扣库存、记应收；包邮订单的运费计入成本、重算利润。运费没填也能交，系统会提示补录。
            </text>
          </view>
        </view>
      </scroll-view>
    </template>

    <!-- ============ 交车页 ============ -->
    <template v-else>
      <scroll-view scroll-y class="list">
        <view class="wrap">
          <view class="dhead">
            <view class="dhd">
              <text class="dline">{{ detail?.line_name }} · {{ detail?.plate_no || '未登记车牌' }}</text>
              <text class="pill" :class="detail?.status === 'open' ? 'open' : 'done'">
                {{ detail ? statusLabel(detail.status) : '' }}
              </text>
            </view>
            <view class="drows">
              <text>司机 {{ detail?.driver_name || '—' }}{{ detail?.driver_phone ? ` · ${detail.driver_phone}` : '' }}</text>
              <text>发车 {{ detail?.depart_time }}{{ detail?.schedule_label ? `（${detail.schedule_label}）` : '' }} · 截单 {{ detail?.cutoff_at ? clockOf(detail.cutoff_at) : '—' }}</text>
              <text>{{ detail?.order_count }} 单 · 货款合计 {{ formatMoney(detail?.order_amount) }}</text>
            </view>
          </view>

          <view v-if="detail?.status === 'open'" class="split">
            <view class="split-row">
              <text class="split-t">整车运费</text>
              <input v-model="totalFreight" class="split-input" type="digit" placeholder="填这一车总运费" />
              <view class="split-btn" :class="{ off: !totalFreight }" @tap="allocate">分摊</view>
            </view>
            <text class="split-tip">按订单金额占比分摊给包邮订单，尾差并入金额最大的一单；分摊后可逐单微调。</text>
          </view>

          <view v-for="(g, gi) in townGroups" :key="g.name">
            <view class="stop-hd">
              <text class="no">{{ gi + 1 }}</text>
              <text class="stop-name">{{ g.name }}</text>
              <text class="stop-meta">{{ g.rows.length }} 单</text>
            </view>

            <view
              v-for="o in g.rows"
              :key="o.order_id"
              class="frow"
              :class="{ sel: isSelected(o), locked: !selectable(o) }"
              @tap="toggle(o)"
            >
              <view class="cbx" :class="{ on: isSelected(o) }">
                <text v-if="isSelected(o)" class="tick">✓</text>
              </view>
              <view class="ftx">
                <text class="fcname">{{ o.customer_name }}</text>
                <view class="fl2">
                  <text class="fono">{{ o.order_no }}</text>
                  <text class="dot">·</text>
                  <text class="famount">{{ formatMoney(o.total_amount) }}</text>
                </view>
                <view class="ftags">
                  <text class="mtag" :class="`m-${o.freight_mode}`">{{ FREIGHT_FEE_HINT[o.freight_mode] }}</text>
                  <text v-if="o.status === 'delivered'" class="mtag m-done">已交车</text>
                </view>
                <text v-if="isSelected(o) && needsFee(o) && !feeOf(o)" class="fwarn">
                  ⚠ 运费没填，交车照常，会提示补
                </text>
              </view>
              <view v-if="o.freight_mode === 'customer_paid'" class="fee fee-paid">
                <text class="no-fee">运费到付</text>
                <text class="no-fee2">客户自付</text>
              </view>
              <view v-else class="fee">
                <text class="cur">¥</text>
                <input
                  class="fee-input"
                  :class="{ empty: !feeOf(o) }"
                  type="digit"
                  :value="feeOf(o)"
                  :disabled="!selectable(o)"
                  placeholder="填运费"
                  @tap.stop
                  @input="onFeeInput(o, $event)"
                />
              </view>
            </view>
          </view>

          <view class="dtail">销售只能勾自己客户的订单；勾不上的行后端会返 403</view>
        </view>
      </scroll-view>

      <view class="footer">
        <view class="foot-info">
          <text class="fi-t">已选 {{ selectedIds.length }} 单 · 货款 {{ formatMoney(selectedGoods) }}</text>
          <text class="fi-s">运费 {{ formatMoney(selectedFee) }}{{ missingFee ? ` · ${missingFee} 单运费未填` : '' }}</text>
        </view>
        <view
          class="hand-btn"
          :class="{ off: !selectedIds.length || detail?.status !== 'open' || handing }"
          @tap="handOver"
        >{{ detail?.status === 'open' ? '确认交车' : '已交车' }}</view>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onBackPress, onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import { freightApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { FREIGHT_FEE_HINT, FREIGHT_SHIPMENT_STATUS } from '@/utils/dict'
import { clockOf, cnDate, formatMoney, timeLeft, toNum, ymd } from '@/utils/format'
import type {
  FreightShipment,
  FreightShipmentDetail,
  FreightShipmentOrder,
  FreightShipmentStatus,
} from '@/types'
import { enqueue, flushQueue, refreshPendingCount } from '@/utils/offline-queue'

const auth = useAuthStore()
const today = ymd(0)
const tomorrow = ymd(1)
const day = ref(0)
const view = ref<'list' | 'detail'>('list')
const directDetail = ref(false)
const shipments = ref<FreightShipment[]>([])
const detail = ref<FreightShipmentDetail | null>(null)
const loading = ref(true)
const refreshing = ref(false)
const totalFreight = ref('')
const selectedIds = ref<number[]>([])
const fees = ref<Record<number, string>>({})
const handing = ref(false)

const yesterdayLabel = computed(() => `昨天 · ${cnDate(ymd(-1))}`)

const dayList = computed(() =>
  shipments.value.filter((b) => b.ship_date === (day.value === 0 ? today : tomorrow)),
)

const pastSummary = computed(() => {
  const past = shipments.value.filter((b) => b.ship_date < today)
  if (!past.length) return '暂无交车记录'
  const orders = past.reduce((s, b) => s + b.order_count, 0)
  return `已交车 ${orders} 单`
})

const btail = computed(() => {
  const list = dayList.value
  if (!list.length) return day.value === 0 ? '今天还没有批次，截单前由 Web 端排批次' : ''
  const open = list.filter((b) => b.status === 'open').length
  return day.value === 0
    ? `${open} 个批次待交车，交车后算送达`
    : `明天共 ${list.length} 个批次`
})

const orders = computed<FreightShipmentOrder[]>(() => detail.value?.orders || [])

/** 按乡镇分组，站内按 stop_seq 排；没有 stop_seq 的排后面。 */
const townGroups = computed(() => {
  const map = new Map<string, FreightShipmentOrder[]>()
  orders.value.forEach((o) => {
    const key = o.town_name || '未分乡镇'
    const list = map.get(key) || []
    list.push(o)
    map.set(key, list)
  })
  return [...map.entries()].map(([name, rows]) => ({
    name,
    rows: rows.slice().sort((a, b) => (a.stop_seq ?? 999) - (b.stop_seq ?? 999)),
  }))
})

function statusLabel(s: FreightShipmentStatus): string {
  return FREIGHT_SHIPMENT_STATUS[s]?.label || s
}

function selectable(o: FreightShipmentOrder): boolean {
  if (detail.value?.status !== 'open') return false
  if (o.status !== 'pending') return false
  if (!auth.isAdmin && auth.user?.id && o.sales_id && o.sales_id !== auth.user.id) return false
  return true
}

function isSelected(o: FreightShipmentOrder): boolean {
  return selectedIds.value.includes(o.order_id)
}

/** 包邮订单才要填运费；运费到付不用填。 */
function needsFee(o: FreightShipmentOrder): boolean {
  return o.freight_mode === 'deduct' || o.freight_mode === 'store_paid'
}

function feeOf(o: FreightShipmentOrder): string {
  return fees.value[o.order_id] ?? (o.freight_cost ? String(toNum(o.freight_cost)) : '')
}

const selectedGoods = computed(() =>
  orders.value.filter((o) => isSelected(o)).reduce((s, o) => s + toNum(o.total_amount), 0),
)

const selectedFee = computed(() =>
  orders.value
    .filter((o) => isSelected(o) && needsFee(o))
    .reduce((s, o) => s + (parseFloat(feeOf(o)) || 0), 0),
)

const missingFee = computed(
  () => orders.value.filter((o) => isSelected(o) && needsFee(o) && !feeOf(o)).length,
)

async function loadList() {
  loading.value = true
  try {
    const [cur, past] = await Promise.all([
      freightApi.list({ date_from: ymd(-1), date_to: tomorrow, page_size: 100 }),
      freightApi.list({ date_from: ymd(-7), date_to: ymd(-1), page_size: 20 }).catch(() => null),
    ])
    const merged = [...cur.items]
    if (past) merged.push(...past.items)
    shipments.value = merged
  } catch {
    /* 保留上一次数据 */
  } finally {
    loading.value = false
  }
}

async function loadDetail(id: number) {
  const d = await freightApi.get(id)
  detail.value = d
  fees.value = Object.fromEntries(
    d.orders.map((o) => [o.order_id, o.freight_cost ? String(toNum(o.freight_cost)) : '']),
  )
  // 默认勾选能交的订单（销售只勾自己的）
  selectedIds.value = d.orders.filter((o) => selectable(o)).map((o) => o.order_id)
  uni.setNavigationBarTitle({ title: `${d.line_name} · 交车` })
}

onLoad(async (opts) => {
  auth.restore()
  refreshPendingCount()
  const id = Number((opts as Record<string, string>)?.id || 0)
  if (id) {
    directDetail.value = true
    view.value = 'detail'
    loading.value = false
    loadDetail(id).catch(() => {
      directDetail.value = false
      view.value = 'list'
      loadList()
    })
    return
  }
  await loadList()
})

onPullDownRefresh(async () => {
  if (view.value === 'detail' && detail.value) {
    await loadDetail(detail.value.id).catch(() => undefined)
  } else {
    await loadList()
  }
  uni.stopPullDownRefresh()
})

onBackPress(() => {
  if (view.value === 'detail' && !directDetail.value) {
    view.value = 'list'
    uni.setNavigationBarTitle({ title: '物流批次' })
    return true
  }
  return false
})

async function onRefresh() {
  refreshing.value = true
  await loadList()
  refreshing.value = false
}

function openDetail(b: FreightShipment) {
  view.value = 'detail'
  detail.value = null
  selectedIds.value = []
  loadDetail(b.id).catch(() => {
    view.value = 'list'
  })
}

function toggle(o: FreightShipmentOrder) {
  if (!selectable(o)) {
    uni.showToast({ title: o.status !== 'pending' ? '这单已交车' : '只能交自己客户的订单', icon: 'none' })
    return
  }
  const idx = selectedIds.value.indexOf(o.order_id)
  if (idx >= 0) selectedIds.value.splice(idx, 1)
  else selectedIds.value.push(o.order_id)
}

function onFeeInput(o: FreightShipmentOrder, e: unknown) {
  const value = (e as { detail?: { value?: string } }).detail?.value ?? ''
  fees.value[o.order_id] = value
}

/** 整车运费 → 按金额占比分摊，服务端算好尾差，前端只回填。 */
async function allocate() {
  const total = parseFloat(totalFreight.value)
  if (!detail.value || !total || total <= 0) {
    uni.showToast({ title: '先填这一车的总运费', icon: 'none' })
    return
  }
  const orderIds = orders.value.filter((o) => isSelected(o) && needsFee(o)).map((o) => o.order_id)
  if (!orderIds.length) {
    uni.showToast({ title: '没有可分摊的包邮订单', icon: 'none' })
    return
  }
  try {
    const rows = await freightApi.allocate(detail.value.id, total, orderIds)
    const map = Object.fromEntries(rows.map((r) => [r.order_id, String(toNum(r.freight_cost))]))
    fees.value = { ...fees.value, ...map }
    uni.showToast({ title: `已按金额占比分摊 ${formatMoney(total)}`, icon: 'none' })
  } catch {
    /* 请求封装已提示 */
  }
}

async function handOver() {
  if (!detail.value || handing.value) return
  if (!selectedIds.value.length || detail.value.status !== 'open') return
  const payloadOrders = orders.value
    .filter((o) => isSelected(o))
    .map((o) => {
      const fee = needsFee(o) ? parseFloat(feeOf(o)) : undefined
      return { order_id: o.order_id, freight_cost: fee !== undefined && !Number.isNaN(fee) ? fee : undefined }
    })
  const tip = missingFee.value
    ? `有 ${missingFee.value} 单运费没填，交车后系统会提示补录。仍要交车？`
    : `确认为 ${payloadOrders.length} 单交车？交车后算送达，扣库存、记应收。`
  uni.showModal({
    title: '确认交车',
    content: tip,
    success: async (res) => {
      if (!res.confirm) return
      handing.value = true
      enqueue({
        kind: 'hand_over',
        label: `物流交车 ${payloadOrders.length} 单`,
        refId: detail.value?.id,
        url: `/freight-shipments/${detail.value?.id}/hand-over`,
        method: 'POST',
        data: { orders: payloadOrders },
      })
      const r = await flushQueue()
      handing.value = false
      if (r.left) {
        uni.showToast({ title: `已存本地队列 · 待同步 ${r.left} 条`, icon: 'none' })
        return
      }
      const warns = r.failed ? '部分订单被拒绝，请检查' : ''
      uni.showToast({
        title: warns || `已交车 ${payloadOrders.length} 单 · 已扣库存、记应收`,
        icon: 'none',
      })
      await loadDetail(detail.value!.id).catch(() => undefined)
      await loadList()
    },
  })
}
</script>

<style lang="scss" scoped>
.freight-page { height: 100vh; background: #f4f6f9; display: flex; flex-direction: column; box-sizing: border-box; }
/* H5 顶部有 44px 原生导航栏，100vh 会多出一屏底部被截掉 */
/* #ifdef H5 */
.freight-page { height: calc(100vh - 44px); }
/* #endif */

/* 日期切换 */
.dtabs { display: flex; gap: 12rpx; padding: 16rpx; flex: none; }
.dtab {
  flex: 1; background: #fff; border-radius: 16rpx; padding: 16rpx 0; text-align: center;
  border: 1rpx solid transparent;
}
.dtab.on { background: #eef4ff; border-color: rgba(37, 99, 235, 0.35); }
.dtab-t { display: block; font-size: 25rpx; font-weight: 600; color: #2f3b4d; }
.dtab.on .dtab-t { color: $uni-color-primary; }
.dtab-s { display: block; margin-top: 2rpx; font-size: 19rpx; color: #8894a5; }

.list { flex: 1; height: 0; }
.wrap { padding: 0 16rpx 30rpx; }

/* 批次卡 */
.bcard { background: #fff; border-radius: 22rpx; padding: 24rpx; margin-bottom: 16rpx; }
.bhd { display: flex; align-items: center; gap: 12rpx; }
.bline { flex: 1; min-width: 0; font-size: 29rpx; font-weight: 600; color: #1c2534; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pill { flex: none; font-size: 20rpx; padding: 3rpx 14rpx; border-radius: 20rpx; }
.pill.open { background: #fff2dd; color: #a96a10; }
.pill.done { background: #e6f7ee; color: #1f8459; }
.bsub { display: flex; flex-wrap: wrap; align-items: center; gap: 8rpx; margin-top: 10rpx; font-size: 21rpx; color: #6b7280; }
.bsub .dot { color: #cbd5e1; }
.bcut { display: flex; align-items: center; gap: 6rpx; margin-top: 12rpx; font-size: 20rpx; color: #a96a10; }
.bcut.over { color: #8894a5; }
.bcut-t { flex: 1; }
.prog { height: 6rpx; border-radius: 3rpx; background: #eef1f6; overflow: hidden; margin-top: 12rpx; }
.pg-fill { height: 100%; border-radius: 3rpx; background: linear-gradient(90deg, #60a5fa, $uni-color-primary); }
.bfoot { display: flex; align-items: center; justify-content: space-between; margin-top: 16rpx; padding-top: 16rpx; border-top: 1rpx solid #eef1f5; }
.bsum { font-size: 21rpx; color: #8894a5; }
.bgo { font-size: 23rpx; font-weight: 600; color: $uni-color-primary; }
.btail { text-align: center; font-size: 20rpx; color: #a8b3c2; padding: 6rpx 0 14rpx; }

.past { display: flex; align-items: center; justify-content: space-between; background: #fff; border-radius: 16rpx; padding: 20rpx 22rpx; }
.past-day { font-size: 22rpx; color: #64738a; }
.past-sum { font-size: 21rpx; color: #8894a5; }

.notice { margin-top: 16rpx; padding: 20rpx 22rpx; border-radius: 16rpx; background: #eef2f8; }
.notice-t { display: block; font-size: 22rpx; font-weight: 600; color: #46536a; }
.notice-s { display: block; margin-top: 6rpx; font-size: 20rpx; line-height: 1.6; color: #8894a5; }

/* 交车页 */
.dhead { background: #fff; border-radius: 22rpx; padding: 24rpx; margin-bottom: 16rpx; }
.dhd { display: flex; align-items: center; gap: 12rpx; }
.dline { flex: 1; min-width: 0; font-size: 29rpx; font-weight: 600; color: #1c2534; }
.drows { display: flex; flex-direction: column; gap: 6rpx; margin-top: 12rpx; font-size: 21rpx; color: #6b7280; }

.split { background: #fff; border-radius: 22rpx; padding: 22rpx 24rpx; margin-bottom: 16rpx; }
.split-row { display: flex; align-items: center; gap: 12rpx; }
.split-t { font-size: 25rpx; font-weight: 600; color: #1c2534; flex: none; }
.split-input {
  flex: 1; height: 68rpx; background: #f4f6f9; border-radius: 12rpx; padding: 0 20rpx; font-size: 25rpx;
}
.split-btn {
  flex: none; height: 68rpx; padding: 0 26rpx; border-radius: 12rpx; background: $uni-color-primary;
  color: #fff; font-size: 24rpx; font-weight: 600; display: flex; align-items: center;
}
.split-btn.off { background: #e8edf4; color: #9aa6b6; }
.split-tip { display: block; margin-top: 10rpx; font-size: 20rpx; line-height: 1.5; color: #8894a5; }

.stop-hd { display: flex; align-items: center; gap: 10rpx; padding: 16rpx 6rpx 10rpx; }
.no {
  width: 36rpx; height: 36rpx; line-height: 36rpx; text-align: center; border-radius: 10rpx;
  background: #16233a; color: #fff; font-size: 20rpx; font-weight: 700; flex: none;
}
.stop-name { font-size: 25rpx; font-weight: 600; color: #1c2534; }
.stop-meta { font-size: 20rpx; color: #8894a5; }

.frow { display: flex; align-items: flex-start; gap: 14rpx; background: #fff; border-radius: 18rpx; padding: 20rpx; margin-bottom: 12rpx; }
.frow.sel { border: 1rpx solid rgba(37, 99, 235, 0.28); background: #fcfdff; }
.frow.locked { opacity: 0.72; }
.cbx {
  width: 38rpx; height: 38rpx; border-radius: 10rpx; border: 2rpx solid #d5dde8; flex: none;
  display: flex; align-items: center; justify-content: center; margin-top: 4rpx;
}
.cbx.on { background: $uni-color-primary; border-color: $uni-color-primary; }
.tick { color: #fff; font-size: 22rpx; font-weight: 700; }
.ftx { flex: 1; min-width: 0; }
.fcname { display: block; font-size: 27rpx; font-weight: 600; color: #1c2534; }
.fl2 { display: flex; align-items: center; gap: 8rpx; margin-top: 4rpx; font-size: 20rpx; color: #8894a5; }
.fl2 .dot { color: #cbd5e1; }
.famount { color: #2f3b4d; font-weight: 600; }
.ftags { display: flex; flex-wrap: wrap; gap: 8rpx; margin-top: 8rpx; }
.mtag { font-size: 19rpx; padding: 3rpx 12rpx; border-radius: 8rpx; }
.m-deduct { background: #eef4ff; color: #2570b3; }
.m-store_paid { background: #f2ecff; color: #6d40c0; }
.m-customer_paid { background: #f3f4f6; color: #6b7280; }
.m-done { background: #e6f7ee; color: #1f8459; }
.fwarn { display: block; margin-top: 8rpx; font-size: 19rpx; color: #a96a10; }

.fee { flex: none; width: 150rpx; display: flex; align-items: center; gap: 4rpx; justify-content: flex-end; }
.fee-paid { flex-direction: column; align-items: flex-end; gap: 0; justify-content: center; }
.cur { font-size: 22rpx; color: #8894a5; }
.fee-input {
  width: 110rpx; height: 58rpx; background: #f4f6f9; border-radius: 10rpx; padding: 0 10rpx;
  font-size: 23rpx; text-align: right;
}
.fee-input.empty { background: #fff8e6; }
.no-fee { font-size: 19rpx; color: #8894a5; }
.no-fee2 { font-size: 19rpx; color: #a8b3c2; margin-left: 4rpx; }
.dtail { text-align: center; font-size: 20rpx; color: #a8b3c2; padding: 14rpx 0 4rpx; }

/* 底栏 */
.footer {
  flex: none; display: flex; align-items: center; gap: 16rpx; padding: 16rpx 24rpx; background: #fff;
  border-top: 1rpx solid #eef1f5;
  padding-bottom: calc(16rpx + constant(safe-area-inset-bottom));
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
}
.foot-info { flex: 1; min-width: 0; }
.fi-t { display: block; font-size: 23rpx; font-weight: 600; color: #1c2534; }
.fi-s { display: block; margin-top: 2rpx; font-size: 20rpx; color: #8894a5; }
.hand-btn {
  flex: none; width: 220rpx; height: 80rpx; border-radius: 16rpx; background: $uni-color-primary; color: #fff;
  font-size: 27rpx; font-weight: 600; display: flex; align-items: center; justify-content: center;
}
.hand-btn.off { background: #e8edf4; color: #9aa6b6; }
</style>
