<template>
  <view class="return-page">
    <scroll-view scroll-y class="content">
      <block v-if="order">
        <view class="card">
          <view class="card-hd">
            <text class="card-title">原订单</text>
            <text class="card-extra" @tap="goOrder">查看 ›</text>
          </view>
          <view class="orig">
            <view class="orig-top">
              <text class="orig-no">{{ order.order_no }}</text>
              <text class="orig-cust">· {{ order.customer_name }}</text>
              <text v-if="order.delivered_at" class="orig-time">{{ formatDate(order.delivered_at) }}</text>
            </view>
            <view class="orig-nums">
              <view class="on">
                <text class="ov">{{ formatMoney(order.delivered_amount || order.total_amount) }}</text>
                <text class="ol">实送金额</text>
              </view>
              <view class="on">
                <text class="ov">{{ formatMoney(order.paid_amount) }}</text>
                <text class="ol">已收</text>
              </view>
              <view class="on">
                <text class="ov danger">{{ formatMoney(order.unpaid_amount) }}</text>
                <text class="ol">当前未付</text>
              </view>
            </view>
          </view>
        </view>

        <!-- 逐行退货 -->
        <view class="card">
          <view class="card-hd">
            <text class="card-title">退货明细</text>
            <text class="card-extra">售价固定取订单快照</text>
          </view>
          <view v-for="line in lines" :key="line.order_item_id" class="line" :class="{ on: line.qty > 0 }">
            <view class="line-top">
              <view class="line-tx">
                <text class="line-name">{{ line.name }}</text>
                <text class="line-sub">实送 {{ formatQty(line.delivered) }} · 已退 {{ formatQty(line.returned) }} · 可退 {{ formatQty(line.max) }}</text>
              </view>
              <view class="line-price">
                <text class="lp">{{ formatMoney(line.price) }}</text>
                <text class="lpl">售价快照</text>
              </view>
            </view>
            <view class="line-qty">
              <view class="stepper">
                <text class="st-btn" :class="{ disabled: line.qty <= 0 }" @tap="step(line, -1)">−</text>
                <input
                  class="st-input"
                  type="digit"
                  :value="String(line.qty)"
                  @blur="setQty(line, $event)"
                />
                <text class="st-btn" :class="{ disabled: line.qty >= line.max }" @tap="step(line, 1)">+</text>
              </view>
              <view class="dest">
                <text
                  class="dest-t"
                  :class="{ on: line.disposition === 'restock' }"
                  @tap="setDest(line, 'restock')"
                >退回库存</text>
                <text
                  class="dest-t"
                  :class="{ on: line.disposition === 'write_off' }"
                  @tap="setDest(line, 'write_off')"
                >报损</text>
              </view>
            </view>
          </view>
        </view>

        <!-- 原因 -->
        <view class="card">
          <view class="card-hd">
            <text class="card-title">退货原因 <text class="req">*</text></text>
            <text class="card-extra">必填</text>
          </view>
          <view class="chips">
            <text
              v-for="r in reasonOpts"
              :key="r"
              class="chip"
              :class="{ on: reason === r }"
              @tap="reason = r"
            >{{ r }}</text>
          </view>
          <textarea
            v-model="reasonText"
            class="reason-input"
            placeholder="补充说明（可选）：如「这批辣椒粉颜色偏暗」"
          />
        </view>

        <!-- 运费 -->
        <view class="card">
          <view class="card-hd">
            <text class="card-title">退货运费</text>
            <text class="card-extra">谁出这笔钱</text>
          </view>
          <view class="freight-opts">
            <view class="fo" :class="{ on: freightMode === 'store_paid' }" @tap="setFreight('store_paid')">
              <text class="fo-t">我们付</text>
              <text class="fo-s">算进可处理金额</text>
            </view>
            <view class="fo" :class="{ on: freightMode === 'customer_paid' }" @tap="setFreight('customer_paid')">
              <text class="fo-t">客户付</text>
              <text class="fo-s">不从货款里扣</text>
            </view>
            <view class="fo" :class="{ on: freightMode === 'none' }" @tap="setFreight('none')">
              <text class="fo-t">包邮不退</text>
              <text class="fo-s">不涉及运费</text>
            </view>
          </view>
          <view v-if="freightMode === 'store_paid'" class="freight-amt">
            <text class="fa-label">运费金额</text>
            <view class="fa-input">
              <text class="yuan">¥</text>
              <input v-model="freightCost" type="digit" class="fa-field" @input="invalidate" />
            </view>
          </view>
        </view>

        <!-- 金额预览 -->
        <view class="card">
          <view class="card-hd">
            <text class="card-title">金额预览</text>
            <text class="calc-btn" @tap="calc">算一下</text>
          </view>
          <view v-if="!preview" class="pending">
            金额由后端算（原单已收多少、抹零多少、之前退过多少只有后端知道）。填好退货数量后点「算一下」。
          </view>
          <block v-else>
            <view class="pv-row">
              <text>退货商品金额</text>
              <text class="pv-v">{{ formatMoney(preview.goods_amount) }}</text>
            </view>
            <view class="pv-row">
              <text>退货运费补偿</text>
              <text class="pv-v">{{ formatMoney(preview.freight_compensation_amount) }}</text>
            </view>
            <view class="pv-row">
              <text>本次可处理金额</text>
              <text class="pv-v">{{ formatMoney(preview.total_credit_amount) }}</text>
            </view>
            <view class="pv-row">
              <text>先冲原订单未付</text>
              <text class="pv-v">{{ formatMoney(preview.original_offset_amount) }}</text>
            </view>
            <view class="pv-row hi">
              <text>余额（可退款 / 挂账待抵）</text>
              <text class="pv-v hi-v">{{ formatMoney(preview.refundable_amount) }}</text>
            </view>
            <text v-if="stale" class="stale">数量或运费改过了，当前金额已失效，请重新「算一下」。</text>
          </block>
        </view>

        <!-- 余额处理 -->
        <view class="card">
          <view class="card-hd">
            <text class="card-title">余额怎么处理</text>
            <text class="card-extra">{{ preview ? (toNum(preview.refundable_amount) > 0 ? '选一种' : '无余额，只能冲原单') : '算完金额再选' }}</text>
          </view>
          <view class="refund-opt" :class="{ on: refundMethod !== 'credit', disabled: noRefund }" @tap="setRefund('cash')">
            <text class="radio" :class="{ on: refundMethod !== 'credit' }" />
            <view class="ro-tx">
              <text class="ro-t">实际退款</text>
              <text class="ro-s">线下退钱，系统只记账</text>
            </view>
            <text class="ro-amt">{{ preview ? formatMoney(preview.refundable_amount) : '—' }}</text>
          </view>
          <view v-if="refundMethod !== 'credit' && !noRefund" class="methods">
            <text
              v-for="m in methodOpts"
              :key="m.value"
              class="m"
              :class="{ on: method === m.value }"
              @tap="method = m.value"
            >{{ m.label }}</text>
          </view>
          <view class="refund-opt" :class="{ on: refundMethod === 'credit', disabled: noRefund }" @tap="setRefund('credit')">
            <text class="radio" :class="{ on: refundMethod === 'credit' }" />
            <view class="ro-tx">
              <text class="ro-t">挂账待抵</text>
              <text class="ro-s">留在退货单上，管理员之后手动平到别的订单</text>
            </view>
            <text class="ro-amt">—</text>
          </view>
          <text v-if="noRefund" class="no-refund">本单没有可退金额，只能全冲原订单未付。</text>
        </view>

        <view class="bottom-space" />
      </block>
      <view v-else class="loading">加载中...</view>
    </scroll-view>

    <view v-if="order" class="bottom-bar">
      <text class="tip">销售提交后要等管理员确认，库存和应收那时才变</text>
      <button class="submit" :disabled="submitting" @tap="submit">
        {{ submitting ? '提交中...' : '提交退货单' }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { orderApi, returnApi } from '@/api'
import { formatDate, formatMoney, formatQty, toNum } from '@/utils/format'
import type {
  Order,
  ReturnCreatePayload,
  ReturnDisposition,
  ReturnPreview,
  RefundMethod,
  ReturnFreightMode,
} from '@/types'

interface Line {
  order_item_id: number
  name: string
  price: number
  delivered: number
  returned: number
  max: number
  qty: number
  disposition: ReturnDisposition
}

const order = ref<Order | null>(null)
const lines = ref<Line[]>([])
const reason = ref('质量问题')
const reasonText = ref('')
const freightMode = ref<ReturnFreightMode>('store_paid')
const freightCost = ref('0.00')
const preview = ref<ReturnPreview | null>(null)
const stale = ref(false)
const refundMethod = ref<'cash' | 'credit'>('cash')
const method = ref<Exclude<RefundMethod, 'credit'>>('wechat')
const submitting = ref(false)

const reasonOpts = ['质量问题', '送错货', '客户不要了', '少送', '其他']
const methodOpts = [
  { label: '微信', value: 'wechat' },
  { label: '支付宝', value: 'alipay' },
  { label: '现金', value: 'cash' },
] as const

const noRefund = computed(() => !!preview.value && toNum(preview.value.refundable_amount) <= 0)

function lineOf(o: Order) {
  return o.items.map((it) => {
    const delivered = it.delivered_quantity != null ? toNum(it.delivered_quantity) : toNum(it.quantity)
    const returned = toNum(it.returned_quantity)
    const max = Math.max(0, delivered - returned)
    return {
      order_item_id: it.id,
      name: `${it.spu_name} / ${it.sku_spec}`,
      price: toNum(it.unit_price),
      delivered,
      returned,
      max,
      qty: 0,
      disposition: 'restock' as ReturnDisposition,
    }
  })
}

async function load(orderId: number) {
  const o = await orderApi.get(orderId)
  order.value = o
  lines.value = lineOf(o)
}

function step(line: Line, delta: number) {
  line.qty = Math.min(line.max, Math.max(0, line.qty + delta))
  invalidate()
}
function setQty(line: Line, e: any) {
  const v = Number(e?.detail?.value ?? 0)
  if (isNaN(v) || v <= 0) line.qty = 0
  else if (v > line.max) {
    line.qty = line.max
    uni.showToast({ title: `该商品最多还能退 ${line.max}`, icon: 'none' })
  } else line.qty = v
  invalidate()
}
function setDest(line: Line, d: ReturnDisposition) {
  line.disposition = d
  invalidate()
}
function setFreight(m: ReturnFreightMode) {
  freightMode.value = m
  invalidate()
}
function setRefund(m: 'cash' | 'credit') {
  if (noRefund.value) return
  refundMethod.value = m
}
/** 数量 / 去向 / 运费一改，旧金额立即失效（06 §5.3：前端不算金额）。 */
function invalidate() {
  if (preview.value) stale.value = true
}

function payload(): ReturnCreatePayload {
  const items = lines.value
    .filter((l) => l.qty > 0)
    .map((l) => ({
      order_item_id: l.order_item_id,
      quantity: l.qty,
      disposition: l.disposition,
    }))
  return {
    order_id: order.value!.id,
    reason: [reason.value, reasonText.value.trim()].filter(Boolean).join('：'),
    items,
    return_freight_mode: freightMode.value,
    ...(freightMode.value === 'store_paid'
      ? { freight_cost: Number(freightCost.value) || 0 }
      : {}),
    refund_method: refundMethod.value === 'credit' ? 'credit' : method.value,
  }
}

async function calc() {
  if (!lines.value.some((l) => l.qty > 0)) {
    return uni.showToast({ title: '先把要退的数量填上', icon: 'none' })
  }
  uni.showLoading({ title: '算价中' })
  try {
    preview.value = await returnApi.preview(payload())
    stale.value = false
  } catch {
    preview.value = null
  } finally {
    uni.hideLoading()
  }
}

async function submit() {
  if (!reason.value) return uni.showToast({ title: '选一个退货原因', icon: 'none' })
  if (!lines.value.some((l) => l.qty > 0)) {
    return uni.showToast({ title: '把要退的数量填上', icon: 'none' })
  }
  if (!preview.value || stale.value) {
    return uni.showToast({ title: '先点「算一下」，金额没算出来不能提交', icon: 'none' })
  }
  submitting.value = true
  try {
    const res = await returnApi.create(payload())
    const pending = res.return_order?.status === 'pending'
    uni.showModal({
      title: pending ? '已提交，待管理员确认' : '退货已确认',
      content: pending
        ? '管理员确认后才会加库存、冲应收；确认前可以驳回。'
        : '库存和应收已按退货单重算。',
      showCancel: false,
      success: () => {
        uni.redirectTo({ url: `/pages/order/detail?id=${order.value!.id}` })
      },
    })
  } catch {
    /* request.ts 已按 error_code 提示 */
  } finally {
    submitting.value = false
  }
}

function goOrder() {
  if (order.value) uni.redirectTo({ url: `/pages/order/detail?id=${order.value.id}` })
}

onLoad((opts: any) => {
  const id = Number(opts?.order_id || opts?.id || 0)
  if (id) load(id)
})
</script>

<style lang="scss" scoped>
.return-page {
  min-height: 100vh;
  background: #f5f7fa;
  padding-bottom: 200rpx;
}
.content {
  height: calc(100vh - 180rpx);
}
.loading {
  padding: 80rpx 0;
  text-align: center;
  font-size: 24rpx;
  color: #a3aebd;
}
.card {
  background: #fff;
  margin: 16rpx 20rpx;
  padding: 24rpx;
  border-radius: 20rpx;
  box-shadow: 0 4rpx 14rpx rgba(22, 35, 58, 0.05);
}
.card-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}
.card-title {
  font-size: 27rpx;
  font-weight: 600;
  color: #1f2937;
}
.card-extra {
  font-size: 20rpx;
  color: #a3aebd;
}

/* 原单 */
.orig {
  background: #f7f9fc;
  border-radius: 14rpx;
  padding: 18rpx 20rpx;
}
.orig-top {
  display: flex;
  align-items: center;
  gap: 8rpx;
  flex-wrap: wrap;
}
.orig-no {
  font-size: 24rpx;
  font-weight: 600;
  color: #1f2937;
  font-variant-numeric: tabular-nums;
}
.orig-cust {
  font-size: 22rpx;
  color: #8d99aa;
}
.orig-time {
  margin-left: auto;
  font-size: 20rpx;
  color: #16a34a;
}
.orig-nums {
  display: flex;
  margin-top: 16rpx;
}
.on {
  flex: 1;
}
.on + .on {
  border-left: 1rpx solid #e6ecf5;
  padding-left: 16rpx;
}
.ov {
  display: block;
  font-size: 26rpx;
  font-weight: 700;
  color: #1f2937;
  font-variant-numeric: tabular-nums;
}
.ov.danger {
  color: #c9343d;
}
.ol {
  display: block;
  font-size: 19rpx;
  color: #9aa6b6;
  margin-top: 2rpx;
}

/* 退货行 */
.line {
  border-top: 1rpx solid #f4f7fa;
  padding: 18rpx 0;
}
.line:first-of-type {
  border-top: 0;
  padding-top: 0;
}
.line.on {
  background: #fffafb;
  border-radius: 12rpx;
  padding: 18rpx 14rpx;
  margin: 0 -14rpx;
}
.line-top {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
}
.line-tx {
  flex: 1;
  min-width: 0;
}
.line-name {
  display: block;
  font-size: 25rpx;
  font-weight: 600;
  color: #1f2937;
}
.line-sub {
  font-size: 20rpx;
  color: #a3aebd;
}
.line-price {
  flex: none;
  text-align: right;
}
.lp {
  display: block;
  font-size: 24rpx;
  font-weight: 700;
  color: #1f2937;
  font-variant-numeric: tabular-nums;
}
.lpl {
  font-size: 18rpx;
  color: #b3bdcb;
}
.line-qty {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 14rpx;
}
.stepper {
  display: flex;
  align-items: center;
  border: 1rpx solid #e8ecf2;
  border-radius: 12rpx;
  overflow: hidden;
  background: #fff;
}
.st-btn {
  width: 62rpx;
  height: 60rpx;
  line-height: 60rpx;
  text-align: center;
  font-size: 30rpx;
  color: #4b5563;
  background: #fbfcfe;
}
.st-btn.disabled {
  color: #d3dae4;
}
.st-input {
  width: 84rpx;
  height: 60rpx;
  text-align: center;
  font-size: 25rpx;
  font-weight: 700;
  color: #1f2937;
  border-left: 1rpx solid #e8ecf2;
  border-right: 1rpx solid #e8ecf2;
}
.dest {
  display: flex;
  border: 1rpx solid #e8ecf2;
  border-radius: 12rpx;
  overflow: hidden;
}
.dest-t {
  padding: 0 20rpx;
  height: 60rpx;
  line-height: 60rpx;
  font-size: 21rpx;
  color: #6f7d92;
  background: #fff;
}
.dest-t.on {
  background: rgba(201, 52, 61, 0.08);
  color: #c9343d;
  font-weight: 600;
}

/* 原因 */
.req {
  color: #ef4444;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}
.chip {
  padding: 8rpx 22rpx;
  border-radius: 24rpx;
  background: #f2f5f9;
  color: #5f6d82;
  font-size: 22rpx;
}
.chip.on {
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
  font-weight: 600;
}
.reason-input {
  width: 100%;
  height: 120rpx;
  margin-top: 16rpx;
  padding: 16rpx 20rpx;
  background: #fbfcfe;
  border: 1rpx solid #e8ecf2;
  border-radius: 14rpx;
  font-size: 24rpx;
  color: #1f2937;
}

/* 运费 */
.freight-opts {
  display: flex;
  gap: 12rpx;
}
.fo {
  flex: 1;
  padding: 16rpx 10rpx;
  border: 1rpx solid #e8ecf2;
  border-radius: 14rpx;
  text-align: center;
}
.fo.on {
  border-color: rgba(37, 99, 235, 0.35);
  background: #f2f7ff;
}
.fo-t {
  display: block;
  font-size: 23rpx;
  color: #4b5563;
  font-weight: 600;
}
.fo.on .fo-t {
  color: #2563eb;
}
.fo-s {
  display: block;
  font-size: 18rpx;
  color: #a3aebd;
  margin-top: 2rpx;
}
.freight-amt {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 16rpx;
}
.fa-label {
  flex: none;
  font-size: 22rpx;
  color: #8d99aa;
}
.fa-input {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8rpx;
  height: 68rpx;
  padding: 0 18rpx;
  background: #fbfcfe;
  border: 1rpx solid #e8ecf2;
  border-radius: 12rpx;
}
.yuan {
  font-size: 22rpx;
  color: #8d99aa;
}
.fa-field {
  flex: 1;
  font-size: 26rpx;
  font-weight: 700;
  color: #1f2937;
}

/* 金额预览 */
.calc-btn {
  flex: none;
  height: 52rpx;
  line-height: 52rpx;
  padding: 0 22rpx;
  border-radius: 26rpx;
  background: #f2f7ff;
  color: #2563eb;
  font-size: 21rpx;
  font-weight: 600;
}
.pending {
  font-size: 21rpx;
  color: #a3aebd;
  line-height: 1.6;
}
.pv-row {
  display: flex;
  justify-content: space-between;
  padding: 8rpx 0;
  font-size: 23rpx;
  color: #6f7d92;
}
.pv-v {
  color: #1f2937;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.pv-row.hi {
  margin-top: 8rpx;
  padding-top: 14rpx;
  border-top: 1rpx dashed #e6ebf2;
}
.pv-v.hi-v {
  color: #c9343d;
  font-size: 30rpx;
  font-weight: 700;
}
.stale {
  display: block;
  margin-top: 12rpx;
  padding: 10rpx 14rpx;
  background: #fff8ea;
  border: 1rpx solid #f7e6c4;
  border-radius: 10rpx;
  font-size: 20rpx;
  color: #8a5c10;
}

/* 余额处理 */
.refund-opt {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 18rpx;
  border: 1rpx solid #e8ecf2;
  border-radius: 14rpx;
  margin-bottom: 12rpx;
}
.refund-opt.on {
  border-color: rgba(37, 99, 235, 0.35);
  background: #f7fbff;
}
.refund-opt.disabled {
  opacity: 0.5;
}
.radio {
  flex: none;
  width: 32rpx;
  height: 32rpx;
  border-radius: 50%;
  border: 2rpx solid #ccd6e2;
}
.radio.on {
  border-color: #2563eb;
  background: radial-gradient(circle, #2563eb 0 40%, #fff 44%);
}
.ro-tx {
  flex: 1;
  min-width: 0;
}
.ro-t {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: #1f2937;
}
.ro-s {
  font-size: 19rpx;
  color: #a3aebd;
  line-height: 1.4;
}
.ro-amt {
  flex: none;
  font-size: 24rpx;
  font-weight: 700;
  color: #1f2937;
  font-variant-numeric: tabular-nums;
}
.methods {
  display: flex;
  gap: 12rpx;
  padding: 0 0 14rpx 46rpx;
}
.m {
  padding: 6rpx 20rpx;
  border: 1rpx solid #e8ecf2;
  border-radius: 10rpx;
  font-size: 21rpx;
  color: #6f7d92;
}
.m.on {
  border-color: rgba(37, 99, 235, 0.35);
  background: #f2f7ff;
  color: #2563eb;
  font-weight: 600;
}
.no-refund {
  display: block;
  font-size: 20rpx;
  color: #c9343d;
  line-height: 1.5;
}

/* 底部 */
.bottom-space {
  height: 20rpx;
}
.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 14rpx 24rpx calc(20rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.97);
  border-top: 1rpx solid #e8ecf2;
}
.tip {
  display: block;
  font-size: 19rpx;
  color: #9aa6b6;
  margin-bottom: 10rpx;
  line-height: 1.4;
}
.submit {
  width: 100%;
  height: 84rpx;
  border-radius: 16rpx;
  background: #2563eb;
  color: #fff;
  font-size: 27rpx;
  font-weight: 600;
  line-height: 84rpx;
}
.submit[disabled] {
  background: #c7d6ef;
}
</style>
