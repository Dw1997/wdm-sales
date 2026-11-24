<template>
  <view class="poster-page">
    <view class="poster">
      <view class="poster-bg">
        <view class="poster-header">
          <text class="poster-title">味都美副食批发</text>
          <text class="poster-sub">微信扫一扫 · 绑定专属客户看批发价</text>
        </view>
        <view class="sales-info">
          <view class="sales-avatar">{{ auth.userInitial }}</view>
          <view class="sales-meta">
            <text class="sales-name">{{ auth.user?.real_name || auth.user?.username || '业务员' }}</text>
            <text class="sales-region">{{ auth.user?.role_name || (auth.isAdmin ? '店主管理员' : '专属销售') }}</text>
            <text class="sales-phone">{{ auth.user?.phone || '' }}</text>
          </view>
        </view>
        <view class="qr-section">
          <view class="qr-box" @tap="previewQr">
            <image
              v-if="qrInfo?.qrcode_url"
              :src="qrInfo.qrcode_url"
              mode="aspectFit"
              class="qr-img"
              show-menu-by-longpress
            />
            <view v-else class="qr-empty">
              <text class="qr-empty-text">
                {{ loading ? '正在生成小程序码...' : (qrInfo?.unavailable_reason || '暂未生成小程序码') }}
              </text>
            </view>
          </view>
          <text class="qr-tip">微信扫描上方小程序码，手机号一键登录</text>
          <text class="qr-code">专属推广码：{{ qrInfo?.invite_code || auth.user?.invite_code || '—' }}</text>
        </view>
        <view class="poster-foot">
          <text class="foot-text">· 干货副食源头批发，老客户自助复单</text>
          <text class="foot-text">· 专属业务员一对一服务与路线配送</text>
          <text class="foot-text">· 可直接保存打印张贴，长期有效</text>
        </view>
      </view>
    </view>
    <view class="actions">
      <button class="btn-outline" :disabled="loading" @tap="loadQrcode(true)">刷新码图</button>
      <button class="btn-primary" :disabled="!qrInfo?.qrcode_url" @tap="onSave">保存小程序码</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { promotionApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import type { PromotionQrcode } from '@/types'

const auth = useAuthStore()
const qrInfo = ref<PromotionQrcode | null>(null)
const loading = ref(false)

async function loadQrcode(refresh = false) {
  loading.value = true
  try {
    qrInfo.value = await promotionApi.qrcode(refresh)
    if (refresh && qrInfo.value?.qrcode_url) {
      uni.showToast({ title: '已重新生成', icon: 'success' })
    }
  } catch {
    /* request 已提示 */
  } finally {
    loading.value = false
  }
}

function previewQr() {
  if (!qrInfo.value?.qrcode_url) return
  uni.previewImage({ urls: [qrInfo.value.qrcode_url] })
}

function onSave() {
  const url = qrInfo.value?.qrcode_url
  if (!url) return
  // #ifdef H5
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.download = `wdm-promo-${qrInfo.value?.invite_code || 'qrcode'}.png`
  a.click()
  uni.showToast({ title: '已触发下载，也可长按图片保存', icon: 'none' })
  // #endif
  // #ifndef H5
  uni.downloadFile({
    url,
    success: (res) => {
      if (res.statusCode !== 200) {
        uni.showToast({ title: '下载图片失败', icon: 'none' })
        return
      }
      uni.saveImageToPhotosAlbum({
        filePath: res.tempFilePath,
        success: () => uni.showToast({ title: '已保存到相册', icon: 'success' }),
        fail: () => uni.showToast({ title: '请允许相册权限后重试', icon: 'none' }),
      })
    },
    fail: () => uni.showToast({ title: '下载图片失败', icon: 'none' }),
  })
  // #endif
}

onMounted(() => loadQrcode(false))
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
.qr-box {
  width: 360rpx;
  height: 360rpx;
  margin: 0 auto 16rpx;
  padding: 16rpx;
  background: #fff;
  border: 2rpx solid #e5e7eb;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.qr-img {
  width: 100%;
  height: 100%;
}
.qr-empty {
  padding: 24rpx;
  text-align: center;
}
.qr-empty-text {
  font-size: 24rpx;
  color: #6b7280;
  line-height: 1.5;
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
