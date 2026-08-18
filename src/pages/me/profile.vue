<template>
  <view class="profile-page">
    <view class="profile-section">
      <view class="avatar">{{ auth.userInitial }}</view>
      <view class="info">
        <text class="name">{{ auth.user?.real_name || '销售员' }}</text>
        <text class="role">销售员</text>
      </view>
    </view>

    <view class="info-card">
      <view class="info-row">
        <text class="info-label">姓名</text>
        <text class="info-value">{{ auth.user?.real_name || '—' }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">手机号</text>
        <text class="info-value">{{ formatPhone(auth.user?.phone) }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">推广码</text>
        <view class="info-action" @tap="copyCode">
          <text class="info-value">{{ auth.user?.invite_code || '—' }}</text>
          <text class="copy-text">复制</text>
        </view>
      </view>
      <view class="info-row">
        <text class="info-label">负责区域</text>
        <text class="info-value">{{ auth.user?.region || '—' }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">账号</text>
        <text class="info-value">{{ auth.user?.username || '—' }}</text>
      </view>
    </view>

    <view class="info-card">
      <view class="info-row" @tap="onChangePassword">
        <text class="info-label">修改密码</text>
        <text class="info-arrow">›</text>
      </view>
      <view class="info-row" @tap="onClearCache">
        <text class="info-label">清除缓存</text>
        <text class="info-arrow">›</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { formatPhone } from '@/utils/format'

const auth = useAuthStore()

function copyCode() {
  uni.setClipboardData({ data: auth.user?.invite_code || '' })
}

function onChangePassword() {
  uni.showToast({ title: '修改密码功能开发中', icon: 'none' })
}

function onClearCache() {
  uni.showModal({
    title: '清除缓存',
    content: '将清除本地缓存的商品和客户数据，是否继续？',
    success: (res) => {
      if (res.confirm) {
        uni.showToast({ title: '已清除', icon: 'success' })
      }
    },
  })
}
</script>

<style lang="scss" scoped>
.profile-page {
  min-height: 100vh;
  background: #f5f5f7;
}
.profile-section {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  padding: 48rpx 32rpx;
  display: flex;
  align-items: center;
  gap: 24rpx;
  color: #fff;
}
.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  font-size: 56rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.info {
  flex: 1;
}
.name {
  display: block;
  font-size: 40rpx;
  font-weight: 600;
}
.role {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.8);
}
.info-card {
  background: #fff;
  margin: 16rpx;
  border-radius: 16rpx;
  overflow: hidden;
}
.info-row {
  display: flex;
  align-items: center;
  padding: 24rpx;
  border-bottom: 2rpx solid #f3f4f6;
  &:last-child { border-bottom: none; }
}
.info-label {
  flex: 1;
  font-size: 28rpx;
  color: #1f2937;
}
.info-value {
  font-size: 28rpx;
  color: #6b7280;
  font-variant-numeric: tabular-nums;
}
.info-action {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.copy-text {
  font-size: 22rpx;
  color: $uni-color-primary;
  background: rgba(37, 99, 235, 0.08);
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}
.info-arrow {
  font-size: 36rpx;
  color: #9ca3af;
}
</style>
