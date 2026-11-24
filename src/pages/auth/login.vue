<template>
  <view class="login">
    <!-- 品牌区 -->
    <view class="hero" :style="{ paddingTop: statusBarHeight + 14 + 'px' }">
      <view class="glow glow-a"></view>
      <view class="glow glow-b"></view>
      <view class="mark"><text class="mark-t">味</text></view>
      <text class="brand">味都美</text>
      <text class="brand-sub">干货副食 · 经营管理</text>
      <view class="badge"><text class="badge-t">移动端 · 管理员与销售共用</text></view>
    </view>

    <!-- 登录卡 -->
    <view class="sheet">
      <view class="sheet-hd">
        <text class="sheet-title">账号登录</text>
        <text class="sheet-sub">用手机号和密码登录</text>
      </view>

      <view v-if="errorText" class="alert">
        <view class="alert-i"><text class="alert-i-t">!</text></view>
        <text class="alert-t">{{ errorText }}</text>
      </view>

      <view class="field">
        <text class="lab">手机号</text>
        <view class="box" :class="{ focus: focusField === 'phone', err: phoneErr }">
          <text class="prefix">+86</text>
          <input
            class="ipt"
            type="number"
            :value="form.phone"
            :maxlength="11"
            :disabled="loading || locked"
            placeholder="请输入 11 位手机号"
            placeholder-style="color:#c2c9d4"
            @input="onPhoneInput"
            @focus="focusField = 'phone'"
            @blur="focusField = ''"
          />
        </view>
        <text class="hint" :class="{ 'hint-err': phoneErr }">{{ phoneHint }}</text>
      </view>

      <view class="field">
        <text class="lab">密码</text>
        <view class="box" :class="{ focus: focusField === 'pwd', err: pwdErr }">
          <input
            class="ipt"
            :value="form.password"
            :password="!showPwd"
            :focus="pwdFocus"
            :disabled="loading || locked"
            :maxlength="128"
            confirm-type="done"
            placeholder="请输入密码（至少 6 位）"
            placeholder-style="color:#c2c9d4"
            @input="onPwdInput"
            @focus="focusField = 'pwd'"
            @blur="focusField = ''"
            @confirm="onLogin"
          />
          <text class="eye" :class="{ 'eye-on': showPwd }" @tap="showPwd = !showPwd">
            {{ showPwd ? '隐藏' : '显示' }}
          </text>
        </view>
        <text class="hint" :class="{ 'hint-err': pwdErr }">{{ pwdHint }}</text>
      </view>

      <view class="aux">
        <view class="chk" @tap="remember = !remember">
          <view class="chk-box" :class="{ on: remember }">
            <text v-if="remember" class="chk-tick">✓</text>
          </view>
          <text class="chk-label">记住手机号</text>
        </view>
        <text class="link" @tap="forgotVisible = true">忘记密码</text>
      </view>

      <view class="btn" :class="{ 'btn-loading': loading, 'btn-dead': locked }" @tap="onLogin">
        <view v-if="loading" class="spinner"></view>
        <text class="btn-t">{{ loading ? '登录中…' : '登录' }}</text>
      </view>
    </view>

    <!-- 身份说明 -->
    <view class="note">
      <text class="note-t">登录后按账号身份进入</text>
      <view class="note-row">
        <view class="dot"></view>
        <text class="note-x">管理员：安排出车、采购入库、审批、全店数据</text>
      </view>
      <view class="note-row">
        <view class="dot"></view>
        <text class="note-x">销售：我的客户、订单、欠款与业绩</text>
      </view>
    </view>

    <view class="foot"><text class="foot-t">味都美副食批零一体 · v{{ version }}</text></view>

    <!-- 忘记密码 -->
    <view v-if="forgotVisible" class="mask" @tap="forgotVisible = false">
      <view class="modal" @tap.stop>
        <text class="modal-t">忘记密码</text>
        <text class="modal-p">
          移动端不提供改密。请让店主在 Web 管理端的「员工与权限」里重置密码，重置后用新密码登录。
        </text>
        <view class="modal-btn" @tap="forgotVisible = false"><text class="modal-btn-t">知道了</text></view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { reactive, ref, nextTick } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'

const PHONE_KEY = 'wdm_last_phone'
const PHONE_RE = /^1[3-9]\d{9}$/
const DEFAULT_REDIRECT = '/pages/home/index'

const PHONE_HINT = '店主、销售都用同一个手机号登录'
const PHONE_HINT_ERR = '请输入 11 位手机号'
const PWD_HINT = '密码由店主在 Web 管理端设置，忘记可让店主重置'
const PWD_HINT_ERR = '密码至少 6 位'

const auth = useAuthStore()

const statusBarHeight = ref(0)
const version = ref('2.0.0')
const redirect = ref(DEFAULT_REDIRECT)

const form = reactive({ phone: '', password: '' })
const remember = ref(true)
const showPwd = ref(false)
const loading = ref(false)
const locked = ref(false)
const forgotVisible = ref(false)
const focusField = ref('')
const pwdFocus = ref(false)

const errorText = ref('')
const phoneErr = ref(false)
const pwdErr = ref(false)
const phoneHint = ref(PHONE_HINT)
const pwdHint = ref(PWD_HINT)

onLoad((opts) => {
  redirect.value = (opts?.redirect as string) || DEFAULT_REDIRECT

  const sys = uni.getSystemInfoSync()
  statusBarHeight.value = sys.statusBarHeight || 0
  const appVersion = (sys as unknown as { appVersion?: string }).appVersion
  if (appVersion) version.value = appVersion

  const cached = uni.getStorageSync(PHONE_KEY)
  if (typeof cached === 'string' && cached) form.phone = cached

  /* App 启动时已完成 restore；本地有令牌就直接进主页面，不再闪登录页 */
  if (auth.isLoggedIn) {
    uni.reLaunch({ url: redirect.value })
  }
})

function clearFieldErrors() {
  errorText.value = ''
  phoneErr.value = false
  pwdErr.value = false
  phoneHint.value = PHONE_HINT
  pwdHint.value = PWD_HINT
}

function onPhoneInput(e: unknown) {
  const raw = (e as { detail?: { value?: string } }).detail?.value ?? ''
  form.phone = String(raw).replace(/\D/g, '').slice(0, 11)
  if (errorText.value || phoneErr.value) clearFieldErrors()
}

function onPwdInput(e: unknown) {
  const raw = (e as { detail?: { value?: string } }).detail?.value ?? ''
  form.password = String(raw)
  if (errorText.value || pwdErr.value) clearFieldErrors()
}

function validate(): boolean {
  phoneErr.value = !PHONE_RE.test(form.phone)
  pwdErr.value = form.password.length < 6
  phoneHint.value = phoneErr.value ? PHONE_HINT_ERR : PHONE_HINT
  pwdHint.value = pwdErr.value ? PWD_HINT_ERR : PWD_HINT
  return !phoneErr.value && !pwdErr.value
}

/** 错误体是 { code, message, data: { error_code } }，错误码见 docs/00-core/api/auth.md §1 */
function handleLoginError(err: unknown) {
  const e = err as {
    status?: number
    message?: string
    body?: { data?: { error_code?: string } }
  }
  const code = e?.body?.data?.error_code

  if (code === 'account_disabled') {
    errorText.value = '账号已停用，请联系店主'
    return
  }
  if (code === 'platform_not_allowed') {
    errorText.value = '该账号未开通移动端登录，请使用 Web 管理端'
    return
  }
  if (code === 'forbidden') {
    errorText.value = '该账号未分配角色，请联系店主'
    return
  }
  if (code === 'validation_error') {
    errorText.value = '请填写正确的手机号和密码'
    return
  }
  if (e?.status === 429) {
    locked.value = true
    errorText.value = '登录失败次数过多，请 10 分钟后再试'
    return
  }
  if (e?.status === 401) {
    errorText.value = '手机号或密码不正确'
    form.password = ''
    pwdFocus.value = false
    nextTick(() => {
      pwdFocus.value = true
    })
    return
  }
  if (!e?.status) {
    errorText.value = '网络不通，请检查网络后重试'
    return
  }
  errorText.value = e?.message || '登录失败，请稍后重试'
}

async function onLogin() {
  if (loading.value || locked.value) return
  if (!validate()) return

  errorText.value = ''
  loading.value = true
  try {
    await auth.login(form.phone, form.password)
    if (remember.value) uni.setStorageSync(PHONE_KEY, form.phone)
    else uni.removeStorageSync(PHONE_KEY)
    uni.reLaunch({ url: redirect.value })
  } catch (err) {
    handleLoginError(err)
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.login {
  min-height: 100vh;
  background: #fff;
  display: flex;
  flex-direction: column;
}

/* ---------- 品牌区 ---------- */
.hero {
  position: relative;
  overflow: hidden;
  padding-bottom: 100rpx;
  background: linear-gradient(152deg, #1d4ed8 0%, #2563eb 48%, #0ea5e9 100%);
  text-align: center;
}
.glow {
  position: absolute;
  border-radius: 50%;
}
.glow-a {
  width: 480rpx;
  height: 480rpx;
  right: -184rpx;
  top: -208rpx;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.16), transparent 68%);
}
.glow-b {
  width: 346rpx;
  height: 346rpx;
  left: -161rpx;
  bottom: -134rpx;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.1), transparent 70%);
}
.mark {
  position: relative;
  width: 120rpx;
  height: 120rpx;
  margin: 0 auto 26rpx;
  border-radius: 36rpx;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 20rpx 46rpx rgba(10, 32, 80, 0.24);
}
.mark-t {
  font-size: 60rpx;
  font-weight: 700;
  color: #1d4ed8;
  line-height: 1;
}
.brand {
  display: block;
  font-size: 48rpx;
  letter-spacing: 4rpx;
  color: #fff;
  font-weight: 600;
}
.brand-sub {
  display: block;
  margin-top: 14rpx;
  font-size: 24rpx;
  letter-spacing: 1rpx;
  color: rgba(255, 255, 255, 0.72);
}
.badge {
  display: inline-block;
  margin-top: 24rpx;
  padding: 8rpx 22rpx;
  border-radius: 40rpx;
  background: rgba(255, 255, 255, 0.16);
  border: 1rpx solid rgba(255, 255, 255, 0.24);
}
.badge-t {
  font-size: 20rpx;
  letter-spacing: 0.6rpx;
  color: #e8f1ff;
}

/* ---------- 登录卡 ---------- */
.sheet {
  position: relative;
  z-index: 2;
  margin: -84rpx 28rpx 0;
  padding: 34rpx 32rpx 32rpx;
  border-radius: 40rpx;
  background: #fff;
  box-shadow: 0 24rpx 60rpx rgba(22, 35, 58, 0.1);
}
.sheet-hd {
  display: flex;
  align-items: baseline;
  margin-bottom: 28rpx;
}
.sheet-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1f2937;
  letter-spacing: 0.6rpx;
}
.sheet-sub {
  margin-left: 16rpx;
  font-size: 22rpx;
  color: #9ca3af;
}

.alert {
  display: flex;
  align-items: flex-start;
  margin-bottom: 26rpx;
  padding: 18rpx 22rpx;
  border-radius: 20rpx;
  background: #fef2f2;
  border: 1rpx solid #fbd5d5;
}
.alert-i {
  flex: none;
  width: 28rpx;
  height: 28rpx;
  margin: 2rpx 14rpx 0 0;
  border-radius: 50%;
  background: #dc2626;
  display: flex;
  align-items: center;
  justify-content: center;
}
.alert-i-t {
  font-size: 20rpx;
  color: #fff;
  font-weight: 700;
  line-height: 1;
}
.alert-t {
  flex: 1;
  font-size: 23rpx;
  line-height: 1.5;
  color: #b91c1c;
}

.field {
  display: block;
  margin-bottom: 26rpx;
}
.lab {
  display: block;
  margin-bottom: 12rpx;
  font-size: 23rpx;
  color: #6b7280;
  font-weight: 500;
}
.box {
  display: flex;
  align-items: center;
  height: 88rpx;
  padding: 0 24rpx;
  border-radius: 24rpx;
  border: 1rpx solid #e2e8f0;
  background: #fff;
}
.box.focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 6rpx rgba(37, 99, 235, 0.12);
}
.box.err {
  border-color: #f0a8a8;
  background: #fffafa;
}
.prefix {
  flex: none;
  margin-right: 20rpx;
  padding-right: 20rpx;
  border-right: 1rpx solid #e5e7eb;
  font-size: 26rpx;
  line-height: 36rpx;
  color: #6b7280;
}
.ipt {
  flex: 1;
  min-width: 0;
  height: 88rpx;
  font-size: 30rpx;
  letter-spacing: 0.8rpx;
  color: #1f2937;
}
.eye {
  flex: none;
  margin-left: 16rpx;
  padding-left: 16rpx;
  font-size: 23rpx;
  color: #9aa5b5;
}
.eye-on {
  color: #2563eb;
}
.hint {
  display: block;
  margin-top: 10rpx;
  font-size: 21rpx;
  line-height: 1.4;
  color: #9ca3af;
}
.hint-err {
  color: #dc2626;
}

.aux {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 4rpx 0 30rpx;
}
.chk {
  display: flex;
  align-items: center;
}
.chk-box {
  width: 30rpx;
  height: 30rpx;
  margin-right: 14rpx;
  border-radius: 8rpx;
  border: 3rpx solid #cbd5e1;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}
.chk-box.on {
  border-color: #2563eb;
  background: #2563eb;
}
.chk-tick {
  font-size: 20rpx;
  line-height: 1;
  color: #fff;
  font-weight: 700;
}
.chk-label {
  font-size: 23rpx;
  color: #4b5563;
}
.link {
  font-size: 23rpx;
  color: #2563eb;
  font-weight: 500;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 88rpx;
  border-radius: 24rpx;
  background: linear-gradient(180deg, #2f6bf0, #1d4ed8);
  box-shadow: 0 18rpx 40rpx rgba(37, 99, 235, 0.26);
}
.btn-loading {
  opacity: 0.9;
}
.btn-dead {
  background: #e6eaf0;
  box-shadow: none;
}
.btn-t {
  font-size: 30rpx;
  font-weight: 600;
  letter-spacing: 1.2rpx;
  color: #fff;
}
.btn-dead .btn-t {
  color: #a8b2c1;
}
.spinner {
  width: 28rpx;
  height: 28rpx;
  margin-right: 14rpx;
  border: 4rpx solid rgba(255, 255, 255, 0.42);
  border-top-color: #fff;
  border-radius: 50%;
  animation: login-spin 0.7s linear infinite;
}
@keyframes login-spin {
  to {
    transform: rotate(360deg);
  }
}

/* ---------- 身份说明 ---------- */
.note {
  margin: 28rpx;
  padding: 24rpx 28rpx;
  border-radius: 28rpx;
  background: #eef4ff;
}
.note-t {
  display: block;
  margin-bottom: 12rpx;
  font-size: 23rpx;
  font-weight: 600;
  color: #1e40af;
}
.note-row {
  display: flex;
  align-items: center;
  margin-top: 8rpx;
}
.dot {
  flex: none;
  width: 8rpx;
  height: 8rpx;
  margin-right: 12rpx;
  border-radius: 50%;
  background: #7ba7e8;
}
.note-x {
  font-size: 22rpx;
  line-height: 1.5;
  color: #41597e;
}

.foot {
  margin-top: auto;
  padding: 12rpx 0 36rpx;
  text-align: center;
}
.foot-t {
  font-size: 21rpx;
  letter-spacing: 0.6rpx;
  color: #a9b3c1;
}

/* ---------- 忘记密码 ---------- */
.mask {
  position: fixed;
  inset: 0;
  z-index: 99;
  padding: 0 56rpx;
  background: rgba(16, 25, 42, 0.42);
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal {
  width: 100%;
  padding: 40rpx 36rpx 28rpx;
  border-radius: 36rpx;
  background: #fff;
}
.modal-t {
  display: block;
  margin-bottom: 18rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: #1f2937;
  text-align: center;
}
.modal-p {
  display: block;
  font-size: 24rpx;
  line-height: 1.7;
  color: #5b6675;
}
.modal-btn {
  margin-top: 28rpx;
  height: 84rpx;
  border-radius: 22rpx;
  background: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-btn-t {
  font-size: 28rpx;
  font-weight: 600;
  color: #fff;
}
</style>
