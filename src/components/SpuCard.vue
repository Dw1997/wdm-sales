<template>
  <view class="spu-card" @tap="$emit('tap')">
    <image class="cover" :src="spu.main_images?.[0] || defaultCover" mode="aspectFill" />
    <view class="info">
      <text class="name">{{ spu.name }}</text>
      <text class="spec">{{ spu.code }}<template v-if="spu.brand"> · {{ spu.brand }}</template></text>
      <view class="tags">
        <text class="tag">基础单位 {{ spu.base_unit }}</text>
        <text class="tag">{{ spu.sku_count }} 个规格</text>
      </view>
      <view class="bottom">
        <text v-if="!spu.status" class="status-off">已停用</text>
        <text class="hint">选择规格后查看客户价</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { Spu } from '@/types'

defineProps<{ spu: Spu }>()
defineEmits<{ tap: [] }>()

const defaultCover = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="%23f3f4f6"/><text x="100" y="105" text-anchor="middle" font-size="60" fill="%239ca3af">📦</text></svg>'
</script>

<style lang="scss" scoped>
.spu-card {
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
.tag {
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
.status-off {
  font-size: 22rpx;
  color: #dc2626;
}
.hint {
  font-size: 22rpx;
  color: #9ca3af;
}
</style>
