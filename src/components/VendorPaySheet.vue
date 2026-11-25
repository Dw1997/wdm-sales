<template>
  <view v-if="visible" class="vps-wrap">
    <view class="vps-mask" @tap="onClose" @touchmove.stop.prevent />
    <view class="vps-sheet">
      <view class="vps-hd" @touchmove.stop.prevent>
        <text class="vps-title">登记付款</text>
        <text class="vps-close" @tap="onClose">×</text>
      </view>

      <scroll-view scroll-y class="vps-body" :show-scrollbar="false">
        <view class="vps-form">
          <!-- 只读信息 -->
          <view class="vps-info-card">
            <view class="vps-info-main">
              <text class="vps-vendor">{{ vendorName }}</text>
              <view class="vps-balance-line">
                <text class="vps-balance-label">当前应付</text>
                <text class="vps-balance" :class="balanceClass">{{ balanceText }}</text>
              </view>
            </view>
            <view v-if="balanceNum > 0" class="vps-full-btn" @tap="fillFullAmount">全额付清</view>
          </view>

          <!-- 付款金额 -->
          <view class="vps-field">
            <text class="vps-label">付款金额<text class="vps-required">*</text></text>
            <view class="vps-amount-box">
              <text class="vps-currency">¥</text>
              <input
                v-model="amount"
                type="digit"
                class="vps-amount-input"
                placeholder="请输入付款金额"
                placeholder-class="vps-placeholder"
                @blur="amountTouched = true"
              />
              <text class="vps-unit">元</text>
            </view>
            <text v-if="overpayHint" class="vps-hint">{{ overpayHint }}</text>
            <text v-else-if="amountInvalid" class="vps-hint error">
              请输入大于 0 的金额，最多两位小数
            </text>
          </view>

          <!-- 付款方式 -->
          <view class="vps-field">
            <text class="vps-label">付款方式</text>
            <view class="vps-methods">
              <text
                v-for="m in PURCHASE_PAY_METHODS"
                :key="m.value"
                class="vps-method"
                :class="{ on: payMethod === m.value }"
                @tap="payMethod = m.value"
              >{{ m.label }}</text>
            </view>
          </view>

          <!-- 付款时间 -->
          <view class="vps-field">
            <text class="vps-label">付款时间</text>
            <view class="vps-datetime">
              <view class="vps-dt-item">
                <picker mode="date" :value="paidDate" :start="'2020-01-01'" :end="todayStr" @change="onDateChange">
                  <view class="vps-picker">
                    <text>{{ paidDate }}</text>
                    <text class="vps-picker-arrow">▾</text>
                  </view>
                </picker>
              </view>
              <view class="vps-dt-item">
                <picker mode="time" :value="paidTime" @change="onTimeChange">
                  <view class="vps-picker">
                    <text>{{ paidTime }}</text>
                    <text class="vps-picker-arrow">▾</text>
                  </view>
                </picker>
              </view>
            </view>
          </view>

          <!-- 备注 -->
          <view class="vps-field">
            <text class="vps-label">备注<text class="vps-optional">选填</text></text>
            <input
              v-model="remark"
              class="vps-remark"
              placeholder="如：月结 11 月上半月"
              placeholder-class="vps-placeholder"
              maxlength="100"
            />
          </view>

          <!-- 付款凭证 -->
          <view class="vps-field">
            <view class="vps-label-row">
              <text class="vps-label">付款凭证<text class="vps-optional">选填，最多 3 张</text></text>
              <text class="vps-count">{{ proofs.length }}/3</text>
            </view>
            <view class="vps-proof-grid">
              <view v-for="(url, i) in proofs" :key="`${url}-${i}`" class="vps-proof-item">
                <image class="vps-proof-img" :src="url" mode="aspectFill" @tap="previewProof(url)" />
                <view class="vps-proof-del" @tap.stop="removeProof(i)">×</view>
              </view>
              <view v-if="proofs.length < 3" class="vps-proof-add" @tap="addProofs">
                <text class="vps-pa-icon">＋</text>
                <text class="vps-pa-text">{{ uploading ? '上传中...' : '拍照 / 相册' }}</text>
              </view>
            </view>
          </view>
        </view>
      </scroll-view>

      <view class="vps-ft">
        <button class="vps-btn ghost" :disabled="submitting" @tap="onClose">取消</button>
        <button class="vps-btn primary" :disabled="submitting" @tap="onSubmit">
          {{ submitting ? '提交中...' : '确认付款' }}
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { uploadApi, vendorFinanceApi } from '@/api'
import { PURCHASE_PAY_METHODS } from '@/utils/dict'
import { formatMoney, toNum } from '@/utils/format'
import type { Money, VendorPayMethod, VendorPaymentResult } from '@/types'

const props = defineProps<{
  visible: boolean
  vendorId: number
  vendorName: string
  payableBalance: Money
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'paid', result: VendorPaymentResult): void
}>()

const amount = ref('')
const amountTouched = ref(false)
const payMethod = ref<VendorPayMethod>('wechat')
const paidDate = ref('')
const paidTime = ref('')
const remark = ref('')
const proofs = ref<string[]>([])
const uploading = ref(false)
const submitting = ref(false)
const idempotencyKey = ref('')

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function todayYmd() {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function nowHm() {
  const d = new Date()
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

const todayStr = todayYmd()

const balanceNum = computed(() => toNum(props.payableBalance))
const balanceClass = computed(() => {
  if (balanceNum.value > 0) return 'owed'
  if (balanceNum.value < 0) return 'prepaid'
  return 'settled'
})
const balanceText = computed(() => {
  if (balanceNum.value > 0) return formatMoney(balanceNum.value)
  if (balanceNum.value < 0) return `预付 ${formatMoney(-balanceNum.value)}`
  return '已结清'
})

const overpayHint = computed(() => {
  const amt = Number(amount.value)
  if (!Number.isFinite(amt) || amt <= 0) return ''
  if (balanceNum.value <= 0 || amt <= balanceNum.value) return ''
  return `超出当前应付，付款后将记为预付 ${formatMoney(amt - balanceNum.value)}`
})

const amountInvalid = computed(() => {
  if (!amountTouched.value) return false
  const raw = amount.value.trim()
  if (!raw) return false
  return !/^\d+(\.\d{1,2})?$/.test(raw) || Number(raw) <= 0
})

function resetForm() {
  amount.value = ''
  amountTouched.value = false
  payMethod.value = 'wechat'
  paidDate.value = todayYmd()
  paidTime.value = nowHm()
  remark.value = ''
  proofs.value = []
  uploading.value = false
  submitting.value = false
  idempotencyKey.value = `vp_${props.vendorId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

watch(
  () => props.visible,
  (v) => {
    if (v) resetForm()
  },
)

function onClose() {
  if (submitting.value) return
  emit('close')
}

function fillFullAmount() {
  if (balanceNum.value <= 0) return
  amount.value = balanceNum.value.toFixed(2)
  amountTouched.value = true
}

function onDateChange(e: any) {
  paidDate.value = e?.detail?.value || paidDate.value
}

function onTimeChange(e: any) {
  paidTime.value = e?.detail?.value || paidTime.value
}

/* ---------- 凭证 ---------- */

function previewProof(url: string) {
  if (!proofs.value.length) return
  uni.previewImage({ urls: proofs.value, current: url })
}

function removeProof(index: number) {
  proofs.value.splice(index, 1)
}

function addProofs() {
  if (uploading.value || proofs.value.length >= 3) return
  uni.chooseImage({
    count: 3 - proofs.value.length,
    sizeType: ['compressed'],
    success: async (res) => {
      const paths = (res.tempFilePaths || []) as string[]
      if (!paths.length) return
      uploading.value = true
      try {
        for (const path of paths) {
          if (proofs.value.length >= 3) break
          try {
            const { url } = await uploadApi.image(path)
            if (url) proofs.value.push(url)
          } catch {
            /* 单张失败已提示，继续上传其余图片 */
          }
        }
      } finally {
        uploading.value = false
      }
    },
  })
}

/* ---------- 提交 ---------- */

function validateAmount(): number | null {
  const raw = amount.value.trim()
  if (!raw) {
    uni.showToast({ title: '请输入付款金额', icon: 'none' })
    return null
  }
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    uni.showToast({ title: '金额最多保留两位小数', icon: 'none' })
    return null
  }
  const num = Number(raw)
  if (!(num > 0)) {
    uni.showToast({ title: '付款金额需大于 0', icon: 'none' })
    return null
  }
  return num
}

async function onSubmit() {
  if (submitting.value || uploading.value) return
  amountTouched.value = true
  const num = validateAmount()
  if (num === null) return
  if (!paidDate.value || !paidTime.value) {
    uni.showToast({ title: '请选择付款时间', icon: 'none' })
    return
  }

  submitting.value = true
  try {
    const res = await vendorFinanceApi.pay(
      {
        vendor_id: props.vendorId,
        amount: num.toFixed(2),
        method: payMethod.value,
        paid_at: `${paidDate.value}T${paidTime.value}:00+08:00`,
        remark: remark.value.trim() || null,
        proof_images: proofs.value.length ? [...proofs.value] : null,
      },
      { idempotencyKey: idempotencyKey.value },
    )

    const warning = res.warnings?.find((w) => w?.message)?.message
    if (warning) {
      uni.showToast({ title: warning, icon: 'none', duration: 3000 })
    } else {
      uni.showToast({ title: '付款已登记', icon: 'success' })
    }

    emit('paid', res)
    emit('close')
  } catch {
    /* request 层已提示，保留弹窗便于重试 */
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
.vps-wrap {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 2000;
}

.vps-mask {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(16, 25, 42, 0.45);
}

.vps-sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  max-height: 88vh;
  background: #fff;
  border-radius: 28rpx 28rpx 0 0;
  padding-bottom: env(safe-area-inset-bottom);
}

.vps-hd {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 26rpx 30rpx 18rpx;
  border-bottom: 1rpx solid #eef1f5;
}
.vps-title {
  flex: 1;
  font-size: 30rpx;
  font-weight: 600;
  color: #1f2937;
}
.vps-close {
  margin-left: auto;
  font-size: 40rpx;
  line-height: 1;
  color: #9ca3af;
  padding: 4rpx 10rpx;
}

.vps-body {
  height: 58vh;
}
.vps-form {
  padding: 20rpx 26rpx 26rpx;
}

/* 只读信息 */
.vps-info-card {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 22rpx;
  background: #f7f9fc;
  border: 1rpx solid #eef2f7;
  border-radius: 16rpx;
}
.vps-info-main {
  flex: 1;
  min-width: 0;
}
.vps-vendor {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #1f2937;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.vps-balance-line {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
  margin-top: 6rpx;
}
.vps-balance-label {
  font-size: 21rpx;
  color: #8d99aa;
}
.vps-balance {
  font-size: 30rpx;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  &.owed {
    color: #dc2626;
  }
  &.settled {
    color: #9ca3af;
  }
  &.prepaid {
    color: #16a34a;
  }
}
.vps-full-btn {
  flex: none;
  padding: 10rpx 18rpx;
  border-radius: 20rpx;
  background: rgba(37, 99, 235, 0.1);
  color: $uni-color-primary;
  font-size: 22rpx;
  font-weight: 600;
}

/* 字段 */
.vps-field {
  margin-top: 26rpx;
}
.vps-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.vps-label {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: #374151;
  margin-bottom: 12rpx;
}
.vps-required {
  color: #dc2626;
  margin-left: 4rpx;
}
.vps-optional {
  margin-left: 10rpx;
  font-size: 20rpx;
  font-weight: 400;
  color: #a3aebd;
}
.vps-count {
  font-size: 21rpx;
  color: #a3aebd;
  margin-bottom: 12rpx;
}

.vps-amount-box {
  display: flex;
  align-items: center;
  padding: 0 22rpx;
  height: 92rpx;
  background: #f7f9fc;
  border: 1rpx solid #eef2f7;
  border-radius: 14rpx;
}
.vps-currency {
  font-size: 32rpx;
  font-weight: 600;
  color: #1f2937;
  margin-right: 10rpx;
}
.vps-amount-input {
  flex: 1;
  height: 92rpx;
  font-size: 32rpx;
  font-weight: 600;
  color: #1f2937;
}
.vps-unit {
  font-size: 24rpx;
  color: #9ca3af;
}
.vps-placeholder {
  font-size: 26rpx;
  font-weight: 400;
  color: #a3aebd;
}
.vps-hint {
  display: block;
  margin-top: 10rpx;
  font-size: 21rpx;
  line-height: 1.45;
  color: #b45309;
  &.error {
    color: #dc2626;
  }
}

.vps-methods {
  display: flex;
  gap: 12rpx;
}
.vps-method {
  flex: 1;
  text-align: center;
  padding: 14rpx 0;
  border-radius: 12rpx;
  background: #f2f5f9;
  color: #5f6d82;
  font-size: 24rpx;
  &.on {
    background: rgba(37, 99, 235, 0.1);
    color: $uni-color-primary;
    font-weight: 600;
  }
}

.vps-datetime {
  display: flex;
  gap: 14rpx;
}
.vps-dt-item {
  flex: 1;
  min-width: 0;
}
.vps-picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 74rpx;
  padding: 0 18rpx;
  background: #f7f9fc;
  border: 1rpx solid #eef2f7;
  border-radius: 12rpx;
  font-size: 25rpx;
  color: #1f2937;
}
.vps-picker-arrow {
  font-size: 22rpx;
  color: #cbd5e1;
}

.vps-remark {
  height: 78rpx;
  padding: 0 20rpx;
  background: #f7f9fc;
  border: 1rpx solid #eef2f7;
  border-radius: 12rpx;
  font-size: 25rpx;
  color: #1f2937;
}

/* 凭证 */
.vps-proof-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.vps-proof-item {
  position: relative;
  width: 150rpx;
  height: 150rpx;
  border-radius: 14rpx;
  overflow: hidden;
  background: #f2f5f9;
}
.vps-proof-img {
  width: 100%;
  height: 100%;
  display: block;
}
.vps-proof-del {
  position: absolute;
  top: 0;
  right: 0;
  width: 40rpx;
  height: 40rpx;
  line-height: 36rpx;
  text-align: center;
  border-radius: 0 0 0 14rpx;
  background: rgba(16, 25, 42, 0.6);
  color: #fff;
  font-size: 28rpx;
}
.vps-proof-add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  width: 150rpx;
  height: 150rpx;
  border: 1rpx dashed #cfd8e3;
  border-radius: 14rpx;
  background: #f8fafc;
}
.vps-pa-icon {
  font-size: 40rpx;
  line-height: 1;
  color: #9ca3af;
}
.vps-pa-text {
  font-size: 20rpx;
  color: #9ca3af;
}

/* 底部 */
.vps-ft {
  display: flex;
  gap: 16rpx;
  padding: 16rpx 26rpx 20rpx;
  border-top: 1rpx solid #eef1f5;
  background: #fff;
}
.vps-btn {
  flex: 1;
  height: 84rpx;
  line-height: 84rpx;
  border-radius: 14rpx;
  font-size: 28rpx;
  font-weight: 600;
  &::after {
    border: none;
  }
  &.ghost {
    background: #f3f6fa;
    color: #5b6a80;
  }
  &.primary {
    background: $uni-color-primary;
    color: #fff;
  }
  &[disabled] {
    opacity: 0.55;
  }
}
</style>
