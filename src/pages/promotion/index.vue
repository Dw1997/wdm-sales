<template>
  <view class="promotion-page">
    <scroll-view scroll-y="true" class="content">
      <!-- Invite card -->
      <view class="invite-card">
        <view class="invite-header">
          <text class="invite-title">我的推广码</text>
          <text class="invite-sub">客户扫码或访问链接自动绑定归属</text>
        </view>
        <view class="invite-code">
          <text class="code-text">{{ stats?.invite_code || '—' }}</text>
          <view class="copy-btn" @tap="copyCode">
            <text>复制</text>
          </view>
        </view>
        <view class="invite-link">
          <text class="link-text" selectable>{{ stats?.invite_url || '—' }}</text>
          <view class="copy-btn" @tap="copyLink">
            <text>复制</text>
          </view>
        </view>
        <view class="invite-actions">
          <view class="invite-action" @tap="goPoster">
            <text class="action-emoji">🖼️</text>
            <text class="action-label">推广海报</text>
          </view>
          <view class="invite-action" @tap="share">
            <text class="action-emoji">📤</text>
            <text class="action-label">分享</text>
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

async function load() {
  try {
    [stats.value, visits.value] = await Promise.all([promotionApi.stats(), promotionApi.visits()])
  } catch (e) {
    /* ignore */
  }
}

function copyCode() {
  uni.setClipboardData({ data: stats.value?.invite_code || '' })
}
function copyLink() {
  uni.setClipboardData({ data: stats.value?.invite_url || '' })
}
function share() {
  // #ifdef H5
  if (navigator.share) {
    navigator.share({
      title: '副食批发平台 - 注册有礼',
      text: '通过我的推广链接注册，享受批发价',
      url: stats.value?.invite_url,
    })
  } else {
    copyLink()
  }
  // #endif
  // #ifndef H5
  uni.showToast({ title: '请复制链接分享', icon: 'none' })
  copyLink()
  // #endif
}
function goPoster() { uni.navigateTo({ url: '/pages/promotion/poster' }) }
function goVisit() { uni.navigateTo({ url: '/pages/promotion/visit' }) }
function goApprovals() { uni.navigateTo({ url: '/pages/promotion/approvals' }) }
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
  height: 100vh;
}
.invite-card {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  margin: 16rpx;
  border-radius: 20rpx;
  padding: 32rpx;
  color: #fff;
  box-shadow: 0 8rpx 24rpx rgba(37, 99, 235, 0.3);
}
.invite-header {
  margin-bottom: 24rpx;
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
