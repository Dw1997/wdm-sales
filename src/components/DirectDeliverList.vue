<template>
  <view class="direct-list">
    <view class="sub-tabs">
      <view class="sub-tab" :class="{ on: tab === 'pending' }" @tap="tab = 'pending'">
        <text>{{ pendingLabel }}</text>
        <text class="sub-n">{{ pendingOrders.length }}</text>
      </view>
      <view class="sub-tab" :class="{ on: tab === 'done' }" @tap="tab = 'done'">
        <text>{{ doneLabel }}</text>
        <text class="sub-n">{{ doneOrders.length }}</text>
      </view>
    </view>

    <view v-if="loading && !currentList.length" class="loading-tip">加载中…</view>

    <view v-for="o in currentList" :key="o.id" class="ocard" @tap="toggle(o)">
      <view class="hd">
        <view class="nm">
          <view class="name-row">
            <text class="cname">{{ o.customer_name }}</text>
            <view v-if="o.customer_phone" class="tel-btn" @tap.stop="callPhone(o.customer_phone)">📞 电话</view>
          </view>
          <text class="ono">{{ o.order_no }} · {{ formatDate(o.created_at, 'MM-DD HH:mm') }}</text>
        </view>
        <text class="amt">{{ formatMoney(tab === 'done' ? (o.delivered_amount ?? o.total_amount) : o.total_amount) }}</text>
      </view>

      <view v-if="o.remark" class="remark">备注：{{ o.remark }}</view>

      <view v-if="openId === o.id" class="body" @tap.stop>
        <view v-if="detailLoadingId === o.id" class="loading-tip">加载订单明细中…</view>
        <template v-else-if="itemsOf(o).length">
          <view v-if="tab === 'pending' && o.pending_price_adjustment" class="adj-banner">
            <text class="adj-t">改价审批中（暂不可确认{{ actionWord }}）</text>
            <text class="adj-s">
              申请人：{{ o.pending_price_adjustment?.applicant_name || '—' }}
              <template v-if="o.pending_price_adjustment?.reason"> · {{ o.pending_price_adjustment.reason }}</template>
            </text>
          </view>

          <view v-for="it in itemsOf(o)" :key="it.id" class="line">
            <view class="line-nm">
              <text class="ln">{{ it.spu_name }}</text>
              <text class="ls">{{ it.sku_spec || '—' }} · {{ it.unit }} · {{ formatMoney(it.unit_price) }}</text>
            </view>
            <template v-if="canEditQty(o)">
              <text class="line-q">下单 {{ formatQty(it.quantity) }}</text>
              <view class="stepper">
                <view class="step" @tap="stepQty(it, -1)">−</view>
                <text class="q" :class="{ small: qtyOf(it) < toNum(it.quantity) }">{{ formatQty(qtyOf(it)) }}</text>
                <view class="step" @tap="stepQty(it, 1)">+</view>
              </view>
            </template>
            <text v-else class="line-q">
              {{ tab === 'done' ? '实送' : '下单' }} {{ formatQty(tab === 'done' ? (it.delivered_quantity ?? it.quantity) : it.quantity) }}
            </text>
          </view>

          <template v-if="canEditQty(o)">
            <view class="sumline">
              <text>预估实送金额 <text class="mc">（以服务端返回为准）</text></text>
              <text class="sv">{{ formatMoney(previewAmount(o)) }}</text>
            </view>
            <view class="body-acts">
              <view
                class="btn-submit"
                :class="{ danger: isAllZero(o), off: submittingId === o.id }"
                @tap="submitWithItems(o)"
              >
                {{
                  submittingId === o.id
                    ? '提交中…'
                    : isAllZero(o)
                      ? '整单拒收(取消)'
                      : `按实送数确认${actionWord}`
                }}
              </view>
            </view>
          </template>
        </template>
        <view v-else class="loading-tip">暂无商品明细</view>
      </view>

      <view class="foot">
        <text class="detail-link" @tap.stop="goDetail(o.id)">订单详情 ›</text>
        <view v-if="tab === 'pending' && isAdmin" class="foot-r">
          <text v-if="o.pending_price_adjustment" class="adj-tag">改价审批中</text>
          <template v-else>
            <view class="op-btn" @tap.stop="toggle(o)">{{ openId === o.id ? '收起' : '调数量' }}</view>
            <view
              class="op-btn primary"
              :class="{ off: submittingId === o.id }"
              @tap.stop="quickDeliver(o)"
            >
              {{ submittingId === o.id ? '处理中…' : `确认${actionWord}` }}
            </view>
          </template>
        </view>
      </view>
    </view>

    <empty-state
      v-if="!loading && !currentList.length"
      :icon="mode === 'pickup' ? '🏬' : '🛵'"
      :text="emptyText"
      padding="90rpx 32rpx"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import { deliveryOrderApi, orderApi } from '@/api'
import { formatDate, formatMoney, formatQty, toNum } from '@/utils/format'
import type { Order, OrderItem } from '@/types'

const props = defineProps<{
  mode: 'local' | 'pickup'
  pendingOrders: Order[]
  doneOrders: Order[]
  loading: boolean
  isAdmin: boolean
}>()

const emit = defineEmits<{
  delivered: []
}>()

const tab = ref<'pending' | 'done'>('pending')
const openId = ref<number | null>(null)
const detailLoadingId = ref<number | null>(null)
const submittingId = ref<number | null>(null)
const detailMap = reactive<Record<number, Order>>({})
const qtyMap = reactive<Record<number, number>>({})

const actionWord = computed(() => (props.mode === 'pickup' ? '自提' : '送达'))
const pendingLabel = computed(() => (props.mode === 'pickup' ? '待自提' : '待送达'))
const doneLabel = computed(() => (props.mode === 'pickup' ? '今日已自提' : '今日已送达'))

const currentList = computed(() => (tab.value === 'pending' ? props.pendingOrders : props.doneOrders))

const emptyText = computed(() => {
  if (tab.value === 'pending') {
    return props.mode === 'pickup' ? '暂无待自提订单' : '暂无待送达的城区自送订单'
  }
  return props.mode === 'pickup' ? '今天还没有已自提订单' : '今天还没有已送达的城区自送订单'
})

function itemsOf(o: Order): OrderItem[] {
  return detailMap[o.id]?.items || o.items || []
}

function canEditQty(o: Order): boolean {
  return tab.value === 'pending' && props.isAdmin && !o.pending_price_adjustment
}

function qtyOf(it: OrderItem): number {
  return qtyMap[it.id] !== undefined ? qtyMap[it.id] : toNum(it.quantity)
}

function stepQty(it: OrderItem, delta: number) {
  const max = toNum(it.quantity)
  const next = Math.max(0, Math.min(max, Number((qtyOf(it) + delta).toFixed(4))))
  qtyMap[it.id] = next
}

function previewAmount(o: Order): number {
  return itemsOf(o).reduce((sum, it) => sum + qtyOf(it) * toNum(it.unit_price), 0)
}

function isAllZero(o: Order): boolean {
  const list = itemsOf(o)
  return list.length > 0 && list.every((it) => qtyOf(it) <= 0)
}

async function toggle(o: Order) {
  if (openId.value === o.id) {
    openId.value = null
    return
  }
  openId.value = o.id
  if (detailMap[o.id]?.items?.length) {
    initQty(detailMap[o.id])
    return
  }
  if (o.items?.length) {
    detailMap[o.id] = o
    initQty(o)
    return
  }
  detailLoadingId.value = o.id
  try {
    const full = await orderApi.get(o.id)
    detailMap[o.id] = full
    initQty(full)
  } catch {
    /* request 已提示 */
  } finally {
    if (detailLoadingId.value === o.id) detailLoadingId.value = null
  }
}

function initQty(order: Order) {
  ;(order.items || []).forEach((it) => {
    if (qtyMap[it.id] === undefined) qtyMap[it.id] = toNum(it.quantity)
  })
}

function callPhone(phone: string | null | undefined) {
  if (!phone) return
  uni.makePhoneCall({ phoneNumber: phone, fail: () => undefined })
}

function goDetail(id: number) {
  uni.navigateTo({ url: `/pages/order/detail?id=${id}` })
}

async function quickDeliver(o: Order) {
  if (submittingId.value !== null) return
  const ok = await new Promise<boolean>((resolve) => {
    uni.showModal({
      title: `确认${actionWord.value}`,
      content: `确认「${o.customer_name}」的订单（${formatMoney(o.total_amount)}）整单${actionWord.value}吗？将按原数量扣库存并记应收。`,
      confirmText: `确认${actionWord.value}`,
      success: (r) => resolve(!!r.confirm),
      fail: () => resolve(false),
    })
  })
  if (!ok) return
  await doDeliver(o.id, null)
}

async function submitWithItems(o: Order) {
  if (submittingId.value !== null) return
  const list = itemsOf(o)
  if (!list.length) return
  const payload = list.map((it) => ({
    order_item_id: it.id,
    delivered_quantity: qtyOf(it),
  }))

  let cancelReason: string | undefined
  if (isAllZero(o)) {
    const reason = await new Promise<string | null>((resolve) => {
      uni.showModal({
        title: '整单拒收（取消订单）',
        content: '',
        editable: true,
        placeholderText: '请填写拒收原因（必填）',
        confirmText: '确认拒收',
        confirmColor: '#dc2626',
        success: (r) => resolve(r.confirm ? (r.content || '').trim() : null),
        fail: () => resolve(null),
      })
    })
    if (reason === null) return
    if (!reason) {
      uni.showToast({ title: '请填写拒收原因', icon: 'none' })
      return
    }
    cancelReason = reason
  }
  await doDeliver(o.id, payload, cancelReason)
}

async function doDeliver(
  orderId: number,
  items: { order_item_id: number; delivered_quantity: number }[] | null,
  cancelReason?: string,
) {
  submittingId.value = orderId
  try {
    const res = await deliveryOrderApi.deliver(orderId, items, { cancelReason })
    openId.value = null
    ;(detailMap[orderId]?.items || []).forEach((it) => delete qtyMap[it.id])
    delete detailMap[orderId]
    const msg = cancelReason ? '已取消该订单' : `已确认${actionWord.value}`
    if (res.warnings?.length) {
      uni.showModal({
        title: msg,
        content: res.warnings.map((w) => w.message || w.code).join('\n'),
        showCancel: false,
      })
    } else {
      uni.showToast({ title: msg, icon: 'success' })
    }
    emit('delivered')
  } catch {
    /* request 已提示 */
  } finally {
    submittingId.value = null
  }
}
</script>

<style lang="scss" scoped>
.direct-list { padding-top: 4rpx; }

.sub-tabs { display: flex; gap: 12rpx; margin-bottom: 16rpx; }
.sub-tab {
  display: inline-flex; align-items: center; gap: 8rpx;
  padding: 12rpx 24rpx; border-radius: 999rpx;
  background: #fff; color: #64738a; font-size: 23rpx; font-weight: 500;
}
.sub-tab.on { background: $uni-color-primary; color: #fff; font-weight: 600; }
.sub-n { font-size: 20rpx; opacity: 0.78; }

.ocard {
  background: #fff; border-radius: 22rpx; padding: 24rpx 24rpx 0; margin-bottom: 16rpx;
  box-shadow: 0 4rpx 14rpx rgba(22, 35, 58, 0.05);
}
.hd { display: flex; align-items: flex-start; justify-content: space-between; gap: 16rpx; }
.nm { flex: 1; min-width: 0; }
.name-row { display: flex; align-items: center; gap: 12rpx; min-width: 0; }
.cname { display: block; font-size: 29rpx; font-weight: 600; color: #1c2534; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ono { display: block; margin-top: 6rpx; font-size: 21rpx; color: #8894a5; }
.amt { flex: none; font-size: 28rpx; font-weight: 700; color: #1c2534; font-variant-numeric: tabular-nums; }

.remark {
  margin-top: 12rpx; padding: 10rpx 14rpx; border-radius: 10rpx;
  background: #f6f8fb; font-size: 21rpx; color: #64738a; line-height: 1.4;
}

.body { margin-top: 16rpx; padding-top: 14rpx; border-top: 1rpx dashed #eef1f5; }
.loading-tip { padding: 16rpx 0; text-align: center; font-size: 21rpx; color: #8894a5; }

.adj-banner {
  padding: 12rpx 16rpx; border-radius: 12rpx; background: #fff7e8; margin-bottom: 12rpx;
}
.adj-t { display: block; font-size: 22rpx; font-weight: 600; color: #a96a10; }
.adj-s { display: block; margin-top: 4rpx; font-size: 19rpx; color: #b7791f; }

.line { display: flex; align-items: center; gap: 12rpx; padding: 10rpx 0; }
.line-nm { flex: 1; min-width: 0; }
.ln { display: block; font-size: 23rpx; font-weight: 600; color: #1c2534; }
.ls { display: block; margin-top: 2rpx; font-size: 19rpx; color: #8894a5; }
.line-q { flex: none; font-size: 21rpx; color: #64738a; }

.stepper { display: flex; align-items: center; gap: 8rpx; flex: none; }
.step {
  width: 48rpx; height: 48rpx; border-radius: 10rpx; background: #f2f5fa; color: #1c2534;
  font-size: 28rpx; font-weight: 600; display: flex; align-items: center; justify-content: center;
}
.q { min-width: 48rpx; text-align: center; font-size: 24rpx; font-weight: 600; color: #1c2534; }
.q.small { color: #d97706; }

.sumline {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 12rpx; padding-top: 12rpx; border-top: 1rpx solid #f1f4f8;
  font-size: 22rpx; color: #64738a;
}
.mc { font-size: 19rpx; color: #9aa6b6; }
.sv { font-size: 26rpx; font-weight: 700; color: #1c2534; }

.body-acts { margin-top: 14rpx; }
.btn-submit {
  height: 70rpx; border-radius: 14rpx; background: $uni-color-primary; color: #fff;
  font-size: 25rpx; font-weight: 600; display: flex; align-items: center; justify-content: center;
}
.btn-submit.danger { background: #dc2626; }
.btn-submit.off { opacity: 0.6; }

.foot {
  display: flex; align-items: center; justify-content: space-between; gap: 12rpx;
  margin-top: 18rpx; padding: 16rpx 0 18rpx; border-top: 1rpx solid #eef1f5;
}
.tel-btn {
  flex: none; padding: 4rpx 16rpx; border-radius: 999rpx; background: #eef4ff; color: $uni-color-primary;
  font-size: 20rpx; font-weight: 500;
}
.detail-link { font-size: 22rpx; color: #64738a; }
.foot-r { display: flex; align-items: center; gap: 12rpx; }
.adj-tag {
  padding: 8rpx 18rpx; border-radius: 999rpx; background: #fff7e8; color: #a96a10; font-size: 21rpx;
}
.op-btn {
  padding: 10rpx 22rpx; border-radius: 999rpx; font-size: 22rpx; background: #f2f5fa; color: #475569;
}
.op-btn.primary { background: $uni-color-primary; color: #fff; font-weight: 600; }
.op-btn.off { opacity: 0.6; }
</style>
