<template>
  <view class="credit-apply-page">
    <scroll-view scroll-y="true" class="content">
      <view v-if="customer" class="info-card">
        <view class="card-title">客户当前额度</view>
        <view class="credit-row">
          <view class="credit-item">
            <text class="credit-label">授信额度</text>
            <text class="credit-value">¥{{ formatQty(customer.credit_limit) }}</text>
          </view>
          <view class="credit-item">
            <text class="credit-label">已用欠款</text>
            <text class="credit-value text-danger">¥{{ formatQty(customer.used_credit) }}</text>
          </view>
          <view class="credit-item">
            <text class="credit-label">可用额度</text>
            <text class="credit-value text-success">¥{{ formatQty(customer.available_credit) }}</text>
          </view>
        </view>
      </view>

      <view class="form-card">
        <view class="card-title">临时提额申请</view>
        <view class="form-item">
          <text class="form-label">申请额度（元）</text>
          <input class="form-input" v-model="amountStr" type="digit" placeholder="请输入金额" @input="onAmountInput" />
          <view class="quick-amounts">
            <text v-for="amt in [1000, 3000, 5000, 10000]" :key="amt" class="quick-amt" @tap="amountStr = String(amt)">+¥{{ amt }}</text>
          </view>
        </view>
        <view class="form-item">
          <text class="form-label">申请原因</text>
          <textarea class="form-textarea" v-model="reason" placeholder="如：客户本月备货旺季、新店开业等" maxlength="200" />
        </view>
        <view class="form-item">
          <text class="form-label">有效期</text>
          <picker mode="date" :value="expireDate" @change="onDateChange">
            <view class="picker-value">{{ expireDate || '请选择有效期' }}</view>
          </picker>
        </view>
        <view class="form-tip">
          <text>💡 提交后将进入管理员审批流程，审批结果通过消息通知。</text>
        </view>
        <button class="btn-primary" :loading="submitting" @tap="onSubmit">提交申请</button>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { customerApi } from '@/api'
import { formatQty } from '@/utils/format'
import type { Customer } from '@/types'
import dayjs from 'dayjs'

const customerId = ref(0)
const customer = ref<Customer | null>(null)
const amountStr = ref('')
const reason = ref('')
const expireDate = ref('')
const submitting = ref(false)

async function load() {
  if (!customerId.value) return
  customer.value = await customerApi.get(customerId.value)
}

function onAmountInput(e: any) {
  amountStr.value = e.detail.value
}

function onDateChange(e: any) {
  expireDate.value = e.detail.value
}

async function onSubmit() {
  const amount = Number(amountStr.value)
  if (!amount || amount <= 0) {
    uni.showToast({ title: '请输入有效金额', icon: 'none' })
    return
  }
  if (!reason.value.trim()) {
    uni.showToast({ title: '请填写申请原因', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    await customerApi.applyCredit(customerId.value, amount, reason.value)
    uni.showToast({ title: '申请已提交', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 800)
  } finally {
    submitting.value = false
  }
}

onLoad((opts: any) => {
  customerId.value = Number(opts?.id || 0)
  expireDate.value = dayjs().add(30, 'day').format('YYYY-MM-DD')
  load()
})
</script>

<style lang="scss" scoped>
.credit-apply-page {
  min-height: 100vh;
  background: #f5f5f7;
}
.content {
  height: 100vh;
}
.info-card, .form-card {
  background: #fff;
  margin: 16rpx;
  border-radius: 16rpx;
  padding: 24rpx;
}
.card-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 16rpx;
}
.credit-row {
  display: flex;
  justify-content: space-around;
}
.credit-item {
  text-align: center;
}
.credit-label {
  display: block;
  font-size: 22rpx;
  color: #9ca3af;
  margin-bottom: 4rpx;
}
.credit-value {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.form-item {
  margin-bottom: 24rpx;
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
  font-size: 36rpx;
  font-weight: 600;
  color: #1f2937;
  box-sizing: border-box;
}
.quick-amounts {
  display: flex;
  gap: 12rpx;
  margin-top: 12rpx;
}
.quick-amt {
  padding: 8rpx 20rpx;
  background: rgba(37, 99, 235, 0.08);
  color: $uni-color-primary;
  border-radius: 20rpx;
  font-size: 24rpx;
}
.form-textarea {
  width: 100%;
  height: 160rpx;
  border: 2rpx solid #e5e7eb;
  border-radius: 12rpx;
  padding: 16rpx 24rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}
.picker-value {
  height: 88rpx;
  line-height: 88rpx;
  border: 2rpx solid #e5e7eb;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: #1f2937;
}
.form-tip {
  background: rgba(234, 88, 12, 0.08);
  color: #ea580c;
  padding: 16rpx 20rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
  margin: 16rpx 0;
}
</style>
