<template>
  <view class="detail-page">
    <scroll-view scroll-y class="content">
      <view v-if="customer" class="hero">
        <view class="hero-top">
          <view class="hero-name">
            <text class="name">{{ customer.name }}</text>
            <view class="hero-tags">
              <text v-if="customer.level_nickname" class="htag lv">{{ customer.level_nickname }}</text>
              <text class="htag">{{ statusLabel }}</text>
              <text v-if="customerTypeLabel" class="htag">{{ customerTypeLabel }}</text>
            </view>
          </view>
          <view v-if="customer.phone" class="hero-call" @tap="callPhone">📞</view>
        </view>
        <view class="hero-rows">
          <view class="hero-row">
            <text class="pin">📍</text>
            <text class="hv">{{ location || '未设送货地点' }}</text>
            <text class="sep">|</text>
            <text class="hv">{{ deliveryModeLabel }}</text>
          </view>
          <view v-if="customer.contact_name || customer.phone" class="hero-row">
            <text class="pin">👤</text>
            <text class="hv">{{ customer.contact_name || '—' }}</text>
            <text v-if="customer.phone" class="hv strong phone-link" @tap="callPhone">{{ formatPhone(customer.phone) }}</text>
          </view>
          <view v-if="customer.sales_name" class="hero-row">
            <text class="pin">🏷</text>
            <text class="hv">归属 {{ customer.sales_name }}</text>
            <text v-if="customer.wechat_bound" class="hv">· 已绑微信</text>
          </view>
          <view v-if="customer.referrer_customer_name" class="hero-row">
            <text class="pin">🎁</text>
            <text class="hv">介绍人：{{ customer.referrer_customer_name }}（首单送达自动发拉新券）</text>
          </view>
        </view>
      </view>

      <view v-if="customer" class="acts">
        <view class="act primary" @tap="goOrderCreate">
          <text class="act-ico">🛒</text>
          <text class="act-label">录单</text>
        </view>
        <view class="act" @tap="callPhone">
          <text class="act-ico">📞</text>
          <text class="act-label">打电话</text>
        </view>
        <view class="act" @tap="goPriceQuery">
          <text class="act-ico">🏷️</text>
          <text class="act-label">查价</text>
        </view>
        <view class="act" @tap="goPrices">
          <text class="act-ico">💴</text>
          <text class="act-label">专属价</text>
        </view>
        <view class="act" @tap="goOrderHistory">
          <text class="act-ico">📋</text>
          <text class="act-label">订单</text>
        </view>
      </view>

      <view v-if="account" class="card">
        <view class="card-hd">
          <text class="card-title">账期与欠款</text>
          <text class="card-extra">{{ termLabel }}</text>
        </view>
        <view class="debt-row">
          <view class="debt-main">
            <text class="debt-value" :class="{ zero: toNum(account.ar_balance) <= 0 }">
              {{ toNum(account.ar_balance) > 0 ? formatMoney(account.ar_balance) : '无欠款' }}
            </text>
            <text class="debt-label">当前欠款</text>
          </view>
          <view v-if="toNum(account.overdue_amount) > 0" class="overdue-chip">
            逾期 {{ formatMoney(account.overdue_amount) }} · {{ account.max_overdue_days }} 天
          </view>
        </view>
        <view class="credit-row">
          <view class="credit-item">
            <text class="cv">{{ formatMoney(account.effective_credit) }}</text>
            <text class="cl">授信额度</text>
          </view>
          <view class="credit-item">
            <text class="cv" :class="{ danger: available < 0 }">{{ formatMoney(available) }}</text>
            <text class="cl">可用额度</text>
          </view>
          <view class="credit-item">
            <text class="cv">{{ formatMoney(account.overdue_amount) }}</text>
            <text class="cl">逾期金额</text>
          </view>
        </view>
        <view class="usage-bar">
          <view class="usage-fill" :style="{ width: usagePercent + '%', background: usageColor }" />
        </view>
        <text class="usage-text">额度使用 {{ usagePercent }}%</text>
      </view>

      <view class="card">
        <view class="card-hd">
          <text class="card-title">可用优惠券</text>
          <text class="card-extra">{{ couponCount }} 张 · 合计 {{ formatMoney(couponTotalAmount) }}</text>
        </view>
        <view v-if="coupons.length">
          <view v-for="c in coupons" :key="c.id" class="coupon">
            <view class="coupon-face">
              <text class="coupon-face-value">{{ formatMoney(c.amount) }}</text>
            </view>
            <view class="coupon-tx">
              <view class="coupon-title-row">
                <text class="coupon-name">{{ c.name }}</text>
                <text class="coupon-type">{{ COUPON_TYPE[c.coupon_type] || c.coupon_type }}</text>
              </view>
              <text class="coupon-sub">
                {{ toNum(c.min_order_amount) > 0 ? `满 ${formatMoney(c.min_order_amount)} 可用` : '无门槛' }}
              </text>
              <text class="coupon-sub">有效期至 {{ formatDate(c.valid_to) }}</text>
            </view>
          </view>
        </view>
        <empty-state v-else icon="🎟️" text="暂无可用优惠券" padding="28rpx 0" />
      </view>

      <view v-if="frequentSkus.length" class="card">
        <view class="card-hd">
          <text class="card-title">常购商品</text>
          <text class="card-extra">按历史订单统计</text>
        </view>
        <view v-for="f in frequentSkus" :key="f.sku_id" class="freq">
          <view class="freq-tx">
            <text class="freq-name">{{ f.spu_name }} <text class="freq-spec">/ {{ f.sku_spec }}</text></text>
            <text class="freq-sub">买过 {{ f.order_count }} 次 · 上次 {{ formatQty(f.last_quantity) }}{{ f.unit }}</text>
          </view>
          <view class="freq-price">
            <text v-if="f.last_unit_price" class="freq-amt">{{ formatMoney(f.last_unit_price) }}</text>
            <text v-else class="freq-amt empty">—</text>
            <text class="freq-label">{{ f.last_unit_price ? '上次成交价' : '无历史价' }}</text>
          </view>
          <view class="freq-add" @tap="addToCart(f)">+</view>
        </view>
      </view>

      <view class="card">
        <view class="card-hd">
          <view class="card-hd-left">
            <text class="card-title">未配送订单</text>
            <text v-if="undeliveredTotal > 0" class="count-badge">{{ undeliveredTotal }}</text>
          </view>
          <text class="card-extra" @tap="goOrderHistory">查看全部 ›</text>
        </view>
        <view v-if="undeliveredOrders.length">
          <view
            v-for="o in undeliveredOrders"
            :key="o.id"
            class="ord"
            @tap="goOrderDetail(o.id)"
          >
            <view class="ord-tx">
              <text class="ord-no">{{ o.order_no }} · {{ o.items.length }} 个商品</text>
              <text class="ord-sub">{{ formatDate(o.created_at) }} · {{ DELIVERY_MODE[o.delivery_mode] || '' }}</text>
            </view>
            <view class="ord-amt">
              <text class="ord-value">{{ formatMoney(o.total_amount) }}</text>
              <view class="ord-badges">
                <text class="ord-status" :class="`s-${ORDER_STATUS[o.status]?.type || 'grey'}`">
                  {{ ORDER_STATUS[o.status]?.label || o.status }}
                </text>
                <text
                  v-if="isActiveOrder(o)"
                  class="ord-status"
                  :class="`s-${PAY_STATUS[o.pay_status]?.type || 'grey'}`"
                >
                  {{ PAY_STATUS[o.pay_status]?.label }}
                </text>
              </view>
              <text v-if="hasUnpaid(o)" class="ord-unpaid">未付 {{ formatMoney(o.unpaid_amount) }}</text>
            </view>
          </view>
        </view>
        <empty-state v-else icon="🚚" text="暂无未配送订单" padding="32rpx 0" />
      </view>

      <view class="card">
        <view class="card-hd">
          <text class="card-title">最近订单</text>
          <text class="card-extra" @tap="goOrderHistory">查看全部 ›</text>
        </view>
        <view v-if="recentOrders.length">
          <view
            v-for="o in recentOrders"
            :key="o.id"
            class="ord"
            @tap="goOrderDetail(o.id)"
          >
            <view class="ord-tx">
              <text class="ord-no">{{ o.order_no }} · {{ o.items.length }} 个商品</text>
              <text class="ord-sub">{{ formatDate(o.created_at) }} · {{ DELIVERY_MODE[o.delivery_mode] || '' }}</text>
            </view>
            <view class="ord-amt">
              <text class="ord-value">{{ formatMoney(o.total_amount) }}</text>
              <view class="ord-badges">
                <text class="ord-status" :class="`s-${ORDER_STATUS[o.status]?.type || 'grey'}`">
                  {{ ORDER_STATUS[o.status]?.label || o.status }}
                </text>
                <text
                  v-if="isActiveOrder(o)"
                  class="ord-status"
                  :class="`s-${PAY_STATUS[o.pay_status]?.type || 'grey'}`"
                >
                  {{ PAY_STATUS[o.pay_status]?.label }}
                </text>
              </view>
              <text v-if="hasUnpaid(o)" class="ord-unpaid">未付 {{ formatMoney(o.unpaid_amount) }}</text>
            </view>
          </view>
        </view>
        <empty-state v-else icon="📋" text="暂无订单" padding="40rpx 0" />
      </view>

      <view class="card">
        <view class="card-hd">
          <text class="card-title">支付记录</text>
          <text class="card-extra" @tap="goPaymentRecords">查看全部 ›</text>
        </view>
        <view v-if="recentPayments.length">
          <view v-for="p in recentPayments" :key="p.id" class="ord">
            <view class="ord-tx">
              <text class="ord-no">
                {{ p.channel === 'wx_miniprogram' ? '小程序微信支付' : '线下登记' }}
                <text v-if="p.allocations && p.allocations.length"> · {{ p.allocations[0].order_no }}</text>
              </text>
              <text class="ord-sub">{{ formatDate(p.paid_at) }} · {{ p.operator_name || '—' }}</text>
            </view>
            <view class="ord-amt">
              <text class="ord-value" style="color: #15803d">{{ formatMoney(p.amount) }}</text>
              <text v-if="p.wx_transaction_id" class="ord-sub">微信单号</text>
            </view>
          </view>
        </view>
        <empty-state v-else icon="💳" text="暂无支付记录" padding="32rpx 0" />
      </view>

      <view v-if="customer" class="card">
        <view class="card-hd">
          <text class="card-title">客户档案</text>
          <text v-if="!editing" class="card-extra" @tap="startEdit">编辑</text>
          <text v-else class="card-extra on" @tap="saveEdit">保存</text>
        </view>

        <view class="kv">
          <text class="k">送货地点</text>
          <view class="v">
            <text>{{ customer.town || '未设置' }}</text>
            <text class="lock">Web 端维护</text>
          </view>
        </view>
        <view class="kv">
          <text class="k">默认配送</text>
          <view class="v">
            <text>{{ deliveryModeLabel }}</text>
            <text class="lock">Web 端维护</text>
          </view>
        </view>
        <view class="kv">
          <text class="k">归属销售</text>
          <view class="v">
            <text>{{ customer.sales_name || '—' }}</text>
            <text class="lock">Web 端维护</text>
          </view>
        </view>
        <view class="kv">
          <text class="k">联系人</text>
          <view class="v">
            <input v-if="editing" v-model="form.contact_name" class="v-input" placeholder="联系人" />
            <text v-else>{{ customer.contact_name || '—' }}</text>
          </view>
        </view>
        <view class="kv">
          <text class="k">手机号</text>
          <view class="v">
            <input v-if="editing" v-model="form.phone" class="v-input" type="number" maxlength="11" />
            <text v-else-if="customer.phone" class="phone-link" @tap="callPhone">{{ customer.phone }}</text>
            <text v-else>—</text>
          </view>
        </view>
        <view class="kv">
          <text class="k">收货地点</text>
          <view class="v">
            <text v-if="editing" class="pick" @tap="regionPickerVisible = true">{{ regionDisplayText || '搜索或选择省/市/县/乡镇' }} ›</text>
            <text v-else>{{ customerRegionText || '未设置' }}</text>
          </view>
        </view>
        <view class="kv">
          <text class="k">详细地址</text>
          <view class="v">
            <input v-if="editing" v-model="form.detail_address" class="v-input" placeholder="街道 / 门牌" />
            <text v-else>{{ customer.detail_address || customer.address || '—' }}</text>
          </view>
        </view>
        <view class="kv">
          <text class="k">客户标签</text>
          <view class="v">
            <text v-if="editing" class="pick" @tap="pickTag">{{ customer.tag_name || '选择标签' }} ›</text>
            <text v-else>{{ customer.tag_name || '未设置' }}</text>
          </view>
        </view>
        <view class="kv">
          <text class="k">客户等级</text>
          <view class="v">
            <text v-if="editing" class="pick" @tap="pickLevel">{{ customer.level_nickname || '选择等级' }} ›</text>
            <text v-else>{{ customer.level_nickname || '未分配' }}</text>
          </view>
        </view>
        <view class="kv">
          <text class="k">建档</text>
          <view class="v">
            <text>{{ customer.created_at ? formatDate(customer.created_at) : '—' }}</text>
          </view>
        </view>
      </view>

      <view class="bottom-space" />
    </scroll-view>
    <RegionPickerSheet v-model:visible="regionPickerVisible" @select="onSelectRegion" />
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import RegionPickerSheet from '@/components/RegionPickerSheet.vue'
import { couponApi, customerApi, customerLevelApi, customerTagApi, financeApi, orderApi, priceApi, skuApi } from '@/api'
import type { AvailableCoupon, CustomerLevel, CustomerTag } from '@/api'
import { useCartStore } from '@/stores/cart'
import { COUPON_TYPE, CUSTOMER_STATUS, DELIVERY_MODE, ORDER_STATUS, PAY_STATUS } from '@/utils/dict'
import { formatDate, formatMoney, formatPhone, formatQty, toNum } from '@/utils/format'
import type { Customer, CustomerAccount, FrequentSku, Order, PaymentRecordItem, RegionSelection } from '@/types'

const cart = useCartStore()

const customerId = ref(0)
const customer = ref<Customer | null>(null)
const account = ref<CustomerAccount | null>(null)
const recentOrders = ref<Order[]>([])
const undeliveredOrders = ref<Order[]>([])
const undeliveredTotal = ref(0)
const recentPayments = ref<PaymentRecordItem[]>([])
const frequentSkus = ref<FrequentSku[]>([])
const coupons = ref<AvailableCoupon[]>([])

const editing = ref(false)
const regionPickerVisible = ref(false)
const form = reactive({
  contact_name: '',
  phone: '',
  delivery_region_id: 0,
  province: '',
  city: '',
  district: '',
  town: '',
  detail_address: '',
})
const customerRegionText = computed(() => {
  const c = customer.value
  if (!c) return ''
  return [c.province, c.city, c.district, c.town].filter(Boolean).join(' / ')
})
const regionDisplayText = computed(() =>
  [form.province, form.city, form.district, form.town].filter(Boolean).join(' / '),
)
const levels = ref<CustomerLevel[]>([])
const tags = ref<CustomerTag[]>([])

const statusLabel = computed(() =>
  customer.value ? CUSTOMER_STATUS[customer.value.status]?.label || customer.value.status : '',
)
const customerTypeLabel = computed(() => customer.value?.tag_name || '')
const deliveryModeLabel = computed(() => {
  const mode = customer.value?.default_delivery_mode
  return mode ? DELIVERY_MODE[mode] || mode : '—'
})
const location = computed(() => {
  const c = customer.value
  if (!c) return ''
  return [c.town || c.district || c.city || c.province, c.detail_address || c.address].filter(Boolean).join(' · ')
})
const termLabel = computed(() => {
  const c = customer.value
  if (!c) return ''
  if (c.payment_term_type === 'monthly') return `月结 · 每月 ${c.monthly_due_day || '—'} 日`
  return `送达后 ${c.term_days ?? '—'} 天`
})
const available = computed(() => {
  if (!account.value) return 0
  return toNum(account.value.effective_credit) - toNum(account.value.ar_balance)
})
const usagePercent = computed(() => {
  if (!account.value) return 0
  const limit = toNum(account.value.effective_credit)
  if (!limit) return 0
  return Math.min(100, Math.round((toNum(account.value.ar_balance) / limit) * 100))
})
const usageColor = computed(() =>
  usagePercent.value > 80 ? '#dc2626' : usagePercent.value > 60 ? '#ea580c' : '#16a34a',
)
const couponCount = computed(() => coupons.value.length)
const couponTotalAmount = computed(() => coupons.value.reduce((sum, c) => sum + toNum(c.amount), 0))

async function load() {
  if (!customerId.value) return
  const id = customerId.value
  const [detailRes, accountRes, couponRes, undeliveredRes, recentRes, paymentRes, freqRes] =
    await Promise.allSettled([
      customerApi.get(id),
      customerApi.account(id),
      couponApi.customerAvailable(id),
      orderApi.list({ customer_id: id, status: 'pending_approval,pending,delivering', page: 1, page_size: 10 }),
      orderApi.list({ customer_id: id, page: 1, page_size: 5 }),
      financeApi.payments({ customer_id: id, page: 1, page_size: 5 }),
      customerApi.frequentSkus(id, 6),
    ])
  if (detailRes.status === 'fulfilled') customer.value = detailRes.value
  if (accountRes.status === 'fulfilled') account.value = accountRes.value
  if (couponRes.status === 'fulfilled') coupons.value = couponRes.value.items || []
  if (undeliveredRes.status === 'fulfilled') {
    undeliveredOrders.value = undeliveredRes.value.items || []
    undeliveredTotal.value = undeliveredRes.value.total || 0
  }
  if (recentRes.status === 'fulfilled') recentOrders.value = recentRes.value.items || []
  if (paymentRes.status === 'fulfilled') recentPayments.value = paymentRes.value.items || []
  if (freqRes.status === 'fulfilled') frequentSkus.value = freqRes.value
}

/** 已取消/已驳回的订单不再展示付款状态。 */
function isActiveOrder(o: Order) {
  return o.status !== 'cancelled' && o.status !== 'rejected'
}
function hasUnpaid(o: Order) {
  return isActiveOrder(o) && o.pay_status !== 'paid' && toNum(o.unpaid_amount) > 0
}

function callPhone() {
  if (customer.value?.phone) uni.makePhoneCall({ phoneNumber: customer.value.phone })
}
function goOrderCreate() {
  uni.navigateTo({ url: `/pages/order/create?customer_id=${customerId.value}` })
}
function goOrderHistory() {
  uni.navigateTo({ url: `/pages/order/history?customer_id=${customerId.value}` })
}
function goOrderDetail(id: number) {
  uni.navigateTo({ url: `/pages/order/detail?id=${id}` })
}

function goPaymentRecords() {
  const name = encodeURIComponent(customer.value?.name || '')
  uni.navigateTo({ url: `/pages/finance/payments?customer_id=${customerId.value}&customer_name=${name}` })
}
function goPrices() {
  uni.navigateTo({ url: `/pages/customers/prices?customer_id=${customerId.value}` })
}
function goPriceQuery() {
  uni.navigateTo({ url: `/pages/customers/price-query?customer_id=${customerId.value}` })
}

/** 常购一键复单：先问服务端报价，再放进购物车（前端不算价）。 */
async function addToCart(sku: FrequentSku) {
  if (!customer.value) return
  uni.showLoading({ title: '加购中' })
  try {
    const quote = await priceApi.quote(customer.value.id, [sku.sku_id])
    const item = quote.items?.[0]
    const detail = await skuApi.get(sku.sku_id)
    if (!item || !detail) throw new Error('no quote')
    cart.setCustomer(customer.value.id, customer.value.name)
    cart.addFromQuote(detail, item, 1)
    uni.showToast({ title: '已加入购物车', icon: 'none' })
    setTimeout(() => uni.navigateTo({ url: '/pages/order/cart' }), 400)
  } catch {
    uni.showToast({ title: '加购失败，价格没取到', icon: 'none' })
  } finally {
    uni.hideLoading()
  }
}

/* ---------- 编辑 ---------- */
function startEdit() {
  const c = customer.value
  if (!c) return
  Object.assign(form, {
    contact_name: c.contact_name || '',
    phone: c.phone || '',
    delivery_region_id: c.delivery_region_id || 0,
    province: c.province || '',
    city: c.city || '',
    district: c.district || '',
    town: c.town || '',
    detail_address: c.detail_address || c.address || '',
  })
  editing.value = true
}
function onSelectRegion(sel: RegionSelection) {
  form.delivery_region_id = sel.id
  form.province = sel.province
  form.city = sel.city
  form.district = sel.district
  form.town = sel.town
}
async function saveEdit() {
  if (form.phone && !/^1[3-9]\d{9}$/.test(form.phone)) {
    return uni.showToast({ title: '手机号格式不对', icon: 'none' })
  }
  const detail = form.detail_address.trim()
  const composed = [form.province, form.city, form.district, form.town, detail].filter(Boolean).join('')
  const payload: Record<string, unknown> = {
    contact_name: form.contact_name || null,
    delivery_region_id: form.delivery_region_id || null,
    province: form.province || null,
    city: form.city || null,
    district: form.district || null,
    town: form.town || null,
    detail_address: detail || null,
    address: composed || null,
  }
  // 已绑微信的客户，手机号只有管理员能改（后端会拦），这里先提示
  if (form.phone && form.phone !== customer.value?.phone) payload.phone = form.phone
  try {
    customer.value = await customerApi.update(customerId.value, payload)
    editing.value = false
    uni.showToast({ title: '已保存', icon: 'none' })
  } catch {
    /* request.ts 已提示错误 */
  }
}
async function pickTag() {
  if (!tags.value.length) {
    try {
      tags.value = await customerTagApi.list({ is_active: true })
    } catch {
      return uni.showToast({ title: '标签列表加载失败', icon: 'none' })
    }
  }
  const itemList = ['不设标签（清空）', ...tags.value.map((t) => t.name)]
  uni.showActionSheet({
    itemList,
    success: async ({ tapIndex }) => {
      const nextTagId = tapIndex === 0 ? null : tags.value[tapIndex - 1]?.id ?? null
      if (nextTagId === (customer.value?.tag_id ?? null)) return
      try {
        customer.value = await customerApi.update(customerId.value, { tag_id: nextTagId })
        uni.showToast({ title: '标签已更新', icon: 'none' })
      } catch {
        /* 已提示 */
      }
    },
  })
}
async function pickLevel() {
  if (!levels.value.length) {
    try {
      levels.value = (await customerLevelApi.list()).filter((l) => l.is_active && l.level_id !== 'walk_in')
    } catch {
      return uni.showToast({ title: '等级列表加载失败', icon: 'none' })
    }
  }
  if (!levels.value.length) return uni.showToast({ title: '没有可选等级', icon: 'none' })
  uni.showActionSheet({
    itemList: levels.value.map((l) => l.nickname),
    success: async ({ tapIndex }) => {
      const level = levels.value[tapIndex]
      if (!level || level.id === customer.value?.level_id) return
      try {
        customer.value = await customerApi.assignLevel(customerId.value, level.id)
        customerApi.account(customerId.value).then((a) => (account.value = a)).catch(() => {})
        uni.showToast({ title: '等级已改', icon: 'none' })
      } catch {
        /* 已提示 */
      }
    },
  })
}

onLoad((opts: any) => {
  customerId.value = Number(opts?.id || 0)
  load()
})
</script>

<style lang="scss" scoped>
.detail-page {
  min-height: 100vh;
  background: #f5f7fa;
}
.content {
  height: 100vh;
}

/* 头卡 */
.hero {
  background: linear-gradient(140deg, #1e3a8a, #2563eb 62%, #3b82f6);
  padding: 32rpx 28rpx 30rpx;
}
.hero-top {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
}
.hero-name {
  flex: 1;
  min-width: 0;
}
.name {
  font-size: 40rpx;
  font-weight: 700;
  color: #fff;
}
.hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 12rpx;
}
.htag {
  font-size: 20rpx;
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
  background: rgba(255, 255, 255, 0.16);
  color: #e3ebf5;
}
.htag.lv {
  background: rgba(255, 214, 120, 0.2);
  color: #ffd978;
}
.hero-call {
  flex: none;
  width: 72rpx;
  height: 72rpx;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.16);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
}
.hero-rows {
  margin-top: 18rpx;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}
.hero-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
  font-size: 23rpx;
  color: rgba(255, 255, 255, 0.78);
}
.hero-row .pin {
  font-size: 22rpx;
}
.hero-row .hv {
  color: rgba(255, 255, 255, 0.9);
}
.hero-row .hv.strong {
  font-weight: 600;
  color: #fff;
}
.phone-link {
  color: #2563eb;
  text-decoration: underline;
  text-underline-offset: 4rpx;
}
.hero-row .hv.strong.phone-link {
  color: #fff;
}
.hero-row .sep {
  color: rgba(255, 255, 255, 0.3);
}

/* 操作行 */
.acts {
  display: flex;
  background: #fff;
  margin: -18rpx 20rpx 0;
  padding: 20rpx 8rpx 16rpx;
  border-radius: 20rpx;
  box-shadow: 0 6rpx 18rpx rgba(22, 35, 58, 0.06);
  position: relative;
  z-index: 2;
}
.act {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}
.act-ico {
  width: 72rpx;
  height: 72rpx;
  border-radius: 20rpx;
  background: #f2f5fa;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
}
.act.primary .act-ico {
  background: #eaf2ff;
}
.act-label {
  font-size: 21rpx;
  color: #5b6a80;
}
.act.primary .act-label {
  color: #2563eb;
  font-weight: 600;
}

/* 卡片 */
.card {
  background: #fff;
  margin: 20rpx;
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
  font-size: 28rpx;
  font-weight: 600;
  color: #1f2937;
}
.card-hd-left {
  display: flex;
  align-items: center;
  gap: 10rpx;
}
.count-badge {
  min-width: 34rpx;
  padding: 0 8rpx;
  height: 34rpx;
  line-height: 34rpx;
  text-align: center;
  border-radius: 17rpx;
  background: #2563eb;
  color: #fff;
  font-size: 20rpx;
  font-weight: 600;
}
.card-extra {
  font-size: 22rpx;
  color: #8e9bad;
}
.card-extra.on {
  color: #2563eb;
  font-weight: 600;
}

/* 欠款 */
.debt-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12rpx;
}
.debt-value {
  font-size: 48rpx;
  font-weight: 700;
  color: #c9343d;
  font-variant-numeric: tabular-nums;
}
.debt-value.zero {
  font-size: 38rpx;
  color: #16a34a;
}
.debt-label {
  display: block;
  font-size: 21rpx;
  color: #9aa6b6;
  margin-top: 2rpx;
}
.overdue-chip {
  flex: none;
  font-size: 20rpx;
  color: #a83540;
  background: #fff1f2;
  border: 1rpx solid #f8d3d6;
  border-radius: 10rpx;
  padding: 6rpx 12rpx;
}
.credit-row {
  display: flex;
  margin-top: 22rpx;
}
.credit-item {
  flex: 1;
  min-width: 0;
}
.credit-item + .credit-item {
  border-left: 1rpx solid #f0f3f8;
  padding-left: 18rpx;
}
.cv {
  display: block;
  font-size: 26rpx;
  font-weight: 700;
  color: #1f2937;
  font-variant-numeric: tabular-nums;
}
.cv.danger {
  color: #c9343d;
}
.cl {
  display: block;
  font-size: 19rpx;
  color: #9aa6b6;
  margin-top: 4rpx;
}
.usage-bar {
  height: 10rpx;
  margin-top: 20rpx;
  background: #eef1f6;
  border-radius: 5rpx;
  overflow: hidden;
}
.usage-fill {
  height: 100%;
  border-radius: 5rpx;
}
.usage-text {
  display: block;
  margin-top: 8rpx;
  font-size: 19rpx;
  color: #9aa6b6;
}

/* 优惠券 */
.coupon {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 18rpx 0;
  border-top: 1rpx solid #f4f7fa;
}
.coupon:first-of-type {
  border-top: 0;
  padding-top: 4rpx;
}
.coupon-face {
  flex: none;
  width: 150rpx;
  height: 96rpx;
  border-radius: 14rpx;
  background: linear-gradient(140deg, #fff4e5, #ffe7c7);
  display: flex;
  align-items: center;
  justify-content: center;
}
.coupon-face-value {
  font-size: 34rpx;
  font-weight: 700;
  color: #d97706;
  font-variant-numeric: tabular-nums;
}
.coupon-tx {
  flex: 1;
  min-width: 0;
}
.coupon-title-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
}
.coupon-name {
  font-size: 25rpx;
  font-weight: 600;
  color: #1f2937;
}
.coupon-type {
  flex: none;
  font-size: 18rpx;
  color: #d97706;
  background: #fff7ed;
  border: 1rpx solid #fde3bd;
  border-radius: 6rpx;
  padding: 2rpx 8rpx;
}
.coupon-sub {
  display: block;
  font-size: 20rpx;
  color: #a3aebd;
  margin-top: 4rpx;
}

/* 常购 */
.freq {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 18rpx 0;
  border-top: 1rpx solid #f4f7fa;
}
.freq:first-of-type {
  border-top: 0;
  padding-top: 4rpx;
}
.freq-tx {
  flex: 1;
  min-width: 0;
}
.freq-name {
  font-size: 25rpx;
  color: #1f2937;
  font-weight: 600;
}
.freq-spec {
  font-size: 22rpx;
  color: #8d99aa;
  font-weight: 400;
}
.freq-sub {
  display: block;
  font-size: 20rpx;
  color: #a3aebd;
  margin-top: 4rpx;
}
.freq-price {
  flex: none;
  text-align: right;
}
.freq-amt {
  display: block;
  font-size: 25rpx;
  font-weight: 700;
  color: #1f2937;
  font-variant-numeric: tabular-nums;
}
.freq-amt.empty {
  color: #c2cbd8;
}
.freq-label {
  font-size: 18rpx;
  color: #a3aebd;
}
.freq-add {
  flex: none;
  width: 56rpx;
  height: 56rpx;
  border-radius: 16rpx;
  background: #f2f7ff;
  color: #2563eb;
  font-size: 32rpx;
  line-height: 52rpx;
  text-align: center;
}

/* 订单 */
.ord {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 16rpx 0;
  border-top: 1rpx solid #f4f7fa;
}
.ord:first-of-type {
  border-top: 0;
  padding-top: 2rpx;
}
.ord-tx {
  flex: 1;
  min-width: 0;
}
.ord-no {
  display: block;
  font-size: 24rpx;
  color: #1f2937;
  font-weight: 600;
}
.ord-sub {
  font-size: 20rpx;
  color: #a3aebd;
}
.ord-amt {
  flex: none;
  text-align: right;
}
.ord-value {
  display: block;
  font-size: 26rpx;
  font-weight: 700;
  color: #1f2937;
  font-variant-numeric: tabular-nums;
}
.ord-status {
  display: inline-block;
  font-size: 19rpx;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
  margin-top: 4rpx;
}
.ord-badges {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6rpx;
}
.ord-badges .ord-status {
  margin-top: 0;
}
.ord-unpaid {
  display: block;
  font-size: 19rpx;
  color: #ea580c;
  font-weight: 600;
  margin-top: 4rpx;
}
.s-success {
  background: rgba(22, 163, 74, 0.1);
  color: #16a34a;
}
.s-primary {
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
}
.s-info {
  background: rgba(14, 116, 144, 0.1);
  color: #0e7490;
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

/* 档案 */
.kv {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 0;
  border-top: 1rpx solid #f4f7fa;
}
.kv:first-of-type {
  border-top: 0;
  padding-top: 2rpx;
}
.k {
  flex: none;
  width: 150rpx;
  font-size: 23rpx;
  color: #8d99aa;
}
.v {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10rpx;
  font-size: 25rpx;
  color: #1f2937;
}
.lock {
  font-size: 18rpx;
  color: #a3aebd;
  background: #f3f6fa;
  border-radius: 6rpx;
  padding: 2rpx 8rpx;
}
.v-input {
  flex: 1;
  height: 62rpx;
  padding: 0 16rpx;
  background: #f6f9fd;
  border: 1rpx solid #e3ebf6;
  border-radius: 10rpx;
  font-size: 25rpx;
  color: #1f2937;
}
.pick {
  color: #2563eb;
  font-weight: 600;
}

.bottom-space {
  height: 40rpx;
}
</style>
