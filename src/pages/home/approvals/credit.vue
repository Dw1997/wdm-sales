<template>
  <view class="approve-page">
    <custom-nav-bar title="调额审批" show-back>
      <template #right>
        <text class="nav-count">{{ list.length }} 待批</text>
      </template>
    </custom-nav-bar>

    <scroll-view
      scroll-y
      class="content"
      :style="{ paddingTop: navTotalHeight + 'px' }"
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
    >
      <view class="wrap">
        <view v-for="a in list" :key="a.id" class="card row-card" @tap="openDetail(a)">
          <view class="rc-hd">
            <text class="rc-name">{{ a.customer_name || `客户 #${a.customer_id}` }}</text>
            <text class="rc-time">{{ relativeTime(a.created_at) }}</text>
          </view>
          <view class="rc-nums">
            <text class="k">额度</text>
            <text class="v">{{ formatMoney(a.current_limit) }}</text>
            <text class="k">→ 申请</text>
            <text class="v">{{ formatMoney(a.requested_limit) }}</text>
          </view>
          <text class="rc-own">申请销售：{{ a.sales_name || '—' }}</text>
          <text class="rc-sub">{{ a.reason }}</text>
          <view class="rc-acts" @tap.stop>
            <button class="btn-outline act" @tap="openAction(a, 'reject')">驳回</button>
            <button class="btn-primary act" @tap="openAction(a, 'pass')">通过</button>
          </view>
        </view>

        <empty-state
          v-if="!list.length"
          icon="💳"
          text="没有待审批的调额申请"
          padding="120rpx 32rpx"
        />
      </view>
    </scroll-view>

    <!-- 客户状况 -->
    <view v-if="detailTarget" class="mask" @tap.self="detailTarget = null">
      <view class="sheet">
        <text class="sheet-title">{{ detailTarget.customer_name || `客户 #${detailTarget.customer_id}` }}</text>
        <text class="sheet-sub">
          申请 {{ formatMoney(detailTarget.requested_limit) }} · 现额度
          {{ formatMoney(detailTarget.current_limit) }}
        </text>
        <view class="settle">
          <view class="settle-row">
            <text class="lb">客户账户</text>
            <text class="vl">{{ detailAccount ? '' : '加载中…' }}</text>
          </view>
          <view class="settle-row">
            <text class="lb">当前欠款</text>
            <text class="vl">{{ formatMoney(detailAccount?.ar_balance) }}</text>
          </view>
          <view class="settle-row">
            <text class="lb">逾期金额</text>
            <text class="vl">{{ formatMoney(detailAccount?.overdue_amount) }}</text>
          </view>
          <view class="settle-row">
            <text class="lb">当前生效额度</text>
            <text class="vl">{{ formatMoney(detailAccount?.effective_credit) }}</text>
          </view>
        </view>
        <view class="rc-acts">
          <button class="btn-outline act" @tap="openAction(detailTarget, 'reject')">驳回</button>
          <button class="btn-primary act" @tap="openAction(detailTarget, 'pass')">通过</button>
        </view>
      </view>
    </view>

    <!-- 通过：批准额度可改，意见必填 -->
    <view v-if="actionTarget && actionMode === 'pass'" class="mask" @tap.self="closeAction">
      <view class="sheet">
        <text class="sheet-title">批准额度</text>
        <text class="sheet-sub">
          {{ actionTarget.customer_name }} · 申请 {{ formatMoney(actionTarget.requested_limit) }}
        </text>
        <view class="field">
          <text class="field-label">批准额度（元）</text>
          <input v-model="approvedLimit" class="picker" type="digit" placeholder="输入批准额度" />
          <text v-if="willStillOver()" class="hint warn-text">
            批准后该客户仍超额度，下次录单需要再次审批。
          </text>
        </view>
        <view class="field">
          <text class="field-label">审批意见（必填）</text>
          <textarea
            v-model="comment"
            class="textarea"
            placeholder="例如：老客户，同意提到 8000"
            maxlength="500"
          />
        </view>
        <button class="btn-primary sheet-btn" :disabled="submitting" @tap="doPass">
          按 {{ formatMoney(approvedLimit) }} 通过
        </button>
      </view>
    </view>

    <!-- 驳回 -->
    <view v-if="actionTarget && actionMode === 'reject'" class="mask" @tap.self="closeAction">
      <view class="sheet">
        <text class="sheet-title">驳回调额申请</text>
        <text class="sheet-sub">
          {{ actionTarget.customer_name }} · 申请 {{ formatMoney(actionTarget.requested_limit) }}
        </text>
        <view class="field">
          <text class="field-label">审批意见（必填）</text>
          <textarea
            v-model="comment"
            class="textarea"
            placeholder="例如：先把欠款收到 3000 以内再谈提额"
            maxlength="500"
          />
        </view>
        <button class="btn-primary sheet-btn" :disabled="submitting" @tap="doReject">确认驳回</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import CustomNavBar from '@/components/CustomNavBar.vue'
import EmptyState from '@/components/EmptyState.vue'
import { creditApi, customerApi } from '@/api'
import { formatMoney, relativeTime } from '@/utils/format'
import type { CreditApplication, CustomerAccount } from '@/types'

const navTotalHeight = ref(64)
try {
  const info = uni.getSystemInfoSync()
  navTotalHeight.value = (info.statusBarHeight || 20) + 44
} catch {
  /* 默认值 */
}

const list = ref<CreditApplication[]>([])
const refreshing = ref(false)
const submitting = ref(false)

const detailTarget = ref<CreditApplication | null>(null)
const detailAccount = ref<CustomerAccount | null>(null)

const actionTarget = ref<CreditApplication | null>(null)
const actionMode = ref<'pass' | 'reject'>('pass')
const approvedLimit = ref('')
const comment = ref('')

async function load() {
  try {
    list.value = await creditApi.list('pending')
  } catch {
    /* request 已提示 */
  }
}

async function onRefresh() {
  refreshing.value = true
  await load()
  refreshing.value = false
}

async function openDetail(a: CreditApplication) {
  detailTarget.value = a
  detailAccount.value = null
  try {
    detailAccount.value = await customerApi.account(a.customer_id)
  } catch {
    /* request 已提示 */
  }
}

function openAction(a: CreditApplication, mode: 'pass' | 'reject') {
  actionTarget.value = a
  actionMode.value = mode
  comment.value = ''
  approvedLimit.value = mode === 'pass' ? String(Number(a.requested_limit)) : ''
}

function closeAction() {
  actionTarget.value = null
  comment.value = ''
}

/** 批准额度低于当前欠款时提示"仍超额度"（只提示不阻止）。 */
function willStillOver(): boolean {
  const limit = Number(approvedLimit.value)
  const owed = Number(detailAccount.value?.ar_balance || 0)
  return limit > 0 && owed > 0 && limit < owed
}

async function afterDone() {
  detailTarget.value = null
  closeAction()
  await load()
}

async function doPass() {
  const a = actionTarget.value
  if (!a || submitting.value) return
  const limit = Number(approvedLimit.value)
  if (!(limit > 0)) {
    uni.showToast({ title: '批准额度必须大于 0', icon: 'none' })
    return
  }
  const text = comment.value.trim()
  if (!text) {
    uni.showToast({ title: '请填写审批意见', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    const same = limit === Number(a.requested_limit)
    await creditApi.approve(a.id, same ? undefined : limit, text)
    uni.showToast({ title: '已通过', icon: 'success' })
    await afterDone()
  } catch {
    /* request 已提示 */
  } finally {
    submitting.value = false
  }
}

async function doReject() {
  const a = actionTarget.value
  if (!a || submitting.value) return
  const text = comment.value.trim()
  if (!text) {
    uni.showToast({ title: '请填写审批意见', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    await creditApi.reject(a.id, text)
    uni.showToast({ title: '已驳回', icon: 'success' })
    await afterDone()
  } catch {
    /* request 已提示 */
  } finally {
    submitting.value = false
  }
}

onShow(load)
</script>

<style lang="scss" scoped>
@import '@/styles/approval.scss';
</style>
