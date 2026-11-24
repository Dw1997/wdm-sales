<template>
  <view class="approve-page">
    <custom-nav-bar title="退货确认" show-back>
      <template #right>
        <text class="nav-count">{{ list.length }} 待确认</text>
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
        <view v-for="r in list" :key="r.id" class="card row-card" @tap="openDetail(r)">
          <view class="rc-hd">
            <text class="rc-name">{{ r.customer_name }}</text>
            <text class="rc-amount warn-text">-{{ formatMoney(r.total_credit_amount) }}</text>
          </view>
          <view class="rc-meta">
            <text>{{ r.return_no }}</text>
            <text>· 原订单 {{ r.order_no }}</text>
          </view>
          <text class="rc-sub">{{ r.reason }}</text>
          <text class="rc-own">
            {{ r.created_by_name || '—' }} 提交于 {{ relativeTime(r.created_at) }}
          </text>
          <view class="rc-acts" @tap.stop>
            <button class="btn-outline act" @tap="openReject(r)">驳回</button>
            <button class="btn-primary act" @tap="openDetail(r)">确认退货</button>
          </view>
        </view>

        <empty-state
          v-if="!list.length"
          icon="↩️"
          text="没有待确认的退货单"
          padding="120rpx 32rpx"
        />
      </view>
    </scroll-view>

    <!-- 明细 + 结算预览 -->
    <view v-if="detailTarget" class="mask" @tap.self="detailTarget = null">
      <view class="sheet">
        <text class="sheet-title">{{ detailTarget.customer_name }}</text>
        <text class="sheet-sub">{{ detailTarget.return_no }} · 原订单 {{ detailTarget.order_no }}</text>

        <view class="items">
          <view class="item-row">
            <text class="nm">商品</text>
            <text class="qt">数量</text>
            <text class="am">金额</text>
          </view>
          <view v-for="(it, i) in detailTarget.items" :key="i" class="item-row">
            <text class="nm">{{ it.spu_name }} {{ it.sku_spec }}</text>
            <text class="qt">{{ formatQty(it.quantity) }}{{ it.unit }}</text>
            <text class="am">{{ formatMoney(it.amount) }}</text>
          </view>
        </view>

        <view class="settle">
          <view class="settle-row">
            <text class="lb">结算预览</text>
            <text class="vl" />
          </view>
          <view class="settle-row">
            <text class="lb">退货金额</text>
            <text class="vl">{{ formatMoney(detailTarget.total_credit_amount) }}</text>
          </view>
          <view class="settle-row">
            <text class="lb">冲原订单未付</text>
            <text class="vl">{{ formatMoney(detailTarget.original_offset_amount) }}</text>
          </view>
          <view class="settle-row">
            <text class="lb">{{ refundLabel(detailTarget.refund_method) }}</text>
            <text class="vl">{{ formatMoney(detailTarget.refund_amount) }}</text>
          </view>
          <view class="settle-row">
            <text class="lb">退回库存</text>
            <text class="vl">{{ restockCount(detailTarget) }} 项</text>
          </view>
        </view>

        <text v-if="detailTarget.refund_method === 'credit'" class="hint">
          挂账待抵的余额需在 Web 平账台指定订单抵扣，移动端不平单。
        </text>

        <view class="rc-acts">
          <button class="btn-outline act" @tap="openReject(detailTarget)">驳回</button>
          <button class="btn-primary act" :disabled="submitting" @tap="doConfirm">
            确认退货
          </button>
        </view>
      </view>
    </view>

    <!-- 驳回 -->
    <view v-if="rejectTarget" class="mask" @tap.self="rejectTarget = null">
      <view class="sheet">
        <text class="sheet-title">驳回退货单</text>
        <text class="sheet-sub">{{ rejectTarget.customer_name }} · {{ rejectTarget.return_no }}</text>
        <view class="field">
          <text class="field-label">驳回原因（必填）</text>
          <textarea
            v-model="rejectReason"
            class="textarea"
            placeholder="例如：客户实际未退回，先核实"
            maxlength="500"
          />
        </view>
        <button class="btn-primary sheet-btn" :disabled="submitting" @tap="doReject">
          确认驳回
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import CustomNavBar from '@/components/CustomNavBar.vue'
import EmptyState from '@/components/EmptyState.vue'
import { returnApi } from '@/api'
import { formatMoney, formatQty, relativeTime } from '@/utils/format'
import type { ReturnOrderDetail } from '@/types'

const navTotalHeight = ref(64)
try {
  const info = uni.getSystemInfoSync()
  navTotalHeight.value = (info.statusBarHeight || 20) + 44
} catch {
  /* 默认值 */
}

const list = ref<ReturnOrderDetail[]>([])
const refreshing = ref(false)
const submitting = ref(false)

const detailTarget = ref<ReturnOrderDetail | null>(null)
const rejectTarget = ref<ReturnOrderDetail | null>(null)
const rejectReason = ref('')

function refundLabel(method: string): string {
  const map: Record<string, string> = {
    credit: '挂账待抵',
    wechat: '实际退款（微信）',
    alipay: '实际退款（支付宝）',
    cash: '实际退款（现金）',
  }
  return map[method] || method
}

function restockCount(r: ReturnOrderDetail): number {
  return r.items.filter((it) => it.disposition === 'restock').length
}

async function load() {
  try {
    const page = await returnApi.list({ status: 'pending', page: 1, page_size: 50 })
    list.value = page.items
  } catch {
    /* request 已提示 */
  }
}

async function onRefresh() {
  refreshing.value = true
  await load()
  refreshing.value = false
}

async function openDetail(r: ReturnOrderDetail) {
  // 列表项已含明细与结算（ReturnOrderOut），直接展示；详情接口用于拿最新状态
  detailTarget.value = r
  try {
    detailTarget.value = await returnApi.get(r.id)
  } catch {
    /* 保留列表里的数据 */
  }
}

async function doConfirm() {
  const r = detailTarget.value
  if (!r || submitting.value) return
  const res = await new Promise<boolean>((resolve) => {
    uni.showModal({
      title: '确认这张退货单？',
      content: '确认后加库存、冲应收并重算订单利润，不能再修改。',
      confirmText: '确认',
      cancelText: '再想想',
      success: (m) => resolve(m.confirm),
      fail: () => resolve(false),
    })
  })
  if (!res) return
  submitting.value = true
  try {
    const result = await returnApi.confirm(r.id)
    if (result.warnings?.length) {
      uni.showToast({ title: result.warnings[0].message, icon: 'none' })
    } else {
      uni.showToast({ title: '已确认，库存已回写', icon: 'none' })
    }
    detailTarget.value = null
    await load()
  } catch {
    /* request 已提示 */
  } finally {
    submitting.value = false
  }
}

function openReject(r: ReturnOrderDetail) {
  rejectTarget.value = r
  rejectReason.value = ''
}

async function doReject() {
  const r = rejectTarget.value
  if (!r || submitting.value) return
  const reason = rejectReason.value.trim()
  if (!reason) {
    uni.showToast({ title: '请填写驳回原因', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    await returnApi.reject(r.id, reason)
    uni.showToast({ title: '已驳回', icon: 'success' })
    rejectTarget.value = null
    detailTarget.value = null
    await load()
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
