<template>
  <view class="stat-card" @tap="$emit('tap')">
    <view class="icon-wrap" :style="{ background: bg }">
      <text class="icon">{{ icon }}</text>
    </view>
    <view class="content">
      <view class="label">{{ label }}</view>
      <view class="value text-money">{{ value }}</view>
      <view v-if="extra" class="extra">{{ extra }}</view>
    </view>
  </view>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  icon: string
  label: string
  value: string | number
  extra?: string
  bg?: string
}>(), {
  bg: 'linear-gradient(135deg, #2563eb, #3b82f6)',
})

defineEmits<{ tap: [] }>()
</script>

<style lang="scss" scoped>
.stat-card {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  gap: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.icon-wrap {
  width: 80rpx;
  height: 80rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.icon {
  font-size: 40rpx;
}
.content {
  flex: 1;
  min-width: 0;
}
.label {
  font-size: 24rpx;
  color: #6b7280;
  margin-bottom: 4rpx;
}
.value {
  font-size: 40rpx;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.2;
}
.extra {
  font-size: 22rpx;
  color: #9ca3af;
  margin-top: 4rpx;
}
</style>
