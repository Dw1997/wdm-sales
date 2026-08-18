<template>
  <view class="search-page">
    <view class="search-bar">
      <input class="search-input" v-model="keyword" :placeholder="placeholder" confirm-type="search" focus @confirm="onConfirm" />
      <text class="cancel" @tap="goBack">取消</text>
    </view>
    <scroll-view scroll-y="true" class="result">
      <!-- Customer picker mode -->
      <template v-if="mode === 'customer'">
        <view v-if="customers.length">
          <view v-for="c in customers" :key="c.id" class="customer-item" @tap="onPickCustomer(c)">
            <view class="cust-info">
              <text class="shop-name">{{ c.shop_name || c.name }}</text>
              <text class="cust-phone">{{ formatPhone(c.phone) }}</text>
            </view>
            <text class="pick-arrow">›</text>
          </view>
        </view>
        <empty-state v-else icon="🔍" text="未找到客户" padding="120rpx 32rpx" />
      </template>
      <!-- Product search mode -->
      <template v-else>
        <view v-if="products.length">
          <product-card v-for="p in products" :key="p.id" :product="p" @tap="goProductDetail(p.id)" />
        </view>
        <empty-state v-else icon="🔍" text="输入关键词搜索商品" padding="120rpx 32rpx" />
      </template>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import ProductCard from '@/components/ProductCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import { customerApi, productApi } from '@/api'
import { useCartStore } from '@/stores/cart'
import { formatPhone } from '@/utils/format'
import type { Customer, Product } from '@/types'

const mode = ref<'customer' | 'product'>('product')
const keyword = ref('')
const customers = ref<Customer[]>([])
const products = ref<Product[]>([])
const cart = useCartStore()

const placeholder = computed(() => mode.value === 'customer' ? '搜索客户姓名 / 手机' : '搜索商品名称 / SKU / 品牌')

async function search() {
  if (mode.value === 'customer') {
    customers.value = await customerApi.all()
    if (keyword.value) {
      const k = keyword.value.toLowerCase()
      customers.value = customers.value.filter(
        (c) => c.name.toLowerCase().includes(k) || c.phone.includes(k) || (c.shop_name || '').toLowerCase().includes(k),
      )
    }
  } else {
    const res = await productApi.list({ keyword: keyword.value, page: 1, page_size: 50 })
    products.value = res.items
  }
}

function onConfirm() {
  search()
}

function onPickCustomer(c: Customer) {
  cart.setCustomer(c.id, c.shop_name || c.name)
  uni.navigateBack()
}

function goProductDetail(id: number) {
  uni.navigateTo({ url: `/pages-sub/product/detail?id=${id}` })
}

function goBack() {
  uni.navigateBack()
}

watch(keyword, () => {
  if (keyword.value === '') search()
})

onLoad((opts: any) => {
  if (opts?.type === 'customer') {
    mode.value = 'customer'
  }
  search()
})
</script>

<style lang="scss" scoped>
.search-page {
  min-height: 100vh;
  background: #f5f5f7;
  display: flex;
  flex-direction: column;
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
.cancel {
  font-size: 28rpx;
  color: $uni-color-primary;
}
.result {
  flex: 1;
}
.customer-item {
  display: flex;
  align-items: center;
  background: #fff;
  padding: 24rpx;
  margin: 0 16rpx;
  border-bottom: 2rpx solid #f3f4f6;
  &:first-child { margin-top: 16rpx; border-radius: 16rpx 16rpx 0 0; }
  &:last-child { border-radius: 0 0 16rpx 16rpx; margin-bottom: 16rpx; border-bottom: none; }
}
.cust-info {
  flex: 1;
}
.shop-name {
  font-size: 30rpx;
  font-weight: 500;
  color: #1f2937;
  display: block;
  margin-bottom: 4rpx;
}
.cust-phone {
  font-size: 24rpx;
  color: #9ca3af;
  font-variant-numeric: tabular-nums;
}
.pick-arrow {
  font-size: 36rpx;
  color: #9ca3af;
}
</style>
