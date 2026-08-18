<template>
  <view class="custom-navbar" :style="{ paddingTop: statusBarHeight + 'px' }">
    <view class="navbar-inner" :style="{ height: navBarHeight + 'px' }">
      <view class="left" @tap="onBack" v-if="showBack">
        <text class="back-arrow">‹</text>
      </view>
      <view class="left" v-else>
        <slot name="left"></slot>
      </view>
      <view class="title">{{ title }}</view>
      <view class="right">
        <slot name="right"></slot>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  title?: string
  showBack?: boolean
  bgColor?: string
  textColor?: string
}>()

const emit = defineEmits<{ back: [] }>()

const statusBarHeight = ref(20)
const navBarHeight = 44

try {
  const info = uni.getSystemInfoSync()
  statusBarHeight.value = info.statusBarHeight || 20
} catch (e) {
  /* defaults */
}

function onBack() {
  emit('back')
  uni.navigateBack({ delta: 1 })
}
</script>

<style lang="scss" scoped>
.custom-navbar {
  width: 100%;
  background: $uni-color-primary;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 999;
}

.navbar-inner {
  display: flex;
  align-items: center;
  padding: 0 24rpx;
  position: relative;
}

.left {
  width: 80rpx;
  display: flex;
  align-items: center;
}

.back-arrow {
  font-size: 56rpx;
  color: #fff;
  line-height: 1;
  font-weight: 300;
}

.title {
  flex: 1;
  text-align: center;
  font-size: 32rpx;
  font-weight: 500;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.right {
  min-width: 80rpx;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
</style>
