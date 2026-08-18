<template>
  <view class="product-detail-page">
    <scroll-view scroll-y="true" class="content">
      <view v-if="product" class="product-section">
        <image class="cover" :src="product.cover || defaultCover" mode="aspectFill" />
        <view class="info">
          <text class="name">{{ product.name }}</text>
          <text class="spec">{{ product.spec }} · {{ product.brand }}</text>
          <view class="price-row">
            <text class="price" v-if="cart.customerId">¥{{ (price || 0).toFixed(2) }}/{{ selectedUnit }}</text>
            <text class="price" v-else>需选客户查看价格</text>
            <text class="stock" :class="product.stock < product.safety_stock ? 'low' : ''">库存 {{ product.stock }}{{ product.base_unit }}</text>
          </view>
        </view>
      </view>

      <view v-if="product" class="section">
        <view class="section-title">单位选择</view>
        <view class="units-row">
          <text v-for="u in product.units" :key="u.name" class="unit-tag" :class="{ active: selectedUnit === u.name }" @tap="onUnitChange(u)">{{ u.name }} (1{{ product.base_unit }}={{ u.ratio }}{{ u.name }})</text>
        </view>
      </view>

      <view v-if="product" class="section">
        <view class="section-title">批次信息 (FIFO)</view>
        <view v-for="b in product.batches" :key="b.batch_no" class="batch-item">
          <view class="batch-row">
            <text class="batch-no">{{ b.batch_no }}</text>
            <text class="batch-qty">{{ b.quantity }}{{ product.base_unit }}</text>
          </view>
          <view class="batch-meta">
            <text>生产 {{ b.production_date }}</text>
            <text>到期 {{ b.expiry_date }}</text>
            <text :class="batchStatus(b, product)">{{ batchDaysLeft(b, product) }}</text>
          </view>
        </view>
      </view>

      <view v-if="product" class="section">
        <view class="section-title">商品描述</view>
        <text class="desc">{{ product.description || '暂无描述' }}</text>
      </view>
    </scroll-view>

    <view v-if="product" class="bottom-bar">
      <button class="btn-outline cart-btn" @tap="goOrderCreate">去下单</button>
      <button class="btn-primary add-btn" @tap="onAdd">加入购物车</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { productApi } from '@/api'
import { useCartStore } from '@/stores/cart'
import type { Product, ProductUnit, StockBatch } from '@/types'

const product = ref<Product | null>(null)
const selectedUnit = ref('')
const price = ref(0)
const cart = useCartStore()

const defaultCover = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="%23f3f4f6"/><text x="200" y="220" text-anchor="middle" font-size="120" fill="%239ca3af">📦</text></svg>'

async function load(id: number) {
  product.value = await productApi.get(id)
  if (product.value) {
    selectedUnit.value = product.value.units[0]?.name || product.value.base_unit
    if (cart.customerId) refreshPrice()
  }
}

async function refreshPrice() {
  if (!product.value || !cart.customerId) return
  const p = await productApi.price(product.value.id, cart.customerId, selectedUnit.value)
  price.value = p.unit_price
}

function onUnitChange(u: ProductUnit) {
  selectedUnit.value = u.name
  refreshPrice()
}

function onAdd() {
  if (!product.value) return
  if (!cart.customerId) {
    uni.showToast({ title: '请先选择客户', icon: 'none' })
    return
  }
  cart.addItem(product.value, selectedUnit.value, 1)
  uni.showToast({ title: '已加入', icon: 'success' })
}

function goOrderCreate() {
  uni.navigateTo({ url: '/pages/order/create' })
}

function batchDaysLeft(b: StockBatch, p: Product): string {
  const days = Math.floor((new Date(b.expiry_date.replace(/-/g, '/')).getTime() - Date.now()) / 86400000)
  if (days < 0) return '已过期'
  return `剩 ${days} 天`
}
function batchStatus(b: StockBatch, p: Product): string {
  const days = Math.floor((new Date(b.expiry_date.replace(/-/g, '/')).getTime() - Date.now()) / 86400000)
  if (days < 0) return 'text-danger'
  if (days <= p.expiry_warning_days) return 'text-warning'
  return 'text-success'
}

onLoad((opts: any) => {
  if (opts?.id) load(Number(opts.id))
})
</script>

<style lang="scss" scoped>
.product-detail-page {
  min-height: 100vh;
  background: #f5f5f7;
  padding-bottom: 120rpx;
}
.content {
  height: calc(100vh - 120rpx);
}
.product-section {
  background: #fff;
}
.cover {
  width: 100%;
  height: 600rpx;
  background: #f3f4f6;
}
.info {
  padding: 24rpx;
}
.name {
  font-size: 36rpx;
  font-weight: 600;
  color: #1f2937;
  display: block;
  margin-bottom: 8rpx;
}
.spec {
  font-size: 26rpx;
  color: #9ca3af;
  display: block;
  margin-bottom: 16rpx;
}
.price-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.price {
  font-size: 44rpx;
  font-weight: 600;
  color: #dc2626;
  font-variant-numeric: tabular-nums;
}
.stock {
  font-size: 24rpx;
  color: #6b7280;
}
.stock.low { color: #dc2626; }
.section {
  background: #fff;
  margin: 16rpx;
  border-radius: 16rpx;
  padding: 24rpx;
}
.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 16rpx;
  display: block;
}
.units-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}
.unit-tag {
  padding: 12rpx 24rpx;
  background: #f3f4f6;
  color: #6b7280;
  border-radius: 24rpx;
  font-size: 24rpx;
}
.unit-tag.active {
  background: $uni-color-primary;
  color: #fff;
}
.batch-item {
  padding: 16rpx 0;
  border-bottom: 2rpx solid #f3f4f6;
  &:last-child { border-bottom: none; }
}
.batch-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8rpx;
}
.batch-no {
  font-size: 26rpx;
  font-weight: 500;
  color: #1f2937;
  font-family: monospace;
}
.batch-qty {
  font-size: 24rpx;
  color: #6b7280;
}
.batch-meta {
  display: flex;
  gap: 24rpx;
  font-size: 22rpx;
  color: #9ca3af;
}
.desc {
  font-size: 26rpx;
  color: #6b7280;
  line-height: 1.6;
}
.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  gap: 16rpx;
  background: #fff;
  padding: 16rpx 24rpx;
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.05);
}
.cart-btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  font-size: 28rpx;
}
.add-btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  font-size: 28rpx;
}
</style>
