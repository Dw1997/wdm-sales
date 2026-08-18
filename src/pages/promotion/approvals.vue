<template>
  <view class="approvals-page">
    <scroll-view scroll-y="true" class="content">
      <view v-if="list.length">
        <view v-for="c in list" :key="c.id" class="approval-card">
          <view class="card-top">
            <view class="cust-info">
              <text class="shop-name">{{ c.shop_name || c.name }}</text>
              <text class="cust-phone">{{ formatPhone(c.phone) }}</text>
            </view>
            <text class="status-tag">待审核</text>
          </view>
          <view class="cust-detail">
            <view class="detail-row">
              <text class="detail-label">邀请码</text>
              <text class="detail-value">{{ c.invite_code || '—' }}</text>
            </view>
            <view class="detail-row">
              <text class="detail-label">地址</text>
              <text class="detail-value">{{ c.address || '—' }}</text>
            </view>
            <view class="detail-row">
              <text class="detail-label">注册时间</text>
              <text class="detail-value">{{ relativeTime(c.registered_at) }}</text>
            </view>
          </view>
          <view class="card-actions">
            <button class="btn-reject" @tap="onReject(c)">驳回</button>
            <button class="btn-approve" @tap="onApprove(c)">通过审核</button>
          </view>
        </view>
      </view>
      <empty-state v-else icon="✅" text="暂无待审核客户" padding="120rpx 32rpx" />
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import { customerApi } from '@/api'
import { formatPhone, relativeTime } from '@/utils/format'
import type { Customer } from '@/types'

const list = ref<Customer[]>([])

async function load() {
  list.value = await customerApi.pending()
}

async function onApprove(c: Customer) {
  uni.showModal({
    title: '确认审核',
    content: `通过「${c.shop_name || c.name}」的注册审核？`,
    success: async (res) => {
      if (res.confirm) {
        await customerApi.approve(c.id, 1)
        uni.showToast({ title: '已通过', icon: 'success' })
        load()
      }
    },
  })
}

async function onReject(c: Customer) {
  uni.showModal({
    title: '驳回审核',
    content: `确认驳回「${c.shop_name || c.name}」的注册？`,
    success: async (res) => {
      if (res.confirm) {
        await customerApi.reject(c.id)
        uni.showToast({ title: '已驳回', icon: 'success' })
        load()
      }
    },
  })
}

onShow(load)
onMounted(load)
</script>

<style lang="scss" scoped>
.approvals-page {
  min-height: 100vh;
  background: #f5f5f7;
}
.content {
  height: 100vh;
}
.approval-card {
  background: #fff;
  margin: 16rpx;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16rpx;
}
.cust-info {
  flex: 1;
}
.shop-name {
  font-size: 32rpx;
  font-weight: 600;
  color: #1f2937;
  display: block;
  margin-bottom: 4rpx;
}
.cust-phone {
  font-size: 26rpx;
  color: #6b7280;
  font-variant-numeric: tabular-nums;
}
.status-tag {
  background: rgba(234, 88, 12, 0.1);
  color: #ea580c;
  padding: 4rpx 16rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
}
.cust-detail {
  background: #f9fafb;
  border-radius: 8rpx;
  padding: 16rpx;
  margin-bottom: 16rpx;
}
.detail-row {
  display: flex;
  margin-bottom: 8rpx;
  &:last-child { margin-bottom: 0; }
}
.detail-label {
  width: 140rpx;
  font-size: 24rpx;
  color: #9ca3af;
}
.detail-value {
  flex: 1;
  font-size: 24rpx;
  color: #4b5563;
}
.card-actions {
  display: flex;
  gap: 16rpx;
}
.btn-reject {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  text-align: center;
  background: #f3f4f6;
  color: #dc2626;
  border-radius: 40rpx;
  font-size: 28rpx;
}
.btn-reject::after { border: none; }
.btn-approve {
  flex: 2;
  height: 80rpx;
  line-height: 80rpx;
  text-align: center;
  background: $uni-color-primary;
  color: #fff;
  border-radius: 40rpx;
  font-size: 28rpx;
}
.btn-approve::after { border: none; }
</style>
