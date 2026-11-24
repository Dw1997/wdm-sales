<template>
  <view class="order-detail-page">
    <scroll-view scroll-y class="content">
      <block v-if="order">
        <view class="head" :class="headClass">
          <view class="head-top">
            <text class="head-st">{{ statusLabel }}</text>
            <text class="head-no">{{ order.order_no }}</text>
          </view>
          <text class="head-desc">{{ statusDesc }}</text>
          <view class="head-nums">
            <view class="hn">
              <text class="hv">{{ formatMoney(order.total_amount) }}</text>
              <text class="hl">订单金额</text>
            </view>
            <view class="hn">
              <text class="hv">{{ formatMoney(order.paid_amount) }}</text>
              <text class="hl">已收</text>
            </view>
            <view class="hn">
              <text class="hv hi">{{ formatMoney(order.unpaid_amount) }}</text>
              <text class="hl">未付</text>
            </view>
          </view>
        </view>

        <view class="card">
          <view class="cust-row">
            <view class="cust-tx">
              <text class="cust-name">{{ order.customer_name }}</text>
              <text class="cust-sub">{{ DELIVERY_MODE[order.delivery_mode] || order.delivery_mode }}</text>
            </view>
            <text v-if="phone" class="call-btn" @tap="callCustomer">📞 电话</text>
            <text class="link-btn" @tap="goCustomer">客户详情 ›</text>
          </view>
          <view class="kv">
            <text class="k">配送方式</text>
            <text class="v">{{ DELIVERY_MODE[order.delivery_mode] || order.delivery_mode }}</text>
          </view>
          <view class="kv">
            <text class="k">下单</text>
            <text class="v">{{ formatDate(order.created_at) }}<text v-if="order.created_by_name" class="dim"> · {{ order.created_by_name }}</text></text>
          </view>
          <view v-if="order.delivered_at" class="kv">
            <text class="k">送达</text>
            <text class="v">{{ formatDate(order.delivered_at) }}</text>
          </view>
          <view v-if="order.due_date" class="kv">
            <text class="k">到期日</text>
            <text class="v">{{ order.due_date }}</text>
          </view>
        </view>

        <view v-if="order.dispatch_note" class="dispatch">
          <text class="dispatch-title">调度备注（只读）</text>
          <text class="dispatch-text">{{ order.dispatch_note }}</text>
        </view>

        <view class="card">
          <view class="card-hd">
            <text class="card-title">商品明细 · {{ order.items.length }} 项</text>
            <text class="card-extra">售价快照</text>
          </view>
          <view v-for="it in order.items" :key="it.id" class="item">
            <view class="item-tx">
              <text class="item-name">{{ it.spu_name }}</text>
              <text class="item-spec">{{ it.sku_spec }} · {{ it.unit }}</text>
              <text v-if="auth.isAdmin && it.commission_amount != null" class="item-comm">
                提成 {{ formatMoney(it.commission_amount) }}<template v-if="it.commission_rate != null">（{{ formatRate(it.commission_rate) }}）</template>
              </text>
            </view>
            <view class="item-qty">
              <text>{{ formatQty(it.quantity) }}{{ it.unit }} × {{ formatMoney(it.unit_price) }}</text>
            </view>
            <text class="item-amt">{{ formatMoney(it.amount) }}</text>
          </view>
        </view>

        <view class="card">
          <view class="card-hd">
            <text class="card-title">金额</text>
          </view>
          <view class="money-row">
            <text class="mk">商品金额</text>
            <text class="mv">{{ formatMoney(order.total_amount) }}</text>
          </view>
          <view v-if="order.freight_mode !== 'none'" class="money-row">
            <text class="mk">运费</text>
            <text class="mv">{{ order.freight_cost ? formatMoney(order.freight_cost) : '—' }}</text>
          </view>
          <view v-if="toNum(order.coupon_amount) > 0" class="money-row">
            <text class="mk">优惠券抵扣{{ order.coupon_name ? `（${order.coupon_name}）` : '' }}</text>
            <text class="mv">-{{ formatMoney(order.coupon_amount) }}</text>
          </view>
          <view v-if="toNum(order.discount_amount) !== 0" class="money-row">
            <text class="mk">抹零</text>
            <text class="mv">-{{ formatMoney(order.discount_amount) }}</text>
          </view>
          <view class="money-row">
            <text class="mk">已收</text>
            <text class="mv">{{ formatMoney(order.paid_amount) }}</text>
          </view>
          <view v-if="order.commission_amount != null" class="money-row">
            <text class="mk">订单提成</text>
            <text class="mv mv-comm">{{ formatMoney(order.commission_amount) }}</text>
          </view>
          <view class="unpaid">
            <text>本单未付</text>
            <text class="unpaid-v">{{ formatMoney(order.unpaid_amount) }}</text>
          </view>
          <text v-if="toNum(order.returned_amount) > 0" class="refunded">
            已退货 {{ formatMoney(order.returned_amount) }}（退货会先冲本单未付，两个口径要分开看）
          </text>
        </view>

        <view v-if="order.payments && order.payments.length" class="card">
          <view class="card-hd">
            <text class="card-title">支付记录</text>
            <text class="card-extra">{{ order.payments.length }} 笔</text>
          </view>
          <view v-for="p in order.payments" :key="p.payment_id" class="pay-item">
            <view class="pay-top">
              <view class="pay-left">
                <text class="pay-ch" :class="p.channel === 'wx_miniprogram' ? 'wx' : 'off'">
                  {{ p.channel === 'wx_miniprogram' ? '小程序微信支付' : '线下登记' }}
                </text>
                <text class="pay-op">{{ p.operator_name || '—' }}</text>
              </view>
              <text class="pay-amt">{{ formatMoney(p.amount) }}</text>
            </view>
            <view class="pay-sub">
              <text>{{ formatDate(p.paid_at) }}</text>
              <text v-if="toNum(p.rounding_amount) > 0">抹零 {{ formatMoney(p.rounding_amount) }}</text>
            </view>
            <view v-if="p.wx_transaction_id" class="pay-txn">微信单号：{{ p.wx_transaction_id }}</view>
          </view>
        </view>

        <view class="card">
          <view class="card-hd">
            <text class="card-title">进度</text>
          </view>
          <view class="tl">
            <view class="tl-row done">
              <text class="tl-dot" />
              <view class="tl-tx">
                <text class="tl-t">下单</text>
                <text class="tl-s">{{ order.created_by_name || '内部账号' }} · {{ formatDate(order.created_at) }}</text>
              </view>
            </view>
            <view v-if="order.approval_stage" class="tl-row done">
              <text class="tl-dot" />
              <view class="tl-tx">
                <text class="tl-t">审批</text>
                <text class="tl-s">超出额度后放行 · {{ order.approval_stage }}</text>
              </view>
            </view>
            <view v-if="order.delivered_at" class="tl-row done">
              <text class="tl-dot" />
              <view class="tl-tx">
                <text class="tl-t">送达</text>
                <text class="tl-s">{{ formatDate(order.delivered_at) }}</text>
              </view>
            </view>
            <view v-if="!order.delivered_at" class="tl-row now">
              <text class="tl-dot" />
              <view class="tl-tx">
                <text class="tl-t">{{ order.status === 'cancelled' ? '已取消' : '待送达' }}</text>
                <text class="tl-s">{{ order.status === 'cancelled' ? '订单已取消，不进入配送' : '送达时扣库存、记欠款' }}</text>
              </view>
            </view>
          </view>
        </view>

        <view v-if="order.remark || order.reject_reason" class="card">
          <view v-if="order.remark" class="kv">
            <text class="k">备注</text>
            <text class="v">{{ order.remark }}</text>
          </view>
          <view v-if="order.reject_reason" class="kv">
            <text class="k">驳回原因</text>
            <text class="v danger">{{ order.reject_reason }}</text>
          </view>
        </view>

        <view class="bottom-space" />
      </block>
    </scroll-view>

    <view v-if="order" class="bottom-bar">
      <button class="btn ghost" @tap="onRepurchase">再来一单</button>
      <button
        v-if="order.status === 'delivered'"
        class="btn outline"
        @tap="goReturn"
      >发起退货</button>
      <button
        v-else-if="canCancel"
        class="btn danger"
        @tap="onCancel"
      >取消订单</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { orderApi, priceApi, skuApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { DELIVERY_MODE, ORDER_STATUS } from '@/utils/dict'
import { formatDate, formatMoney, formatQty, toNum } from '@/utils/format'
import type { Order, Sku } from '@/types'

const auth = useAuthStore()
const order = ref<Order | null>(null)
const cart = useCartStore()

function formatRate(rate: string | number | null | undefined) {
  if (rate == null || rate === '') return ''
  const pct = Number(rate) * 100
  return `${Number.isInteger(pct) ? pct : Number(pct.toFixed(2))}%`
}

const statusLabel = computed(() => (order.value ? ORDER_STATUS[order.value.status]?.label || order.value.status : ''))
const statusDesc = computed(() => {
  const map: Record<string, string> = {
    pending_approval: '超出授信额度，等待管理员审批',
    pending: '等待安排配送，送达时才扣库存、记欠款',
    delivering: '配送中',
    delivered: '已送达，等待收款核销',
    cancelled: '订单已取消',
    rejected: '订单未通过审批',
  }
  return order.value ? map[order.value.status] || '' : ''
})
const headClass = computed(() => {
  const s = order.value?.status
  if (s === 'delivered') return 'green'
  if (s === 'cancelled' || s === 'rejected') return 'grey'
  return 'blue'
})
const phone = computed(() => order.value?.customer_phone || '')
const canCancel = computed(() =>
  ['pending', 'pending_approval', 'delivering'].includes(order.value?.status || ''),
)

function callCustomer() {
  if (phone.value) uni.makePhoneCall({ phoneNumber: phone.value })
}
function goCustomer() {
  if (order.value) uni.navigateTo({ url: `/pages/customers/detail?id=${order.value.customer_id}` })
}
function goReturn() {
  if (order.value) uni.navigateTo({ url: `/pages/order/return?order_id=${order.value.id}` })
}

async function load(id: number) {
  order.value = await orderApi.get(id)
}

async function onCancel() {
  const res = await uni.showModal({
    title: '取消订单',
    editable: true,
    placeholderText: '取消原因（可填）',
    confirmText: '确认取消',
  })
  if (!res.confirm) return
  try {
    const result = await orderApi.cancel(order.value!.id, res.content || '移动端取消')
    order.value = result.order
    uni.showToast({ title: '已取消', icon: 'none' })
  } catch {
    /* 已提示 */
  }
}

async function onRepurchase() {
  if (!order.value) return
  uni.showLoading({ title: '加载中' })
  try {
    cart.clear()
    cart.setCustomer(order.value.customer_id, order.value.customer_name)
    cart.setSource('phone_in')
    const skus: Sku[] = []
    for (const it of order.value.items) {
      skus.push(await skuApi.get(it.sku_id))
    }
    const quotes = await priceApi.quote(order.value.customer_id, skus.map((s) => s.id))
    const bySku = new Map(quotes.items.map((q) => [q.sku_id, q]))
    order.value.items.forEach((it) => {
      const sku = skus.find((s) => s.id === it.sku_id)
      const q = bySku.get(it.sku_id)
      if (sku && q) cart.addFromQuote(sku, q, Number(it.quantity))
    })
    uni.navigateTo({ url: '/pages/order/cart' })
  } catch {
    /* request 层已提示 */
  } finally {
    uni.hideLoading()
  }
}

onLoad((opts: any) => {
  if (opts?.id) load(Number(opts.id))
})
</script>

<style lang="scss" scoped>
.order-detail-page {
  min-height: 100vh;
  background: #f5f7fa;
  padding-bottom: 140rpx;
}
.content {
  height: calc(100vh - 140rpx);
}

/* 状态头 */
.head {
  padding: 32rpx 28rpx 28rpx;
  color: #fff;
}
.head.blue {
  background: linear-gradient(140deg, #1e3a8a, #2563eb 70%, #3b82f6);
}
.head.green {
  background: linear-gradient(140deg, #14532d, #15803d 70%, #1f9d55);
}
.head.grey {
  background: linear-gradient(140deg, #374151, #4b5563 70%, #6b7280);
}
.head-top {
  display: flex;
  align-items: center;
  gap: 14rpx;
}
.head-st {
  font-size: 36rpx;
  font-weight: 700;
}
.head-no {
  font-size: 21rpx;
  padding: 4rpx 12rpx;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.16);
  color: #e3ebf5;
}
.head-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.72);
  line-height: 1.5;
}
.head-nums {
  display: flex;
  margin-top: 24rpx;
}
.hn {
  flex: 1;
}
.hn + .hn {
  border-left: 1rpx solid rgba(255, 255, 255, 0.16);
  padding-left: 20rpx;
}
.hv {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.hv.hi {
  color: #ffd4d7;
}
.hl {
  display: block;
  font-size: 19rpx;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 4rpx;
}

/* 卡片 */
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
  margin-bottom: 14rpx;
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
.cust-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #f4f7fa;
}
.cust-tx {
  flex: 1;
  min-width: 0;
}
.cust-name {
  display: block;
  font-size: 29rpx;
  font-weight: 600;
  color: #1f2937;
}
.cust-sub {
  font-size: 21rpx;
  color: #9aa6b6;
}
.call-btn {
  flex: none;
  height: 52rpx;
  line-height: 52rpx;
  padding: 0 20rpx;
  border-radius: 26rpx;
  background: #f2f7ff;
  color: #2563eb;
  font-size: 21rpx;
}
.link-btn {
  flex: none;
  font-size: 21rpx;
  color: #8d99aa;
}
.kv {
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
  padding: 14rpx 0;
  border-top: 1rpx solid #f6f8fb;
}
.kv:first-of-type {
  border-top: 0;
}
.k {
  flex: none;
  width: 120rpx;
  font-size: 22rpx;
  color: #8d99aa;
}
.v {
  flex: 1;
  font-size: 24rpx;
  color: #1f2937;
  line-height: 1.5;
}
.v.danger {
  color: #c9343d;
}
.dim {
  color: #9aa6b6;
  font-size: 21rpx;
}

/* 调度备注 */
.dispatch {
  margin: 0 20rpx 0;
  padding: 18rpx 20rpx;
  background: #f2f7ff;
  border: 1rpx solid #dfe9f9;
  border-radius: 14rpx;
}
.dispatch-title {
  display: block;
  font-size: 21rpx;
  font-weight: 600;
  color: #3f6391;
  margin-bottom: 4rpx;
}
.dispatch-text {
  font-size: 21rpx;
  color: #4a6b96;
  line-height: 1.6;
}

/* 商品 */
.item {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  padding: 16rpx 0;
  border-top: 1rpx solid #f6f8fb;
}
.item:first-of-type {
  border-top: 0;
}
.item-tx {
  flex: 1;
  min-width: 0;
}
.item-name {
  display: block;
  font-size: 25rpx;
  color: #1f2937;
  font-weight: 600;
}
.item-spec {
  display: block;
  font-size: 20rpx;
  color: #a3aebd;
}
.item-comm {
  display: block;
  margin-top: 4rpx;
  font-size: 20rpx;
  color: #ea580c;
  font-variant-numeric: tabular-nums;
}
.item-qty {
  flex: none;
  font-size: 20rpx;
  color: #7d8ba0;
  padding-top: 4rpx;
}
.item-amt {
  flex: none;
  width: 140rpx;
  text-align: right;
  font-size: 25rpx;
  font-weight: 700;
  color: #1f2937;
  font-variant-numeric: tabular-nums;
}

/* 金额 */
.money-row {
  display: flex;
  justify-content: space-between;
  padding: 8rpx 0;
  font-size: 23rpx;
  color: #6f7d92;
}
.money-row .mv {
  color: #1f2937;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.money-row .mv-comm {
  color: #ea580c;
}
.unpaid {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12rpx;
  padding: 16rpx 18rpx;
  background: #fff6f6;
  border: 1rpx solid #f8dfe1;
  border-radius: 12rpx;
  font-size: 22rpx;
  color: #a83540;
}
.unpaid-v {
  font-size: 30rpx;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.refunded {
  display: block;
  margin-top: 12rpx;
  font-size: 20rpx;
  color: #a3aebd;
  line-height: 1.6;
}

/* 时间轴 */
.tl {
  padding-left: 6rpx;
}
.tl-row {
  display: flex;
  gap: 16rpx;
  padding-bottom: 20rpx;
  position: relative;
}
.tl-row:last-child {
  padding-bottom: 0;
}
.tl-dot {
  flex: none;
  width: 18rpx;
  height: 18rpx;
  border-radius: 50%;
  margin-top: 8rpx;
  background: #fff;
  border: 3rpx solid #cfdae8;
}
.tl-row.done .tl-dot {
  background: #16a34a;
  border-color: #16a34a;
}
.tl-row.now .tl-dot {
  background: #2563eb;
  border-color: rgba(37, 99, 235, 0.25);
}
.tl-tx {
  flex: 1;
}
.tl-t {
  display: block;
  font-size: 24rpx;
  color: #1f2937;
  font-weight: 600;
}
.tl-s {
  font-size: 20rpx;
  color: #a3aebd;
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
  display: flex;
  gap: 16rpx;
  padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.97);
  border-top: 1rpx solid #e8ecf2;
}
.btn {
  flex: 1;
  height: 84rpx;
  border-radius: 16rpx;
  font-size: 27rpx;
  font-weight: 600;
  line-height: 84rpx;
}
.btn.ghost {
  background: #f3f6fa;
  color: #5b6a80;
}
.btn.outline {
  background: #fff;
  color: #2563eb;
  border: 1rpx solid rgba(37, 99, 235, 0.35);
}
.btn.danger {
  background: #fff6f6;
  color: #c9343d;
  border: 1rpx solid rgba(201, 52, 61, 0.3);
}
.pay-item {
  padding: 16rpx 0;
  border-top: 1rpx solid #f1f5f9;
}
.pay-item:first-of-type {
  border-top: none;
  padding-top: 4rpx;
}
.pay-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12rpx;
}
.pay-left {
  display: flex;
  align-items: center;
  gap: 10rpx;
}
.pay-ch {
  font-size: 22rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  font-weight: 600;
}
.pay-ch.wx {
  background: #e8f8ef;
  color: #07c160;
}
.pay-ch.off {
  background: #f3f4f6;
  color: #6b7280;
}
.pay-op {
  font-size: 24rpx;
  color: #4b5563;
}
.pay-amt {
  font-size: 30rpx;
  font-weight: 700;
  color: #15803d;
}
.pay-sub {
  margin-top: 8rpx;
  display: flex;
  justify-content: space-between;
  font-size: 22rpx;
  color: #9ca3af;
}
.pay-txn {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: #6b7280;
  word-break: break-all;
}
</style>
