<template>
  <view class="prices-page">
    <view class="who">
      <view class="who-box">
        <view class="who-top">
          <text class="who-name">{{ customerName || '客户' }}</text>
          <text v-if="levelName" class="who-lv">{{ levelName }}</text>
        </view>
        <view class="who-sums">
          <text>已设 <text class="num">{{ rows.length }}</text> 条</text>
          <text class="below" :class="{ on: belowOnly }" @tap="toggleBelow">
            低于最低售价 <text class="num danger">{{ belowCount }}</text> 条
          </text>
        </view>
      </view>
    </view>

    <view class="tools">
      <view class="search-box">
        <text class="s-ico">🔍</text>
        <input
          v-model="keyword"
          class="search-input"
          placeholder="搜商品名 / 编码，可直接设新价"
          confirm-type="search"
          @confirm="search"
        />
        <text v-if="keyword" class="clear" @tap="clearSearch">×</text>
      </view>
    </view>

    <scroll-view scroll-y class="body" @scrolltolower="noop">
      <!-- 搜索结果 -->
      <view v-if="searchResults.length" class="group">
        <text class="group-title">搜索到的商品（未设价的也能直接设）</text>
        <view v-for="s in searchResults" :key="`${s.spu_id}-${s.id}`" class="sku-row">
          <view class="sku-tx">
            <text class="sku-name">{{ s.spu_name }} <text class="sku-spec">/ {{ specText(s) }}</text></text>
            <text class="sku-sub">建议价 {{ s.suggested_price ? formatMoney(s.suggested_price) : '—' }} · 最低 {{ s.min_price ? formatMoney(s.min_price) : '—' }}</text>
          </view>
          <view class="set-btn" @tap="openEditForSku(s)">设价</view>
        </view>
      </view>

      <!-- 已设专属价 -->
      <view class="group">
        <text class="group-title">已设专属价{{ belowOnly ? '（只看低于最低售价）' : '' }}</text>
        <view v-if="!rows.length" class="empty">
          <text class="empty-t">还没有设过专属价</text>
          <text class="empty-s">用上面的搜索框找商品，直接设价</text>
        </view>
        <view
          v-for="r in rows"
          :key="r.id"
          class="price-row"
          :class="{ below: r.below_min }"
        >
          <view class="ck" :class="{ on: selected.includes(r.sku_id) }" @tap="toggleSelect(r.sku_id)">
            <text v-if="selected.includes(r.sku_id)" class="ck-mark">✓</text>
          </view>
          <view class="sku-tx">
            <text class="sku-name">{{ r.spu_name }} <text class="sku-spec">/ {{ specsText(r) }}</text></text>
            <text class="sku-sub">
              专属价 <text class="strong">{{ formatMoney(r.price) }}</text>
              · 最低 {{ r.min_price ? formatMoney(r.min_price) : '—' }}
            </text>
            <text v-if="r.below_min" class="below-tip">已低于最低售价</text>
          </view>
          <view class="row-acts">
            <text class="mini edit" @tap="openEdit(r)">改价</text>
            <text class="mini del" @tap="remove(r)">删除</text>
          </view>
        </view>
      </view>

      <view class="tips">
        成本上涨后，已有专属价可能低于新的最低售价。系统不会自动改，改不改由你定；删除专属价等于回到等级价，不是设成 0。
      </view>
      <view class="bottom-space" />
    </scroll-view>

    <view class="footbar">
      <text class="sel">已选 <text class="num">{{ selected.length }}</text> 个商品</text>
      <button class="fb" :disabled="!selected.length" @tap="openBatch">批量设置</button>
    </view>

    <!-- 改价 -->
    <view v-if="editVisible" class="mask" @tap="closeSheets" />
    <view v-if="editVisible" class="sheet">
      <view class="sheet-hd">
        <text class="sheet-title">改专属价</text>
        <text class="sheet-close" @tap="closeSheets">×</text>
      </view>
      <view class="sheet-body">
        <view class="prod">
          <text class="prod-name">{{ editing?.name }}</text>
          <text class="prod-sub">{{ editing?.sub }}</text>
        </view>
        <text class="fld-label">专属价（元）</text>
        <view class="price-input" :class="{ err: errorMsg }">
          <text class="yuan">¥</text>
          <input v-model="editPrice" class="pi" type="digit" placeholder="0.00" @input="validate" />
        </view>
        <text v-if="errorMsg" class="err-tip">{{ errorMsg }}</text>
        <view class="meta-row">
          <text>最低售价 <text class="strong">{{ editing?.min ? formatMoney(editing.min) : '—' }}</text></text>
          <text>等级价 <text class="strong">{{ preview ? formatMoney(preview.level_price) : '—' }}</text></text>
          <text>建议价 <text class="strong">{{ preview ? formatMoney(preview.suggested_price) : '—' }}</text></text>
        </view>
        <view class="quick">
          <text class="quick-t">快捷填入</text>
          <view class="quick-chips">
            <text v-if="preview" class="qchip" @tap="quickFill('level')">等级价</text>
            <text v-if="editing?.min" class="qchip" @tap="quickFill('min')">最低售价</text>
            <text v-if="preview" class="qchip" @tap="quickFill('suggest')">建议价 9 折</text>
          </view>
        </view>
      </view>
      <view class="sheet-ft">
        <button class="btn ghost" @tap="closeSheets">取消</button>
        <button class="btn primary" :disabled="!!errorMsg || saving" @tap="savePrice">保存</button>
      </view>
    </view>

    <!-- 批量设置 -->
    <view v-if="batchVisible" class="mask" @tap="closeSheets" />
    <view v-if="batchVisible" class="sheet">
      <view class="sheet-hd">
        <text class="sheet-title">批量设置（{{ selected.length }} 个）</text>
        <text class="sheet-close" @tap="closeSheets">×</text>
      </view>
      <scroll-view scroll-y class="sheet-body">
        <view class="quick-chips">
          <text class="qchip" :class="{ on: batchMode === 'ratio' }" @tap="setBatchMode('ratio')">按建议价比例</text>
          <text class="qchip" :class="{ on: batchMode === 'minus' }" @tap="setBatchMode('minus')">减固定金额</text>
        </view>
        <text class="fld-label" style="margin-top: 20rpx">
          {{ batchMode === 'ratio' ? '折扣（0.9 = 建议价的 9 折）' : '每个商品减多少元' }}
        </text>
        <view class="price-input">
          <input v-model="batchValue" class="pi" type="digit" @input="calcBatch" />
        </view>
        <text class="fld-label" style="margin-top: 24rpx">算完的结果（低于最低售价的默认不勾）</text>
        <view v-for="b in batchRows" :key="b.sku_id" class="batch-row">
          <view class="ck" :class="{ on: b.checked }" @tap="b.checked = !b.checked">
            <text v-if="b.checked" class="ck-mark">✓</text>
          </view>
          <view class="sku-tx">
            <text class="sku-name">{{ b.name }}</text>
            <text class="sku-sub">建议价 {{ formatMoney(b.suggested) }} · 最低 {{ formatMoney(b.min) }}</text>
          </view>
          <view class="batch-amt">
            <text class="bv" :class="{ danger: b.below }">{{ formatMoney(b.value) }}</text>
            <text v-if="b.below" class="below-tip">低于最低，不勾选</text>
          </view>
        </view>
      </scroll-view>
      <view class="sheet-ft">
        <button class="btn ghost" @tap="closeSheets">取消</button>
        <button class="btn primary" :disabled="saving || !batchRows.some((b) => b.checked)" @tap="submitBatch">
          确认设置
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { customerApi, skuPriceApi, spuApi } from '@/api'
import { formatMoney, toNum } from '@/utils/format'
import type {
  Customer,
  CustomerSkuPrice,
  CustomerSkuPricePreview,
  Sku,
} from '@/types'

const customerId = ref(0)
const customerName = ref('')
const levelName = ref('')

const rows = ref<CustomerSkuPrice[]>([])
const belowOnly = ref(false)
const selected = ref<number[]>([])
const saving = ref(false)

const keyword = ref('')
const searchResults = ref<Sku[]>([])

const belowCount = computed(() => rows.value.filter((r) => r.below_min).length)

function specsText(r: CustomerSkuPrice) {
  return Object.values(r.sku_specs || {}).join(' / ') || r.sku_remark || '—'
}
function specText(s: Sku) {
  return Object.values(s.specs || {}).join(' / ') || s.remark || '—'
}

async function loadCustomer() {
  const c: Customer = await customerApi.get(customerId.value)
  customerName.value = c.name
  levelName.value = c.level_nickname || ''
}
async function loadRows() {
  rows.value = await skuPriceApi.list(customerId.value, {
    belowMin: belowOnly.value ? true : undefined,
  })
  selected.value = selected.value.filter((id) => rows.value.some((r) => r.sku_id === id))
}

async function toggleBelow() {
  belowOnly.value = !belowOnly.value
  await loadRows()
}

async function search() {
  const kw = keyword.value.trim()
  if (!kw) {
    searchResults.value = []
    return
  }
  try {
    const page = await spuApi.list({ keyword: kw, page: 1, page_size: 10 })
    const all: Sku[] = []
    for (const spu of page.items) {
      try {
        const skus = await spuApi.skus(spu.id, { page: 1, page_size: 50 })
        all.push(...skus.items.map((s) => ({ ...s, spu_name: s.spu_name || spu.name })))
      } catch {
        /* 单个 SPU 取不到 SKU 就跳过 */
      }
    }
    searchResults.value = all
  } catch {
    searchResults.value = []
  }
}
function clearSearch() {
  keyword.value = ''
  searchResults.value = []
}

/* ---------- 改价 ---------- */
const editVisible = ref(false)
const editing = ref<{ sku_id: number; name: string; sub: string; min: number | null; original: number | null } | null>(null)
const editPrice = ref('')
const preview = ref<CustomerSkuPricePreview | null>(null)
const errorMsg = ref('')

async function openEdit(r: CustomerSkuPrice) {
  editing.value = {
    sku_id: r.sku_id,
    name: r.spu_name,
    sub: `${specsText(r)}（当前 ${formatMoney(r.price)}）`,
    min: r.min_price ? toNum(r.min_price) : null,
    original: toNum(r.price),
  }
  editPrice.value = toNum(r.price).toFixed(2)
  errorMsg.value = ''
  editVisible.value = true
  await loadPreview(r.sku_id)
  validate()
}
async function openEditForSku(s: Sku) {
  editing.value = {
    sku_id: s.id,
    name: s.spu_name || '',
    sub: `${specText(s)}（未设专属价）`,
    min: s.min_price ? toNum(s.min_price) : null,
    original: null,
  }
  editPrice.value = ''
  errorMsg.value = ''
  editVisible.value = true
  await loadPreview(s.id)
  validate()
}
async function loadPreview(skuId: number) {
  preview.value = null
  try {
    preview.value = await skuPriceApi.preview(customerId.value, skuId)
  } catch {
    /* 预览失败时只靠 min_price 校验 */
  }
}
function validate() {
  const raw = editPrice.value.trim()
  const v = Number(raw)
  if (!raw) {
    errorMsg.value = ''
    return
  }
  if (isNaN(v) || v <= 0) {
    errorMsg.value = '填一个大于 0 的金额'
    return
  }
  if (raw.includes('.') && raw.split('.')[1].length > 2) {
    errorMsg.value = '最多两位小数'
    return
  }
  const min = editing.value?.min
  if (min && v < min) {
    errorMsg.value = `不能低于最低售价 ${formatMoney(min)}`
    return
  }
  errorMsg.value = ''
}
function quickFill(kind: 'level' | 'min' | 'suggest') {
  const p = preview.value
  let v = 0
  if (kind === 'level' && p) v = toNum(p.level_price)
  else if (kind === 'suggest' && p) v = Math.round(toNum(p.suggested_price) * 0.9 * 100) / 100
  else if (kind === 'min' && editing.value?.min) v = editing.value.min
  if (!v) return
  editPrice.value = v.toFixed(2)
  validate()
}
async function savePrice() {
  if (!editing.value) return
  validate()
  if (errorMsg.value) return
  saving.value = true
  try {
    const saved = await skuPriceApi.upsert(
      customerId.value,
      editing.value.sku_id,
      Number(editPrice.value),
    )
    const idx = rows.value.findIndex((r) => r.sku_id === saved.sku_id)
    if (idx >= 0) rows.value[idx] = saved
    else rows.value.unshift(saved)
    searchResults.value = searchResults.value.filter((s) => s.id !== saved.sku_id)
    closeSheets()
    uni.showToast({ title: '已保存', icon: 'none' })
  } catch {
    /* request.ts 已提示，含 below_min_price */
  } finally {
    saving.value = false
  }
}

async function remove(r: CustomerSkuPrice) {
  const res = await uni.showModal({
    title: '删除专属价',
    content: `删除后「${r.spu_name}」回到等级价，不是设成 0。`,
    confirmText: '删除',
  })
  if (!res.confirm) return
  try {
    await skuPriceApi.remove(customerId.value, r.sku_id)
    rows.value = rows.value.filter((x) => x.sku_id !== r.sku_id)
    selected.value = selected.value.filter((id) => id !== r.sku_id)
    uni.showToast({ title: '已删除', icon: 'none' })
  } catch {
    /* 已提示 */
  }
}

/* ---------- 批量 ---------- */
const batchVisible = ref(false)
const batchMode = ref<'ratio' | 'minus'>('ratio')
const batchValue = ref('0.9')
interface BatchRow {
  sku_id: number
  name: string
  suggested: number
  min: number
  value: number
  below: boolean
  checked: boolean
}
const batchRows = ref<BatchRow[]>([])

async function openBatch() {
  const picked = rows.value.filter((r) => selected.value.includes(r.sku_id))
  if (!picked.length) return
  uni.showLoading({ title: '算价中' })
  try {
    const previews = await Promise.all(
      picked.map((r) => skuPriceApi.preview(customerId.value, r.sku_id).catch(() => null)),
    )
    batchRows.value = picked.map((r, i) => {
      const p = previews[i]
      const suggested = p ? toNum(p.suggested_price) : toNum(r.price)
      const min = r.min_price ? toNum(r.min_price) : 0
      return {
        sku_id: r.sku_id,
        name: `${r.spu_name} / ${specsText(r)}`,
        suggested,
        min,
        value: suggested,
        below: false,
        checked: true,
      }
    })
    calcBatch()
    batchVisible.value = true
  } finally {
    uni.hideLoading()
  }
}
function setBatchMode(mode: 'ratio' | 'minus') {
  batchMode.value = mode
  batchValue.value = mode === 'ratio' ? '0.9' : '2'
  calcBatch()
}
function calcBatch() {
  const raw = Number(batchValue.value)
  batchRows.value.forEach((b) => {
    const v =
      batchMode.value === 'ratio'
        ? Math.round(b.suggested * (isNaN(raw) ? 1 : raw) * 100) / 100
        : Math.round((b.suggested - (isNaN(raw) ? 0 : raw)) * 100) / 100
    b.value = v
    b.below = b.min ? v < b.min : v <= 0
    b.checked = !b.below
  })
}
async function submitBatch() {
  const targets = batchRows.value.filter((b) => b.checked)
  if (!targets.length) return
  saving.value = true
  let ok = 0
  const failed: string[] = []
  try {
    for (const b of targets) {
      try {
        const saved = await skuPriceApi.upsert(customerId.value, b.sku_id, b.value)
        const idx = rows.value.findIndex((r) => r.sku_id === saved.sku_id)
        if (idx >= 0) rows.value[idx] = saved
        ok += 1
      } catch {
        failed.push(b.name)
      }
    }
    closeSheets()
    selected.value = []
    uni.showToast({
      title: failed.length ? `${ok} 条成功，${failed.length} 条失败` : `${ok} 条已设置`,
      icon: 'none',
    })
    if (failed.length) console.warn('[专属价] 批量失败：', failed)
  } finally {
    saving.value = false
  }
}

function toggleSelect(skuId: number) {
  selected.value = selected.value.includes(skuId)
    ? selected.value.filter((id) => id !== skuId)
    : [...selected.value, skuId]
}
function closeSheets() {
  editVisible.value = false
  batchVisible.value = false
}
function noop() {}

onLoad(async (opts: any) => {
  customerId.value = Number(opts?.customer_id || opts?.id || 0)
  if (!customerId.value) return
  await loadCustomer()
  await loadRows()
})
</script>

<style lang="scss" scoped>
.prices-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}
.who {
  padding: 16rpx 20rpx 0;
}
.who-box {
  background: #fff;
  border-radius: 18rpx;
  padding: 20rpx 22rpx;
  box-shadow: 0 4rpx 14rpx rgba(22, 35, 58, 0.05);
}
.who-top {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.who-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #1f2937;
}
.who-lv {
  font-size: 19rpx;
  padding: 3rpx 12rpx;
  border-radius: 6rpx;
  background: rgba(234, 179, 8, 0.14);
  color: #96650a;
}
.who-sums {
  display: flex;
  gap: 20rpx;
  margin-top: 12rpx;
  font-size: 21rpx;
  color: #8d99aa;
}
.who-sums .below.on {
  color: #c9343d;
  font-weight: 600;
}
.num {
  color: #1f2937;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.num.danger {
  color: #c9343d;
}

.tools {
  padding: 14rpx 20rpx 6rpx;
}
.search-box {
  display: flex;
  align-items: center;
  gap: 10rpx;
  height: 72rpx;
  padding: 0 22rpx;
  background: #fff;
  border-radius: 36rpx;
  border: 1rpx solid #e8ecf2;
}
.s-ico {
  font-size: 22rpx;
  opacity: 0.5;
}
.search-input {
  flex: 1;
  font-size: 25rpx;
  color: #1f2937;
}
.clear {
  font-size: 32rpx;
  color: #9ca3af;
}

.body {
  flex: 1;
}
.group {
  margin: 14rpx 20rpx 0;
  background: #fff;
  border-radius: 18rpx;
  padding: 20rpx;
  box-shadow: 0 4rpx 14rpx rgba(22, 35, 58, 0.05);
}
.group-title {
  display: block;
  font-size: 22rpx;
  color: #8d99aa;
  margin-bottom: 12rpx;
}
.sku-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 14rpx 0;
  border-top: 1rpx solid #f4f7fa;
}
.sku-row:first-of-type {
  border-top: 0;
}
.sku-tx {
  flex: 1;
  min-width: 0;
}
.sku-name {
  display: block;
  font-size: 25rpx;
  color: #1f2937;
  font-weight: 600;
}
.sku-spec {
  font-size: 22rpx;
  color: #8d99aa;
  font-weight: 400;
}
.sku-sub {
  display: block;
  font-size: 20rpx;
  color: #a3aebd;
  margin-top: 4rpx;
}
.sku-sub .strong {
  color: #1f2937;
  font-weight: 700;
}
.set-btn {
  flex: none;
  height: 52rpx;
  padding: 0 22rpx;
  line-height: 52rpx;
  border-radius: 26rpx;
  background: #f2f7ff;
  color: #2563eb;
  font-size: 22rpx;
  font-weight: 600;
}

.price-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 0;
  border-top: 1rpx solid #f4f7fa;
}
.price-row:first-of-type {
  border-top: 0;
}
.price-row.below {
  background: #fffafa;
  border-radius: 12rpx;
  padding: 16rpx 12rpx;
  margin: 0 -12rpx;
}
.ck {
  flex: none;
  width: 34rpx;
  height: 34rpx;
  border-radius: 10rpx;
  border: 2rpx solid #ccd6e2;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
}
.ck.on {
  background: #2563eb;
  border-color: #2563eb;
}
.ck-mark {
  color: #fff;
  font-size: 20rpx;
  line-height: 1;
}
.below-tip {
  display: block;
  font-size: 19rpx;
  color: #c9343d;
  margin-top: 4rpx;
}
.row-acts {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.mini {
  height: 46rpx;
  line-height: 46rpx;
  padding: 0 18rpx;
  border-radius: 23rpx;
  font-size: 21rpx;
  font-weight: 600;
  text-align: center;
}
.mini.edit {
  color: #2563eb;
  background: #f2f7ff;
}
.mini.del {
  color: #a83540;
  background: #fff6f7;
}
.empty {
  padding: 30rpx 0;
  text-align: center;
}
.empty-t {
  display: block;
  font-size: 24rpx;
  color: #6b7280;
}
.empty-s {
  display: block;
  font-size: 21rpx;
  color: #a3aebd;
  margin-top: 6rpx;
}
.tips {
  margin: 16rpx 20rpx 0;
  padding: 16rpx 18rpx;
  background: #f2f7ff;
  border-radius: 14rpx;
  font-size: 20rpx;
  color: #4a6b96;
  line-height: 1.6;
}
.bottom-space {
  height: 40rpx;
}

/* 底部条 */
.footbar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 24rpx calc(16rpx + constant(safe-area-inset-bottom));
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.97);
  border-top: 1rpx solid #e8ecf2;
}
.sel {
  flex: 1;
  font-size: 22rpx;
  color: #7d8ba0;
}
.fb {
  flex: none;
  height: 72rpx;
  padding: 0 32rpx;
  border-radius: 36rpx;
  background: #2563eb;
  color: #fff;
  font-size: 25rpx;
  font-weight: 600;
  line-height: 72rpx;
}
.fb[disabled] {
  background: #e9edf3;
  color: #a9b4c2;
}

/* 弹层 */
.mask {
  position: fixed;
  inset: 0;
  background: rgba(16, 25, 42, 0.42);
  z-index: 98;
}
.sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 99;
  max-height: 84vh;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 28rpx 28rpx 0 0;
}
.sheet-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx 18rpx;
  border-bottom: 1rpx solid #f2f5f9;
}
.sheet-title {
  font-size: 29rpx;
  font-weight: 600;
  color: #1f2937;
}
.sheet-close {
  font-size: 40rpx;
  line-height: 1;
  color: #b3bdcb;
}
.sheet-body {
  flex: 1;
  max-height: 60vh;
  padding: 20rpx 32rpx;
}
.prod {
  background: #f7f9fc;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 20rpx;
}
.prod-name {
  display: block;
  font-size: 25rpx;
  font-weight: 600;
  color: #1f2937;
}
.prod-sub {
  display: block;
  font-size: 20rpx;
  color: #8d99aa;
  margin-top: 4rpx;
}
.fld-label {
  display: block;
  font-size: 22rpx;
  color: #7d8ba0;
  margin-bottom: 10rpx;
  font-weight: 600;
}
.price-input {
  display: flex;
  align-items: center;
  gap: 10rpx;
  height: 92rpx;
  padding: 0 24rpx;
  background: #fbfcfe;
  border: 2rpx solid #e8ecf2;
  border-radius: 16rpx;
}
.price-input.err {
  border-color: #e7a9ae;
  background: #fff8f8;
}
.yuan {
  font-size: 28rpx;
  font-weight: 700;
  color: #8d99aa;
}
.pi {
  flex: 1;
  font-size: 40rpx;
  font-weight: 700;
  color: #1f2937;
}
.err-tip {
  display: block;
  margin-top: 10rpx;
  font-size: 21rpx;
  color: #c9343d;
}
.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 18rpx;
  margin-top: 16rpx;
  font-size: 20rpx;
  color: #8d99aa;
}
.meta-row .strong {
  color: #4b5563;
  font-weight: 600;
}
.quick {
  margin-top: 24rpx;
}
.quick-t {
  font-size: 22rpx;
  color: #7d8ba0;
  font-weight: 600;
}
.quick-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 10rpx;
}
.qchip {
  padding: 8rpx 22rpx;
  border-radius: 24rpx;
  background: #f2f5f9;
  color: #5f6d82;
  font-size: 22rpx;
}
.qchip.on {
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
  font-weight: 600;
}
.batch-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 14rpx 0;
  border-bottom: 1rpx solid #f6f8fb;
}
.batch-amt {
  flex: none;
  text-align: right;
}
.bv {
  display: block;
  font-size: 25rpx;
  font-weight: 700;
  color: #1f2937;
  font-variant-numeric: tabular-nums;
}
.bv.danger {
  color: #c9343d;
}
.sheet-ft {
  display: flex;
  gap: 18rpx;
  padding: 16rpx 32rpx calc(28rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #f2f5f9;
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
.btn.primary {
  background: #2563eb;
  color: #fff;
}
.btn.primary[disabled] {
  background: #c7d6ef;
}
</style>
