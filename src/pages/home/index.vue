<template>
  <view class="home-page">
    <custom-nav-bar :title="'工作台'">
      <template #right>
        <view class="nav-right" @tap="goMessages">
          <text class="msg-icon">🔔</text>
          <text v-if="unreadCount > 0" class="msg-badge">{{ unreadCount }}</text>
        </view>
      </template>
    </custom-nav-bar>

    <scroll-view scroll-y="true" class="content" :style="{ paddingTop: navTotalHeight + 'px' }" @refresherrefresh="onRefresh" :refresher-enabled="true" :refresher-triggered="refreshing">
      <!-- Profile card -->
      <view class="profile-card">
        <view class="profile-info">
          <view class="avatar">{{ auth.userInitial }}</view>
          <view class="meta">
            <text class="name">{{ auth.user?.real_name || '销售' }}</text>
            <text class="sub">推广码：{{ auth.user?.invite_code || '—' }}</text>
          </view>
        </view>
        <view class="profile-action" @tap="goPromotion">
          <text class="action-icon">🎯</text>
          <text class="action-text">去推广</text>
        </view>
      </view>

      <!-- KPI grid -->
      <view class="kpi-section">
        <view class="kpi-row">
          <stat-card icon="💰" label="今日 GMV" :value="'¥' + formatQty(dashboard?.today_gmv || 0)" :extra="`订单 ${dashboard?.today_orders || 0} 单`" bg="linear-gradient(135deg, #2563eb, #3b82f6)" />
          <stat-card icon="🏆" label="本月 GMV" :value="'¥' + formatQty(dashboard?.month_gmv || 0)" :extra="`预估提成 ¥${formatQty(Number((dashboard?.month_estimated_commission || 0).toFixed(2)))}`" bg="linear-gradient(135deg, #ea580c, #f59e0b)" />
        </view>
        <view class="kpi-row">
          <stat-card icon="👥" label="本月新客" :value="dashboard?.month_new_customers || 0" :extra="`待审核 ${dashboard?.pending_approvals || 0}`" bg="linear-gradient(135deg, #16a34a, #22c55e)" />
          <stat-card icon="📍" label="今日拜访" :value="dashboard?.today_visits || 0" :extra="`累计客户 ${dashboard?.month_orders || 0}`" bg="linear-gradient(135deg, #7c3aed, #a855f7)" />
        </view>
      </view>

      <!-- Quick actions -->
      <view class="section">
        <view class="section-title">快捷操作</view>
        <view class="action-grid">
          <view class="action-item" @tap="goOrderCreate">
            <view class="action-emoji">📝</view>
            <text class="action-label">代客下单</text>
          </view>
          <view class="action-item" @tap="goCustomers">
            <view class="action-emoji">👥</view>
            <text class="action-label">客户管理</text>
          </view>
          <view class="action-item" @tap="goPromotion">
            <view class="action-emoji">🎯</view>
            <text class="action-label">拓客推广</text>
          </view>
          <view class="action-item" @tap="goApprovals">
            <view class="action-emoji">✅</view>
            <text class="action-label">客户审核</text>
            <text v-if="dashboard?.pending_approvals" class="action-badge">{{ dashboard?.pending_approvals }}</text>
          </view>
          <view class="action-item" @tap="goPerformance">
            <view class="action-emoji">📊</view>
            <text class="action-label">业绩中心</text>
          </view>
          <view class="action-item" @tap="goMessages">
            <view class="action-emoji">🔔</view>
            <text class="action-label">消息通知</text>
            <text v-if="unreadCount" class="action-badge">{{ unreadCount }}</text>
          </view>
          <view class="action-item" @tap="goVisit">
            <view class="action-emoji">📍</view>
            <text class="action-label">拜访签到</text>
          </view>
          <view class="action-item" @tap="goPoster">
            <view class="action-emoji">🖼️</view>
            <text class="action-label">推广海报</text>
          </view>
        </view>
      </view>

      <!-- Today's tasks -->
      <view class="section">
        <view class="section-title-row">
          <text class="section-title">今日待办</text>
        </view>
        <view v-if="tasks.length" class="task-list">
          <view v-for="task in tasks" :key="task.id" class="task-item" @tap="onTaskTap(task)">
            <view class="task-icon" :style="{ background: task.color }">{{ task.icon }}</view>
            <view class="task-content">
              <text class="task-title">{{ task.title }}</text>
              <text class="task-desc">{{ task.desc }}</text>
            </view>
            <text class="task-arrow">›</text>
          </view>
        </view>
        <empty-state v-else icon="✅" text="今日暂无待办" padding="60rpx 32rpx" />
      </view>

      <!-- Recent orders -->
      <view class="section">
        <view class="section-title-row">
          <text class="section-title">最近订单</text>
          <text class="more-link" @tap="goOrders">查看全部 ›</text>
        </view>
        <view v-if="recentOrders.length">
          <order-card v-for="order in recentOrders" :key="order.id" :order="order" @tap="goOrderDetail(order.id)" />
        </view>
        <empty-state v-else icon="📦" text="暂无订单" padding="60rpx 32rpx" />
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import CustomNavBar from '@/components/CustomNavBar.vue'
import StatCard from '@/components/StatCard.vue'
import OrderCard from '@/components/OrderCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useAuthStore } from '@/stores/auth'
import { salesApi, orderApi, messageApi } from '@/api'
import { formatQty } from '@/utils/format'
import type { SalesDashboard, Order } from '@/types'

const auth = useAuthStore()
const dashboard = ref<SalesDashboard | null>(null)
const recentOrders = ref<Order[]>([])
const unreadCount = ref(0)
const refreshing = ref(false)
const navTotalHeight = ref(64)

try {
  const info = uni.getSystemInfoSync()
  navTotalHeight.value = (info.statusBarHeight || 20) + 44
} catch (e) { /* default */ }

const tasks = computed(() => {
  const out: { id: string; icon: string; title: string; desc: string; color: string; link: string }[] = []
  if (dashboard.value?.pending_approvals) {
    out.push({
      id: 'pending-approvals',
      icon: '✅',
      title: `${dashboard.value.pending_approvals} 位客户待审核`,
      desc: '客户已通过您的推广链接注册，请尽快审核',
      color: 'rgba(234, 88, 12, 0.15)',
      link: '/pages/promotion/approvals',
    })
  }
  if (dashboard.value?.pending_orders) {
    out.push({
      id: 'pending-orders',
      icon: '⏰',
      title: `${dashboard.value.pending_orders} 笔订单待审核`,
      desc: '客户下单后需要销售确认',
      color: 'rgba(37, 99, 235, 0.15)',
      link: '/pages/order/history',
    })
  }
  if (dashboard.value?.low_stock_products) {
    out.push({
      id: 'low-stock',
      icon: '📦',
      title: `${dashboard.value.low_stock_products} 个商品库存不足`,
      desc: '关注客户备货需求',
      color: 'rgba(220, 38, 38, 0.15)',
      link: '/pages-sub/product/search',
    })
  }
  if (dashboard.value?.expiring_batches) {
    out.push({
      id: 'expiring',
      icon: '⏳',
      title: `${dashboard.value.expiring_batches} 个批次临期`,
      desc: '及时通知客户购买',
      color: 'rgba(234, 88, 12, 0.15)',
      link: '/pages-sub/product/search',
    })
  }
  if (!dashboard.value?.today_visits) {
    out.push({
      id: 'visit-today',
      icon: '📍',
      title: '今日尚未拜访客户',
      desc: '保持每周至少 2 次客户拜访',
      color: 'rgba(124, 58, 237, 0.15)',
      link: '/pages/promotion/visit',
    })
  }
  return out
})

async function loadDashboard() {
  try {
    dashboard.value = await salesApi.dashboard()
  } catch (e) {
    /* ignore */
  }
}

async function loadRecentOrders() {
  try {
    const res = await orderApi.list({ page: 1, page_size: 3 })
    recentOrders.value = res.items
  } catch (e) {
    /* ignore */
  }
}

async function loadUnread() {
  try {
    const res = await messageApi.unreadCount()
    unreadCount.value = res.count
  } catch (e) {
    /* ignore */
  }
}

async function refreshAll() {
  await Promise.all([loadDashboard(), loadRecentOrders(), loadUnread()])
}

async function onRefresh() {
  refreshing.value = true
  await refreshAll()
  refreshing.value = false
}

onPullDownRefresh(async () => {
  await refreshAll()
  uni.stopPullDownRefresh()
})

onShow(() => {
  refreshAll()
})

onMounted(() => {
  refreshAll()
})

// Navigation helpers
function goOrderCreate() {
  uni.navigateTo({ url: '/pages/order/create' })
}
function goCustomers() {
  uni.switchTab({ url: '/pages/customers/index' })
}
function goPromotion() {
  uni.switchTab({ url: '/pages/promotion/index' })
}
function goApprovals() {
  uni.navigateTo({ url: '/pages/promotion/approvals' })
}
function goPerformance() {
  uni.switchTab({ url: '/pages/performance/index' })
}
function goMessages() {
  uni.navigateTo({ url: '/pages/messages/index' })
}
function goVisit() {
  uni.navigateTo({ url: '/pages/promotion/visit' })
}
function goPoster() {
  uni.navigateTo({ url: '/pages/promotion/poster' })
}
function goOrders() {
  uni.navigateTo({ url: '/pages/order/history' })
}
function goOrderDetail(id: string) {
  uni.navigateTo({ url: `/pages/order/detail?id=${id}` })
}
function onTaskTap(task: { link: string }) {
  uni.navigateTo({ url: task.link })
}
</script>

<style lang="scss" scoped>
.home-page {
  min-height: 100vh;
  background: #f5f5f7;
}
.content {
  height: 100vh;
  box-sizing: border-box;
}
.nav-right {
  position: relative;
  padding: 8rpx;
}
.msg-icon {
  font-size: 36rpx;
}
.msg-badge {
  position: absolute;
  top: 0;
  right: 0;
  min-width: 28rpx;
  height: 28rpx;
  line-height: 28rpx;
  padding: 0 8rpx;
  border-radius: 14rpx;
  background: #dc2626;
  color: #fff;
  font-size: 18rpx;
  text-align: center;
}
.profile-card {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  margin: 16rpx;
  border-radius: 20rpx;
  padding: 32rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 8rpx 24rpx rgba(37, 99, 235, 0.3);
}
.profile-info {
  display: flex;
  align-items: center;
  gap: 20rpx;
  flex: 1;
}
.avatar {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  font-size: 40rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.meta {
  flex: 1;
}
.name {
  display: block;
  color: #fff;
  font-size: 34rpx;
  font-weight: 600;
  margin-bottom: 4rpx;
}
.sub {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.8);
}
.profile-action {
  background: rgba(255, 255, 255, 0.2);
  padding: 16rpx 24rpx;
  border-radius: 40rpx;
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.action-icon {
  font-size: 28rpx;
}
.action-text {
  color: #fff;
  font-size: 26rpx;
}
.kpi-section {
  padding: 0 16rpx;
}
.kpi-row {
  display: flex;
  gap: 16rpx;
  margin-bottom: 16rpx;
}
.kpi-row stat-card {
  flex: 1;
}
.section {
  background: #fff;
  margin: 16rpx;
  border-radius: 16rpx;
  padding: 24rpx;
}
.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 16rpx;
  display: block;
}
.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}
.more-link {
  font-size: 24rpx;
  color: $uni-color-primary;
}
.action-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.action-item {
  position: relative;
  width: calc(25% - 12rpx);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16rpx 8rpx;
  background: #f9fafb;
  border-radius: 12rpx;
}
.action-emoji {
  font-size: 48rpx;
  margin-bottom: 8rpx;
}
.action-label {
  font-size: 22rpx;
  color: #4b5563;
  text-align: center;
}
.action-badge {
  position: absolute;
  top: 8rpx;
  right: 16rpx;
  min-width: 28rpx;
  height: 28rpx;
  line-height: 28rpx;
  padding: 0 8rpx;
  background: #dc2626;
  color: #fff;
  border-radius: 14rpx;
  font-size: 18rpx;
  text-align: center;
}
.task-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.task-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx;
  background: #f9fafb;
  border-radius: 12rpx;
}
.task-icon {
  width: 64rpx;
  height: 64rpx;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  flex-shrink: 0;
}
.task-content {
  flex: 1;
}
.task-title {
  display: block;
  font-size: 28rpx;
  font-weight: 500;
  color: #1f2937;
  margin-bottom: 4rpx;
}
.task-desc {
  font-size: 22rpx;
  color: #6b7280;
}
.task-arrow {
  font-size: 40rpx;
  color: #9ca3af;
}
</style>
