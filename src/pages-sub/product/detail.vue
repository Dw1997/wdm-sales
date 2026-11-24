<template>
  <view class="spu-detail-page">
    <scroll-view scroll-y class="content">
      <view v-if="spu" class="head">
        <image
          class="cover"
          :src="spu.main_images?.[0] || defaultCover"
          mode="aspectFill"
          @tap="previewMainImages"
        />
        <view class="info">
          <text class="name">{{ spu.name }}</text>
          <text class="meta">
            {{ spu.code }}<template v-if="spu.brand"> · {{ spu.brand }}</template> · 基础单位 {{ spu.base_unit }}
          </text>
          <text v-if="spu.description" class="desc">{{ spu.description }}</text>
        </view>
      </view>

      <view v-if="!cart.customerId" class="notice" @tap="goSelectCustomer">
        <text>选择客户后显示专属批发价，可加购或改价</text>
        <text class="notice-link">去选择 ›</text>
      </view>

      <view class="section">
        <view class="section-title">选择规格</view>
        <view v-for="sku in skus" :key="sku.id" class="sku-row" :class="{ disabled: !sku.is_enabled }">
          <view class="sku-info">
            <text class="sku-name">{{ specText(sku) }}</text>
            <text class="sku-conv">{{ convText(sku) }}</text>
            <text v-if="stockText(sku)" class="sku-stock">{{ stockText(sku) }}</text>
            <text v-if="minPriceText(sku)" class="sku-min">{{ minPriceText(sku) }}</text>
            <text v-if="isSkuBelowMin(sku)" class="sku-below-warn">
              {{ auth.isAdmin ? '⚠️ 低于最低售价（仅提示）' : '⚠️ 低于最低售价，提交后需管理员审批' }}
            </text>
          </view>
          <view class="sku-right">
            <view class="price-line">
              <text v-if="overridePrices[sku.id] !== undefined" class="manual-tag">手改</text>
              <text class="price" :class="{ warn: isSkuBelowMin(sku) }">{{ priceText(sku) }}</text>
            </view>
            <view class="sku-ops">
              <text
                v-if="canOverride && cart.customerId && quotes[sku.id]"
                class="edit-price-btn"
                @tap="openPriceEditor(sku)"
              >改价</text>
              <view class="qty-control">
                <text class="qty-btn" @tap="step(sku, -1)">−</text>
                <text class="qty-num">{{ qty[sku.id] ?? 1 }}</text>
                <text class="qty-btn plus" @tap="step(sku, 1)">+</text>
              </view>
              <view class="add-btn" @tap="onAdd(sku)">加入</view>
            </view>
          </view>
        </view>
        <empty-state v-if="!skus.length && loaded" icon="📦" text="该商品暂无可用规格" padding="60rpx 0" />
      </view>

      <view v-if="spu?.detail_images?.length" class="section">
        <view class="section-title">商品详情</view>
        <image
          v-for="(img, idx) in spu.detail_images"
          :key="idx"
          :src="img"
          mode="widthFix"
          class="detail-img"
          @tap="previewDetailImages(idx)"
        />
      </view>
    </scroll-view>

    <view class="bottom-bar">
      <view class="cart-info" @tap="toggleCartSheet">
        <text class="cart-icon">🛒</text>
        <text v-if="cart.totalCount" class="cart-badge">{{ formatQty(cart.totalCount) }}</text>
        <text class="cart-amount">{{ formatMoney(cart.totalAmount) }}</text>
      </view>
      <button class="btn-primary cart-btn" :disabled="cart.isEmpty" @tap="goConfirm">去结算</button>
    </view>

    <!-- 底部购物车弹出层 -->
    <cart-sheet :visible="cartSheetVisible" @close="cartSheetVisible = false" />

    <!-- 改价弹窗 -->
    <view v-if="editingSku" class="modal-mask" @tap.self="editingSku = null">
      <view class="modal">
        <text class="modal-title">修改单价</text>
        <text class="modal-sub">{{ spu?.name }} · {{ specText(editingSku) }}</text>
        <input
          v-model="editPriceInput"
          class="modal-input"
          type="digit"
          :placeholder="editingQuotePrice.toFixed(2)"
        />
        <view class="modal-meta">
          <text class="modal-tip">客户价 {{ formatMoney(editingQuotePrice) }}</text>
          <text class="modal-tip">最低售价 {{ formatMoney(editingMinPrice) }}</text>
        </view>
        <view v-if="editingIsBelowMin" class="modal-warn">
          <text v-if="auth.isAdmin">⚠️ 低于最低售价，管理员改价将直接生效（仅提示）</text>
          <text v-else>⚠️ 低于最低售价，提交订单后需管理员审批</text>
        </view>
        <view class="modal-actions">
          <button class="btn-outline modal-btn" @tap="resetEditPrice">恢复原价</button>
          <button class="btn-primary modal-btn" @tap="confirmEditPrice">确定</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import CartSheet from '@/components/CartSheet.vue'
import { useCartStore } from '@/stores/cart'
import { useAuthStore } from '@/stores/auth'
import { priceApi, spuApi } from '@/api'
import { formatMoney, formatQty, toNum } from '@/utils/format'
import type { QuoteItem, Sku, Spu } from '@/types'

const cart = useCartStore()
const auth = useAuthStore()
const spu = ref<Spu | null>(null)
const skus = ref<Sku[]>([])
const quotes = reactive<Record<number, QuoteItem>>({})
const qty = reactive<Record<number, number>>({})
const overridePrices = reactive<Record<number, number>>({})
const loaded = ref(false)
let quotedCustomerId: number | null = null

const editingSku = ref<Sku | null>(null)
const editPriceInput = ref('')
const cartSheetVisible = ref(false)

const canOverride = computed(() => auth.can('order.price_override') || auth.isAdmin)

const editingQuotePrice = computed(() => {
  if (!editingSku.value) return 0
  return toNum(quotes[editingSku.value.id]?.unit_price)
})

const editingMinPrice = computed(() => {
  if (!editingSku.value) return 0
  const q = quotes[editingSku.value.id]
  return toNum(q?.min_price ?? q?.unit_price)
})

const editingIsBelowMin = computed(() => {
  const val = Number(editPriceInput.value)
  return Number.isFinite(val) && val > 0 && val < editingMinPrice.value
})

const defaultCover =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="%23f3f4f6"/><text x="200" y="220" text-anchor="middle" font-size="120" fill="%239ca3af">📦</text></svg>'

function specText(sku: Sku): string {
  const values = Object.values(sku.specs || {})
  return values.length ? values.join(' ') : '基础规格'
}

function convText(sku: Sku): string {
  const unit = sku.specs?.['规格'] || '件'
  const base = spu.value?.base_unit || ''
  const q = toNum(sku.base_qty)
  return q > 1 ? `1${unit} = ${formatQty(q)}${base}` : `按${unit}计价`
}

function effectivePrice(sku: Sku): number | null {
  if (overridePrices[sku.id] !== undefined) return overridePrices[sku.id]
  const q = quotes[sku.id]
  if (!q) return null
  return toNum(q.unit_price)
}

function isSkuBelowMin(sku: Sku): boolean {
  const manual = overridePrices[sku.id]
  const q = quotes[sku.id]
  if (manual === undefined || !q) return false
  return manual < toNum(q.min_price ?? q.unit_price)
}

function priceText(sku: Sku): string {
  if (!cart.customerId) return '选客户看价'
  const q = quotes[sku.id]
  const p = effectivePrice(sku)
  if (!q || p === null) return '—'
  return q.unit ? `${formatMoney(p)}/${q.unit}` : formatMoney(p)
}

function minPriceText(sku: Sku): string {
  const q = quotes[sku.id]
  if (!cart.customerId || !q || q.min_price === null || q.min_price === undefined) return ''
  return `最低售价 ${formatMoney(q.min_price)}`
}

function stockText(sku: Sku): string {
  const q = quotes[sku.id]
  const stock = q?.stock_on_hand
  if (stock === null || stock === undefined) return ''
  return `库存 ${formatQty(stock)}${spu.value?.base_unit || ''}`
}

function step(sku: Sku, delta: number) {
  const next = (qty[sku.id] ?? 1) + delta
  qty[sku.id] = Math.max(1, Number(next.toFixed(1)))
}

function openPriceEditor(sku: Sku) {
  const p = effectivePrice(sku)
  editingSku.value = sku
  editPriceInput.value = p !== null ? p.toFixed(2) : ''
}

function resetEditPrice() {
  if (editingSku.value) {
    delete overridePrices[editingSku.value.id]
  }
  editingSku.value = null
}

function confirmEditPrice() {
  if (!editingSku.value) return
  const price = Number(editPriceInput.value)
  if (!price || price <= 0) {
    uni.showToast({ title: '请输入有效单价', icon: 'none' })
    return
  }
  const skuId = editingSku.value.id
  overridePrices[skuId] = Math.round(price * 100) / 100
  if (editingIsBelowMin.value) {
    uni.showToast({
      title: auth.isAdmin ? '提示：已低于最低售价' : '已低于最低售价，提交后需管理员审批',
      icon: 'none',
    })
  }
  editingSku.value = null
}

async function loadQuotes() {
  if (!cart.customerId || !skus.value.length) return
  try {
    const res = await priceApi.quote(
      cart.customerId,
      skus.value.map((s) => s.id),
    )
    quotedCustomerId = cart.customerId
    res.items.forEach((q) => (quotes[q.sku_id] = q))
  } catch {
    /* 没有定价或网络问题时保持 — */
  }
}

function onAdd(sku: Sku) {
  if (!cart.customerId) {
    uni.showToast({ title: '请先选择客户', icon: 'none' })
    return
  }
  const q = quotes[sku.id]
  if (!q) {
    uni.showToast({ title: '暂未取到客户价', icon: 'none' })
    return
  }
  const manual = overridePrices[sku.id]
  cart.addFromQuote(sku, q, qty[sku.id] ?? 1, manual)
  uni.showToast({
    title: isSkuBelowMin(sku) && !auth.isAdmin ? '已加入（提交需审批）' : '已加入购物车',
    icon: isSkuBelowMin(sku) ? 'none' : 'success',
  })
}

function previewMainImages() {
  const imgs = spu.value?.main_images || []
  if (!imgs.length) return
  uni.previewImage({ urls: imgs })
}

function previewDetailImages(current: number) {
  const imgs = spu.value?.detail_images || []
  if (!imgs.length) return
  uni.previewImage({ urls: imgs, current })
}

function goSelectCustomer() {
  uni.navigateTo({ url: '/pages-sub/product/search?type=customer' })
}

function toggleCartSheet() {
  if (cart.isEmpty) {
    uni.showToast({ title: '购物车为空', icon: 'none' })
    return
  }
  cartSheetVisible.value = !cartSheetVisible.value
}

function goConfirm() {
  if (cart.isEmpty) {
    uni.showToast({ title: '购物车为空', icon: 'none' })
    return
  }
  cartSheetVisible.value = false
  uni.navigateTo({ url: '/pages/order/confirm' })
}

onLoad(async (opts: any) => {
  if (!opts?.id) return
  const spuId = Number(opts.id)
  spu.value = await spuApi.get(spuId)
  const res = await spuApi.skus(spuId, { page: 1, page_size: 100, is_enabled: true })
  skus.value = res.items.filter((s) => s.is_enabled)
  skus.value.forEach((s) => (qty[s.id] = 1))
  loaded.value = true
  await loadQuotes()
})

onShow(() => {
  if (loaded.value && cart.customerId && quotedCustomerId !== cart.customerId) {
    Object.keys(overridePrices).forEach((k) => delete overridePrices[Number(k)])
    void loadQuotes()
  }
})
</script>

<style lang="scss" scoped>
.spu-detail-page { min-height: 100vh; background: #f5f5f7; padding-bottom: 120rpx; }
.content { height: calc(100vh - 120rpx); }
.head { background: #fff; }
.cover { width: 100%; height: 520rpx; background: #f3f4f6; }
.info { padding: 24rpx; }
.name { font-size: 36rpx; font-weight: 600; color: #1f2937; display: block; margin-bottom: 8rpx; }
.meta { font-size: 24rpx; color: #9ca3af; display: block; margin-bottom: 8rpx; }
.desc { font-size: 26rpx; color: #6b7280; line-height: 1.6; }
.notice {
  display: flex; justify-content: space-between; align-items: center;
  margin: 16rpx; padding: 18rpx 24rpx; border-radius: 12rpx;
  background: rgba(37, 99, 235, 0.08); font-size: 24rpx; color: $uni-color-primary;
}
.notice-link { font-weight: 600; flex: none; margin-left: 12rpx; }
.section { background: #fff; margin: 16rpx; border-radius: 16rpx; padding: 24rpx; }
.section-title { font-size: 28rpx; font-weight: 600; color: #1f2937; margin-bottom: 16rpx; display: block; }
.sku-row {
  display: flex; justify-content: space-between; gap: 16rpx;
  padding: 20rpx 0; border-bottom: 2rpx solid #f3f4f6;
  &:last-child { border-bottom: none; }
}
.sku-row.disabled { opacity: 0.45; }
.sku-info { flex: 1; min-width: 0; }
.sku-name { display: block; font-size: 28rpx; font-weight: 600; color: #1f2937; margin-bottom: 4rpx; }
.sku-conv { display: block; font-size: 22rpx; color: #9ca3af; }
.sku-stock { display: block; font-size: 22rpx; color: #6b7280; margin-top: 4rpx; }
.sku-min { display: block; font-size: 21rpx; color: #9ca3af; margin-top: 4rpx; }
.sku-below-warn { display: block; font-size: 21rpx; color: #dc2626; margin-top: 6rpx; font-weight: 500; }
.sku-right { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 10rpx; }
.price-line { display: flex; align-items: center; gap: 8rpx; }
.manual-tag {
  font-size: 18rpx; padding: 2rpx 8rpx; border-radius: 6rpx;
  background: rgba(37, 99, 235, 0.12); color: $uni-color-primary; font-weight: 600;
}
.price { font-size: 30rpx; font-weight: 700; color: #dc2626; font-variant-numeric: tabular-nums; }
.price.warn { color: #b91c1c; }
.sku-ops { display: flex; align-items: center; gap: 10rpx; justify-content: flex-end; }
.edit-price-btn {
  font-size: 22rpx; color: $uni-color-primary; background: rgba(37, 99, 235, 0.08);
  padding: 10rpx 16rpx; border-radius: 28rpx; font-weight: 500;
}
.qty-control { display: flex; align-items: center; gap: 10rpx; background: #f3f4f6; border-radius: 32rpx; padding: 4rpx; }
.qty-btn { width: 44rpx; height: 44rpx; border-radius: 50%; background: #fff; text-align: center; line-height: 44rpx; font-size: 30rpx; color: #6b7280; }
.qty-btn.plus { background: $uni-color-primary; color: #fff; }
.qty-num { min-width: 44rpx; text-align: center; font-size: 26rpx; }
.add-btn { background: $uni-color-primary; color: #fff; padding: 12rpx 22rpx; border-radius: 32rpx; font-size: 24rpx; font-weight: 600; }
.detail-img { width: 100%; border-radius: 12rpx; margin-bottom: 12rpx; display: block; }
.bottom-bar {
  position: fixed; left: 0; right: 0; bottom: 0; display: flex; align-items: center;
  background: #fff; padding: 16rpx 24rpx; box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.05);
}
.cart-info { position: relative; display: flex; align-items: center; gap: 12rpx; flex: 1; }
.cart-icon { font-size: 40rpx; }
.cart-badge {
  position: absolute; top: -10rpx; left: 44rpx; min-width: 28rpx; height: 28rpx; line-height: 28rpx;
  padding: 0 8rpx; background: #dc2626; color: #fff; border-radius: 14rpx; font-size: 18rpx; text-align: center;
}
.cart-amount { font-size: 30rpx; font-weight: 600; color: #dc2626; font-variant-numeric: tabular-nums; }
.cart-btn { width: 280rpx; height: 80rpx; line-height: 80rpx; font-size: 28rpx; }
.cart-btn[disabled] { opacity: 0.5; }

/* 改价弹窗 */
.modal-mask { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45); display: flex; align-items: center; justify-content: center; z-index: 200; }
.modal { width: 620rpx; background: #fff; border-radius: 20rpx; padding: 32rpx; box-sizing: border-box; }
.modal-title { display: block; font-size: 32rpx; font-weight: 600; color: #1f2937; margin-bottom: 8rpx; }
.modal-sub { display: block; font-size: 24rpx; color: #9ca3af; margin-bottom: 20rpx; }
.modal-input { width: 100%; height: 88rpx; border: 2rpx solid #e5e7eb; border-radius: 12rpx; padding: 0 24rpx; font-size: 36rpx; font-weight: 600; box-sizing: border-box; }
.modal-meta { display: flex; justify-content: space-between; margin: 14rpx 0 16rpx; }
.modal-tip { font-size: 22rpx; color: #6b7280; }
.modal-warn {
  background: rgba(220, 38, 38, 0.08); color: #dc2626; padding: 14rpx 18rpx;
  border-radius: 10rpx; font-size: 23rpx; line-height: 1.5; margin-bottom: 20rpx;
}
.modal-actions { display: flex; gap: 16rpx; margin-top: 8rpx; }
.modal-btn { flex: 1; height: 80rpx; line-height: 80rpx; font-size: 28rpx; }
</style>
