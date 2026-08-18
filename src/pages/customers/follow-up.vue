<template>
  <view class="follow-up-page">
    <scroll-view scroll-y="true" class="content">
      <view class="add-section">
        <view class="type-tabs">
          <view v-for="opt in typeOpts" :key="opt.value" class="type-tab" :class="{ active: form.type === opt.value }" @tap="form.type = opt.value">
            <text class="type-icon">{{ opt.icon }}</text>
            <text class="type-label">{{ opt.label }}</text>
          </view>
        </view>
        <textarea class="content-input" v-model="form.content" placeholder="请输入跟进内容..." maxlength="500" />
        <button class="btn-primary" @tap="onAdd">添加跟进</button>
      </view>

      <view class="section">
        <view class="section-title">历史跟进 ({{ list.length }})</view>
        <view v-if="list.length" class="timeline">
          <view v-for="f in list" :key="f.id" class="timeline-item">
            <view class="timeline-dot" :style="{ background: followUpTypeColor(f.type) }">{{ followUpTypeIcon(f.type) }}</view>
            <view class="timeline-content">
              <view class="timeline-header">
                <text class="timeline-type">{{ followUpTypeLabel(f.type) }}</text>
                <text class="timeline-time">{{ relativeTime(f.created_at) }}</text>
              </view>
              <text class="timeline-text">{{ f.content }}</text>
              <text v-if="f.location" class="timeline-location">📍 {{ f.location }}</text>
            </view>
          </view>
        </view>
        <empty-state v-else icon="📝" text="暂无跟进记录" padding="60rpx 0" />
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import { customerApi } from '@/api'
import { FOLLOW_UP_TYPE } from '@/utils/dict'
import { relativeTime } from '@/utils/format'
import type { FollowUp } from '@/types'

const customerId = ref(0)
const customerName = ref('')
const list = ref<FollowUp[]>([])
const form = reactive<{ type: FollowUp['type']; content: string }>({
  type: 'visit',
  content: '',
})

const typeOpts = [
  { value: 'visit', label: '上门', icon: '🚶' },
  { value: 'phone', label: '电话', icon: '📞' },
  { value: 'wechat', label: '微信', icon: '💬' },
  { value: 'note', label: '备注', icon: '📝' },
]

function followUpTypeIcon(t: string) { return FOLLOW_UP_TYPE[t]?.icon || '📝' }
function followUpTypeColor(t: string) { return FOLLOW_UP_TYPE[t]?.color || '#6b7280' }
function followUpTypeLabel(t: string) { return FOLLOW_UP_TYPE[t]?.label || t }

async function load() {
  if (!customerId.value) return
  list.value = await customerApi.followUps(customerId.value)
}

async function onAdd() {
  if (!form.content.trim()) {
    uni.showToast({ title: '请输入跟进内容', icon: 'none' })
    return
  }
  await customerApi.addFollowUp({
    customer_id: customerId.value,
    customer_name: customerName.value,
    sales_id: 1,
    type: form.type,
    content: form.content,
  })
  uni.showToast({ title: '已添加', icon: 'success' })
  form.content = ''
  load()
}

onLoad(async (opts: any) => {
  customerId.value = Number(opts?.id || 0)
  if (customerId.value) {
    const c = await customerApi.get(customerId.value)
    if (c) customerName.value = c.shop_name || c.name
    load()
  }
})
</script>

<style lang="scss" scoped>
.follow-up-page {
  min-height: 100vh;
  background: #f5f5f7;
}
.content {
  height: 100vh;
}
.add-section {
  background: #fff;
  margin: 16rpx;
  border-radius: 16rpx;
  padding: 24rpx;
}
.type-tabs {
  display: flex;
  gap: 12rpx;
  margin-bottom: 16rpx;
}
.type-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16rpx 0;
  background: #f9fafb;
  border-radius: 12rpx;
  border: 2rpx solid transparent;
}
.type-tab.active {
  background: rgba(37, 99, 235, 0.1);
  border-color: $uni-color-primary;
}
.type-icon {
  font-size: 36rpx;
  margin-bottom: 4rpx;
}
.type-label {
  font-size: 22rpx;
  color: #4b5563;
}
.content-input {
  width: 100%;
  height: 200rpx;
  background: #f9fafb;
  border-radius: 12rpx;
  padding: 20rpx;
  font-size: 28rpx;
  box-sizing: border-box;
  margin-bottom: 16rpx;
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
.timeline {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}
.timeline-item {
  display: flex;
  gap: 16rpx;
}
.timeline-dot {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  flex-shrink: 0;
}
.timeline-content {
  flex: 1;
  padding-top: 8rpx;
}
.timeline-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8rpx;
}
.timeline-type {
  font-size: 24rpx;
  color: #6b7280;
}
.timeline-time {
  font-size: 22rpx;
  color: #9ca3af;
}
.timeline-text {
  display: block;
  font-size: 28rpx;
  color: #1f2937;
  line-height: 1.5;
  margin-bottom: 8rpx;
}
.timeline-location {
  font-size: 22rpx;
  color: #9ca3af;
}
</style>
