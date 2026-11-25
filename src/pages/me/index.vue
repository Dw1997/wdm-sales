<template>
  <view class="me-page">
    <scroll-view scroll-y="true" class="content">
      <view class="profile-card">
        <view class="avatar">{{ auth.userInitial }}</view>
        <view class="profile-info" @tap="goProfile">
          <view class="name-row">
            <text class="name">{{ auth.user?.real_name || '销售员' }}</text>
            <text v-if="auth.user?.role_name" class="role-badge">{{ auth.user?.role_name }}</text>
          </view>
          <view class="sub-row">
            <text class="sub">{{ auth.user?.phone || '—' }}</text>
            <text class="edit-hint">编辑 ›</text>
          </view>
        </view>
        <view class="qr-box" @tap.stop="goPromotion">
          <image v-if="qrcodeUrl" :src="qrcodeUrl" mode="aspectFit" class="qr-img" />
          <view v-else class="qr-placeholder">
            <text class="qr-glyph">▦</text>
            <text class="qr-label">推广码</text>
          </view>
        </view>
      </view>

      <view v-if="auth.isAdmin" class="quick-stats">
        <view class="stat-item">
          <text class="stat-value" :class="{ 'stat-danger': arOwed }">{{ formatMoney(adminMoney?.ar_total) }}</text>
          <text class="stat-label">客户欠额</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">{{ formatMoney(adminMoney?.ap_total) }}</text>
          <text class="stat-label">欠供应商</text>
        </view>
      </view>
      <view v-else class="quick-stats" @tap="goPerformance">
        <view class="stat-item">
          <text class="stat-value">{{ salesToday?.order_count ?? 0 }} 单</text>
          <text class="stat-label">今日订单</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">{{ formatMoney(salesToday?.gmv) }}</text>
          <text class="stat-label">今日金额</text>
        </view>
        <view class="stat-item">
          <text class="stat-value stat-primary">{{ formatMoney(salesToday?.estimated_commission) }}</text>
          <text class="stat-label">今日预计提成</text>
        </view>
      </view>

      <view class="menu-section">
        <view class="menu-item" @tap="goPerformance">
          <text class="menu-icon">📊</text>
          <text class="menu-label">业绩中心</text>
          <text class="menu-arrow">›</text>
        </view>
        <view class="menu-item" @tap="goPromotion">
          <text class="menu-icon">📣</text>
          <text class="menu-label">拓客推广</text>
          <text class="menu-arrow">›</text>
        </view>
        <view class="menu-item" @tap="goMessages">
          <text class="menu-icon">🔔</text>
          <text class="menu-label">消息通知</text>
          <text v-if="unreadCount" class="menu-badge">{{ unreadCount }}</text>
          <text class="menu-arrow">›</text>
        </view>
      </view>

      <view v-if="auth.isAdmin" class="menu-section">
        <view class="menu-section-title">采购进货</view>
        <view class="menu-item" @tap="goPurchasePlan">
          <text class="menu-icon">📝</text>
          <text class="menu-label">采购清单</text>
          <text class="menu-arrow">›</text>
        </view>
        <view class="menu-item" @tap="goPurchaseReceipts">
          <text class="menu-icon">📦</text>
          <text class="menu-label">采购入库</text>
          <text class="menu-arrow">›</text>
        </view>
        <view class="menu-item" @tap="goVendorPayments">
          <text class="menu-icon">💳</text>
          <text class="menu-label">供应商付款</text>
          <text class="menu-arrow">›</text>
        </view>
      </view>

      <view class="menu-section">
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
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'
import { dashboardApi, messageApi, promotionApi, salesApi } from '@/api'
import { formatMoney, toNum, ymd } from '@/utils/format'
import type { DashboardOverview, SalesPerformance } from '@/types'

const auth = useAuthStore()
const unreadCount = ref(0)
const qrcodeUrl = ref('')
const adminMoney = ref<DashboardOverview['money'] | null>(null)
const salesToday = ref<SalesPerformance | null>(null)
const arOwed = computed(() => toNum(adminMoney.value?.ar_total) > 0)
let qrLoading = false

async function loadUnread() {
  try {
    const res = await messageApi.unreadCount()
    unreadCount.value = res.count
  } catch (e) { /* ignore */ }
}

async function loadQrcode() {
  if (qrcodeUrl.value || qrLoading) return
  qrLoading = true
  try {
    const res = await promotionApi.qrcode(false, { silent: true })
    if (res?.qrcode_url) qrcodeUrl.value = res.qrcode_url
  } catch (e) {
    /* 未配置微信/COS 或网络波动时静默 */
  } finally {
    qrLoading = false
  }
}

async function loadRoleStats() {
  if (!auth.user) {
    try {
      await auth.fetchMe()
    } catch (e) {
      return
    }
  }
  if (auth.isAdmin) {
    try {
      const overview = await dashboardApi.overview()
      adminMoney.value = overview.money
    } catch (e) { /* ignore */ }
  } else {
    try {
      const today = ymd()
      salesToday.value = await salesApi.performance(today, today)
    } catch (e) { /* ignore */ }
  }
}

function goProfile() { uni.navigateTo({ url: '/pages/me/profile' }) }
function goPerformance() { uni.navigateTo({ url: '/pages/performance/index' }) }
function goPromotion() { uni.navigateTo({ url: '/pages/promotion/index' }) }
function goMessages() { uni.navigateTo({ url: '/pages/messages/index' }) }
function goPurchasePlan() { uni.navigateTo({ url: '/pages/purchase/plan' }) }
function goPurchaseReceipts() { uni.navigateTo({ url: '/pages/purchase/receipts' }) }
function goVendorPayments() { uni.navigateTo({ url: '/pages/purchase/vendor-payments' }) }

function onPurchaseSoon(name: string) {
  uni.showToast({ title: `${name}功能即将上线`, icon: 'none' })
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

onShow(() => {
  loadUnread()
  loadRoleStats()
  loadQrcode()
})
onMounted(loadQrcode)
</script>

<style lang="scss" scoped>
.me-page {
  min-height: 100vh;
  background: #f5f5f7;
}
.content {
  height: 100vh;
  box-sizing: border-box;
  padding-top: var(--status-bar-height, 0px);
}
/* #ifdef H5 */
.content {
  height: calc(100vh - 50px);
}
/* #endif */
.profile-card {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  margin: 12rpx 16rpx;
  border-radius: 20rpx;
  padding: 24rpx 28rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;
  box-shadow: 0 8rpx 24rpx rgba(37, 99, 235, 0.3);
}
.avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  font-size: 40rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.profile-info {
  flex: 1;
  min-width: 0;
}
.name-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
}
.name {
  min-width: 0;
  font-size: 32rpx;
  font-weight: 600;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.role-badge {
  flex-shrink: 0;
  font-size: 20rpx;
  padding: 2rpx 12rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.22);
  color: #fff;
  white-space: nowrap;
}
.sub-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 6rpx;
}
.sub {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
}
.edit-hint {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.72);
}
.qr-box {
  width: 84rpx;
  height: 84rpx;
  padding: 6rpx;
  box-sizing: border-box;
  background: #fff;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.qr-img {
  width: 100%;
  height: 100%;
}
.qr-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rpx;
}
.qr-glyph {
  font-size: 26rpx;
  line-height: 1;
  color: #2563eb;
}
.qr-label {
  font-size: 16rpx;
  line-height: 1.2;
  color: #2563eb;
}
.quick-stats {
  display: flex;
  background: #fff;
  margin: 0 16rpx;
  border-radius: 16rpx;
  padding: 18rpx 0;
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stat-danger {
  color: #dc2626;
}
.stat-primary {
  color: #2563eb;
}
.stat-label {
  display: block;
  font-size: 22rpx;
  color: #9ca3af;
  margin-top: 4rpx;
}
.menu-section {
  background: #fff;
  margin: 12rpx 16rpx;
  border-radius: 16rpx;
  overflow: hidden;
}
.menu-section-title {
  padding: 16rpx 24rpx 4rpx;
  font-size: 24rpx;
  color: #9ca3af;
}
.menu-item {
  display: flex;
  align-items: center;
  padding: 22rpx 24rpx;
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
  padding: 20rpx 16rpx 48rpx;
}
.logout-btn {
  color: #dc2626;
  border-color: #dc2626;
}
</style>
