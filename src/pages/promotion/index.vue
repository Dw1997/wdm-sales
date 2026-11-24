<template>
  <view class="promotion-page">
    <scroll-view scroll-y="true" class="content">
      <!-- Invite card -->
      <view class="invite-card">
        <view class="invite-top">
          <view class="invite-header">
            <text class="invite-title">我的专属推广码</text>
            <text class="invite-sub">客户通过推广链接或小程序码进入，自动绑定归属</text>
          </view>
          <view v-if="qrcodeUrl" class="invite-qr-thumb" @tap="previewQr">
            <image :src="qrcodeUrl" mode="aspectFit" class="qr-thumb-img" />
            <text class="qr-thumb-tip">放大</text>
          </view>
        </view>
        <view class="invite-code">
          <text class="code-text">{{ stats?.invite_code || '—' }}</text>
          <view class="copy-btn" @tap="copyPromoLink">
            <text>{{ copyingLink ? '生成中...' : '复制链接' }}</text>
          </view>
        </view>
        <view class="invite-actions">
          <view class="invite-action" @tap="goPoster">
            <text class="action-emoji">🖼️</text>
            <text class="action-label">小程序码海报</text>
          </view>
          <view class="invite-action" @tap="copyPromoLink">
            <text class="action-emoji">📋</text>
            <text class="action-label">{{ copyingLink ? '生成中...' : '复制推广链接' }}</text>
          </view>
        </view>
      </view>

      <!-- Stats grid -->
      <view class="stats-grid">
        <view class="stat-item">
          <text class="stat-value">{{ stats?.total_visits || 0 }}</text>
          <text class="stat-label">扫码访问</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">{{ stats?.total_registered || 0 }}</text>
          <text class="stat-label">注册客户</text>
        </view>
        <view class="stat-item">
          <text class="stat-value">{{ stats?.approved || 0 }}</text>
          <text class="stat-label">已审核</text>
        </view>
        <view class="stat-item">
          <text class="stat-value text-warning">{{ stats?.pending_approvals || 0 }}</text>
          <text class="stat-label">待审核</text>
        </view>
      </view>

      <!-- Quick actions -->
      <view class="section">
        <view class="section-title">推广工具</view>
        <view class="tool-grid">
          <view class="tool-item" @tap="goApprovals">
            <view class="tool-emoji">✅</view>
            <text class="tool-label">客户审核</text>
            <text v-if="stats?.pending_approvals" class="tool-badge">{{ stats?.pending_approvals }}</text>
          </view>
          <view class="tool-item" @tap="goVisit">
            <view class="tool-emoji">📍</view>
            <text class="tool-label">拜访签到</text>
          </view>
          <view class="tool-item" @tap="goPoster">
            <view class="tool-emoji">🖼️</view>
            <text class="tool-label">推广海报</text>
          </view>
          <view class="tool-item" @tap="goCustomers">
            <view class="tool-emoji">👥</view>
            <text class="tool-label">我的客户</text>
          </view>
        </view>
      </view>

      <!-- Recent visits -->
      <view class="section">
        <view class="section-title-row">
          <text class="section-title">最近拜访</text>
        </view>
        <view v-if="visits.length" class="visit-list">
          <view v-for="v in visits" :key="v.id" class="visit-item">
            <view class="visit-icon">📍</view>
            <view class="visit-content">
              <text class="visit-customer">{{ v.customer_name }}</text>
              <text class="visit-text">{{ v.content }}</text>
              <text class="visit-meta">{{ v.location }} · {{ relativeTime(v.created_at) }}</text>
            </view>
          </view>
        </view>
        <empty-state v-else icon="📍" text="暂无拜访记录" action="去签到" @action="goVisit" />
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import { promotionApi } from '@/api'
import { relativeTime } from '@/utils/format'
import type { PromotionStats, VisitRecord } from '@/types'

const stats = ref<PromotionStats | null>(null)
const visits = ref<VisitRecord[]>([])
const qrcodeUrl = ref('')
const copyingLink = ref(false)

async function load() {
  try {
    const [s, v] = await Promise.all([promotionApi.stats(), promotionApi.visits()])
    stats.value = s
    visits.value = v
    if (s.qrcode_url) {
      qrcodeUrl.value = s.qrcode_url
    } else if (s.invite_code && !qrcodeUrl.value) {
      promotionApi.qrcode().then((res) => {
        if (res?.qrcode_url) qrcodeUrl.value = res.qrcode_url
      }).catch(() => { /* 未配置微信/COS 时静默 */ })
    }
  } catch (e) {
    /* ignore */
  }
}

function previewQr() {
  if (!qrcodeUrl.value) return
  uni.previewImage({ urls: [qrcodeUrl.value] })
}

async function copyPromoLink() {
  // 无推广码或正在生成时直接忽略，避免重复请求
  if (!stats.value?.invite_code || copyingLink.value) return
  copyingLink.value = true
  try {
    const res = await promotionApi.urlLink()
    if (res?.url_link) {
      // H5 与小程序默认复制后自带提示，这里关闭后统一在 success 中提示
      uni.setClipboardData({
        data: res.url_link,
        showToast: false,
        success: () => uni.showToast({ title: '已复制小程序推广链接', icon: 'success' }),
      })
    } else {
      uni.showToast({ title: res?.unavailable_reason || '暂无法生成推广链接', icon: 'none' })
    }
  } catch (e) {
    /* 请求层已统一提示错误，此处静默 */
  } finally {
    copyingLink.value = false
  }
}
function goPoster() { uni.navigateTo({ url: '/pages/promotion/poster' }) }
function goVisit() { uni.navigateTo({ url: '/pages/promotion/visit' }) }
function goApprovals() { uni.navigateTo({ url: '/pages/home/approvals/customer' }) }
function goCustomers() { uni.switchTab({ url: '/pages/customers/index' }) }

onShow(load)
onPullDownRefresh(async () => {
  await load()
  uni.stopPullDownRefresh()
})
onMounted(load)
</script>

<style lang="scss" scoped>
.promotion-page {
  min-height: 100vh;
  background: #f5f5f7;
}
.content {
  height: calc(100vh - var(--window-top, 0px));
  box-sizing: border-box;
}
.invite-card {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  margin: 16rpx;
  border-radius: 20rpx;
  padding: 32rpx;
  color: #fff;
  box-shadow: 0 8rpx 24rpx rgba(37, 99, 235, 0.3);
}
.invite-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 20rpx;
}
.invite-header {
  flex: 1;
}
.invite-qr-thumb {
  width: 112rpx;
  padding: 8rpx;
  background: #fff;
  border-radius: 12rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}
.qr-thumb-img {
  width: 96rpx;
  height: 96rpx;
}
.qr-thumb-tip {
  font-size: 18rpx;
  color: #2563eb;
  margin-top: 2rpx;
}
.invite-title {
  font-size: 36rpx;
  font-weight: 600;
  display: block;
  margin-bottom: 8rpx;
}
.invite-sub {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
}
.invite-code {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 12rpx;
}
.code-text {
  font-size: 44rpx;
  font-weight: 700;
  letter-spacing: 4rpx;
  font-family: -apple-system, monospace;
}
.invite-link {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 12rpx;
  padding: 16rpx 24rpx;
  margin-bottom: 16rpx;
}
.link-text {
  flex: 1;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.9);
  word-break: break-all;
  margin-right: 12rpx;
}
.copy-btn {
  background: rgba(255, 255, 255, 0.25);
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
  font-size: 22rpx;
}
.invite-actions {
  display: flex;
  gap: 16rpx;
}
.invite-action {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  padding: 16rpx 0;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 12rpx;
}
.action-emoji {
  font-size: 36rpx;
}
.action-label {
  font-size: 24rpx;
}
.stats-grid {
  display: flex;
  background: #fff;
  margin: 16rpx;
  border-radius: 16rpx;
  padding: 24rpx 0;
}
.stat-item {
  flex: 1;
  text-align: center;
  border-right: 2rpx solid #f3f4f6;
}
.stat-item:last-child { border-right: none; }
.stat-value {
  display: block;
  font-size: 40rpx;
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
.section {
  background: #fff;
  margin: 16rpx;
  border-radius: 16rpx;
  padding: 24rpx;
}
.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}
.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 16rpx;
  display: block;
}
.tool-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.tool-item {
  position: relative;
  width: calc(25% - 12rpx);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24rpx 8rpx;
  background: #f9fafb;
  border-radius: 12rpx;
}
.tool-emoji {
  font-size: 48rpx;
  margin-bottom: 8rpx;
}
.tool-label {
  font-size: 22rpx;
  color: #4b5563;
}
.tool-badge {
  position: absolute;
  top: 12rpx;
  right: 20rpx;
  min-width: 32rpx;
  height: 32rpx;
  line-height: 32rpx;
  padding: 0 8rpx;
  background: #dc2626;
  color: #fff;
  border-radius: 16rpx;
  font-size: 18rpx;
  text-align: center;
}
.visit-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.visit-item {
  display: flex;
  gap: 16rpx;
  padding: 16rpx;
  background: #f9fafb;
  border-radius: 12rpx;
}
.visit-icon {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: rgba(37, 99, 235, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  flex-shrink: 0;
}
.visit-content {
  flex: 1;
}
.visit-customer {
  display: block;
  font-size: 28rpx;
  font-weight: 500;
  color: #1f2937;
  margin-bottom: 4rpx;
}
.visit-text {
  display: block;
  font-size: 24rpx;
  color: #6b7280;
  line-height: 1.5;
  margin-bottom: 4rpx;
}
.visit-meta {
  font-size: 22rpx;
  color: #9ca3af;
}
</style>
