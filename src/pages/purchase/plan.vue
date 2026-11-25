<template>
  <view class="plan-page">
    <view v-if="!auth.isAdmin" class="no-auth">
      <text class="no-auth-icon">🔒</text>
      <text class="no-auth-title">无权限访问</text>
      <text class="no-auth-desc">采购清单功能仅管理员可用</text>
      <button class="btn-primary no-auth-btn" @tap="goBack">返回</button>
    </view>

    <block v-else>
      <!-- 顶部筛选区 -->
      <view class="filter-panel">
        <view class="mode-row">
          <text
            v-for="m in modeOpts"
            :key="m.value"
            class="mode-pill"
            :class="{ on: scopeMode === m.value }"
            @tap="onModeChange(m.value)"
          >{{ m.label }}</text>
        </view>

        <view v-if="scopeMode === 'route_trip'" class="picker-row">
          <picker
            mode="selector"
            :range="tripLabels"
            :value="tripIndex"
            @change="onTripPick"
          >
            <view class="picker-box">
              <text class="picker-label">出车趟次</text>
              <text class="picker-val">{{ selectedTripLabel }}</text>
              <text class="picker-arrow">›</text>
            </view>
          </picker>
        </view>

        <view v-if="scopeMode === 'freight_shipment'" class="picker-row">
          <picker
            mode="selector"
            :range="shipmentLabels"
            :value="shipmentIndex"
            @change="onShipmentPick"
          >
            <view class="picker-box">
              <text class="picker-label">物流批次</text>
              <text class="picker-val">{{ selectedShipmentLabel }}</text>
              <text class="picker-arrow">›</text>
            </view>
          </picker>
        </view>

        <view v-if="scopeMode === 'date'" class="picker-row">
          <picker mode="date" :value="selectedDate" @change="onDatePick">
            <view class="picker-box">
              <text class="picker-label">下单日期</text>
              <text class="picker-val">{{ selectedDate }}</text>
              <text class="picker-arrow">›</text>
            </view>
          </picker>
        </view>

        <view class="switch-row">
          <text class="switch-text">含自营缺口商品</text>
          <switch
            :checked="includeSelfShortage"
            color="#2563eb"
            style="transform: scale(0.8)"
            @change="onToggleSelf"
          />
        </view>
      </view>

      <!-- 汇总条 -->
      <view v-if="plan" class="summary-strip">
        <view class="sum-cell">
          <text class="sum-num">{{ plan.summary.supplier_count }}</text>
          <text class="sum-lbl">供应商</text>
        </view>
        <view class="sum-cell">
          <text class="sum-num">{{ checkedCount }}/{{ plan.summary.item_count }}</text>
          <text class="sum-lbl">已拿/项数</text>
        </view>
        <view class="sum-cell">
          <text class="sum-num">{{ plan.summary.order_count }}</text>
          <text class="sum-lbl">关联订单</text>
        </view>
        <view class="sum-cell">
          <text class="sum-num sum-money">{{ formatMoney(plan.summary.estimated_amount) }}</text>
          <text class="sum-lbl">预估拿货</text>
        </view>
      </view>

      <!-- 主内容区 -->
      <view class="list-wrap">
        <view v-if="loading && !plan" class="page-loading">加载采购清单中...</view>

        <block v-else-if="plan && plan.groups.length">
          <view v-for="group in plan.groups" :key="group.supplier_id" class="vendor-card">
            <view class="vc-head">
              <view class="vc-title-col">
                <view class="vc-name-row">
                  <text class="vc-name">{{ group.supplier_name || '未指定供应商' }}</text>
                  <text class="vc-badge" :class="group.supplier_id === 0 ? 'badge-self' : 'badge-vendor'">
                    {{ group.supplier_id === 0 ? '自营补货' : '供应商拿货' }}
                  </text>
                </view>
                <view class="vc-meta-row">
                  <text v-if="group.supplier_phone" class="vc-phone" @tap="callVendor(group.supplier_phone)">
                    📞 {{ group.supplier_phone }}
                  </text>
                  <text class="vc-sub">{{ group.item_count }} 项 · 预估 {{ formatMoney(group.estimated_amount) }}</text>
                </view>
                <text v-if="group.supplier_address" class="vc-addr">{{ group.supplier_address }}</text>
              </view>
              <view class="vc-actions">
                <text class="copy-btn" @tap="copyGroupText(group)">复制清单</text>
              </view>
            </view>

            <view class="vc-items">
              <view
                v-for="item in group.items"
                :key="item.item_key"
                class="item-block"
                :class="{ checked: isChecked(item.item_key) }"
              >
                <view class="item-main">
                  <view class="check-circle" @tap="toggleCheck(item.item_key)">
                    <text v-if="isChecked(item.item_key)" class="check-tick">✓</text>
                  </view>

                  <view class="item-body" @tap="toggleExpand(item.item_key)">
                    <view class="item-top">
                      <text class="item-name">{{ item.sku_name }}</text>
                      <text class="item-qty">{{ item.display }}</text>
                    </view>
                    <view class="item-mid">
                      <text class="item-tag" :class="item.supply_mode === 'temp_pick' ? 'tag-temp' : 'tag-self'">
                        {{ item.supply_mode === 'temp_pick' ? '临时拿货' : '自营缺口' }}
                      </text>
                      <text v-if="item.has_auto_receipt && !item.can_create_receipt" class="item-tag tag-auto">
                        已自动记应付
                      </text>
                      <text class="item-cost">参考价 ¥{{ fmtCost(item.suggested_unit_cost) }}</text>
                      <text class="item-orders-toggle">
                        {{ item.orders.length }} 笔订单 {{ isExpanded(item.item_key) ? '▲' : '▼' }}
                      </text>
                    </view>

                    <view v-if="item.can_create_receipt" class="draft-qty-row" @tap.stop>
                      <text class="draft-qty-lbl">入库数量（{{ item.unit }}）</text>
                      <input
                        class="draft-qty-input"
                        type="digit"
                        :value="getDraftQtyStr(item)"
                        @input="(e: any) => onDraftQtyInput(item.item_key, e.detail.value)"
                      />
                    </view>
                  </view>
                </view>

                <!-- 展开来源订单 -->
                <view v-if="isExpanded(item.item_key)" class="orders-box">
                  <view v-for="ord in item.orders" :key="ord.order_item_id" class="ord-row">
                    <view class="ord-info">
                      <text class="ord-cust">{{ ord.customer_name || '客户' }}</text>
                      <text class="ord-no">{{ ord.order_no }}</text>
                      <text class="ord-qty">× {{ ord.quantity }}{{ ord.unit }} · ¥{{ fmtCost(ord.unit_cost) }}</text>
                    </view>
                    <view class="ord-ops">
                      <text
                        v-if="ord.purchase_receipt_id && ord.receipt_status === 'confirmed'"
                        class="ord-btn ord-btn-primary"
                        @tap="openCorrectSheet(item, ord)"
                      >改价/换供应商</text>
                      <text
                        v-if="ord.purchase_receipt_id"
                        class="ord-btn"
                        @tap="goReceiptDetail(ord.purchase_receipt_id)"
                      >详情</text>
                    </view>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </block>

        <empty-state
          v-else-if="!loading"
          icon="📝"
          :text="emptyTip"
          action="刷新清单"
          @action="loadPreview"
        />
      </view>

      <!-- 底部生成草稿入库单操作栏（仅存在可建单行时显示） -->
      <view v-if="hasAnyCreatable" class="bottom-bar">
        <button
          class="btn-primary submit-btn"
          :disabled="creatingReceipts"
          @tap="createDraftReceipts"
        >
          {{ creatingReceipts ? '生成中...' : `生成草稿入库单（${creatableGroups.length} 组）` }}
        </button>
      </view>

      <!-- 快捷更正实际进价 / 换供应商底部弹层 -->
      <view v-if="correctVisible" class="sheet-mask" @tap="correctVisible = false">
        <view class="sheet-box" @tap.stop>
          <view class="sheet-head">
            <text class="sheet-title">更正实际进价 / 供应商</text>
            <text class="sheet-close" @tap="correctVisible = false">✕</text>
          </view>

          <view v-if="correctTarget" class="sheet-body">
            <view class="sheet-info">
              <text class="sheet-sku">{{ correctTarget.skuName }}</text>
              <text class="sheet-sub">{{ correctTarget.orderNo }} · {{ correctTarget.customerName }} · × {{ correctTarget.quantity }}{{ correctTarget.unit }}</text>
            </view>

            <view class="form-item">
              <text class="form-label">供应商</text>
              <picker
                mode="selector"
                :range="vendorNames"
                :value="correctVendorIndex"
                @change="onCorrectVendorPick"
              >
                <view class="form-picker">
                  <text>{{ correctVendorName }}</text>
                  <text class="picker-arrow">›</text>
                </view>
              </picker>
            </view>

            <view class="form-item">
              <text class="form-label">实际进价（元）</text>
              <input
                v-model="correctForm.unit_cost"
                class="form-input"
                type="digit"
                placeholder="输入实际拿货单价"
              />
            </view>

            <view class="form-item">
              <text class="form-label">更正原因</text>
              <input
                v-model="correctForm.reason"
                class="form-input"
                placeholder="如：市场拿货实际调价 / 临时换档口"
              />
            </view>

            <text class="sheet-tip">
              提交后将自动冲正原供应商应付、按新值重记应付并重算该订单利润。
            </text>

            <button
              class="btn-primary sheet-submit"
              :disabled="correctSaving"
              @tap="submitCorrect"
            >
              {{ correctSaving ? '提交中...' : '确认更正' }}
            </button>
          </view>
        </view>
      </view>
    </block>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import { useAuthStore } from '@/stores/auth'
import {
  deliveryApi,
  freightApi,
  purchaseApi,
  purchasePlanApi,
  vendorApi,
} from '@/api'
import { formatMoney, ymd } from '@/utils/format'
import type {
  FreightShipment,
  PurchasePlanGroup,
  PurchasePlanItem,
  PurchasePlanOrderRef,
  PurchasePlanPreviewResult,
  PurchasePlanScopeMode,
  RouteTrip,
  Vendor,
} from '@/types'

const auth = useAuthStore()

const modeOpts: { label: string; value: PurchasePlanScopeMode }[] = [
  { label: '全部待送', value: 'all_pending' },
  { label: '出车趟次', value: 'route_trip' },
  { label: '物流批次', value: 'freight_shipment' },
  { label: '按日期', value: 'date' },
]

const scopeMode = ref<PurchasePlanScopeMode>('all_pending')
const includeSelfShortage = ref(false)
const selectedDate = ref(ymd())

const trips = ref<RouteTrip[]>([])
const shipments = ref<FreightShipment[]>([])
const vendors = ref<Vendor[]>([])
const tripIndex = ref(0)
const shipmentIndex = ref(0)

const loading = ref(false)
const creatingReceipts = ref(false)
const plan = ref<PurchasePlanPreviewResult | null>(null)

const checkedMap = reactive<Record<string, boolean>>({})
const expandedMap = reactive<Record<string, boolean>>({})
const draftQtyMap = reactive<Record<string, string>>({})

const correctVisible = ref(false)
const correctSaving = ref(false)
const correctTarget = ref<{
  receiptId: number
  version: number
  skuName: string
  orderNo: string
  customerName: string
  quantity: string
  unit: string
} | null>(null)
const correctForm = reactive({
  vendor_id: 0,
  unit_cost: '',
  reason: '市场拿货实际核对',
})

const tripLabels = computed(() =>
  trips.value.length
    ? trips.value.map((t) => `${t.trip_date} ${t.name || `趟次#${t.id}`} (${t.order_count ?? 0}单)`)
    : ['暂无待发车趟次'],
)

const selectedTrip = computed(() => trips.value[tripIndex.value] || null)
const selectedTripLabel = computed(() =>
  selectedTrip.value
    ? `${selectedTrip.value.trip_date} ${selectedTrip.value.name || `趟次#${selectedTrip.value.id}`}`
    : '暂无待发车趟次',
)

const shipmentLabels = computed(() =>
  shipments.value.length
    ? shipments.value.map((s) => `${s.ship_date} ${s.line_name || `批次#${s.id}`} (${s.order_count ?? 0}单)`)
    : ['暂无待交车物流批次'],
)

const selectedShipment = computed(() => shipments.value[shipmentIndex.value] || null)
const selectedShipmentLabel = computed(() =>
  selectedShipment.value
    ? `${selectedShipment.value.ship_date} ${selectedShipment.value.line_name || `批次#${selectedShipment.value.id}`}`
    : '暂无待交车物流批次',
)

const vendorNames = computed(() => vendors.value.map((v) => v.name))
const correctVendorIndex = computed(() => {
  const idx = vendors.value.findIndex((v) => v.id === correctForm.vendor_id)
  return idx >= 0 ? idx : 0
})
const correctVendorName = computed(() => {
  const hit = vendors.value.find((v) => v.id === correctForm.vendor_id)
  return hit ? hit.name : '请选择供应商'
})

const creatableGroups = computed(() =>
  (plan.value?.groups || []).filter((g) => g.can_create_receipt),
)
const hasAnyCreatable = computed(() => creatableGroups.value.length > 0)

const emptyTip = computed(() => {
  if (scopeMode.value === 'route_trip' && !selectedTrip.value) return '暂无待发车的出车趟次'
  if (scopeMode.value === 'freight_shipment' && !selectedShipment.value) return '暂无待交车的物流批次'
  return includeSelfShortage.value
    ? '当前范围内没有需要拿货或补货的商品'
    : '当前范围内没有需要去供应商拿的货'
})

const storageKey = computed(() => {
  const part =
    scopeMode.value === 'route_trip'
      ? `trip:${selectedTrip.value?.id || 0}`
      : scopeMode.value === 'freight_shipment'
        ? `ship:${selectedShipment.value?.id || 0}`
        : scopeMode.value === 'date'
          ? `date:${selectedDate.value}`
          : 'all'
  return `wdm_sales_purchase_plan_checked:${part}`
})

function fmtCost(v: string | number | null | undefined): string {
  const n = Number(v ?? 0)
  if (!Number.isFinite(n)) return '0'
  return parseFloat(n.toFixed(4)).toString()
}

function loadChecked() {
  Object.keys(checkedMap).forEach((k) => delete checkedMap[k])
  try {
    const raw = uni.getStorageSync(storageKey.value)
    if (raw && typeof raw === 'object') {
      Object.entries(raw as Record<string, boolean>).forEach(([k, v]) => {
        if (v) checkedMap[k] = true
      })
    }
  } catch { /* ignore */ }
}

function isChecked(key: string): boolean {
  return Boolean(checkedMap[key])
}

function toggleCheck(key: string) {
  if (checkedMap[key]) delete checkedMap[key]
  else checkedMap[key] = true
  try {
    uni.setStorageSync(storageKey.value, { ...checkedMap })
  } catch { /* ignore */ }
}

const checkedCount = computed(() => {
  if (!plan.value) return 0
  let cnt = 0
  for (const g of plan.value.groups) {
    for (const it of g.items) {
      if (checkedMap[it.item_key]) cnt += 1
    }
  }
  return cnt
})

function isExpanded(key: string): boolean {
  return Boolean(expandedMap[key])
}

function toggleExpand(key: string) {
  expandedMap[key] = !expandedMap[key]
}

function getDraftQtyStr(item: PurchasePlanItem): string {
  return draftQtyMap[item.item_key] ?? String(item.shortage_quantity)
}

function onDraftQtyInput(key: string, val: string) {
  draftQtyMap[key] = val
}

function onModeChange(mode: PurchasePlanScopeMode) {
  if (scopeMode.value === mode) return
  scopeMode.value = mode
  loadPreview()
}

function onTripPick(e: any) {
  tripIndex.value = Number(e.detail.value || 0)
  loadPreview()
}

function onShipmentPick(e: any) {
  shipmentIndex.value = Number(e.detail.value || 0)
  loadPreview()
}

function onDatePick(e: any) {
  selectedDate.value = e.detail.value
  loadPreview()
}

function onToggleSelf(e: any) {
  includeSelfShortage.value = Boolean(e.detail.value)
  loadPreview()
}

function callVendor(phone: string) {
  uni.makePhoneCall({ phoneNumber: phone })
}

function copyGroupText(group: PurchasePlanGroup) {
  const lines: string[] = []
  lines.push(`【采购拿货单】${group.supplier_name}${group.supplier_phone ? `（${group.supplier_phone}）` : ''}`)
  if (plan.value?.scope.label) lines.push(`范围：${plan.value.scope.label}`)
  lines.push('----------------')
  group.items.forEach((it, idx) => {
    lines.push(`${idx + 1}. ${it.sku_name}：${it.display}`)
  })
  lines.push('----------------')
  lines.push(`共 ${group.item_count} 项，预估 ${formatMoney(group.estimated_amount)}`)
  uni.setClipboardData({
    data: lines.join('\n'),
    success: () => {
      uni.showToast({ title: '已复制，可发微信', icon: 'success' })
    },
  })
}

function openCorrectSheet(item: PurchasePlanItem, ord: PurchasePlanOrderRef) {
  if (!ord.purchase_receipt_id || ord.receipt_version === null) return
  correctTarget.value = {
    receiptId: ord.purchase_receipt_id,
    version: ord.receipt_version,
    skuName: item.sku_name,
    orderNo: ord.order_no,
    customerName: ord.customer_name,
    quantity: ord.quantity,
    unit: ord.unit,
  }
  correctForm.vendor_id = ord.vendor_id
  correctForm.unit_cost = fmtCost(ord.unit_cost)
  correctForm.reason = '市场拿货实际核对'
  correctVisible.value = true
}

function onCorrectVendorPick(e: any) {
  const idx = Number(e.detail.value || 0)
  const v = vendors.value[idx]
  if (v) correctForm.vendor_id = v.id
}

async function submitCorrect() {
  if (!correctTarget.value) return
  const costNum = Number(correctForm.unit_cost)
  if (!Number.isFinite(costNum) || costNum < 0) {
    uni.showToast({ title: '请输入有效的实际进价', icon: 'none' })
    return
  }
  if (!correctForm.vendor_id || correctForm.vendor_id <= 0) {
    uni.showToast({ title: '请选择供应商', icon: 'none' })
    return
  }
  if (!correctForm.reason.trim()) {
    uni.showToast({ title: '请填写更正原因', icon: 'none' })
    return
  }
  correctSaving.value = true
  try {
    await purchaseApi.update(correctTarget.value.receiptId, {
      version: correctTarget.value.version,
      vendor_id: correctForm.vendor_id,
      unit_cost: costNum.toFixed(4),
      reason: correctForm.reason.trim(),
    })
    uni.showToast({ title: '已更正并重算应付', icon: 'success' })
    correctVisible.value = false
    await loadPreview()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '更正失败', icon: 'none' })
  } finally {
    correctSaving.value = false
  }
}

async function createDraftReceipts() {
  const groups = creatableGroups.value
    .map((g) => ({
      supplier_id: g.supplier_id,
      items: g.items
        .filter((it) => it.can_create_receipt)
        .map((it) => {
          const qtyNum = Number(getDraftQtyStr(it))
          return {
            spu_id: it.spu_id,
            sku_id: it.sku_id,
            quantity: (Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : Number(it.shortage_quantity)).toFixed(1),
            unit_cost: String(it.suggested_unit_cost),
          }
        }),
    }))
    .filter((g) => g.items.length > 0)

  if (!groups.length) return
  creatingReceipts.value = true
  try {
    const res = await purchasePlanApi.toReceipts({
      groups,
      remark: `采购清单生成（${plan.value?.scope.label || ''}）`,
    })
    const count = res.receipts?.length || groups.length
    uni.showModal({
      title: '草稿入库单已生成',
      content: `已生成 ${count} 张草稿入库单，是否前往「采购入库」确认？`,
      confirmText: '去确认',
      cancelText: '留在此页',
      success: (r) => {
        if (r.confirm) {
          uni.navigateTo({ url: '/pages/purchase/receipts' })
        }
      },
    })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '生成失败', icon: 'none' })
  } finally {
    creatingReceipts.value = false
  }
}

function goReceiptDetail(id: number) {
  uni.navigateTo({ url: `/pages/purchase/receipt-detail?id=${id}` })
}

function goBack() {
  uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/me/index' }) })
}

async function loadOptions() {
  try {
    const [tripRes, shipRes, vendorRes] = await Promise.all([
      deliveryApi.listTrips({ status: 'planned', page: 1, page_size: 50 }),
      freightApi.list({ status: 'pending', page: 1, page_size: 50 }),
      vendorApi.list({ page: 1, page_size: 100 }),
    ])
    trips.value = tripRes?.items || []
    shipments.value = shipRes?.items || []
    vendors.value = vendorRes?.items || []
  } catch { /* ignore */ }
}

async function loadPreview() {
  if (!auth.isAdmin) return
  if (scopeMode.value === 'route_trip' && !selectedTrip.value) {
    plan.value = null
    return
  }
  if (scopeMode.value === 'freight_shipment' && !selectedShipment.value) {
    plan.value = null
    return
  }
  loading.value = true
  try {
    const res = await purchasePlanApi.preview({
      route_trip_id: scopeMode.value === 'route_trip' ? selectedTrip.value?.id : undefined,
      freight_shipment_id: scopeMode.value === 'freight_shipment' ? selectedShipment.value?.id : undefined,
      date: scopeMode.value === 'date' ? selectedDate.value : undefined,
      include_self_shortage: includeSelfShortage.value,
    })
    plan.value = res
    loadChecked()
  } catch { /* request.ts 已提示 */ } finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

onLoad(async () => {
  if (!auth.isAdmin) return
  await loadOptions()
  await loadPreview()
})

onShow(() => {
  if (auth.isAdmin && plan.value) {
    loadPreview()
  }
})

onPullDownRefresh(() => {
  loadPreview()
})
</script>

<style lang="scss" scoped>
.plan-page {
  min-height: 100vh;
  background: #f5f5f7;
  padding-bottom: 140rpx;
}

.no-auth {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 160rpx 48rpx;
  text-align: center;
}
.no-auth-icon { font-size: 96rpx; margin-bottom: 24rpx; }
.no-auth-title { font-size: 34rpx; font-weight: 600; color: #1f2937; margin-bottom: 12rpx; }
.no-auth-desc { font-size: 26rpx; color: #6b7280; margin-bottom: 40rpx; }
.no-auth-btn { width: 280rpx; }

.filter-panel {
  background: #ffffff;
  padding: 20rpx 24rpx;
  border-bottom: 1rpx solid #eef0f4;
}

.mode-row {
  display: flex;
  gap: 14rpx;
  flex-wrap: wrap;
}

.mode-pill {
  font-size: 25rpx;
  padding: 10rpx 22rpx;
  border-radius: 999rpx;
  background: #f3f4f6;
  color: #4b5563;
}
.mode-pill.on {
  background: #2563eb;
  color: #ffffff;
  font-weight: 600;
}

.picker-row {
  margin-top: 16rpx;
}
.picker-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f8fafc;
  border: 1rpx solid #e5e7eb;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
}
.picker-label { font-size: 26rpx; color: #6b7280; }
.picker-val { flex: 1; text-align: right; font-size: 26rpx; color: #111827; font-weight: 500; margin: 0 12rpx; }
.picker-arrow { font-size: 30rpx; color: #9ca3af; }

.switch-row {
  margin-top: 14rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.switch-text { font-size: 26rpx; color: #374151; }

.summary-strip {
  display: flex;
  background: #1e293b;
  color: #ffffff;
  padding: 20rpx 16rpx;
}
.sum-cell {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.sum-num { font-size: 30rpx; font-weight: 700; }
.sum-money { color: #fbbf24; }
.sum-lbl { font-size: 22rpx; color: #cbd5e1; margin-top: 4rpx; }

.list-wrap {
  padding: 20rpx 24rpx;
}
.page-loading {
  text-align: center;
  padding: 80rpx 0;
  font-size: 28rpx;
  color: #6b7280;
}

.vendor-card {
  background: #ffffff;
  border-radius: 16rpx;
  margin-bottom: 22rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 14rpx rgba(15, 23, 42, 0.05);
}

.vc-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
  padding: 22rpx 24rpx;
  background: #f8fafc;
  border-bottom: 1rpx solid #eef0f4;
}
.vc-title-col { flex: 1; min-width: 0; }
.vc-name-row { display: flex; align-items: center; gap: 12rpx; flex-wrap: wrap; }
.vc-name { font-size: 32rpx; font-weight: 700; color: #111827; }
.vc-badge {
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}
.badge-vendor { background: #dbeafe; color: #1d4ed8; }
.badge-self { background: #e5e7eb; color: #374151; }

.vc-meta-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  flex-wrap: wrap;
  margin-top: 8rpx;
}
.vc-phone { font-size: 24rpx; color: #2563eb; font-weight: 500; }
.vc-sub { font-size: 24rpx; color: #6b7280; }
.vc-addr { display: block; font-size: 22rpx; color: #9ca3af; margin-top: 6rpx; }

.copy-btn {
  display: inline-block;
  font-size: 24rpx;
  color: #2563eb;
  background: #eff6ff;
  border: 1rpx solid #bfdbfe;
  padding: 8rpx 18rpx;
  border-radius: 999rpx;
  white-space: nowrap;
}

.vc-items {
  padding: 0 24rpx;
}

.item-block {
  padding: 22rpx 0;
  border-bottom: 1rpx solid #f1f5f9;
}
.item-block:last-child { border-bottom: none; }
.item-block.checked .item-name,
.item-block.checked .item-qty {
  color: #9ca3af;
  text-decoration: line-through;
}

.item-main {
  display: flex;
  align-items: flex-start;
  gap: 18rpx;
}

.check-circle {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  border: 3rpx solid #cbd5e1;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 4rpx;
  flex-shrink: 0;
}
.item-block.checked .check-circle {
  background: #16a34a;
  border-color: #16a34a;
}
.check-tick { color: #ffffff; font-size: 26rpx; font-weight: 700; }

.item-body { flex: 1; min-width: 0; }
.item-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16rpx;
}
.item-name { font-size: 29rpx; font-weight: 600; color: #111827; flex: 1; }
.item-qty { font-size: 30rpx; font-weight: 700; color: #2563eb; white-space: nowrap; }

.item-mid {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-wrap: wrap;
  margin-top: 10rpx;
}
.item-tag {
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
}
.tag-temp { background: #fef3c7; color: #b45309; }
.tag-self { background: #dcfce7; color: #15803d; }
.tag-auto { background: #e0f2fe; color: #0369a1; }
.item-cost { font-size: 24rpx; color: #6b7280; }
.item-orders-toggle { font-size: 23rpx; color: #2563eb; margin-left: auto; }

.draft-qty-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14rpx;
  padding: 10rpx 16rpx;
  background: #f8fafc;
  border-radius: 10rpx;
}
.draft-qty-lbl { font-size: 24rpx; color: #4b5563; }
.draft-qty-input {
  width: 150rpx;
  text-align: right;
  font-size: 28rpx;
  font-weight: 600;
  color: #111827;
  background: #ffffff;
  border: 1rpx solid #d1d5db;
  border-radius: 8rpx;
  padding: 6rpx 12rpx;
}

.orders-box {
  margin-top: 16rpx;
  margin-left: 62rpx;
  background: #f8fafc;
  border-radius: 12rpx;
  padding: 14rpx 16rpx;
}
.ord-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  padding: 10rpx 0;
  border-bottom: 1rpx solid #e5e7eb;
}
.ord-row:last-child { border-bottom: none; padding-bottom: 0; }
.ord-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4rpx; }
.ord-cust { font-size: 25rpx; font-weight: 600; color: #1f2937; }
.ord-no { font-size: 22rpx; color: #6b7280; }
.ord-qty { font-size: 24rpx; color: #374151; }
.ord-ops { display: flex; align-items: center; gap: 12rpx; flex-shrink: 0; }
.ord-btn {
  font-size: 22rpx;
  padding: 6rpx 14rpx;
  border-radius: 8rpx;
  background: #e5e7eb;
  color: #374151;
}
.ord-btn-primary {
  background: #eff6ff;
  color: #2563eb;
  border: 1rpx solid #bfdbfe;
}

.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  background: #ffffff;
  padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #eef0f4;
  box-shadow: 0 -4rpx 16rpx rgba(15, 23, 42, 0.06);
}
.submit-btn { width: 100%; }

.sheet-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  z-index: 999;
  display: flex;
  align-items: flex-end;
}
.sheet-box {
  width: 100%;
  background: #ffffff;
  border-radius: 24rpx 24rpx 0 0;
  padding: 28rpx 28rpx calc(32rpx + env(safe-area-inset-bottom));
}
.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}
.sheet-title { font-size: 32rpx; font-weight: 700; color: #111827; }
.sheet-close { font-size: 34rpx; color: #6b7280; padding: 8rpx; }

.sheet-info {
  background: #f8fafc;
  border-radius: 12rpx;
  padding: 16rpx;
  margin-bottom: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.sheet-sku { font-size: 28rpx; font-weight: 600; color: #111827; }
.sheet-sub { font-size: 24rpx; color: #6b7280; }

.form-item { margin-bottom: 20rpx; }
.form-label { display: block; font-size: 25rpx; color: #374151; margin-bottom: 10rpx; font-weight: 500; }
.form-picker,
.form-input {
  width: 100%;
  box-sizing: border-box;
  background: #f9fafb;
  border: 1rpx solid #d1d5db;
  border-radius: 12rpx;
  padding: 18rpx 20rpx;
  font-size: 28rpx;
  color: #111827;
}
.form-picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sheet-tip {
  display: block;
  font-size: 22rpx;
  color: #6b7280;
  margin-bottom: 24rpx;
}
.sheet-submit { width: 100%; }
</style>
