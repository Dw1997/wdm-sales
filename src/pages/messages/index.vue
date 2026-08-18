<template>
  <view class="messages-page">
    <view class="header-bar">
      <text class="mark-all" @tap="onMarkAllRead">全部标为已读</text>
    </view>
    <scroll-view scroll-y="true" class="content">
      <view v-if="list.length">
        <view v-for="msg in list" :key="msg.id" class="msg-item" :class="{ unread: !msg.read }" @tap="onTap(msg)">
          <view class="msg-icon" :style="{ background: typeColor(msg.type) }">
            <text>{{ typeIcon(msg.type) }}</text>
          </view>
          <view class="msg-body">
            <view class="msg-header">
              <text class="msg-title">{{ msg.title }}</text>
              <text v-if="!msg.read" class="unread-dot"></text>
            </view>
            <text class="msg-text">{{ msg.content }}</text>
            <view class="msg-meta">
              <text class="msg-type">{{ typeLabel(msg.type) }}</text>
              <text class="msg-time">{{ relativeTime(msg.created_at) }}</text>
            </view>
          </view>
        </view>
      </view>
      <empty-state v-else icon="🔔" text="暂无消息" padding="120rpx 32rpx" />
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import { messageApi } from '@/api'
import { NOTIFICATION_TYPE } from '@/utils/dict'
import { relativeTime } from '@/utils/format'
import type { Notification } from '@/types'

const list = ref<Notification[]>([])

async function load() {
  list.value = await messageApi.list()
}

function typeIcon(t: string) { return NOTIFICATION_TYPE[t]?.icon || '🔔' }
function typeColor(t: string) { return NOTIFICATION_TYPE[t]?.color || '#64748b' }
function typeLabel(t: string) { return NOTIFICATION_TYPE[t]?.label || '系统' }

async function onTap(msg: Notification) {
  if (!msg.read) {
    await messageApi.markRead(msg.id)
    msg.read = true
  }
  if (msg.link) {
    uni.navigateTo({ url: msg.link })
  }
}

async function onMarkAllRead() {
  await messageApi.markAllRead()
  list.value.forEach((m) => (m.read = true))
  uni.showToast({ title: '已全部标为已读', icon: 'success' })
}

onShow(load)
onMounted(load)
</script>

<style lang="scss" scoped>
.messages-page {
  min-height: 100vh;
  background: #f5f5f7;
  display: flex;
  flex-direction: column;
}
.header-bar {
  background: #fff;
  padding: 16rpx 24rpx;
  display: flex;
  justify-content: flex-end;
  border-bottom: 2rpx solid #f3f4f6;
}
.mark-all {
  font-size: 24rpx;
  color: $uni-color-primary;
}
.content {
  flex: 1;
}
.msg-item {
  display: flex;
  gap: 16rpx;
  background: #fff;
  padding: 24rpx;
  margin: 0 16rpx;
  border-bottom: 2rpx solid #f3f4f6;
  &:first-child { margin-top: 16rpx; border-radius: 16rpx 16rpx 0 0; }
  &:last-child { border-radius: 0 0 16rpx 16rpx; margin-bottom: 16rpx; border-bottom: none; }
  &.unread {
    background: rgba(37, 99, 235, 0.03);
  }
}
.msg-icon {
  width: 72rpx;
  height: 72rpx;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  flex-shrink: 0;
}
.msg-body {
  flex: 1;
  min-width: 0;
}
.msg-header {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 8rpx;
}
.msg-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #1f2937;
  flex: 1;
}
.unread-dot {
  width: 16rpx;
  height: 16rpx;
  background: #dc2626;
  border-radius: 50%;
}
.msg-text {
  display: block;
  font-size: 24rpx;
  color: #6b7280;
  line-height: 1.5;
  margin-bottom: 8rpx;
}
.msg-meta {
  display: flex;
  gap: 12rpx;
  align-items: center;
}
.msg-type {
  font-size: 20rpx;
  color: #9ca3af;
  background: #f3f4f6;
  padding: 2rpx 8rpx;
  border-radius: 4rpx;
}
.msg-time {
  font-size: 22rpx;
  color: #9ca3af;
}
</style>
