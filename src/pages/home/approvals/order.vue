<template>
  <view class="approve-page">
    <custom-nav-bar title="订单审批" show-back>
      <template #right>
        <text class="nav-count">{{ total }} 待批</text>
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
        <view v-for="row in list" :key="row.order.id" class="card row-card" @tap="openDetail(row)">
          <view class="rc-hd">
            <text class="rc-name">{{ row.order.customer_name }}</text>
            <text class="rc-amount">{{ formatMoney(row.order.total_amount) }}</text>
          </view>
          <view class="rc-meta">
            <text>{{ row.order.order_no }}</text>
            <text>· 录单 {{ row.order.created_by_name || row.order.sales_name || '—' }}</text>
          </view>
          <view class="rc-nums">
            <text class="k">
              已等
              <text class="v" :class="{ 'warn-text': row.waiting_hours >= 24 }">
                {{ waitLabel(row.waiting_hours) }}
              </text>
            </text>
            <text class="k">未付 <text class="v">{{ formatMoney(row.order.unpaid_amount) }}</text></text>
            <text v-if="row.order.over_credit" class="danger"><text class="k">原因 </text><text class="v">超额度</text></text>
            <text v-if="orderHasBelowMin(row.order)" class="danger"><text class="k">原因 </text><text class="v">低于最低价</text></text>
          </view>
          <view class="rc-acts" @tap.stop>
            <button class="btn-outline act" @tap="openAction(row.order, 'reject')">驳回</button>
            <button class="btn-primary act" @tap="openAction(row.order, 'pass')">通过</button>
          </view>
        </view>

        <empty-state
          v-if="!list.length"
          icon="📝"
          text="没有待审批的订单"
          padding="120rpx 32rpx"
        />
      </view>
    </scroll-view>

    <!-- 明细 + 审批记录：账户数字由列表接口直接给，不再逐个客户另发请求 -->
    <view v-if="detailRow" class="mask" @tap.self="closeDetail">
      <view class="sheet">
        <text class="sheet-title">{{ detailRow.order.customer_name }}</text>
        <text class="sheet-sub">
          {{ detailRow.order.order_no }} · {{ relativeTime(detailRow.submitted_at) }} 提交
        </text>

        <view class="items">
          <view class="item-row">
            <text class="nm">商品</text>
            <text class="qt">数量</text>
            <text class="am">金额</text>
          </view>
          <view v-for="it in detailRow.order.items" :key="it.id" class="item-row">
            <view class="nm">
              <text>{{ it.spu_name }} {{ it.sku_spec }}</text>
              <text v-if="itemIsBelowMin(it)" class="below-min-note">
                单价 {{ formatMoney(it.unit_price) }} &lt; 最低 {{ formatMoney(it.min_price) }}
              </text>
            </view>
            <text class="qt">{{ formatQty(it.quantity) }}{{ it.unit }}</text>
            <text class="am">{{ formatMoney(it.amount) }}</text>
          </view>
        </view>

        <view class="settle">
          <view class="settle-row">
            <text class="lb">当前欠款（实时）</text>
            <text class="vl">{{ formatMoney(detailRow.ar_balance) }}</text>
          </view>
          <view class="settle-row">
            <text class="lb">逾期金额（实时）</text>
            <text class="vl">{{ formatMoney(detailRow.overdue_amount) }}</text>
          </view>
          <view class="settle-row">
            <text class="lb">生效额度（提交时）</text>
            <text class="vl">{{ creditLabel(detailRow.effective_credit) }}</text>
          </view>
          <view class="settle-row">
            <text class="lb">占用额度（提交时）</text>
            <text class="vl">{{ creditLabel(detailRow.occupied_credit) }}</text>
          </view>
          <view class="settle-row">
            <text class="lb">本单金额</text>
            <text class="vl">{{ formatMoney(detailRow.order.total_amount) }}</text>
          </view>
        </view>

        <view v-if="detailApprovals.length" class="timeline">
          <view
            v-for="a in detailApprovals"
            :key="a.id"
            class="tl-node"
            :class="{ done: a.action === 'approve' || a.action === 'auto_pass' }"
          >
            <text class="tl-title">{{ stageLabel(a.stage) }} · {{ actionLabel(a.action) }}</text>
            <text class="tl-sub">
              {{ a.operator_name || '系统' }} · {{ relativeTime(a.created_at) }}
            </text>
          </view>
        </view>

        <view class="rc-acts">
          <button class="btn-outline act" @tap="openAction(detailRow.order, 'reject')">驳回</button>
          <button class="btn-primary act" @tap="openAction(detailRow.order, 'pass')">通过</button>
        </view>
      </view>
    </view>

    <!-- 通过 -->
    <view v-if="actionTarget && actionMode === 'pass'" class="mask" @tap.self="closeAction">
      <view class="sheet">
        <text class="sheet-title">通过这张订单？</text>
        <text class="sheet-sub">
          {{ actionTarget.customer_name }} · {{ formatMoney(actionTarget.total_amount) }}
        </text>
        <view class="field">
          <text class="field-label">审批意见（可选）</text>
          <textarea
            v-model="comment"
            class="textarea"
            placeholder="例如：老客户，这次先放行，下次先收款"
            maxlength="200"
          />
          <text class="hint">通过后订单转「待配送」，待排车期限从这一刻开始算。</text>
        </view>
        <button class="btn-primary sheet-btn" :disabled="submitting" @tap="doPass">确认通过</button>
      </view>
    </view>

    <!-- 驳回 -->
    <view v-if="actionTarget && actionMode === 'reject'" class="mask" @tap.self="closeAction">
      <view class="sheet">
        <text class="sheet-title">驳回订单</text>
        <text class="sheet-sub">驳回后订单变「已驳回」，会通知客户和录单销售。</text>
        <view class="field">
          <text class="field-label">驳回原因（必填）</text>
          <textarea
            v-model="comment"
            class="textarea"
            placeholder="例如：客户已超额度太多，先收款再发货"
            maxlength="200"
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
import { orderApi, orderApprovalApi } from '@/api'
import { formatMoney, formatQty, relativeTime, toNum } from '@/utils/format'
import type { Order, OrderApproval, OrderApprovalItem, OrderItem, Money } from '@/types'

const navTotalHeight = ref(64)
try {
  const info = uni.getSystemInfoSync()
  navTotalHeight.value = (info.statusBarHeight || 20) + 44
} catch {
  /* 默认值 */
}

const list = ref<OrderApprovalItem[]>([])
const total = ref(0)
const refreshing = ref(false)
const submitting = ref(false)

const detailRow = ref<OrderApprovalItem | null>(null)
const detailApprovals = ref<OrderApproval[]>([])

const actionTarget = ref<Order | null>(null)
const actionMode = ref<'pass' | 'reject'>('pass')
const comment = ref('')

/** 已等待小时数由后端算（按最新 submit 记录），前端只做展示。 */
function itemIsBelowMin(it: OrderItem): boolean {
  if (it.min_price === null || it.min_price === undefined) return false
  return toNum(it.unit_price) < toNum(it.min_price)
}

function orderHasBelowMin(o: Order): boolean {
  return (o.items || []).some((it) => itemIsBelowMin(it))
}

function waitLabel(hours: number): string {
  const h = Math.max(0, Math.floor(hours || 0))
  if (h >= 24) return `${Math.floor(h / 24)} 天 ${h % 24} 小时`
  return `${h} 小时`
}

function creditLabel(value: Money | null): string {
  return value === null || value === undefined ? '不限额' : formatMoney(value)
}

function stageLabel(stage: string): string {
  return stage === 'admin' ? '管理员' : '销售'
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    submit: '提交',
    approve: '同意',
    reject: '驳回',
    auto_pass: '自动通过',
    customer_cancel: '客户取消',
  }
  return map[action] || action
}

async function load() {
  try {
    // D29：GET /order-approvals 一次给齐订单、额度、欠款与等待时长
    const page = await orderApprovalApi.list({ page: 1, page_size: 50 })
    list.value = page.items
    total.value = page.total
  } catch {
    /* request 已提示 */
  }
}

async function onRefresh() {
  refreshing.value = true
  await load()
  refreshing.value = false
}

async function openDetail(row: OrderApprovalItem) {
  detailRow.value = row
  detailApprovals.value = []
  try {
    // 列表接口的 order 已是完整 OrderOut（含明细），只需补审批记录时间线
    detailApprovals.value = await orderApi.approvals(row.order.id)
  } catch {
    /* request 已提示，时间线为空不影响审批 */
  }
}

function closeDetail() {
  detailRow.value = null
  detailApprovals.value = []
}

function openAction(o: Order, mode: 'pass' | 'reject') {
  actionTarget.value = o
  actionMode.value = mode
  comment.value = ''
}

function closeAction() {
  actionTarget.value = null
  comment.value = ''
}

async function afterDone() {
  closeDetail()
  closeAction()
  await load()
}

async function doPass() {
  const o = actionTarget.value
  if (!o || submitting.value) return
  submitting.value = true
  try {
    const res = await orderApi.approve(o.id, comment.value.trim() || undefined)
    if (res.warnings?.length) {
      uni.showToast({ title: res.warnings[0].message, icon: 'none' })
    } else {
      uni.showToast({ title: '已通过', icon: 'success' })
    }
    await afterDone()
  } catch {
    /* request 已提示 */
  } finally {
    submitting.value = false
  }
}

async function doReject() {
  const o = actionTarget.value
  if (!o || submitting.value) return
  const reason = comment.value.trim()
  if (!reason) {
    uni.showToast({ title: '请填写驳回原因', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    await orderApi.reject(o.id, reason)
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
.below-min-note {
  display: block;
  font-size: 20rpx;
  color: #dc2626;
  margin-top: 4rpx;
}
</style>
