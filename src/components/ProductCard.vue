<template>
  <view class="product-card" @tap="$emit('tap')">
    <image class="cover" :src="product.cover || defaultCover" mode="aspectFill" />
    <view class="info">
      <text class="name">{{ product.name }}</text>
      <text class="spec">{{ product.spec }} · {{ product.brand }}</text>
      <view class="tags">
        <text v-for="(u, i) in product.units" :key="i" class="unit-tag">{{ u.name }}×{{ u.ratio }}</text>
      </view>
      <view class="bottom">
        <text class="price">¥{{ defaultPrice }}</text>
        <text class="stock" :class="product.stock < product.safety_stock ? 'low' : ''">库存 {{ product.stock }}{{ product.base_unit }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Product } from '@/types'

const props = defineProps<{ product: Product }>()
defineEmits<{ tap: [] }>()

const defaultCover = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="%23f3f4f6"/><text x="100" y="105" text-anchor="middle" font-size="60" fill="%239ca3af">📦</text></svg>'

const defaultPrice = computed(() => {
  const ref: Record<number, number> = { 1: 3.5, 2: 2.5, 3: 2.5, 4: 1.5, 5: 13, 6: 3.8, 7: 8, 8: 5 }
  return (ref[props.product.id] || 0).toFixed(2)
})
</script>

<style lang="scss" scoped>
.product-card {
  display: flex;
  gap: 16rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx;
  margin: 16rpx;
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
  margin-bottom: 4rpx;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.3;
}
.spec {
  font-size: 22rpx;
  color: #9ca3af;
  margin-bottom: 8rpx;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6rpx;
  margin-bottom: 8rpx;
}
.unit-tag {
  font-size: 20rpx;
  padding: 2rpx 8rpx;
  background: #f3f4f6;
  color: #6b7280;
  border-radius: 4rpx;
}
.bottom {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-top: auto;
}
.price {
  font-size: 32rpx;
  font-weight: 600;
  color: #dc2626;
  font-variant-numeric: tabular-nums;
}
.stock {
  font-size: 22rpx;
  color: #6b7280;
}
.stock.low {
  color: #dc2626;
}
</style>
