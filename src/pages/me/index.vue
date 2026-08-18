<template>
  <view class="me-page">
    <custom-nav-bar :title="'我的'"></custom-nav-bar>
    <scroll-view scroll-y="true" class="content" :style="{ paddingTop: navTotalHeight + 'px' }">
      <view class="profile-card">
        <view class="avatar">{{ auth.userInitial }}</view>
        <view class="profile-info">
          <text class="name">{{ auth.user?.real_name || '销售员' }}</text>
          <text class="sub">{{ auth.user?.phone || '—' }}</text>
        </view>
        <view class="profile-action" @tap="goProfile">
          <text>编辑</text>
        </view>
      </view>

      <view class="quick-stats">
        <view class="stat-item">
          <text class="stat-value">{{ auth.user?.invite_code || '—' }}</text>
          <text class="stat-label">推广码</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">{{ auth.user?.region || '—' }}</text>
          <text class="stat-label">负责区域</text>
        </view>
      </view>

      <view class="menu-section">
        <view class="menu-item" @tap="goCustomers">
          <text class="menu-icon">👥</text>
          <text class="menu-label">我的客户</text>
          <text class="menu-arrow">›</text>
        </view>
        <view class="menu-item" @tap="goOrders">
          <text class="menu-icon">📋</text>
          <text class="menu-label">订单管理</text>
          <text class="menu-arrow">›</text>
        </view>
        <view class="menu-item" @tap="goPerformance">
          <text class="menu-icon">📊</text>
          <text class="menu-label">业绩中心</text>
          <text class="menu-arrow">›</text>
        </view>
        <view class="menu-item" @tap="goMessages">
          <text class="menu-icon">🔔</text>
          <text class="menu-label">消息通知</text>
          <text v-if="unreadCount" class="menu-badge">{{ unreadCount }}</text>
          <text class="menu-arrow">›</text>
        </view>
      </view>

      <view class="menu-section">
        <view class="menu-item" @tap="goPoster">
          <text class="menu-icon">🖼️</text>
          <text class="menu-label">推广海报</text>
          <text class="menu-arrow">›</text>
        </view>
        <view class="menu-item" @tap="goVisit">
          <text class="menu-icon">📍</text>
          <text class="menu-label">拜访签到</text>
          <text class="menu-arrow">›</text>
        </view>
        <view class="menu-item" @tap="onFeedback">
          <text class="menu-icon">💬</text>
          <text class="menu-label">意见反馈</text>
          <text class="menu-arrow">›</text>
        </view>
        <view class="menu-item" @tap="onAbout">
          <text class="menu-icon">ℹ️</text>
          <text class="menu-label">关于</text>
          <text class="menu-version">v0.1.0</text>
          <text class="menu-arrow">›</text>
        </view>
      </view>

      <view class="logout-section">
        <button class="btn-outline logout-btn" @tap="onLogout">退出登录</button>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import CustomNavBar from '@/components/CustomNavBar.vue'
import { useAuthStore } from '@/stores/auth'
import { messageApi } from '@/api'

const auth = useAuthStore()
const unreadCount = ref(0)
const navTotalHeight = ref(64)

try {
  const info = uni.getSystemInfoSync()
  navTotalHeight.value = (info.statusBarHeight || 20) + 44
} catch (e) { /* default */ }

async function loadUnread() {
  try {
    const res = await messageApi.unreadCount()
    unreadCount.value = res.count
  } catch (e) { /* ignore */ }
}

function goProfile() { uni.navigateTo({ url: '/pages/me/profile' }) }
function goCustomers() { uni.switchTab({ url: '/pages/customers/index' }) }
function goOrders() { uni.navigateTo({ url: '/pages/order/history' }) }
function goPerformance() { uni.switchTab({ url: '/pages/performance/index' }) }
function goMessages() { uni.navigateTo({ url: '/pages/messages/index' }) }
function goPoster() { uni.navigateTo({ url: '/pages/promotion/poster' }) }
function goVisit() { uni.navigateTo({ url: '/pages/promotion/visit' }) }

function onFeedback() {
  uni.showToast({ title: '反馈功能开发中', icon: 'none' })
}
function onAbout() {
  uni.showModal({
    title: '副食批发 · 销售端',
    content: '版本 v0.1.0\n\n副食批发平台销售端，提供拓客推广、客户管理、代客下单等核心功能。\n\n© 2026 副食批发平台',
    showCancel: false,
  })
}

async function onLogout() {
  uni.showModal({
    title: '退出登录',
    content: '确认退出当前账号？',
    success: async (res) => {
      if (res.confirm) {
        await auth.logout()
        uni.reLaunch({ url: '/pages/auth/login' })
      }
    },
  })
}

onShow(loadUnread)
onMounted(() => {
  if (!auth.user) auth.fetchMe()
  loadUnread()
})
</script>

<style lang="scss" scoped>
.me-page {
  min-height: 100vh;
  background: #f5f5f7;
}
.content {
  height: 100vh;
}
.profile-card {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  margin: 16rpx;
  border-radius: 20rpx;
  padding: 32rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;
  box-shadow: 0 8rpx 24rpx rgba(37, 99, 235, 0.3);
}
.avatar {
  width: 112rpx;
  height: 112rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  font-size: 48rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.profile-info {
  flex: 1;
}
.name {
  display: block;
  font-size: 36rpx;
  font-weight: 600;
  color: #fff;
  margin-bottom: 4rpx;
}
.sub {
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.8);
}
.profile-action {
  background: rgba(255, 255, 255, 0.2);
  padding: 12rpx 24rpx;
  border-radius: 24rpx;
  color: #fff;
  font-size: 24rpx;
}
.quick-stats {
  display: flex;
  background: #fff;
  margin: 0 16rpx;
  border-radius: 16rpx;
  padding: 24rpx 0;
}
.stat-item {
  flex: 1;
  text-align: center;
  border-right: 2rpx solid #f3f4f6;
  &:last-child { border-right: none; }
}
.stat-value {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #1f2937;
  font-variant-numeric: tabular-nums;
}
.stat-label {
  display: block;
  font-size: 22rpx;
  color: #9ca3af;
  margin-top: 4rpx;
}
.menu-section {
  background: #fff;
  margin: 16rpx;
  border-radius: 16rpx;
  overflow: hidden;
}
.menu-item {
  display: flex;
  align-items: center;
  padding: 28rpx 24rpx;
  border-bottom: 2rpx solid #f3f4f6;
  &:last-child { border-bottom: none; }
}
.menu-icon {
  font-size: 36rpx;
  margin-right: 16rpx;
  width: 56rpx;
}
.menu-label {
  flex: 1;
  font-size: 28rpx;
  color: #1f2937;
}
.menu-version {
  font-size: 24rpx;
  color: #9ca3af;
  margin-right: 8rpx;
}
.menu-badge {
  background: #dc2626;
  color: #fff;
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 12rpx;
  margin-right: 8rpx;
}
.menu-arrow {
  font-size: 36rpx;
  color: #9ca3af;
}
.logout-section {
  padding: 32rpx 16rpx 80rpx;
}
.logout-btn {
  color: #dc2626;
  border-color: #dc2626;
}
</style>
