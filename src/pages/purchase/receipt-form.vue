<template>
  <view class="receipt-form-page">
    <view v-if="loading" class="page-loading">加载中...</view>

    <block v-else>
      <!-- 供应商 -->
      <view class="form-card">
        <view class="card-hd">
          <text class="card-title">供应商</text>
          <text class="card-extra">必选</text>
        </view>
        <view class="vendor-pick" @tap="openVendorPicker">
          <view class="vp-main">
            <text class="vp-name">{{ vendorDisplay }}</text>
            <text class="vp-tip" :class="{ self: vendorId === 0 }">{{ vendorTip }}</text>
          </view>
          <text class="vp-arrow">›</text>
        </view>
      </view>

      <!-- 商品明细 -->
      <view class="form-card">
        <view class="card-hd">
          <text class="card-title">商品明细</text>
          <text class="card-extra">{{ rows.length }} 行</text>
        </view>

        <view v-for="(r, i) in rows" :key="r.key" class="goods-row" :class="{ first: i === 0 }">
          <view class="gr-hd">
            <text class="gr-no">商品 {{ i + 1 }}</text>
            <view class="mode-switch">
              <text class="mode-opt" :class="{ on: r.mode === 'sku' }" @tap="setMode(r, 'sku')">按规格 (SKU)</text>
              <text class="mode-opt" :class="{ on: r.mode === 'spu' }" @tap="setMode(r, 'spu')">按商品 (SPU)</text>
            </view>
            <text v-if="rows.length > 1" class="gr-del" @tap="removeRow(i)">删除</text>
          </view>

          <view class="row-pick" :class="{ picked: !!r.label }" @tap="openItemPicker(r)">
            <view class="rp-main">
              <text v-if="r.label" class="rp-label">{{ r.label }}</text>
              <text v-else class="rp-placeholder">{{ r.mode === 'sku' ? '点击选择商品规格' : '点击选择商品' }}</text>
              <text v-if="rowMeta(r)" class="rp-meta">{{ rowMeta(r) }}</text>
            </view>
            <text class="rp-arrow">›</text>
          </view>

          <view class="row-fields">
            <view class="rf-item">
              <text class="rf-label">实际数量</text>
              <view class="rf-input">
                <input v-model="r.quantity" type="digit" class="rf-input-el" placeholder="0" />
                <text v-if="r.base_unit" class="rf-suffix">{{ r.base_unit }}</text>
              </view>
            </view>
            <view class="rf-item">
              <text class="rf-label">实际进价</text>
              <view class="rf-input">
                <text class="rf-prefix">¥</text>
                <input v-model="r.unit_cost" type="digit" class="rf-input-el" placeholder="0.00" />
              </view>
            </view>
            <view class="rf-subtotal">
              <text class="rfs-label">小计</text>
              <text class="rfs-val">{{ formatMoney(rowAmount(r)) }}</text>
            </view>
          </view>

          <view
            v-if="showCostSync(r)"
            class="cost-sync"
            :class="{ warn: costChanged(r) }"
            @tap="r.update_cost = !r.update_cost"
          >
            <text class="cs-title">{{ costTitle(r) }}</text>
            <view class="cs-check-line">
              <text class="check-box" :class="{ on: r.update_cost }">{{ r.update_cost ? '✓' : '' }}</text>
              <text class="cs-label">同步更新 SKU 成本价</text>
            </view>
          </view>
        </view>

        <view class="add-row" @tap="addRow">+ 添加商品行</view>
      </view>

      <!-- 进货单照片 -->
      <view class="form-card">
        <view class="card-hd">
          <text class="card-title">进货单照片（最多 9 张）</text>
          <text class="card-extra">{{ photos.length }}/9</text>
        </view>
        <view class="photo-grid">
          <view v-for="(url, i) in photos" :key="url + '-' + i" class="photo-item">
            <image class="photo" :src="url" mode="aspectFill" @tap="previewPhoto(url)" />
            <view class="photo-del" @tap.stop="removePhoto(i)">×</view>
          </view>
          <view v-if="photos.length < 9" class="photo-add" @tap="addPhotos">
            <text class="pa-icon">＋</text>
            <text class="pa-text">{{ uploading ? '上传中...' : '拍照 / 相册' }}</text>
          </view>
        </view>
      </view>

      <!-- 备注 -->
      <view class="form-card">
        <view class="card-hd">
          <text class="card-title">备注</text>
          <text class="card-extra">选填</text>
        </view>
        <textarea
          v-model="remark"
          class="remark-input"
          placeholder="如：产地直采、市场补货"
          maxlength="200"
        />
      </view>
    </block>

    <view v-if="!loading" class="bottom-bar">
      <view class="bb-total">
        <text class="bb-label">合计</text>
        <text class="bb-amt">{{ formatMoney(totalAmount) }}</text>
      </view>
      <view class="bb-actions">
        <button class="bb-btn ghost" :disabled="submitting" @tap="saveDraft">存草稿</button>
        <button class="bb-btn primary" :disabled="submitting" @tap="openConfirm">确认入库</button>
      </view>
    </view>

    <!-- 供应商选择 -->
    <view v-if="vendorVisible" class="sheet-mask">
      <view class="sheet-mask-bg" @tap="closeVendorPicker" @touchmove.stop.prevent></view>
      <view class="sheet" @tap.stop>
        <view class="sheet-hd">
          <text class="sheet-title">选择供应商</text>
          <text class="sheet-close" @tap="closeVendorPicker">×</text>
        </view>
        <view class="sheet-search">
          <input
            v-model="vendorKeyword"
            class="search-input"
            placeholder="搜索供应商名称 / 手机号"
            confirm-type="search"
          />
          <text v-if="vendorKeyword" class="search-clear" @tap="vendorKeyword = ''">×</text>
        </view>
        <scroll-view scroll-y class="sheet-body vendor-body">
          <view class="vendor-item" @tap="pickVendor(0, '自己进货')">
            <view class="vi-main">
              <text class="vi-name">自己进货（不记应付）</text>
              <text class="vi-sub">不产生供应商应付</text>
            </view>
            <text v-if="vendorId === 0" class="vi-check">✓</text>
          </view>
          <view
            v-for="v in filteredVendors"
            :key="v.id"
            class="vendor-item"
            @tap="pickVendor(v.id, v.name)"
          >
            <view class="vi-main">
              <text class="vi-name">{{ v.name }}</text>
              <text class="vi-sub">{{ vendorMeta(v) }}</text>
            </view>
            <text v-if="vendorId === v.id" class="vi-check">✓</text>
          </view>
          <view v-if="vendorLoading && !vendors.length" class="sheet-empty">加载中...</view>
          <view v-else-if="!filteredVendors.length" class="sheet-empty">
            {{ vendorKeyword ? '未找到匹配的供应商' : '暂无供应商' }}
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 商品 / 规格选择 -->
    <view v-if="itemPickerVisible" class="sheet-mask">
      <view class="sheet-mask-bg" @tap="closeItemPicker" @touchmove.stop.prevent></view>
      <view class="sheet" @tap.stop>
        <view class="sheet-hd">
          <text v-if="pickingSpu" class="picker-back" @tap="backToSpuList">‹ 返回选商品</text>
          <text v-else class="sheet-title">{{ activeMode === 'sku' ? '选择商品规格' : '选择商品' }}</text>
          <text class="sheet-close" @tap="closeItemPicker">×</text>
        </view>

        <template v-if="pickingSpu">
          <view class="picked-spu">
            <text class="ps-name">{{ pickingSpu.name }}</text>
            <text class="ps-meta">{{ spuMeta(pickingSpu) }}</text>
          </view>
          <scroll-view scroll-y class="sheet-body picker-body">
            <view v-if="skuLoading" class="sheet-empty">加载中...</view>
            <block v-else-if="skuList.length">
              <view v-for="s in skuList" :key="s.id" class="pick-item" @tap="onPickSku(s)">
                <view class="pi-main">
                  <text class="pi-name">{{ specText(s) }}</text>
                  <text v-if="skuMeta(s)" class="pi-meta">{{ skuMeta(s) }}</text>
                </view>
                <text class="pi-arrow">›</text>
              </view>
            </block>
            <view v-else class="sheet-empty">该商品暂无可用规格</view>
          </scroll-view>
        </template>

        <template v-else>
          <view class="sheet-search">
            <input
              v-model="spuKeyword"
              class="search-input"
              placeholder="搜索商品名称 / 编码"
              confirm-type="search"
              @confirm="loadSpus"
            />
            <text v-if="spuKeyword" class="search-clear" @tap="spuKeyword = ''">×</text>
          </view>
          <scroll-view scroll-y class="sheet-body picker-body">
            <view v-if="spuLoading" class="sheet-empty">加载中...</view>
            <block v-else-if="spuList.length">
              <view v-for="s in spuList" :key="s.id" class="pick-item" @tap="onPickSpu(s)">
                <view class="pi-main">
                  <text class="pi-name">{{ s.name }}</text>
                  <text class="pi-meta">{{ spuMeta(s) }}</text>
                </view>
                <text class="pi-arrow">{{ activeMode === 'sku' ? '›' : '选' }}</text>
              </view>
            </block>
            <view v-else class="sheet-empty">未找到商品</view>
          </scroll-view>
        </template>
      </view>
    </view>

    <!-- 确认入库 -->
    <view v-if="confirmVisible" class="mask" @tap.self="closeConfirm">
      <view class="dialog" @tap.stop>
        <text class="dialog-title">确认入库</text>

        <view class="dialog-amount">
          <text class="dl">入库金额</text>
          <text class="dv">{{ formatMoney(totalAmount) }}</text>
        </view>

        <block v-if="vendorId > 0">
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
          <button class="d-btn cancel" :disabled="submitting" @tap="closeConfirm">取消</button>
          <button class="d-btn ok" :disabled="submitting" @tap="onConfirmInbound">
            {{ submitting ? '提交中...' : '确认入库' }}
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { purchaseApi, skuApi, spuApi, uploadApi, vendorApi } from '@/api'
import { PURCHASE_PAY_METHODS } from '@/utils/dict'
import { formatMoney, toNum } from '@/utils/format'
import type {
  PurchaseItemIn,
  PurchasePayMethod,
  PurchaseReceiptItem,
  Sku,
  Spu,
  Vendor,
} from '@/types'

interface FormRow {
  key: number
  mode: 'sku' | 'spu'
  spu_id: number | null
  spu_name: string
  sku_id: number | null
  label: string
  base_unit: string
  current_cost: number | null
  quantity: string
  unit_cost: string
  update_cost: boolean
}

let keySeq = 0
function nextKey() {
  return ++keySeq
}

function blankRow(): FormRow {
  return {
    key: nextKey(),
    mode: 'sku',
    spu_id: null,
    spu_name: '',
    sku_id: null,
    label: '',
    base_unit: '',
    current_cost: null,
    quantity: '',
    unit_cost: '',
    update_cost: false,
  }
}

const editId = ref(0)
const version = ref(0)
const loading = ref(false)
const submitting = ref(false)

const vendorId = ref(0)
const vendorName = ref('自己进货')
const remark = ref('')
const photos = ref<string[]>([])
const uploading = ref(false)

const rows = ref<FormRow[]>([blankRow()])

const vendorVisible = ref(false)
const vendorKeyword = ref('')
const vendorLoading = ref(false)
const vendors = ref<Vendor[]>([])
let vendorsLoaded = false

const itemPickerVisible = ref(false)
const activeRowKey = ref(0)
const spuKeyword = ref('')
const spuList = ref<Spu[]>([])
const spuLoading = ref(false)
const pickingSpu = ref<Spu | null>(null)
const skuList = ref<Sku[]>([])
const skuLoading = ref(false)
let spuTimer: ReturnType<typeof setTimeout> | undefined
let spuSeq = 0
let skuSeq = 0

const confirmVisible = ref(false)
const payNow = ref(false)
const payMethod = ref<PurchasePayMethod>('wechat')
const payAmount = ref('')

const VENDOR_TYPE_LABEL: Record<string, string> = {
  market: '市场',
  origin: '产地',
  manufacturer: '厂家',
}

const activeRow = computed(() => rows.value.find((r) => r.key === activeRowKey.value) || null)
const activeMode = computed(() => activeRow.value?.mode || 'sku')

const vendorDisplay = computed(() => {
  if (vendorId.value === 0) return '自己进货'
  return vendorName.value || `供应商 #${vendorId.value}`
})

const vendorTip = computed(() =>
  vendorId.value === 0
    ? '不记供应商应付'
    : '确认入库将记入供应商应付，可当场付款',
)

const filteredVendors = computed(() => {
  const kw = vendorKeyword.value.trim().toLowerCase()
  if (!kw) return vendors.value
  return vendors.value.filter((v) => {
    const name = (v.name || '').toLowerCase()
    const phone = `${v.phone || ''} ${v.contact_phone || ''}`
    return name.includes(kw) || phone.includes(kw)
  })
})

const totalAmount = computed(() =>
  rows.value.reduce((sum, r) => sum + toNum(r.quantity) * toNum(r.unit_cost), 0),
)

function rowAmount(r: FormRow) {
  return toNum(r.quantity) * toNum(r.unit_cost)
}

function rowMeta(r: FormRow) {
  const parts: string[] = []
  if (r.base_unit) parts.push(`单位 ${r.base_unit}`)
  if (r.mode === 'sku' && r.current_cost != null) {
    parts.push(`当前成本 ${formatMoney(r.current_cost)}`)
  }
  return parts.join(' · ')
}

function showCostSync(r: FormRow) {
  return (
    r.mode === 'sku' &&
    !!r.sku_id &&
    r.current_cost != null &&
    String(r.unit_cost).trim() !== ''
  )
}

function costChanged(r: FormRow) {
  return r.current_cost != null && Number(r.unit_cost) !== Number(r.current_cost)
}

function costTitle(r: FormRow) {
  return costChanged(r)
    ? `进价与当前成本 ${formatMoney(r.current_cost)} 不同`
    : '进价与当前成本一致'
}

function vendorMeta(v: Vendor) {
  return [VENDOR_TYPE_LABEL[v.type], v.phone || v.contact_phone].filter(Boolean).join(' · ')
}

function spuMeta(s: Spu) {
  const parts = [s.code, s.base_unit]
  if (s.sku_count) parts.push(`${s.sku_count} 个规格`)
  return parts.filter(Boolean).join(' · ')
}

function skuMeta(s: Sku) {
  return s.cost_price != null ? `当前成本 ${formatMoney(s.cost_price)}` : ''
}

function specText(sku: Sku) {
  return (
    Object.values(sku.specs || {})
      .filter(Boolean)
      .join(' / ') ||
    sku.remark ||
    '默认规格'
  )
}

/* ---------- 编辑回填 ---------- */

function rowFromItem(it: PurchaseReceiptItem): FormRow {
  return {
    key: nextKey(),
    mode: it.sku_id ? 'sku' : 'spu',
    spu_id: it.spu_id,
    spu_name: it.spu_name,
    sku_id: it.sku_id ?? null,
    label: it.sku_name || `${it.spu_name}（${it.base_unit}）`,
    base_unit: it.base_unit,
    current_cost: null,
    quantity: String(it.quantity),
    unit_cost: String(it.unit_cost),
    update_cost: !!it.update_cost,
  }
}

async function fillCurrentCost(key: number, skuId: number) {
  try {
    const sku = await skuApi.get(skuId)
    const row = rows.value.find((r) => r.key === key)
    if (!row) return
    row.current_cost = sku.cost_price != null ? toNum(sku.cost_price) : null
  } catch {
    /* request 层已提示 */
  }
}

async function loadReceipt(id: number) {
  loading.value = true
  try {
    const receipt = await purchaseApi.get(id)
    vendorId.value = receipt.vendor_id
    vendorName.value =
      receipt.vendor_id === 0
        ? '自己进货'
        : receipt.vendor_name || `供应商 #${receipt.vendor_id}`
    remark.value = receipt.remark || ''
    photos.value = [...(receipt.photos || [])]
    version.value = receipt.version
    rows.value = receipt.items.map(rowFromItem)
    rows.value.forEach((row) => {
      if (row.sku_id) void fillCurrentCost(row.key, row.sku_id)
    })
  } catch {
    /* request 层已提示 */
  } finally {
    loading.value = false
  }
}

/* ---------- 供应商 ---------- */

function openVendorPicker() {
  vendorKeyword.value = ''
  vendorVisible.value = true
  if (!vendorsLoaded) void loadVendors()
}

function closeVendorPicker() {
  vendorVisible.value = false
}

async function loadVendors() {
  if (vendorLoading.value) return
  vendorLoading.value = true
  try {
    const res = await vendorApi.list({ page: 1, page_size: 100, status: 'active' })
    vendors.value = res.items
    vendorsLoaded = true
  } catch {
    /* request 层已提示 */
  } finally {
    vendorLoading.value = false
  }
}

function pickVendor(id: number, name: string) {
  vendorId.value = id
  vendorName.value = id === 0 ? '自己进货' : name
  vendorVisible.value = false
}

/* ---------- 商品行 ---------- */

function addRow() {
  rows.value.push(blankRow())
}

function removeRow(index: number) {
  if (rows.value.length <= 1) return
  rows.value.splice(index, 1)
}

function setMode(r: FormRow, mode: 'sku' | 'spu') {
  if (r.mode === mode) return
  r.mode = mode
  r.spu_id = null
  r.spu_name = ''
  r.sku_id = null
  r.label = ''
  r.base_unit = ''
  r.current_cost = null
  r.update_cost = false
}

/* ---------- 商品 / 规格选择 ---------- */

function openItemPicker(r: FormRow) {
  activeRowKey.value = r.key
  spuKeyword.value = ''
  pickingSpu.value = null
  skuList.value = []
  itemPickerVisible.value = true
  void loadSpus()
}

function closeItemPicker() {
  if (spuTimer) clearTimeout(spuTimer)
  itemPickerVisible.value = false
  pickingSpu.value = null
  skuList.value = []
}

function backToSpuList() {
  pickingSpu.value = null
  skuList.value = []
}

async function loadSpus() {
  const seq = ++spuSeq
  spuLoading.value = true
  try {
    const res = await spuApi.list({
      page: 1,
      page_size: 50,
      keyword: spuKeyword.value.trim() || undefined,
    })
    if (seq === spuSeq) spuList.value = res.items
  } catch {
    if (seq === spuSeq) spuList.value = []
  } finally {
    if (seq === spuSeq) spuLoading.value = false
  }
}

async function loadSkus(spuId: number) {
  const seq = ++skuSeq
  skuLoading.value = true
  skuList.value = []
  try {
    const res = await spuApi.skus(spuId, { page: 1, page_size: 50 })
    if (seq === skuSeq) skuList.value = res.items
  } catch {
    if (seq === skuSeq) skuList.value = []
  } finally {
    if (seq === skuSeq) skuLoading.value = false
  }
}

function onPickSpu(spu: Spu) {
  const row = activeRow.value
  if (!row) return
  if (row.mode === 'spu') {
    row.spu_id = spu.id
    row.spu_name = spu.name
    row.sku_id = null
    row.label = `${spu.name}（${spu.base_unit}）`
    row.base_unit = spu.base_unit
    row.current_cost = null
    row.update_cost = false
    closeItemPicker()
    return
  }
  pickingSpu.value = spu
  void loadSkus(spu.id)
}

function onPickSku(sku: Sku) {
  const row = activeRow.value
  const spu = pickingSpu.value
  if (!row || !spu) return
  const spec = specText(sku)
  row.spu_id = spu.id
  row.spu_name = spu.name
  row.sku_id = sku.id
  row.label = `${spu.name} · ${spec}`
  row.base_unit = sku.base_unit || spu.base_unit
  row.current_cost = sku.cost_price != null ? toNum(sku.cost_price) : null
  row.update_cost = false
  if (!row.unit_cost && sku.cost_price != null) {
    row.unit_cost = String(sku.cost_price)
  }
  closeItemPicker()
}

watch(spuKeyword, () => {
  if (!itemPickerVisible.value || pickingSpu.value) return
  if (spuTimer) clearTimeout(spuTimer)
  spuTimer = setTimeout(() => {
    void loadSpus()
  }, 300)
})

/* ---------- 照片 ---------- */

function previewPhoto(url: string) {
  if (!photos.value.length) return
  uni.previewImage({ urls: photos.value, current: url })
}

function removePhoto(index: number) {
  photos.value.splice(index, 1)
}

function addPhotos() {
  if (uploading.value || photos.value.length >= 9) return
  uni.chooseImage({
    count: 9 - photos.value.length,
    sizeType: ['compressed'],
    success: async (res) => {
      const paths = (res.tempFilePaths || []) as string[]
      if (!paths.length) return
      uploading.value = true
      try {
        for (const path of paths) {
          if (photos.value.length >= 9) break
          try {
            const { url } = await uploadApi.image(path)
            if (url) photos.value.push(url)
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

function buildItems(): PurchaseItemIn[] {
  return rows.value.map((r) => ({
    spu_id: r.spu_id,
    sku_id: r.mode === 'sku' ? r.sku_id : null,
    quantity: String(r.quantity).trim(),
    unit_cost: String(r.unit_cost).trim(),
    update_cost: r.mode === 'sku' ? r.update_cost : false,
  }))
}

function validateForm(): boolean {
  if (!rows.value.length) {
    uni.showToast({ title: '请至少添加 1 行商品', icon: 'none' })
    return false
  }
  for (let i = 0; i < rows.value.length; i++) {
    const r = rows.value[i]
    const no = i + 1
    if (!r.spu_id || (r.mode === 'sku' && !r.sku_id)) {
      uni.showToast({ title: `第 ${no} 行请选择商品`, icon: 'none' })
      return false
    }
    const qtyText = String(r.quantity).trim()
    const qty = Number(qtyText)
    if (!qtyText || Number.isNaN(qty) || qty <= 0) {
      uni.showToast({ title: `第 ${no} 行数量需大于 0`, icon: 'none' })
      return false
    }
    const costText = String(r.unit_cost).trim()
    if (!costText) {
      uni.showToast({ title: `第 ${no} 行请填写进价`, icon: 'none' })
      return false
    }
    const cost = Number(costText)
    if (Number.isNaN(cost) || cost < 0) {
      uni.showToast({ title: `第 ${no} 行进价不能小于 0`, icon: 'none' })
      return false
    }
  }
  return true
}

async function saveDraft() {
  if (submitting.value) return
  if (!validateForm()) return
  submitting.value = true
  try {
    const common = {
      vendor_id: vendorId.value,
      photos: photos.value,
      remark: remark.value.trim() || null,
      items: buildItems(),
    }
    if (editId.value) {
      const res = await purchaseApi.update(editId.value, { version: version.value, ...common })
      version.value = res.purchase_receipt.version
    } else {
      const res = await purchaseApi.create({ source_type: 'stock', ...common })
      editId.value = res.id
      version.value = res.version
    }
    uni.showToast({ title: '已保存草稿', icon: 'success' })
    finishAndBack()
  } catch {
    submitting.value = false
  }
}

function finishAndBack() {
  setTimeout(() => {
    uni.navigateBack({
      fail: () => {
        submitting.value = false
      },
    })
  }, 600)
}

function openConfirm() {
  if (submitting.value) return
  if (!validateForm()) return
  payNow.value = false
  payMethod.value = 'wechat'
  payAmount.value = totalAmount.value.toFixed(2)
  confirmVisible.value = true
}

function closeConfirm() {
  if (submitting.value) return
  confirmVisible.value = false
}

function resolvePayment(): {
  ok: boolean
  payment: { method: PurchasePayMethod; amount: string } | null
} {
  if (vendorId.value > 0 && payNow.value) {
    const amtText = String(payAmount.value).trim()
    const amt = Number(amtText)
    if (!amtText || Number.isNaN(amt) || amt <= 0) {
      uni.showToast({ title: '实付金额需大于 0', icon: 'none' })
      return { ok: false, payment: null }
    }
    const totalCents = Math.round(totalAmount.value * 100)
    const paidCents = Math.round(amt * 100)
    if (paidCents > totalCents) {
      uni.showToast({ title: '实付金额不能超过合计金额', icon: 'none' })
      return { ok: false, payment: null }
    }
    return { ok: true, payment: { method: payMethod.value, amount: amtText } }
  }
  return { ok: true, payment: null }
}

async function onConfirmInbound() {
  if (submitting.value) return
  const { ok, payment } = resolvePayment()
  if (!ok) return

  submitting.value = true
  try {
    const common = {
      vendor_id: vendorId.value,
      photos: photos.value,
      remark: remark.value.trim() || null,
      items: buildItems(),
    }
    let id = editId.value
    let ver = version.value

    if (id) {
      const updated = await purchaseApi.update(id, { version: ver, ...common })
      ver = updated.purchase_receipt.version
      version.value = ver
    } else {
      const created = await purchaseApi.create({ source_type: 'stock', ...common })
      id = created.id
      ver = created.version
      editId.value = id
      version.value = ver
    }

    const res = await purchaseApi.confirm(id, { version: ver, payment })
    confirmVisible.value = false

    if (res.warnings?.length) {
      await uni.showModal({
        title: '入库成功，请注意',
        content: res.warnings.map((w) => w.message || w.code).join('\n'),
        showCancel: false,
      })
    } else {
      uni.showToast({ title: '入库成功', icon: 'success' })
    }
    finishAndBack()
  } catch {
    submitting.value = false
  }
}

onLoad((opts: any) => {
  const id = Number(opts?.id)
  if (opts?.id && Number.isFinite(id) && id > 0) {
    editId.value = id
    uni.setNavigationBarTitle({ title: '编辑采购入库' })
    void loadReceipt(id)
  }
})
</script>

<style lang="scss" scoped>
.receipt-form-page {
  min-height: 100vh;
  background: #f5f7fa;
  padding-bottom: calc(170rpx + env(safe-area-inset-bottom));
}
.page-loading {
  text-align: center;
  padding: 120rpx 0;
  font-size: 24rpx;
  color: #a3aebd;
}

/* 卡片 */
.form-card {
  background: #fff;
  border-radius: 18rpx;
  padding: 22rpx;
  margin: 14rpx 20rpx 0;
  box-shadow: 0 4rpx 14rpx rgba(22, 35, 58, 0.05);
}
.card-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14rpx;
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

/* 供应商 */
.vendor-pick {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 18rpx 20rpx;
  border-radius: 12rpx;
  background: #f7f9fc;
}
.vp-main {
  flex: 1;
  min-width: 0;
}
.vp-name {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #1f2937;
}
.vp-tip {
  display: block;
  margin-top: 6rpx;
  font-size: 21rpx;
  color: #8d99aa;
}
.vp-tip.self {
  color: #b45309;
}
.vp-arrow {
  flex: none;
  font-size: 34rpx;
  color: #cbd5e1;
}

/* 商品行 */
.goods-row {
  margin-top: 18rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid #f4f7fa;
}
.goods-row.first {
  margin-top: 4rpx;
  padding-top: 0;
  border-top: 0;
}
.gr-hd {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.gr-no {
  flex: none;
  font-size: 24rpx;
  font-weight: 600;
  color: #1f2937;
}
.gr-del {
  flex: none;
  font-size: 22rpx;
  color: #dc2626;
  padding: 4rpx 8rpx;
}
.mode-switch {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  gap: 6rpx;
}
.mode-opt {
  padding: 6rpx 14rpx;
  border-radius: 20rpx;
  background: #f2f5f9;
  color: #8d99aa;
  font-size: 20rpx;
}
.mode-opt.on {
  background: rgba(37, 99, 235, 0.1);
  color: $uni-color-primary;
  font-weight: 600;
}

.row-pick {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 14rpx;
  padding: 18rpx 20rpx;
  border-radius: 12rpx;
  border: 1rpx dashed #d8e0ea;
  background: #fbfcfe;
}
.row-pick.picked {
  border-style: solid;
  border-color: #e4ebf5;
  background: #f7f9fc;
}
.rp-main {
  flex: 1;
  min-width: 0;
}
.rp-label {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.45;
}
.rp-placeholder {
  display: block;
  font-size: 25rpx;
  color: #a3aebd;
}
.rp-meta {
  display: block;
  margin-top: 5rpx;
  font-size: 20rpx;
  color: #8d99aa;
}
.rp-arrow {
  flex: none;
  font-size: 32rpx;
  color: #cbd5e1;
}

.row-fields {
  display: flex;
  align-items: flex-end;
  gap: 14rpx;
  margin-top: 14rpx;
}
.rf-item {
  flex: 1;
  min-width: 0;
}
.rf-label {
  display: block;
  font-size: 20rpx;
  color: #8d99aa;
  margin-bottom: 6rpx;
}
.rf-input {
  display: flex;
  align-items: center;
  gap: 6rpx;
  height: 70rpx;
  padding: 0 16rpx;
  border-radius: 10rpx;
  background: #f7f9fc;
  border: 1rpx solid #eef2f7;
}
.rf-input-el {
  flex: 1;
  min-width: 0;
  font-size: 27rpx;
  font-weight: 600;
  color: #1f2937;
}
.rf-prefix,
.rf-suffix {
  flex: none;
  font-size: 22rpx;
  color: #8d99aa;
}
.rf-subtotal {
  flex: none;
  width: 150rpx;
  text-align: right;
}
.rfs-label {
  display: block;
  font-size: 20rpx;
  color: #8d99aa;
  margin-bottom: 6rpx;
}
.rfs-val {
  display: block;
  height: 70rpx;
  line-height: 70rpx;
  font-size: 27rpx;
  font-weight: 700;
  color: #1f2937;
  font-variant-numeric: tabular-nums;
}

/* 成本差异 */
.cost-sync {
  margin-top: 12rpx;
  padding: 14rpx 18rpx;
  border-radius: 12rpx;
  background: #f7f9fc;
  border: 1rpx solid #eef2f7;
}
.cost-sync.warn {
  background: #fff7ed;
  border-color: rgba(234, 88, 12, 0.25);
}
.cs-title {
  display: block;
  font-size: 23rpx;
  font-weight: 600;
  color: #6b7280;
}
.cost-sync.warn .cs-title {
  color: #c2410c;
}
.cs-check-line {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-top: 10rpx;
}
.cs-label {
  font-size: 22rpx;
  color: #4b5563;
}
.check-box {
  flex: none;
  width: 34rpx;
  height: 34rpx;
  border-radius: 8rpx;
  border: 2rpx solid #cbd5e1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  color: #fff;
  line-height: 1;
  background: #fff;
}
.check-box.on {
  background: $uni-color-primary;
  border-color: $uni-color-primary;
}

.add-row {
  margin-top: 20rpx;
  height: 76rpx;
  line-height: 76rpx;
  text-align: center;
  border-radius: 12rpx;
  border: 1rpx dashed #c7d5e8;
  background: #f7f9fc;
  color: $uni-color-primary;
  font-size: 25rpx;
  font-weight: 600;
}

/* 照片 */
.photo-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}
.photo-item {
  position: relative;
  width: calc((100% - 24rpx) / 3);
  height: 200rpx;
}
.photo {
  width: 100%;
  height: 100%;
  border-radius: 12rpx;
  background: #f3f4f6;
}
.photo-del {
  position: absolute;
  top: -8rpx;
  right: -8rpx;
  width: 38rpx;
  height: 38rpx;
  border-radius: 50%;
  background: #dc2626;
  color: #fff;
  text-align: center;
  line-height: 36rpx;
  font-size: 28rpx;
}
.photo-add {
  width: calc((100% - 24rpx) / 3);
  height: 200rpx;
  border: 2rpx dashed #d1dbe8;
  border-radius: 12rpx;
  background: #fbfcfe;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
}
.pa-icon {
  font-size: 44rpx;
  line-height: 1;
  color: #9ca3af;
}
.pa-text {
  font-size: 21rpx;
  color: #9ca3af;
}

/* 备注 */
.remark-input {
  width: 100%;
  height: 160rpx;
  padding: 16rpx 18rpx;
  border-radius: 12rpx;
  background: #f7f9fc;
  border: 1rpx solid #eef2f7;
  font-size: 26rpx;
  color: #1f2937;
  line-height: 1.6;
  box-sizing: border-box;
}

/* 底部栏 */
.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.97);
  border-top: 1rpx solid #e8ecf2;
}
.bb-total {
  flex: 1;
  min-width: 0;
}
.bb-label {
  display: block;
  font-size: 20rpx;
  color: #8d99aa;
}
.bb-amt {
  display: block;
  margin-top: 2rpx;
  font-size: 34rpx;
  font-weight: 700;
  color: #1f2937;
  font-variant-numeric: tabular-nums;
}
.bb-actions {
  flex: none;
  display: flex;
  gap: 12rpx;
}
.bb-btn {
  min-width: 150rpx;
  height: 78rpx;
  line-height: 78rpx;
  padding: 0 24rpx;
  border-radius: 14rpx;
  font-size: 26rpx;
  font-weight: 600;
}
.bb-btn::after {
  border: none;
}
.bb-btn.ghost {
  background: #f3f6fa;
  color: #5b6a80;
}
.bb-btn.primary {
  background: $uni-color-primary;
  color: #fff;
}
.bb-btn[disabled] {
  opacity: 0.6;
}

/* 弹层通用 */
.sheet-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 2000;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}
.sheet-mask-bg {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(16, 25, 42, 0.45);
}
.sheet {
  position: relative;
  z-index: 2;
  width: 100%;
  max-height: 82vh;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 28rpx 28rpx 0 0;
  padding-bottom: env(safe-area-inset-bottom);
}
.sheet-hd {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 26rpx 30rpx 18rpx;
  border-bottom: 1rpx solid #eef1f5;
}
.sheet-title {
  flex: 1;
  font-size: 30rpx;
  font-weight: 600;
  color: #1f2937;
}
.sheet-close {
  margin-left: auto;
  font-size: 40rpx;
  line-height: 1;
  color: #9ca3af;
  padding: 4rpx 10rpx;
}
.picker-back {
  flex: 1;
  font-size: 26rpx;
  font-weight: 600;
  color: $uni-color-primary;
}
.sheet-search {
  display: flex;
  align-items: center;
  margin: 18rpx 26rpx 12rpx;
  padding: 0 20rpx;
  height: 74rpx;
  background: #f3f5f8;
  border-radius: 14rpx;
}
.search-input {
  flex: 1;
  font-size: 26rpx;
  color: #1f2937;
}
.search-clear {
  font-size: 32rpx;
  color: #9ca3af;
  padding: 0 6rpx;
}
.sheet-body {
  height: 56vh;
}
.vendor-body {
  height: 50vh;
}
.sheet-empty {
  padding: 70rpx 30rpx;
  text-align: center;
  font-size: 24rpx;
  color: #a3aebd;
}
.vi-check {
  flex: none;
  font-size: 30rpx;
  font-weight: 700;
  color: $uni-color-primary;
}

/* 供应商条目 */
.vendor-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 22rpx 30rpx;
  border-bottom: 1rpx solid #f5f6f8;
}
.vi-main {
  flex: 1;
  min-width: 0;
}
.vi-name {
  display: block;
  font-size: 27rpx;
  color: #1f2937;
  font-weight: 500;
}
.vi-sub {
  display: block;
  margin-top: 5rpx;
  font-size: 21rpx;
  color: #9ca3af;
}

/* 商品条目 */
.picked-spu {
  padding: 16rpx 30rpx;
  background: #f7f9fc;
  border-bottom: 1rpx solid #eef1f5;
}
.ps-name {
  display: block;
  font-size: 27rpx;
  font-weight: 600;
  color: #1f2937;
}
.ps-meta {
  display: block;
  margin-top: 4rpx;
  font-size: 21rpx;
  color: #8d99aa;
}
.pick-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 22rpx 30rpx;
  border-bottom: 1rpx solid #f5f6f8;
}
.pi-main {
  flex: 1;
  min-width: 0;
}
.pi-name {
  display: block;
  font-size: 27rpx;
  color: #1f2937;
  line-height: 1.45;
}
.pi-meta {
  display: block;
  margin-top: 5rpx;
  font-size: 21rpx;
  color: #9ca3af;
}
.pi-arrow {
  flex: none;
  font-size: 28rpx;
  color: #cbd5e1;
}

/* 确认入库弹窗 */
.mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 3000;
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
.d-btn::after {
  border: none;
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
