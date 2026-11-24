<template>
  <view class="confirm-page">
    <scroll-view scroll-y class="content">
      <view class="customer-card">
        <view class="card-header">
          <text class="card-title">下单客户</text>
        </view>
        <view class="cust-info">
          <text class="shop-name">{{ cart.customerName }}</text>
          <text v-if="customer?.phone" class="cust-phone" @tap="callCustomer">{{ formatPhone(customer.phone) }}</text>
        </view>
        <view v-if="address" class="cust-addr">
          <text>📍 {{ address }}</text>
        </view>
      </view>

      <view v-if="account" class="credit-card">
        <view class="card-title">账期信息</view>
        <view class="credit-row">
          <view class="credit-item">
            <text class="credit-label">授信额度</text>
            <text class="credit-value">{{ formatMoney(account.effective_credit) }}</text>
          </view>
          <view class="credit-item">
            <text class="credit-label">已欠</text>
            <text class="credit-value text-danger">{{ formatMoney(account.ar_balance) }}</text>
          </view>
          <view class="credit-item">
            <text class="credit-label">本单</text>
            <text class="credit-value text-warning">{{ formatMoney(cart.totalAmount) }}</text>
          </view>
        </view>
        <view v-if="overCredit" class="credit-warn">
          <text v-if="auth.isAdmin">⚠️ 超出授信额度，可以提交，仅提示</text>
          <text v-else>⚠️ 超出授信额度，提交后需管理员审批</text>
        </view>
        <view v-if="toNum(account.overdue_amount) > 0" class="credit-warn overdue">
          <text>⚠️ 当前逾期 {{ formatMoney(account.overdue_amount) }}，最长 {{ account.max_overdue_days }} 天</text>
        </view>
      </view>

      <view class="items-card">
        <view class="card-title">商品明细（{{ formatQty(cart.totalCount) }} 件）</view>
        <view v-for="(item, i) in cart.items" :key="i" class="item-row">
          <view class="item-info">
            <text class="item-name">{{ item.spuName }}</text>
            <text class="item-spec">{{ item.spec }} × {{ formatQty(item.quantity) }}{{ item.unit }}</text>
            <text class="item-subtotal">{{ formatMoney(item.amount) }}</text>
            <text v-if="cart.isBelowMin(item)" class="below-min-tag">
              低于最低售价（最低 {{ formatMoney(item.minPrice) }}）
            </text>
          </view>
          <view class="item-price">
            <text class="unit-price" :class="{ 'text-danger': cart.isBelowMin(item) }">
              <template v-if="item.manual">[手改] </template>{{ formatMoney(item.price) }}/{{ item.unit }}
            </text>
            <text v-if="canOverride" class="edit-price" @tap="openPriceEditor(item)">改价</text>
          </view>
        </view>
        <view v-if="cart.hasBelowMin" class="credit-warn overdue">
          <text v-if="auth.isAdmin">⚠️ 存在低于最低售价的商品，管理员提交将直接生效（仅提示）</text>
          <text v-else>⚠️ 存在低于最低售价的商品，提交后需管理员审批</text>
        </view>
        <view class="total-row">
          <text class="total-label">商品合计</text>
          <text class="total-amount">{{ formatMoney(cart.totalAmount) }}</text>
        </view>
        <view v-if="availableCoupons.length > 0" class="total-row coupon-pick-row" @tap="showCouponModal = true">
          <text class="total-label">优惠券</text>
          <text v-if="couponDeduct > 0" class="coupon-val">-{{ formatMoney(couponDeduct) }}（{{ selectedCoupon?.name }}） ›</text>
          <text v-else class="coupon-hint">{{ usableCoupons.length }} 张可用，点击帮客户勾选 ›</text>
        </view>
      </view>

      <view class="form-card">
        <view class="form-item">
          <text class="form-label">配送方式</text>
          <view class="mode-tabs">
            <view
              v-for="opt in deliveryOpts"
              :key="opt.value"
              class="mode-tab"
              :class="{ active: deliveryMode === opt.value }"
              @tap="deliveryMode = opt.value"
            >
              <text class="mode-label">{{ opt.label }}</text>
            </view>
          </view>
          <text v-if="deliveryMode === 'route' && cart.routeTripId" class="mode-hint">已绑定询单趟次</text>
          <text v-if="deliveryMode === 'route' && !cart.routeTripId" class="mode-hint">
            不指定趟次时，后端按"两天内有没有车经过"自动挂趟或进待排车
          </text>
        </view>

        <template v-if="deliveryMode === 'freight'">
          <view class="form-item">
            <text class="form-label">运费方式</text>
            <view class="mode-tabs">
              <view
                v-for="opt in freightOpts"
                :key="opt.value"
                class="mode-tab"
                :class="{ active: freightMode === opt.value }"
                @tap="freightMode = opt.value"
              >
                <text class="mode-label">{{ opt.label }}</text>
              </view>
            </view>
          </view>
          <view v-if="freightMode !== 'customer_paid'" class="form-item">
            <text class="form-label">运费金额（可留空，按 0 元提交）</text>
            <input v-model="freightCost" class="form-input" type="digit" placeholder="0.00" />
          </view>
        </template>

        <view class="form-item">
          <text class="form-label">备注</text>
          <textarea v-model="remark" class="form-textarea" placeholder="选填，如：客户要求本周三前送达" maxlength="200" />
        </view>
      </view>
    </scroll-view>

    <view class="bottom-bar">
      <view class="amount-wrap">
        <text class="amount-label">应付{{ couponDeduct > 0 ? `（已减 ${formatMoney(couponDeduct)}）` : '' }}</text>
        <text class="amount">{{ formatMoney(netPayable) }}</text>
      </view>
      <button class="btn-primary submit-btn" :loading="submitting" @tap="onSubmit">提交订单</button>
    </view>

    <!-- 优惠券选择弹窗 -->
    <view v-if="showCouponModal" class="modal-mask" @tap.self="showCouponModal = false">
      <view class="modal">
        <text class="modal-title">为客户选择优惠券</text>
        <scroll-view scroll-y style="max-height: 520rpx; margin: 16rpx 0;">
          <view
            v-for="cp in evaluatedCoupons"
            :key="cp.id"
            class="cp-opt"
            :class="{ active: selectedCouponId === cp.id, disabled: !cp.usable }"
            @tap="pickCoupon(cp)"
          >
            <view class="cp-opt-l">
              <text class="cp-opt-name">{{ cp.name }}</text>
              <text class="cp-opt-sub">减 ¥{{ Number(cp.amount).toFixed(2) }} · {{ Number(cp.min_order_amount) > 0 ? `满¥${Number(cp.min_order_amount).toFixed(0)}` : '无门槛' }}</text>
              <text v-if="!cp.usable" class="cp-opt-err">{{ cp.unusable_reason }}</text>
            </view>
            <text class="cp-opt-mark">{{ selectedCouponId === cp.id ? '✓' : '' }}</text>
          </view>
        </scroll-view>
        <view class="modal-actions">
          <button class="btn-outline modal-btn" @tap="clearCoupon">不使用</button>
          <button class="btn-primary modal-btn" @tap="showCouponModal = false">确定</button>
        </view>
      </view>
    </view>

    <view v-if="editing" class="modal-mask" @tap.self="editing = null">
      <view class="modal">
        <text class="modal-title">修改单价</text>
        <text class="modal-sub">{{ editing.spuName }} · {{ editing.spec }}</text>
        <input v-model="editPrice" class="modal-input" type="digit" :placeholder="editing.price.toFixed(2)" />
        <text class="modal-tip">最低售价 {{ formatMoney(editing.minPrice) }}</text>
        <view v-if="editBelowMin" class="credit-warn overdue modal-warn">
          <text v-if="auth.isAdmin">⚠️ 低于最低售价，管理员改价将直接生效（仅提示）</text>
          <text v-else>⚠️ 低于最低售价，提交订单后需管理员审批</text>
        </view>
        <view class="modal-actions">
          <button class="btn-outline modal-btn" @tap="editing = null">取消</button>
          <button class="btn-primary modal-btn" @tap="savePrice">确定</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useCartStore, type CartItem } from '@/stores/cart'
import { useAuthStore } from '@/stores/auth'
import { couponApi, customerApi, orderApi, type AvailableCoupon, type CreateOrderItem } from '@/api'
import { FREIGHT_MODE } from '@/utils/dict'
import { formatMoney, formatPhone, formatQty, toNum } from '@/utils/format'
import type { Customer, CustomerAccount, DeliveryMode, FreightMode } from '@/types'

const cart = useCartStore()
const auth = useAuthStore()
const customer = ref<Customer | null>(null)
const account = ref<CustomerAccount | null>(null)
const deliveryMode = ref<DeliveryMode>('route')
const freightMode = ref<Exclude<FreightMode, 'none'>>('deduct')
const freightCost = ref('')
const remark = ref('')
const submitting = ref(false)
const editing = ref<CartItem | null>(null)
const editPrice = ref('')
const availableCoupons = ref<AvailableCoupon[]>([])
const selectedCouponId = ref<number | null>(null)
const showCouponModal = ref(false)

const evaluatedCoupons = computed(() => {
  const total = cart.totalAmount
  return availableCoupons.value.map((c) => {
    const threshold = Number(c.min_order_amount || 0)
    const face = Number(c.amount || 0)
    const usable = total >= threshold
    return {
      ...c,
      usable,
      unusable_reason: usable ? null : `还差 ${(threshold - total).toFixed(2)} 元可用`,
      deduct: usable ? Math.min(face, total) : 0,
    }
  })
})
const usableCoupons = computed(() => evaluatedCoupons.value.filter((c) => c.usable))
const selectedCoupon = computed(() => usableCoupons.value.find((c) => c.id === selectedCouponId.value) || null)
const couponDeduct = computed(() => (selectedCoupon.value ? selectedCoupon.value.deduct : 0))
const netPayable = computed(() => Math.max(0, cart.totalAmount - couponDeduct.value))

function pickCoupon(cp: { id: number; usable: boolean }) {
  if (!cp.usable) return
  selectedCouponId.value = cp.id
  showCouponModal.value = false
}

function clearCoupon() {
  selectedCouponId.value = null
  showCouponModal.value = false
}

const deliveryOpts: { value: DeliveryMode; label: string }[] = [
  { value: 'route', label: '跟车送' },
  { value: 'freight', label: '物流' },
  { value: 'local', label: '城区自送' },
]
const freightOpts = (['deduct', 'store_paid', 'customer_paid'] as const).map((value) => ({
  value,
  label: FREIGHT_MODE[value],
}))

const canOverride = computed(() => auth.can('order.price_override') || auth.isAdmin)
const address = computed(() => {
  if (!customer.value) return ''
  const c = customer.value
  return [c.town, c.address, c.detail_address].filter(Boolean).join(' ') || ''
})
const overCredit = computed(() => {
  if (!account.value) return false
  return toNum(account.value.ar_balance) + netPayable.value > toNum(account.value.effective_credit)
})
const editBelowMin = computed(() => {
  if (!editing.value) return false
  const val = Number(editPrice.value)
  return Number.isFinite(val) && val > 0 && val < editing.value.minPrice
})
const willNeedApproval = computed(() => !auth.isAdmin && (overCredit.value || cart.hasBelowMin))

function callCustomer() {
  if (customer.value?.phone) uni.makePhoneCall({ phoneNumber: customer.value.phone })
}

function openPriceEditor(item: CartItem) {
  editing.value = item
  editPrice.value = item.price.toFixed(2)
}

function savePrice() {
  if (!editing.value) return
  const price = Number(editPrice.value)
  if (!price || price <= 0) {
    uni.showToast({ title: '请输入有效单价', icon: 'none' })
    return
  }
  const belowMin = price < editing.value.minPrice
  cart.updatePrice(editing.value, price)
  editing.value = null
  if (belowMin) {
    uni.showToast({
      title: auth.isAdmin ? '提示：已低于最低售价' : '低于最低售价，提交后需管理员审批',
      icon: 'none',
    })
  }
}

async function load() {
  if (!cart.customerId) {
    uni.showToast({ title: '请先选择客户', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 800)
    return
  }
  customer.value = await customerApi.get(cart.customerId)
  deliveryMode.value = customer.value.default_delivery_mode
  freightMode.value = customer.value.default_freight_mode
  customerApi
    .account(cart.customerId)
    .then((a) => (account.value = a))
    .catch(() => undefined)
  couponApi
    .customerAvailable(cart.customerId, cart.totalAmount.toFixed(2))
    .then((res) => {
      availableCoupons.value = res.items || []
    })
    .catch(() => undefined)
}

async function findMergeTarget(): Promise<number | undefined> {
  try {
    const res = await orderApi.list({
      customer_id: cart.customerId,
      status: 'pending',
      page: 1,
      page_size: 5,
    })
    return res.items[0]?.id
  } catch {
    return undefined
  }
}

function askMerge(targetId: number, count: number): Promise<number | undefined> {
  return new Promise((resolve) => {
    uni.showModal({
      title: '该客户已有待配送订单',
      content: `共有 ${count} 张待配送订单。合并到最近一张，还是新建订单？`,
      confirmText: '合并',
      cancelText: '新建',
      success: (res) => resolve(res.confirm ? targetId : undefined),
      fail: () => resolve(undefined),
    })
  })
}

async function onSubmit() {
  if (cart.isEmpty || !cart.customerId) {
    uni.showToast({ title: '购物车为空', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    let mergeInto: number | undefined
    if (!willNeedApproval.value) {
      const targetId = await findMergeTarget()
      if (targetId) {
        const count = (await orderApi.list({ customer_id: cart.customerId, status: 'pending', page: 1, page_size: 1 })).total
        mergeInto = await askMerge(targetId, count)
      }
    }

    const items: CreateOrderItem[] = cart.items.map((it) => {
      const line: CreateOrderItem = { sku_id: it.sku.id, quantity: it.quantity }
      if (it.manual) line.unit_price = it.price
      return line
    })

    const result = await orderApi.create({
      customer_id: cart.customerId,
      source: cart.source,
      delivery_mode: deliveryMode.value,
      items,
      remark: remark.value || undefined,
      route_trip_id: deliveryMode.value === 'route' ? cart.routeTripId ?? undefined : undefined,
      freight_mode: deliveryMode.value === 'freight' ? freightMode.value : undefined,
      freight_cost:
        deliveryMode.value === 'freight' && freightMode.value !== 'customer_paid'
          ? Number(freightCost.value || 0)
          : undefined,
      merge_into_order_id: mergeInto,
      customer_coupon_id: !mergeInto && selectedCoupon.value ? selectedCoupon.value.id : undefined,
    })

    const orderId = result.order.id
    const pendingApproval = result.order.status === 'pending_approval'
    cart.clear()
    uni.showToast({
      title: pendingApproval ? '已提交，等待管理员审批' : '订单已创建',
      icon: pendingApproval ? 'none' : 'success',
    })
    if (result.warnings?.length) {
      setTimeout(() => {
        uni.showModal({
          title: '提示',
          content: result.warnings.map((w) => w.message || w.code).join('\n'),
          showCancel: false,
        })
      }, 600)
    }
    setTimeout(() => {
      uni.redirectTo({ url: `/pages/order/detail?id=${orderId}` })
    }, 800)
  } finally {
    submitting.value = false
  }
}

onLoad(load)
</script>

<style lang="scss" scoped>
.confirm-page { min-height: 100vh; background: #f5f5f7; padding-bottom: 120rpx; }
.content { height: calc(100vh - 120rpx); }
.customer-card, .credit-card, .items-card, .form-card { background: #fff; margin: 16rpx; border-radius: 16rpx; padding: 24rpx; }
.card-title { font-size: 28rpx; font-weight: 600; color: #1f2937; margin-bottom: 16rpx; display: block; }
.cust-info { display: flex; align-items: baseline; gap: 16rpx; margin-bottom: 8rpx; }
.shop-name { font-size: 32rpx; font-weight: 600; color: #1f2937; }
.cust-phone { font-size: 26rpx; color: #6b7280; font-variant-numeric: tabular-nums; }
.cust-addr { font-size: 24rpx; color: #6b7280; }
.credit-row { display: flex; justify-content: space-around; }
.credit-item { text-align: center; }
.credit-label { display: block; font-size: 22rpx; color: #9ca3af; margin-bottom: 4rpx; }
.credit-value { display: block; font-size: 28rpx; font-weight: 600; font-variant-numeric: tabular-nums; }
.credit-warn { background: rgba(234, 88, 12, 0.08); color: #ea580c; padding: 12rpx 16rpx; border-radius: 8rpx; font-size: 24rpx; margin-top: 16rpx; text-align: center; }
.credit-warn.overdue { background: rgba(220, 38, 38, 0.08); color: #dc2626; }
.item-row { display: flex; justify-content: space-between; gap: 16rpx; padding: 16rpx 0; border-bottom: 2rpx solid #f3f4f6; &:last-of-type { border-bottom: none; } }
.item-info { flex: 1; min-width: 0; }
.item-name { font-size: 26rpx; color: #1f2937; display: block; margin-bottom: 4rpx; }
.item-spec { font-size: 22rpx; color: #9ca3af; display: block; margin-bottom: 4rpx; }
.item-subtotal { font-size: 26rpx; color: #dc2626; font-weight: 500; font-variant-numeric: tabular-nums; }
.below-min-tag { display: block; margin-top: 4rpx; font-size: 20rpx; color: #dc2626; font-weight: 500; }
.item-price { text-align: right; }
.unit-price { display: block; font-size: 22rpx; color: #9ca3af; }
.edit-price { display: inline-block; margin-top: 8rpx; font-size: 22rpx; color: $uni-color-primary; background: rgba(37, 99, 235, 0.08); padding: 4rpx 16rpx; border-radius: 8rpx; }
.total-row { display: flex; justify-content: space-between; align-items: baseline; padding-top: 16rpx; border-top: 2rpx solid #f3f4f6; margin-top: 16rpx; }
.total-label { font-size: 26rpx; color: #6b7280; }
.total-amount { font-size: 36rpx; font-weight: 600; color: #dc2626; font-variant-numeric: tabular-nums; }
.form-item { margin-bottom: 24rpx; }
.form-label { display: block; font-size: 26rpx; color: #6b7280; margin-bottom: 12rpx; }
.mode-tabs { display: flex; gap: 12rpx; flex-wrap: wrap; }
.mode-tab { flex: 1; min-width: 180rpx; text-align: center; padding: 18rpx 8rpx; background: #f9fafb; border-radius: 12rpx; border: 2rpx solid transparent; }
.mode-tab.active { background: rgba(37, 99, 235, 0.05); border-color: $uni-color-primary; }
.mode-label { font-size: 24rpx; color: #4b5563; }
.mode-hint { display: block; margin-top: 12rpx; font-size: 22rpx; color: #9ca3af; }
.form-input { width: 100%; height: 80rpx; border: 2rpx solid #e5e7eb; border-radius: 12rpx; padding: 0 24rpx; font-size: 28rpx; box-sizing: border-box; }
.form-textarea { width: 100%; height: 120rpx; border: 2rpx solid #e5e7eb; border-radius: 12rpx; padding: 16rpx 24rpx; font-size: 26rpx; box-sizing: border-box; }
.bottom-bar { position: fixed; left: 0; right: 0; bottom: 0; display: flex; align-items: center; background: #fff; padding: 16rpx 24rpx; box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.05); }
.amount-wrap { flex: 1; }
.amount-label { font-size: 22rpx; color: #9ca3af; }
.amount { display: block; font-size: 36rpx; font-weight: 600; color: #dc2626; font-variant-numeric: tabular-nums; }
.submit-btn { width: 280rpx; height: 80rpx; line-height: 80rpx; font-size: 28rpx; }
.modal-mask { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center; z-index: 200; }
.modal { width: 620rpx; background: #fff; border-radius: 20rpx; padding: 32rpx; }
.modal-title { display: block; font-size: 32rpx; font-weight: 600; color: #1f2937; margin-bottom: 8rpx; }
.modal-sub { display: block; font-size: 24rpx; color: #9ca3af; margin-bottom: 20rpx; }
.modal-input { width: 100%; height: 88rpx; border: 2rpx solid #e5e7eb; border-radius: 12rpx; padding: 0 24rpx; font-size: 36rpx; font-weight: 600; box-sizing: border-box; }
.modal-tip { display: block; font-size: 22rpx; color: #9ca3af; margin: 12rpx 0 16rpx; }
.modal-warn { margin-top: 0; margin-bottom: 20rpx; text-align: left; }
.modal-actions { display: flex; gap: 16rpx; }
.modal-btn { flex: 1; height: 80rpx; line-height: 80rpx; font-size: 28rpx; }
.coupon-pick-row { align-items: center; }
.coupon-val { font-size: 26rpx; font-weight: 600; color: #dc2626; }
.coupon-hint { font-size: 26rpx; color: #2563eb; }
.cp-opt { display: flex; align-items: center; justify-content: space-between; padding: 20rpx; border: 2rpx solid #e5e7eb; border-radius: 12rpx; margin-bottom: 12rpx; }
.cp-opt.active { border-color: #dc2626; background: #fef2f2; }
.cp-opt.disabled { opacity: 0.5; }
.cp-opt-l { flex: 1; min-width: 0; }
.cp-opt-name { display: block; font-size: 28rpx; font-weight: 600; color: #1f2937; }
.cp-opt-sub { display: block; font-size: 22rpx; color: #6b7280; margin-top: 4rpx; }
.cp-opt-err { display: block; font-size: 22rpx; color: #dc2626; margin-top: 4rpx; }
.cp-opt-mark { font-size: 32rpx; font-weight: 700; color: #dc2626; margin-left: 16rpx; }
</style>
