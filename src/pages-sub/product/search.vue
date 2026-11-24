<template>
  <view class="search-page">
    <view class="search-bar">
      <input
        v-model="keyword"
        class="search-input"
        :placeholder="placeholder"
        confirm-type="search"
        focus
        @confirm="search"
      />
      <text class="cancel" @tap="goBack">取消</text>
    </view>

    <scroll-view scroll-y class="result">
      <template v-if="mode === 'customer'">
        <view v-if="customers.length">
          <view v-for="c in customers" :key="c.id" class="customer-item" @tap="onPickCustomer(c)">
            <view class="cust-info">
              <text class="shop-name">{{ c.name }}</text>
              <text class="cust-phone">{{ formatPhone(c.phone) }} · {{ c.town || c.address || '未设置地点' }}</text>
            </view>
            <text class="pick-arrow">›</text>
          </view>
        </view>
        <empty-state v-else icon="🔍" text="未找到客户" padding="120rpx 32rpx" />
      </template>

      <template v-else>
        <view v-if="products.length">
          <spu-card v-for="s in products" :key="s.id" :spu="s" @tap="goProductDetail(s.id)" />
        </view>
        <empty-state v-else icon="🔍" text="输入关键词搜索商品" padding="120rpx 32rpx" />
      </template>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import SpuCard from '@/components/SpuCard.vue'
import { customerApi, spuApi } from '@/api'
import { useCartStore } from '@/stores/cart'
import { formatPhone } from '@/utils/format'
import type { Customer, Spu } from '@/types'

const mode = ref<'customer' | 'product'>('product')
const keyword = ref('')
const customers = ref<Customer[]>([])
const products = ref<Spu[]>([])
const cart = useCartStore()

const placeholder = computed(() =>
  mode.value === 'customer' ? '搜索客户名称 / 手机号' : '搜索商品名称 / 编码',
)

async function search() {
  if (mode.value === 'customer') {
    customers.value = await customerApi.list({
      keyword: keyword.value,
      page: 1,
      page_size: 50,
    })
  } else {
    const res = await spuApi.list({ keyword: keyword.value, page: 1, page_size: 50 })
    products.value = res.items
  }
}

function onPickCustomer(c: Customer) {
  cart.setCustomer(c.id, c.name)
  uni.navigateBack()
}

function goProductDetail(id: number) {
  uni.navigateTo({ url: `/pages-sub/product/detail?id=${id}` })
}

function goBack() {
  uni.navigateBack()
}

onLoad((opts: any) => {
  if (opts?.type === 'customer') mode.value = 'customer'
  search()
})
</script>

<style lang="scss" scoped>
.search-page { min-height: 100vh; background: #f5f5f7; display: flex; flex-direction: column; }
.search-bar { display: flex; align-items: center; gap: 16rpx; padding: 16rpx; background: #fff; }
.search-input { flex: 1; height: 72rpx; background: #f3f4f6; border-radius: 36rpx; padding: 0 32rpx; font-size: 26rpx; }
.cancel { font-size: 28rpx; color: $uni-color-primary; }
.result { flex: 1; }
.customer-item {
  display: flex; align-items: center; background: #fff; padding: 24rpx; margin: 0 16rpx;
  border-bottom: 2rpx solid #f3f4f6;
  &:first-child { margin-top: 16rpx; border-radius: 16rpx 16rpx 0 0; }
  &:last-child { border-radius: 0 0 16rpx 16rpx; margin-bottom: 16rpx; border-bottom: none; }
}
.cust-info { flex: 1; }
.shop-name { font-size: 30rpx; font-weight: 500; color: #1f2937; display: block; margin-bottom: 4rpx; }
.cust-phone { font-size: 24rpx; color: #9ca3af; font-variant-numeric: tabular-nums; }
.pick-arrow { font-size: 36rpx; color: #9ca3af; }
</style>
