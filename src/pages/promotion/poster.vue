<template>
  <view class="poster-page">
    <view class="poster">
      <view class="poster-bg">
        <view class="poster-header">
          <text class="poster-title">副食批发平台</text>
          <text class="poster-sub">注册有礼 · 享受批发价</text>
        </view>
        <view class="sales-info">
          <view class="sales-avatar">{{ auth.userInitial }}</view>
          <view class="sales-meta">
            <text class="sales-name">{{ auth.user?.real_name || '销售员' }}</text>
            <text class="sales-region">{{ auth.user?.region || '区域销售' }}</text>
            <text class="sales-phone">{{ auth.user?.phone || '' }}</text>
          </view>
        </view>
        <view class="qr-section">
          <view class="qr-placeholder">
            <view class="qr-grid">
              <view v-for="i in 64" :key="i" class="qr-cell" :class="{ on: qrPattern[i - 1] }"></view>
            </view>
          </view>
          <text class="qr-tip">扫码注册</text>
          <text class="qr-code">推广码：{{ auth.user?.invite_code || '—' }}</text>
        </view>
        <view class="poster-foot">
          <text class="foot-text">· 5 万 + 商品批发价</text>
          <text class="foot-text">· 专属销售一对一服务</text>
          <text class="foot-text">· 账期支持，先货后款</text>
        </view>
      </view>
    </view>
    <view class="actions">
      <button class="btn-outline" @tap="onSave">保存到相册</button>
      <button class="btn-primary" @tap="onShare">分享给客户</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const qrPattern = ref<boolean[]>([])

function genPattern() {
  const arr: boolean[] = []
  for (let i = 0; i < 64; i++) {
    arr.push(Math.random() > 0.5)
  }
  // Make it look QR-like: corners are squares
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const idx = r * 8 + c
      const edge = r === 0 || r === 6 || c === 0 || c === 6
      const middle = r >= 2 && r <= 4 && c >= 2 && c <= 4
      arr[idx] = edge || middle
      arr[r * 8 + c + 56] = arr[idx] // bottom-left
      arr[(r + 1) * 8 - 1 - 0] = arr[idx]
    }
  }
  qrPattern.value = arr
}

function onSave() {
  // #ifdef H5
  uni.showToast({ title: '请长按图片保存', icon: 'none' })
  // #endif
  // #ifndef H5
  uni.showToast({ title: '已保存 (演示)', icon: 'success' })
  // #endif
}
function onShare() {
  uni.setClipboardData({
    data: `https://m.example.com/register?invite=${auth.user?.invite_code || ''}`,
    success: () => uni.showToast({ title: '链接已复制', icon: 'success' }),
  })
}

onMounted(genPattern)
</script>

<style lang="scss" scoped>
.poster-page {
  min-height: 100vh;
  background: #f5f5f7;
  padding: 32rpx;
}
.poster {
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  border-radius: 24rpx;
  padding: 8rpx;
  margin-bottom: 32rpx;
  box-shadow: 0 12rpx 40rpx rgba(37, 99, 235, 0.3);
}
.poster-bg {
  background: #fff;
  border-radius: 18rpx;
  padding: 40rpx 32rpx;
  text-align: center;
}
.poster-header {
  margin-bottom: 32rpx;
}
.poster-title {
  display: block;
  font-size: 48rpx;
  font-weight: 700;
  color: #1f2937;
  letter-spacing: 2rpx;
}
.poster-sub {
  display: block;
  font-size: 26rpx;
  color: #6b7280;
  margin-top: 8rpx;
}
.sales-info {
  display: flex;
  align-items: center;
  gap: 24rpx;
  background: #f9fafb;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 32rpx;
  text-align: left;
}
.sales-avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: $uni-color-primary;
  color: #fff;
  font-size: 44rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sales-meta {
  flex: 1;
}
.sales-name {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #1f2937;
}
.sales-region {
  display: block;
  font-size: 24rpx;
  color: #6b7280;
  margin: 4rpx 0;
}
.sales-phone {
  font-size: 24rpx;
  color: #6b7280;
  font-variant-numeric: tabular-nums;
}
.qr-section {
  margin-bottom: 32rpx;
}
.qr-placeholder {
  width: 320rpx;
  height: 320rpx;
  margin: 0 auto 16rpx;
  padding: 16rpx;
  background: #fff;
  border: 4rpx solid #1f2937;
  border-radius: 12rpx;
}
.qr-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 2rpx;
  width: 100%;
  height: 100%;
}
.qr-cell {
  background: #fff;
  &.on {
    background: #1f2937;
  }
}
.qr-tip {
  display: block;
  font-size: 26rpx;
  color: #4b5563;
}
.qr-code {
  display: block;
  font-size: 22rpx;
  color: #9ca3af;
  margin-top: 4rpx;
  font-family: -apple-system, monospace;
}
.poster-foot {
  background: #fef3c7;
  border-radius: 12rpx;
  padding: 16rpx 24rpx;
  text-align: left;
}
.foot-text {
  display: block;
  font-size: 24rpx;
  color: #92400e;
  line-height: 1.8;
}
.actions {
  display: flex;
  gap: 16rpx;
}
.actions button {
  flex: 1;
}
</style>
