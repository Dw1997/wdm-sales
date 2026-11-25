<template>
  <view class="receipt-detail-page" :class="{ 'with-bar': isDraft }">
    <view v-if="loading && !receipt" class="page-loading">加载中...</view>

    <block v-else-if="receipt">
      <view class="card">
        <view class="ov-head">
          <view class="ov-tags">
            <text class="tag" :class="`tag-${sourceMeta.type}`">{{ sourceMeta.label }}</text>
            <text class="tag" :class="`tag-${statusMeta.type}`">{{ statusMeta.label }}</text>
          </view>
          <view class="ov-amt-box">
            <text class="ov-amt-label">总金额</text>
            <text class="ov-amt">{{ amountText }}</text>
          </view>
        </view>

        <view class="kv">
          <text class="k">供应商</text>
          <text class="v">{{ receipt.vendor_name || '—' }}</text>
        </view>
        <view v-if="toNum(receipt.paid_amount) > 0" class="kv">
          <text class="k">当场已付</text>
          <text class="v v-paid">{{ formatMoney(receipt.paid_amount) }}</text>
        </view>
        <view v-if="receipt.order_no" class="kv">
          <text class="k">关联订单</text>
          <text class="v">{{ receipt.order_no }}</text>
        </view>
        <view class="kv">
          <text class="k">进货时间</text>
          <text class="v">{{ receipt.purchased_at ? formatDate(receipt.purchased_at) : '—' }}</text>
        </view>
        <view class="kv">
          <text class="k">确认时间</text>
          <text class="v">{{ receipt.confirmed_at ? formatDate(receipt.confirmed_at) : '—' }}</text>
        </view>
        <view class="kv">
          <text class="k">建单时间</text>
          <text class="v">{{ formatDate(receipt.created_at) }}</text>
        </view>
        <view v-if="receipt.remark" class="kv">
          <text class="k">备注</text>
          <text class="v">{{ receipt.remark }}</text>
        </view>
      </view>

      <view class="card">
        <view class="card-hd">
          <text class="card-title">商品明细</text>
          <text class="card-extra">{{ receipt.items.length }} 项</text>
        </view>
        <view v-for="it in receipt.items" :key="it.id" class="item">
          <view class="item-head">
            <text class="item-name">{{ itemLabel(it) }}</text>
            <text v-if="it.update_cost" class="tag tag-primary item-tag">同步更新成本</text>
          </view>
          <view class="item-sub">
            <text class="item-qty">{{ it.quantity }} {{ it.base_unit }} × {{ formatMoney(it.unit_cost) }}</text>
            <text class="item-amt">{{ formatMoney(it.amount) }}</text>
          </view>
        </view>
      </view>

      <view v-if="receipt.photos && receipt.photos.length" class="card">
        <view class="card-hd">
          <text class="card-title">进货单照片</text>
          <text class="card-extra">{{ receipt.photos.length }} 张</text>
        </view>
        <view class="photo-grid">
          <image
            v-for="(url, i) in receipt.photos || []"
            :key="i"
            class="photo"
            :src="url"
            mode="aspectFill"
            @tap="previewPhoto(url)"
          />
        </view>
      </view>

      <view v-if="receipt.corrections && receipt.corrections.length" class="card">
        <view class="card-hd">
          <text class="card-title">更正记录</text>
          <text class="card-extra">{{ receipt.corrections.length }} 条</text>
        </view>
        <view v-for="(c, i) in receipt.corrections || []" :key="c.id || i" class="corr">
          <text class="corr-reason">{{ c.reason || c.action || '更正' }}</text>
          <text class="corr-meta">
            {{ formatDate(c.created_at) }}<template v-if="c.operator_name"> · {{ c.operator_name }}</template>
          </text>
        </view>
      </view>
    </block>

    <view v-if="isDraft" class="bottom-bar">
      <button class="btn ghost" @tap="onCancelDraft">取消草稿</button>
      <button
        v-if="receipt && receipt.source_type === 'stock'"
        class="btn outline"
        @tap="goEdit"
      >编辑</button>
      <button class="btn primary" @tap="openConfirm">确认入库</button>
    </view>

    <view v-if="confirmVisible && receipt" class="mask" @tap.self="closeConfirm">
      <view class="dialog" @tap.stop>
        <text class="dialog-title">确认入库</text>

        <view class="dialog-amount">
          <text class="dl">入库金额</text>
          <text class="dv">{{ amountText }}</text>
        </view>

        <block v-if="receipt.vendor_id > 0">
          <view class="check-row" @tap="payNow = !payNow">
            <text class="check-box" :class="{ on: payNow }">{{ payNow ? '✓' : '' }}</text>
            <text class="check-label">当场已付款</text>
          </view>

          <view v-if="payNow" class="pay-box">
            <view class="pay-methods">
              <text
                v-for="m in PURCHASE_PAY_METHODS"
                :key="m.value"
                class="pay-pill"
                :class="{ on: payMethod === m.value }"
                @tap="payMethod = m.value"
              >{{ m.label }}</text>
            </view>
            <view class="pay-input-row">
              <text class="pay-prefix">实付</text>
              <input v-model="payAmount" type="digit" class="pay-input" placeholder="请输入实付金额" />
              <text class="pay-unit">元</text>
            </view>
          </view>
        </block>

        <view v-else class="vendor-zero-tip">自己进货不记供应商应付，确认后将直接计入库存</view>

        <view class="dialog-actions">
          <button class="d-btn cancel" @tap="closeConfirm">取消</button>
          <button class="d-btn ok" :disabled="submitting" @tap="onConfirm">
            {{ submitting ? '提交中...' : '确认入库' }}
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { purchaseApi } from '@/api'
import { PURCHASE_PAY_METHODS, PURCHASE_SOURCE_TYPE, PURCHASE_STATUS } from '@/utils/dict'
import { formatDate, formatMoney, toNum } from '@/utils/format'
import type { PurchasePayMethod, PurchaseReceipt, PurchaseReceiptItem } from '@/types'

const receipt = ref<PurchaseReceipt | null>(null)
const receiptId = ref(0)
const loading = ref(false)
const confirmVisible = ref(false)
const submitting = ref(false)
const payNow = ref(false)
const payMethod = ref<PurchasePayMethod>('wechat')
const payAmount = ref('')

const isDraft = computed(() => receipt.value?.status === 'draft')
const sourceMeta = computed(() => {
  const t = receipt.value?.source_type
  return (t && PURCHASE_SOURCE_TYPE[t]) || { label: t || '—', type: 'grey' }
})
const statusMeta = computed(() => {
  const s = receipt.value?.status
  return (s && PURCHASE_STATUS[s]) || { label: s || '—', type: 'grey' }
})
const amountText = computed(() => {
  if (!receipt.value) return ''
  const sign = receipt.value.source_type === 'return' ? '-' : ''
  return `${sign}${formatMoney(receipt.value.total_amount)}`
})

function itemLabel(it: PurchaseReceiptItem) {
  return it.sku_name || `${it.spu_name}（${it.base_unit}）`
}

async function load(id: number) {
  loading.value = true
  try {
    receipt.value = await purchaseApi.get(id)
  } catch {
    /* request 层已提示 */
  } finally {
    loading.value = false
  }
}

function goEdit() {
  if (!receipt.value) return
  uni.navigateTo({ url: `/pages/purchase/receipt-form?id=${receipt.value.id}` })
}

async function onCancelDraft() {
  if (!receipt.value) return
  const id = receipt.value.id
  const res = await uni.showModal({
    title: '取消草稿',
    content: '取消后不可恢复，确认取消这张草稿？',
    confirmText: '确认取消',
    confirmColor: '#dc2626',
  })
  if (!res.confirm) return
  try {
    await purchaseApi.cancel(id, receipt.value.version)
    uni.showToast({ title: '已取消', icon: 'none' })
    await load(id)
  } catch {
    /* request 层已提示 */
  }
}

function openConfirm() {
  if (!receipt.value) return
  payNow.value = false
  payMethod.value = 'wechat'
  payAmount.value = String(receipt.value.total_amount)
  confirmVisible.value = true
}

function closeConfirm() {
  if (submitting.value) return
  confirmVisible.value = false
}

async function onConfirm() {
  if (!receipt.value || submitting.value) return
  const id = receipt.value.id
  const total = toNum(receipt.value.total_amount)
  let payment: { method: PurchasePayMethod; amount: string } | null = null

  if (receipt.value.vendor_id > 0 && payNow.value) {
    const amt = Number(payAmount.value)
    if (!amt || amt <= 0) {
      uni.showToast({ title: '实付金额需大于 0', icon: 'none' })
      return
    }
    if (amt > total) {
      uni.showToast({ title: '实付金额不能超过入库金额', icon: 'none' })
      return
    }
    payment = { method: payMethod.value, amount: payAmount.value }
  }

  submitting.value = true
  try {
    const res = await purchaseApi.confirm(id, { version: receipt.value.version, payment })
    confirmVisible.value = false
    await load(id)
    uni.showToast({ title: '入库成功', icon: 'success' })
    if (res.warnings?.length) {
      uni.showModal({
        title: '入库成功，请注意',
        content: res.warnings.map((w) => w.message || w.code).join('\n'),
        showCancel: false,
      })
    }
  } catch {
    /* request 层已提示 */
  } finally {
    submitting.value = false
  }
}

function previewPhoto(url: string) {
  const photos = receipt.value?.photos
  if (!photos || !photos.length) return
  uni.previewImage({ urls: photos, current: url })
}

let skipShow = false

onLoad((opts: any) => {
  if (!opts?.id) return
  receiptId.value = Number(opts.id)
  skipShow = true
  load(receiptId.value)
})

onShow(() => {
  if (skipShow) {
    skipShow = false
    return
  }
  if (receiptId.value) load(receiptId.value)
})
</script>

<style lang="scss" scoped>
.receipt-detail-page {
  min-height: 100vh;
  background: #f5f7fa;
  padding-bottom: 32rpx;
}
.receipt-detail-page.with-bar {
  padding-bottom: calc(150rpx + env(safe-area-inset-bottom));
}
.page-loading {
  text-align: center;
  padding: 120rpx 0;
  font-size: 24rpx;
  color: #a3aebd;
}

/* 概览 */
.ov-head {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #f4f7fa;
}
.ov-tags {
  display: flex;
  align-items: center;
  gap: 10rpx;
}
.ov-head .tag {
  font-size: 19rpx;
  font-weight: 600;
  padding: 3rpx 12rpx;
  border-radius: 6rpx;
}
.tag-info {
  background: rgba(14, 116, 144, 0.1);
  color: #0e7490;
}
.ov-amt-box {
  margin-left: auto;
  text-align: right;
}
.ov-amt-label {
  display: block;
  font-size: 19rpx;
  color: #a3aebd;
}
.ov-amt {
  display: block;
  margin-top: 2rpx;
  font-size: 38rpx;
  font-weight: 700;
  color: #1f2937;
  font-variant-numeric: tabular-nums;
}
.kv {
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
  padding: 14rpx 0;
  border-top: 1rpx solid #f6f8fb;
}
.kv:first-of-type {
  border-top: 0;
}
.k {
  flex: none;
  width: 130rpx;
  font-size: 22rpx;
  color: #8d99aa;
}
.v {
  flex: 1;
  font-size: 24rpx;
  color: #1f2937;
  line-height: 1.5;
}
.v-paid {
  color: #16a34a;
  font-weight: 600;
}

/* 明细 */
.card-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6rpx;
}
.card-title {
  font-size: 27rpx;
  font-weight: 600;
  color: #1f2937;
}
.card-extra {
  font-size: 20rpx;
  color: #a3aebd;
}
.item {
  padding: 16rpx 0;
  border-top: 1rpx solid #f4f7fa;
}
.item:first-of-type {
  border-top: 0;
}
.item-head {
  display: flex;
  align-items: center;
  gap: 10rpx;
}
.item-name {
  flex: 1;
  font-size: 26rpx;
  font-weight: 600;
  color: #1f2937;
}
.item-tag {
  flex: none;
  font-size: 19rpx;
  padding: 3rpx 12rpx;
  border-radius: 6rpx;
}
.item-sub {
  display: flex;
  align-items: baseline;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #6f7d92;
}
.item-amt {
  margin-left: auto;
  font-size: 26rpx;
  font-weight: 600;
  color: #1f2937;
  font-variant-numeric: tabular-nums;
}

/* 照片 */
.photo-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 12rpx;
}
.photo {
  width: calc((100% - 24rpx) / 3);
  height: 200rpx;
  border-radius: 12rpx;
  background: #f3f4f6;
}

/* 更正记录 */
.corr {
  padding: 14rpx 0;
  border-top: 1rpx solid #f4f7fa;
}
.corr:first-of-type {
  border-top: 0;
}
.corr-reason {
  display: block;
  font-size: 24rpx;
  color: #1f2937;
  line-height: 1.5;
}
.corr-meta {
  display: block;
  margin-top: 6rpx;
  font-size: 20rpx;
  color: #a3aebd;
}

/* 底部操作栏 */
.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  display: flex;
  gap: 14rpx;
  padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.97);
  border-top: 1rpx solid #e8ecf2;
}
.btn {
  flex: 1;
  height: 84rpx;
  border-radius: 16rpx;
  font-size: 27rpx;
  font-weight: 600;
  line-height: 84rpx;
}
.btn.ghost {
  background: #f3f6fa;
  color: #5b6a80;
}
.btn.outline {
  background: #fff;
  color: $uni-color-primary;
  border: 1rpx solid rgba(37, 99, 235, 0.35);
}
.btn.primary {
  background: $uni-color-primary;
  color: #fff;
}

/* 确认入库弹窗 */
.mask {
  position: fixed;
  inset: 0;
  z-index: 99;
  padding: 0 48rpx;
  background: rgba(16, 25, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}
.dialog {
  width: 100%;
  padding: 32rpx 28rpx 24rpx;
  border-radius: 28rpx;
  background: #fff;
}
.dialog-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #1f2937;
  text-align: center;
}
.dialog-amount {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-top: 24rpx;
  padding: 18rpx 20rpx;
  border-radius: 12rpx;
  background: #f7f9fc;
}
.dl {
  font-size: 23rpx;
  color: #6b7280;
}
.dv {
  font-size: 32rpx;
  font-weight: 700;
  color: #1f2937;
  font-variant-numeric: tabular-nums;
}
.check-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 26rpx;
}
.check-box {
  width: 38rpx;
  height: 38rpx;
  border-radius: 8rpx;
  border: 2rpx solid #cbd5e1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  color: #fff;
  line-height: 1;
}
.check-box.on {
  background: $uni-color-primary;
  border-color: $uni-color-primary;
}
.check-label {
  font-size: 25rpx;
  color: #1f2937;
}
.pay-box {
  margin-top: 18rpx;
}
.pay-methods {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}
.pay-pill {
  padding: 10rpx 26rpx;
  border-radius: 24rpx;
  background: #f2f5f9;
  color: #5f6d82;
  font-size: 23rpx;
}
.pay-pill.on {
  background: rgba(37, 99, 235, 0.1);
  color: $uni-color-primary;
  font-weight: 600;
}
.pay-input-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 16rpx;
  padding: 16rpx 20rpx;
  border-radius: 12rpx;
  background: #f7f9fc;
}
.pay-prefix {
  font-size: 24rpx;
  color: #6b7280;
}
.pay-input {
  flex: 1;
  font-size: 30rpx;
  font-weight: 600;
  color: #1f2937;
}
.pay-unit {
  font-size: 24rpx;
  color: #6b7280;
}
.vendor-zero-tip {
  margin-top: 24rpx;
  padding: 18rpx 20rpx;
  border-radius: 12rpx;
  background: #f2f7ff;
  font-size: 23rpx;
  line-height: 1.6;
  color: #41597e;
}
.dialog-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 30rpx;
}
.d-btn {
  flex: 1;
  height: 84rpx;
  border-radius: 14rpx;
  font-size: 27rpx;
  font-weight: 600;
  line-height: 84rpx;
}
.d-btn.cancel {
  background: #f3f6fa;
  color: #5b6a80;
}
.d-btn.ok {
  background: $uni-color-primary;
  color: #fff;
}
.d-btn[disabled] {
  opacity: 0.6;
}
</style>
