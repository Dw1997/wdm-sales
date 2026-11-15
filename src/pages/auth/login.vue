<template>
  <view class="login-page">
    <view class="bg-decor"></view>
    <view class="login-card">
      <view class="brand">
        <view class="brand-mark">销</view>
        <text class="brand-title">副食批发平台</text>
        <text class="brand-sub">销售端 · Sales Console</text>
      </view>
      <view class="form">
        <view class="form-item">
          <text class="form-label">手机号</text>
          <input class="form-input" v-model="form.phone" type="number" maxlength="11" placeholder="请输入手机号" />
        </view>
        <view class="form-item">
          <text class="form-label">密码</text>
          <input class="form-input" v-model="form.password" :password="true" placeholder="请输入密码 (≥6位)" />
        </view>
        <button class="btn-primary" :loading="loading" @tap="onLogin">登录</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const loading = ref(false)
const form = reactive({ phone: '', password: '' })
const redirect = ref('')

onLoad((opts: any) => {
  redirect.value = opts?.redirect || '/pages/home/index'
})

onMounted(() => {
  // Auto-restore session
  auth.restore()
  if (auth.isLoggedIn) {
    uni.reLaunch({ url: redirect.value })
  }
})

async function onLogin() {
  if (!/^1[3-9]\d{9}$/.test(form.phone)) {
    uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
    return
  }
  if (form.password.length < 6) {
    uni.showToast({ title: '密码至少 6 位', icon: 'none' })
    return
  }
  loading.value = true
  try {
    await auth.login(form.phone, form.password)
    uni.showToast({ title: '登录成功', icon: 'success' })
    setTimeout(() => {
      uni.reLaunch({ url: redirect.value })
    }, 500)
  } catch (e: any) {
    uni.showToast({ title: e?.message || '登录失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.login-page {
  position: relative;
  min-height: 100vh;
  background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #06b6d4 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
}
.bg-decor {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle at 20% 30%, rgba(255, 255, 255, 0.12) 0%, transparent 40%),
    radial-gradient(circle at 80% 70%, rgba(255, 255, 255, 0.08) 0%, transparent 40%);
}
.login-card {
  position: relative;
  width: 100%;
  background: #fff;
  border-radius: 24rpx;
  padding: 60rpx 48rpx;
  box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.2);
}
.brand {
  text-align: center;
  margin-bottom: 48rpx;
}
.brand-mark {
  width: 100rpx;
  height: 100rpx;
  background: $uni-color-primary;
  color: #fff;
  font-size: 56rpx;
  font-weight: 700;
  border-radius: 24rpx;
  margin: 0 auto 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.brand-title {
  display: block;
  font-size: 40rpx;
  font-weight: 600;
  color: #1f2937;
}
.brand-sub {
  display: block;
  font-size: 24rpx;
  color: #9ca3af;
  margin-top: 8rpx;
}
.form-item {
  margin-bottom: 32rpx;
}
.form-label {
  display: block;
  font-size: 26rpx;
  color: #6b7280;
  margin-bottom: 12rpx;
}
.form-input {
  width: 100%;
  height: 88rpx;
  border: 2rpx solid #e5e7eb;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 30rpx;
  color: #1f2937;
  box-sizing: border-box;
}
.form-input:focus {
  border-color: $uni-color-primary;
}
.tips {
  text-align: center;
  margin-top: 32rpx;
  font-size: 22rpx;
  color: #9ca3af;
  padding-top: 24rpx;
  border-top: 2rpx dashed #e5e7eb;
}
</style>
