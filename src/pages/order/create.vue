<template>
  <view class="order-create-page">
    <view v-if="cart.customerName" class="customer-bar" @tap="goSelectCustomer">
      <view class="cust-icon">👥</view>
      <view class="cust-info">
        <text class="cust-name">{{ cart.customerName }}</text>
        <text class="cust-tip">点击切换客户</text>
      </view>
      <text class="cust-arrow">›</text>
    </view>
    <view v-else class="customer-bar empty" @tap="goSelectCustomer">
      <view class="cust-icon">+</view>
      <view class="cust-info">
        <text class="cust-name">请选择客户</text>
        <text class="cust-tip">必填，价格会按客户等级自动计算</text>
      </view>
    </view>

    <view class="search-bar">
      <input class="search-input" v-model="keyword" placeholder="搜索商品名称 / SKU / 品牌" confirm-type="search" @confirm="reload" />
      <view class="filter-btn" @tap="showCategory = !showCategory">
        <text>分类</text>
      </view>
    </view>
    <scroll-view v-if="showCategory" scroll-x="true" class="category-bar">
      <text class="cat-tag" :class="{ active: !category }" @tap="category = ''; reload()">全部</text>
      <text v-for="c in categories" :key="c" class="cat-tag" :class="{ active: category === c }" @tap="category = c; reload()">{{ c }}</text>
    </scroll-view>

    <scroll-view scroll-y="true" class="product-list" @scrolltolower="loadMore">
      <view v-if="list.length">
        <view v-for="p in list" :key="p.id" class="product-item">
          <image class="cover" :src="p.cover || defaultCover" mode="aspectFill" />
          <view class="info">
            <text class="name">{{ p.name }}</text>
            <text class="spec">{{ p.spec }} · {{ p.brand }}</text>
            <view class="units-row">
              <text v-for="u in p.units" :key="u.name" class="unit-tag" :class="{ active: selectedUnit[p.id] === u.name }" @tap="onSelectUnit(p, u)">{{ u.name }}</text>
            </view>
            <view class="bottom-row">
              <view class="price-wrap">
                <text class="price" v-if="cart.customerId">¥{{ (priceMap[p.id] || 0).toFixed(2) }}</text>
                <text class="price" v-else>需选客户</text>
                <text class="stock" :class="p.stock < p.safety_stock ? 'low' : ''">库存 {{ p.stock }}{{ p.base_unit }}</text>
              </view>
              <view class="qty-wrap">
                <view v-if="getQty(p.id) > 0" class="qty-control">
                  <text class="qty-btn" @tap="onMinus(p)">-</text>
                  <text class="qty-num">{{ getQty(p.id) }}</text>
                  <text class="qty-btn plus" @tap="onPlus(p)">+</text>
                </view>
                <view v-else class="add-btn" @tap="onPlus(p)">
                  <text>+加入</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
      <empty-state v-else icon="📦" text="暂无商品" padding="60rpx 0" />
      <view v-if="loadingMore" class="load-more">加载中...</view>
    </scroll-view>

    <view class="bottom-bar">
      <view class="cart-info" @tap="goCart">
        <view class="cart-icon-wrap">
          <text class="cart-icon">🛒</text>
          <text v-if="cart.totalCount > 0" class="cart-badge">{{ cart.totalCount }}</text>
        </view>
        <view class="cart-amount">
          <text class="amount-label">合计</text>
          <text class="amount">¥{{ formatQty(cart.totalAmount.toFixed(2)) }}</text>
        </view>
      </view>
      <button class="btn-primary next-btn" :disabled="cart.isEmpty" @tap="goCart">查看购物车</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import { useCartStore } from '@/stores/cart'
import { productApi, customerApi } from '@/api'
import { formatQty } from '@/utils/format'
import type { Product, ProductUnit, PageQuery } from '@/types'

const cart = useCartStore()
const keyword = ref('')
const category = ref('')
const categories = ref<string[]>([])
const showCategory = ref(false)
const list = ref<Product[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const query = reactive<PageQuery>({ page: 1, page_size: 20 })
const selectedUnit = reactive<Record<number, string>>({})
const priceMap = reactive<Record<number, number>>({})

const defaultCover = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="%23f3f4f6"/><text x="100" y="105" text-anchor="middle" font-size="60" fill="%239ca3af">📦</text></svg>'

function getQty(productId: number): number {
  const items = cart.items.filter((it) => it.product.id === productId)
  return items.reduce((s, it) => s + it.quantity, 0)
}

async function reload() {
  query.page = 1
  loading.value = true
  try {
    const res = await productApi.list({ ...query, keyword: keyword.value, category: category.value })
    list.value = res.items
    // Init default unit
    res.items.forEach((p) => {
      if (!selectedUnit[p.id]) selectedUnit[p.id] = p.units[0]?.name || p.base_unit
    })
    // Resolve prices for current customer
    if (cart.customerId) refreshPrices(res.items)
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (loadingMore.value) return
  loadingMore.value = true
  try {
    const next = Number(query.page) + 1
    const res = await productApi.list({ ...query, page: next, keyword: keyword.value, category: category.value })
    list.value.push(...res.items)
    query.page = next
  } finally {
    loadingMore.value = false
  }
}

async function refreshPrices(products: Product[]) {
  if (!cart.customerId) return
  for (const p of products) {
    const unit = selectedUnit[p.id] || p.base_unit
    try {
      const price = await productApi.price(p.id, cart.customerId, unit)
      priceMap[p.id] = price.unit_price
    } catch (e) { /* ignore */ }
  }
}

function onSelectUnit(p: Product, u: ProductUnit) {
  selectedUnit[p.id] = u.name
  if (cart.customerId) {
    productApi.price(p.id, cart.customerId, u.name).then((price) => {
      priceMap[p.id] = price.unit_price
    })
  }
}

async function onPlus(p: Product) {
  if (!cart.customerId) {
    uni.showToast({ title: '请先选择客户', icon: 'none' })
    return
  }
  const unit = selectedUnit[p.id] || p.units[0]?.name || p.base_unit
  await cart.addItem(p, unit, 1)
}

function onMinus(p: Product) {
  const items = cart.items.filter((it) => it.product.id === p.id)
  if (items.length) {
    const last = items[items.length - 1]
    if (last.quantity > 1) {
      cart.updateQuantity(last, last.quantity - 1)
    } else {
      cart.removeItem(last)
    }
  }
}

function goSelectCustomer() {
  uni.navigateTo({ url: '/pages-sub/product/search?type=customer' })
}
function goCart() {
  if (cart.isEmpty) {
    uni.showToast({ title: '请先添加商品', icon: 'none' })
    return
  }
  uni.navigateTo({ url: '/pages/order/cart' })
}

// Watch customer change to refresh prices
watch(() => cart.customerId, () => {
  if (cart.customerId) refreshPrices(list.value)
})

onLoad(async (opts: any) => {
  if (opts?.customer_id) {
    const c = await customerApi.get(Number(opts.customer_id))
    if (c) cart.setCustomer(c.id, c.shop_name || c.name)
  }
  categories.value = await productApi.categories()
  reload()
})

onShow(() => {
  if (cart.customerId) refreshPrices(list.value)
})
</script>

<style lang="scss" scoped>
.order-create-page {
  min-height: 100vh;
  background: #f5f5f7;
  display: flex;
  flex-direction: column;
  padding-bottom: 120rpx;
}
.customer-bar {
  display: flex;
  align-items: center;
  gap: 16rpx;
  background: #fff;
  margin: 16rpx;
  border-radius: 16rpx;
  padding: 24rpx;
}
.customer-bar.empty {
  background: rgba(37, 99, 235, 0.05);
  border: 2rpx dashed $uni-color-primary;
}
.cust-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: $uni-color-primary;
  color: #fff;
  font-size: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.customer-bar.empty .cust-icon {
  background: rgba(37, 99, 235, 0.1);
  color: $uni-color-primary;
  font-size: 56rpx;
  font-weight: 300;
}
.cust-info {
  flex: 1;
}
.cust-name {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #1f2937;
}
.cust-tip {
  font-size: 22rpx;
  color: #9ca3af;
}
.cust-arrow {
  font-size: 36rpx;
  color: #9ca3af;
}
.search-bar {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx;
  background: #fff;
}
.search-input {
  flex: 1;
  height: 72rpx;
  background: #f3f4f6;
  border-radius: 36rpx;
  padding: 0 32rpx;
  font-size: 26rpx;
}
.filter-btn {
  padding: 12rpx 24rpx;
  color: $uni-color-primary;
  font-size: 26rpx;
}
.category-bar {
  white-space: nowrap;
  padding: 16rpx;
  background: #fff;
  border-bottom: 2rpx solid #f3f4f6;
}
.cat-tag {
  display: inline-block;
  padding: 8rpx 20rpx;
  background: #f3f4f6;
  color: #6b7280;
  border-radius: 20rpx;
  font-size: 22rpx;
  margin-right: 8rpx;
}
.cat-tag.active {
  background: $uni-color-primary;
  color: #fff;
}
.product-list {
  flex: 1;
}
.product-item {
  display: flex;
  gap: 16rpx;
  background: #fff;
  margin: 16rpx;
  border-radius: 16rpx;
  padding: 20rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.cover {
  width: 160rpx;
  height: 160rpx;
  border-radius: 12rpx;
  background: #f3f4f6;
  flex-shrink: 0;
}
.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.name {
  font-size: 28rpx;
  font-weight: 600;
  color: #1f2937;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 4rpx;
}
.spec {
  font-size: 22rpx;
  color: #9ca3af;
  margin-bottom: 8rpx;
}
.units-row {
  display: flex;
  gap: 6rpx;
  margin-bottom: 8rpx;
}
.unit-tag {
  font-size: 20rpx;
  padding: 2rpx 12rpx;
  background: #f3f4f6;
  color: #6b7280;
  border-radius: 6rpx;
}
.unit-tag.active {
  background: $uni-color-primary;
  color: #fff;
}
.bottom-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
}
.price-wrap {
  display: flex;
  flex-direction: column;
}
.price {
  font-size: 30rpx;
  font-weight: 600;
  color: #dc2626;
  font-variant-numeric: tabular-nums;
}
.stock {
  font-size: 20rpx;
  color: #6b7280;
}
.stock.low { color: #dc2626; }
.qty-wrap {
  display: flex;
  align-items: center;
}
.qty-control {
  display: flex;
  align-items: center;
  gap: 16rpx;
  background: #f3f4f6;
  border-radius: 32rpx;
  padding: 4rpx;
}
.qty-btn {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: #fff;
  text-align: center;
  line-height: 56rpx;
  font-size: 36rpx;
  color: #6b7280;
}
.qty-btn.plus {
  background: $uni-color-primary;
  color: #fff;
}
.qty-num {
  min-width: 40rpx;
  text-align: center;
  font-size: 28rpx;
  font-weight: 500;
  color: #1f2937;
}
.add-btn {
  background: $uni-color-primary;
  color: #fff;
  padding: 12rpx 24rpx;
  border-radius: 32rpx;
  font-size: 24rpx;
}
.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  background: #fff;
  padding: 16rpx 24rpx;
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.05);
  z-index: 100;
}
.cart-info {
  display: flex;
  align-items: center;
  gap: 16rpx;
  flex: 1;
}
.cart-icon-wrap {
  position: relative;
  width: 80rpx;
  height: 80rpx;
  background: $uni-color-primary;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cart-icon {
  font-size: 40rpx;
}
.cart-badge {
  position: absolute;
  top: -4rpx;
  right: -4rpx;
  min-width: 32rpx;
  height: 32rpx;
  line-height: 32rpx;
  padding: 0 8rpx;
  background: #dc2626;
  color: #fff;
  border-radius: 16rpx;
  font-size: 18rpx;
  text-align: center;
}
.cart-amount {
  flex: 1;
}
.amount-label {
  font-size: 22rpx;
  color: #9ca3af;
}
.amount {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #dc2626;
  font-variant-numeric: tabular-nums;
}
.next-btn {
  width: 280rpx;
  height: 80rpx;
  line-height: 80rpx;
  font-size: 28rpx;
}
.next-btn[disabled] {
  opacity: 0.5;
}
</style>
