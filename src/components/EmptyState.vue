<template>
  <view class="empty-state" :style="{ padding: padding }">
    <view class="empty-icon">{{ icon }}</view>
    <view class="empty-text">{{ text }}</view>
    <view v-if="action" class="empty-action" @tap="$emit('action')">{{ action }}</view>
  </view>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  icon?: string
  text?: string
  action?: string
  padding?: string
}>(), {
  icon: '📭',
  text: '暂无数据',
  action: '',
  padding: '120rpx 32rpx',
})

defineEmits<{ action: [] }>()
</script>

<style lang="scss" scoped>
.empty-state {
  text-align: center;
  color: #9ca3af;
}
.empty-icon {
  font-size: 96rpx;
  margin-bottom: 16rpx;
  opacity: 0.7;
}
.empty-text {
  font-size: 26rpx;
  color: #9ca3af;
}
.empty-action {
  margin-top: 24rpx;
  display: inline-block;
  padding: 12rpx 40rpx;
  background: $uni-color-primary;
  color: #fff;
  border-radius: 40rpx;
  font-size: 26rpx;
}
</style>
