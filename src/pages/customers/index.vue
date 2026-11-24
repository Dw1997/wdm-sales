<template>
  <page-meta :page-style="createVisible || regionPickerVisible ? 'overflow: hidden;' : ''" />
  <view class="customers-page">
    <view class="tools">
      <view class="search-row">
        <view class="search-box">
          <text class="search-icon">🔍</text>
          <input
            v-model="keyword"
            class="search-input"
            placeholder="搜索客户名称 / 手机号"
            confirm-type="search"
            @confirm="reload"
          />
          <text v-if="keyword" class="clear" @tap="clearKeyword">×</text>
        </view>
        <view class="filter-btn" :class="{ on: panelOpen || hasFilter }" @tap="panelOpen = !panelOpen">
          筛选<text v-if="hasFilter" class="dot" />
        </view>
      </view>

      <!-- 常用路线快捷筛选（询单打电话） -->
      <scroll-view v-if="routeTemplates.length" scroll-x class="route-bar" :show-scrollbar="false">
        <view class="route-line">
          <text class="rchip" :class="{ on: !routeTemplateId }" @tap="setRoute(0)">全部路线</text>
          <text
            v-for="r in routeTemplates"
            :key="r.id"
            class="rchip"
            :class="{ on: routeTemplateId === r.id }"
            @tap="setRoute(r.id)"
          >{{ r.name }}</text>
        </view>
      </scroll-view>

      <view v-if="panelOpen" class="panel">
        <view class="prow">
          <text class="lb">状态</text>
          <view class="chips">
            <text
              v-for="opt in statusOpts"
              :key="opt.value"
              class="chip"
              :class="{ on: status === opt.value }"
              @tap="setStatus(opt.value)"
            >{{ opt.label }}</text>
          </view>
        </view>
        <view v-if="isAdmin" class="prow">
          <text class="lb">归属</text>
          <view class="chips">
            <text class="chip" :class="{ on: !salesId }" @tap="setSales(0)">全部</text>
            <text
              v-for="s in salesOptions"
              :key="s.id"
              class="chip"
              :class="{ on: salesId === s.id }"
              @tap="setSales(s.id)"
            >{{ s.is_admin ? '管理员·' : '' }}{{ s.name }}</text>
          </view>
        </view>
        <view class="prow">
          <text class="lb">排序</text>
          <view class="chips">
            <text
              v-for="opt in sortOpts"
              :key="opt.value"
              class="chip"
              :class="{ on: orderBy === opt.value }"
              @tap="setSort(opt.value)"
            >{{ opt.label }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="sum">
      <text>已加载 <text class="sum-num">{{ list.length }}</text> 位客户</text>
      <text v-if="list.length">欠款合计 <text class="sum-owe">{{ formatMoney(totalDebt) }}</text></text>
    </view>

    <view class="list">
      <view v-if="list.length">
        <view
          v-for="c in list"
          :key="c.id"
          class="cust"
          :class="{ pending: c.status === 'pending' }"
          @tap="goDetail(c.id)"
        >
          <view class="c-hd">
            <view class="c-name">
              <text class="name">{{ c.name }}</text>
              <text v-if="c.level_nickname" class="tag tag-level">{{ c.level_nickname }}</text>
              <text class="tag" :class="`tag-${statusType(c.status)}`">{{ statusLabel(c.status) }}</text>
            </view>
            <view class="c-debt">
              <text class="debt" :class="owe(c) > 0 ? 'owe' : 'zero'">
                {{ owe(c) > 0 ? formatMoney(c.ar_balance) : '无欠款' }}
              </text>
              <text v-if="owe(c) > 0" class="debt-label">当前欠款</text>
            </view>
          </view>

          <view class="c-meta">
            <text class="town">{{ c.town || c.district || c.city || c.province || '未设送货地点' }}</text>
            <text class="sep">·</text>
            <text>{{ deliveryLabel(c.default_delivery_mode) }}</text>
            <text v-if="c.contact_name" class="sep">·</text>
            <text v-if="c.contact_name">{{ c.contact_name }}</text>
          </view>

          <view class="c-foot">
            <text class="who">
              {{ c.sales_name ? `归属 ${c.sales_name}` : '无归属销售' }}{{ c.referrer_customer_name ? ` · 介绍人 ${c.referrer_customer_name}` : '' }}
            </text>
            <view class="acts">
              <view v-if="isAdmin && c.status === 'pending'" class="mini ok" @tap.stop="goAudit()">审核</view>
              <view v-if="c.phone" class="mini call" @tap.stop="callPhone(c.phone)">📞 电话</view>
            </view>
          </view>
        </view>
      </view>
      <empty-state
        v-else-if="!loading"
        icon="👥"
        :text="hasFilter || keyword ? '没有符合条件的客户' : '暂无客户'"
        :action="hasFilter || keyword ? '清空筛选' : '去推广'"
        @action="hasFilter || keyword ? resetFilter() : goPromotion()"
      />
      <view v-if="loadingMore" class="load-more">加载中...</view>
      <view v-else-if="noMore && list.length" class="load-more">没有更多了</view>
      <view v-else-if="!loading && list.length" class="load-more" @tap="loadMore">上拉加载更多</view>
    </view>

    <view class="fab" @tap="openCreate">
      <text class="fab-plus">+</text>
      <text class="fab-text">新建客户</text>
    </view>

    <!-- 新建客户 -->
    <view v-if="createVisible" class="mask" @tap="closeCreate" @touchmove.stop.prevent />
    <view v-if="createVisible" class="sheet">
      <view class="sheet-hd" @touchmove.stop.prevent>
        <text class="sheet-title">新建客户</text>
        <text class="sheet-close" @tap="closeCreate">×</text>
      </view>
      <scroll-view scroll-y class="sheet-body" :show-scrollbar="false" @touchmove.stop>
        <view class="sheet-body-inner">
          <view class="fld">
            <text class="fld-label">客户名称 <text class="req">*</text></text>
            <input v-model="form.name" class="fld-input" cursor-spacing="24" placeholder="门店名 / 老板名" />
          </view>
          <view class="fld">
            <text class="fld-label">手机号 <text class="req">*</text></text>
            <input v-model="form.phone" class="fld-input" type="number" maxlength="11" cursor-spacing="24" placeholder="11 位手机号" />
            <text class="fld-hint">客户以后微信登录时，系统按手机号匹配到这个档案</text>
          </view>
          <view class="fld-row">
            <view class="fld fld-half">
              <text class="fld-label">联系人</text>
              <input v-model="form.contact_name" class="fld-input" cursor-spacing="24" placeholder="默认同客户名称" />
            </view>
            <view class="fld fld-half">
              <text class="fld-label">联系电话</text>
              <input v-model="form.contact_phone" class="fld-input" type="number" maxlength="20" cursor-spacing="24" placeholder="默认同手机号" />
            </view>
          </view>

          <view v-if="isAdmin && salesOptions.length" class="fld">
            <text class="fld-label">归属销售</text>
            <view class="chips">
              <text class="chip" :class="{ on: !form.sales_id }" @tap="form.sales_id = 0">默认自己</text>
              <text
                v-for="s in salesOptions"
                :key="s.id"
                class="chip"
                :class="{ on: form.sales_id === s.id }"
                @tap="form.sales_id = form.sales_id === s.id ? 0 : s.id"
              >{{ s.is_admin ? '管理员·' : '' }}{{ s.name }}</text>
            </view>
          </view>

          <view v-if="tags.length" class="fld">
            <text class="fld-label">客户标签</text>
            <view class="chips">
              <text class="chip" :class="{ on: !form.tag_id }" @tap="form.tag_id = 0">暂不填</text>
              <text
                v-for="t in tags"
                :key="t.id"
                class="chip"
                :class="{ on: form.tag_id === t.id }"
                @tap="form.tag_id = form.tag_id === t.id ? 0 : t.id"
              >{{ t.name }}</text>
            </view>
          </view>

          <view v-if="activeLevels.length" class="fld">
            <text class="fld-label">等级价格</text>
            <view class="chips">
              <text class="chip" :class="{ on: !form.level_id }" @tap="form.level_id = 0">默认售价</text>
              <text
                v-for="lv in activeLevels"
                :key="lv.id"
                class="chip"
                :class="{ on: form.level_id === lv.id }"
                @tap="form.level_id = form.level_id === lv.id ? 0 : lv.id"
              >{{ lv.nickname }}</text>
            </view>
          </view>

          <view v-if="referrerOptions.length" class="fld">
            <text class="fld-label">介绍人 / 拉新老客（选填，首单送达自动发拉新券）</text>
            <picker :range="referrerLabels" :value="referrerIndex" @change="onReferrerChange">
              <view class="fld-pick">
                <text :class="form.referrer_customer_id ? 'pick-val' : 'pick-ph'">
                  {{ referrerLabels[referrerIndex] || '无介绍人' }}
                </text>
              </view>
            </picker>
          </view>

          <view class="fld-sec">收货地点与配送</view>
          <view class="fld">
            <text class="fld-label">收货地点</text>
            <view class="fld-pick" @tap="openRegionPicker">
              <text :class="deliveryRegionText ? 'pick-val' : 'pick-ph'">
                {{ deliveryRegionText || '请选择省 / 市 / 县 / 乡镇' }}
              </text>
              <text v-if="form.delivery_region_id" class="pick-clear" @tap.stop="clearDeliveryRegion">×</text>
              <text v-else class="pick-arrow">›</text>
            </view>
            <text class="fld-hint">决定常用路线与物流线路匹配</text>
          </view>
          <view class="fld">
            <text class="fld-label">详细地址</text>
            <input v-model="form.detail_address" class="fld-input" cursor-spacing="24" placeholder="街道 / 门牌 / 摊位号" />
          </view>
          <view class="fld">
            <text class="fld-label">默认配送</text>
            <view class="chips">
              <text
                v-for="opt in deliveryModeOpts"
                :key="opt.value"
                class="chip"
                :class="{ on: form.default_delivery_mode === opt.value }"
                @tap="setDeliveryMode(opt.value)"
              >{{ opt.label }}</text>
            </view>
          </view>
          <view v-if="form.default_delivery_mode !== 'local'" class="fld">
            <text class="fld-label">默认物流线路</text>
            <view v-if="!form.delivery_region_id" class="fld-muted">请先选择收货地点，不设则按乡镇自动匹配</view>
            <view v-else-if="!matchedFreightLines.length" class="fld-muted">该收货地点暂无匹配的物流线路</view>
            <view v-else class="chips">
              <text class="chip" :class="{ on: !form.freight_line_id }" @tap="form.freight_line_id = 0">自动匹配</text>
              <text
                v-for="line in matchedFreightLines"
                :key="line.id"
                class="chip"
                :class="{ on: form.freight_line_id === line.id }"
                @tap="form.freight_line_id = form.freight_line_id === line.id ? 0 : line.id"
              >{{ line.name }}</text>
            </view>
          </view>
          <view v-if="form.default_delivery_mode !== 'local'" class="fld">
            <text class="fld-label">默认运费方式</text>
            <view class="chips">
              <text
                v-for="opt in freightModeOpts"
                :key="opt.value"
                class="chip"
                :class="{ on: form.default_freight_mode === opt.value }"
                @tap="form.default_freight_mode = opt.value"
              >{{ opt.label }}</text>
            </view>
          </view>

          <view class="sheet-tip">
            保存后客户直接生效（无需审核）；客户标签可不填，等级价格不选默认按「默认售价」计价。
          </view>
        </view>
      </scroll-view>
      <view class="sheet-ft">
        <button class="btn ghost" @tap="closeCreate">取消</button>
        <button class="btn primary" :disabled="saving" @tap="submitCreate">
          {{ saving ? '保存中...' : '保存' }}
        </button>
      </view>
    </view>

    <!-- 地区搜索与级联选择器（收货地点） -->
    <RegionPickerSheet v-model:visible="regionPickerVisible" @select="onSelectRegion" />
  </view>
</template>

<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch } from 'vue'
import { onHide, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import RegionPickerSheet from '@/components/RegionPickerSheet.vue'
import { customerApi, customerLevelApi, customerTagApi, deliveryApi, freightApi } from '@/api'
import type { CustomerLevel, CustomerTag } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { CUSTOMER_STATUS, DELIVERY_MODE, FREIGHT_MODE } from '@/utils/dict'
import { formatMoney, toNum } from '@/utils/format'
import type {
  Customer,
  CustomerStatus,
  DeliveryMode,
  FreightLine,
  FreightMode,
  RegionSelection,
  RouteTemplate,
  SalesOption,
} from '@/types'

const auth = useAuthStore()
const isAdmin = computed(() => auth.isAdmin)

const keyword = ref('')
const status = ref('')
const salesId = ref(0)
const routeTemplateId = ref(0)
const orderBy = ref('id')
const panelOpen = ref(false)

const list = ref<Customer[]>([])
const salesOptions = ref<SalesOption[]>([])
const routeTemplates = ref<RouteTemplate[]>([])
const levels = ref<CustomerLevel[]>([])
const tags = ref<CustomerTag[]>([])
const freightLines = ref<FreightLine[]>([])

const loading = ref(false)
const loadingMore = ref(false)
const noMore = ref(false)
const page = ref(1)
const PAGE_SIZE = 20

const statusOpts = [
  { label: '全部', value: '' },
  { label: '待审核', value: 'pending' },
  { label: '正常', value: 'active' },
  { label: '禁止下单', value: 'order_disabled' },
  { label: '禁止登录', value: 'login_disabled' },
]

const sortOpts = [
  { label: '默认', value: 'id' },
  { label: '欠款最多', value: 'debt' },
  { label: '欠款最少', value: 'debt_asc' },
  { label: '最近下单', value: 'last_order' },
  { label: '名称', value: 'name' },
]

const deliveryModeOpts: { label: string; value: DeliveryMode }[] = [
  { label: DELIVERY_MODE.route, value: 'route' },
  { label: DELIVERY_MODE.freight, value: 'freight' },
  { label: DELIVERY_MODE.local, value: 'local' },
]

const freightModeOpts: { label: string; value: Exclude<FreightMode, 'none'> }[] = [
  { label: FREIGHT_MODE.deduct, value: 'deduct' },
  { label: FREIGHT_MODE.store_paid, value: 'store_paid' },
  { label: FREIGHT_MODE.customer_paid, value: 'customer_paid' },
]

const activeLevels = computed(() =>
  levels.value.filter((l) => l.is_active && l.level_id !== 'walk_in' && l.level_id !== 'default_retail'),
)

const hasFilter = computed(
  () => !!status.value || !!salesId.value || !!routeTemplateId.value || orderBy.value !== 'id',
)
const totalDebt = computed(() => list.value.reduce((sum, c) => sum + owe(c), 0))

function owe(c: Customer) {
  return toNum(c.ar_balance)
}
function statusLabel(v: CustomerStatus) {
  return CUSTOMER_STATUS[v]?.label || v
}
function statusType(v: CustomerStatus) {
  return CUSTOMER_STATUS[v]?.type || 'grey'
}
function deliveryLabel(v?: string | null) {
  if (!v) return '未设配送方式'
  return DELIVERY_MODE[v as DeliveryMode] || v
}

function params(p: number) {
  return {
    page: p,
    page_size: PAGE_SIZE,
    keyword: keyword.value || undefined,
    status: status.value || undefined,
    sales_id: salesId.value || undefined,
    route_template_id: routeTemplateId.value || undefined,
    order_by: orderBy.value,
  }
}

async function reload() {
  page.value = 1
  noMore.value = false
  loading.value = true
  try {
    const items = await customerApi.list(params(1))
    list.value = items
    noMore.value = items.length < PAGE_SIZE
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (loading.value || loadingMore.value || noMore.value) return
  loadingMore.value = true
  try {
    const next = page.value + 1
    const items = await customerApi.list(params(next))
    list.value.push(...items)
    page.value = next
    noMore.value = items.length < PAGE_SIZE
  } finally {
    loadingMore.value = false
  }
}

function setRoute(id: number) {
  routeTemplateId.value = routeTemplateId.value === id ? 0 : id
  reload()
}
function setStatus(v: string) {
  status.value = status.value === v ? '' : v
  reload()
}
function setSales(id: number) {
  salesId.value = salesId.value === id ? 0 : id
  reload()
}
function setSort(v: string) {
  orderBy.value = v
  reload()
}
function clearKeyword() {
  keyword.value = ''
  reload()
}
function resetFilter() {
  keyword.value = ''
  status.value = ''
  salesId.value = 0
  routeTemplateId.value = 0
  orderBy.value = 'id'
  reload()
}

function goDetail(id: number) {
  uni.navigateTo({ url: `/pages/customers/detail?id=${id}` })
}
function goPromotion() {
  uni.navigateTo({ url: '/pages/promotion/index' })
}
function goAudit() {
  uni.navigateTo({ url: '/pages/home/approvals/customer' })
}
function callPhone(phone: string) {
  uni.makePhoneCall({ phoneNumber: phone })
}

/* ---------- 新建客户（字段与 Web 管理端一致） ---------- */
const createVisible = ref(false)
const saving = ref(false)

function defaultForm() {
  return {
    name: '',
    phone: '',
    contact_name: '',
    contact_phone: '',
    tag_id: 0,
    sales_id: 0,
    referrer_customer_id: 0,
    level_id: 0,
    province: '',
    city: '',
    district: '',
    town: '',
    detail_address: '',
    address: '',
    default_delivery_mode: 'route' as DeliveryMode,
    delivery_region_id: 0,
    freight_line_id: 0,
    default_freight_mode: 'deduct' as Exclude<FreightMode, 'none'>,
  }
}

const form = reactive(defaultForm())
const deliveryRegionText = ref('')
const referrerOptions = ref<Customer[]>([])
const referrerIndex = ref(0)
const referrerLabels = computed(() => [
  '无介绍人',
  ...referrerOptions.value.map((c) => `${c.name}${c.phone ? `（${c.phone.slice(-4)}）` : ''}`),
])
function onReferrerChange(e: { detail: { value: number | string } }) {
  const idx = Number(e.detail.value)
  referrerIndex.value = idx
  form.referrer_customer_id = idx > 0 ? (referrerOptions.value[idx - 1]?.id ?? 0) : 0
}

const matchedFreightLines = computed(() => {
  if (!form.delivery_region_id) return []
  return freightLines.value.filter(
    (line) =>
      line.is_active &&
      line.stops.some((stop) => stop.town_region_id === form.delivery_region_id),
  )
})

function setDeliveryMode(mode: DeliveryMode) {
  form.default_delivery_mode = mode
  if (mode === 'local') form.freight_line_id = 0
}

function clearDeliveryRegion() {
  form.delivery_region_id = 0
  form.province = ''
  form.city = ''
  form.district = ''
  form.town = ''
  deliveryRegionText.value = ''
  form.freight_line_id = 0
}

/* ---------- 地区搜索与级联选择器 ---------- */
const regionPickerVisible = ref(false)

function openRegionPicker() {
  regionPickerVisible.value = true
}

function onSelectRegion(sel: RegionSelection) {
  form.delivery_region_id = sel.id
  form.province = sel.province
  form.city = sel.city
  form.district = sel.district
  form.town = sel.town
  deliveryRegionText.value = sel.full_name
  if (form.freight_line_id) {
    const line = freightLines.value.find((l) => l.id === form.freight_line_id)
    if (!line || !line.stops.some((s) => s.town_region_id === form.delivery_region_id)) {
      form.freight_line_id = 0
    }
  }
}

function setBodyScrollLock(locked: boolean) {
  // #ifdef H5
  if (typeof document !== 'undefined') {
    const val = locked ? 'hidden' : ''
    document.documentElement.style.overflow = val
    document.body.style.overflow = val
  }
  // #endif
}

watch([createVisible, regionPickerVisible], ([a, b]) => {
  setBodyScrollLock(a || b)
})

async function ensureCreateOptions() {
  const tasks: Promise<unknown>[] = []
  if (!freightLines.value.length) {
    tasks.push(
      freightApi.lines(true).then((res) => {
        freightLines.value = res
      }).catch(() => {}),
    )
  }
  if (!levels.value.length) {
    tasks.push(
      customerLevelApi.list().then((res) => {
        levels.value = res
      }).catch(() => {}),
    )
  }
  if (!tags.value.length) {
    tasks.push(
      customerTagApi.list({ is_active: true }).then((res) => {
        tags.value = res
      }).catch(() => {}),
    )
  }
  if (!referrerOptions.value.length) {
    tasks.push(
      customerApi.list({ status: 'active', page: 1, page_size: 200 }).then((res) => {
        referrerOptions.value = res.filter((c) => !c.is_system)
      }).catch(() => {}),
    )
  }
  if (tasks.length) await Promise.all(tasks)
}

function openCreate() {
  createVisible.value = true
  ensureCreateOptions()
}
function closeCreate() {
  regionPickerVisible.value = false
  createVisible.value = false
}
async function submitCreate() {
  if (saving.value) return
  const name = String(form.name ?? '').trim()
  const phone = String(form.phone ?? '').replace(/\s+/g, '')
  const contactName = String(form.contact_name ?? '').trim()
  const contactPhone = String(form.contact_phone ?? '').replace(/\s+/g, '')
  const town = String(form.town ?? '').trim()
  const detailAddress = String(form.detail_address ?? '').trim()

  if (!name) return uni.showToast({ title: '请填写客户名称', icon: 'none' })
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return uni.showToast({ title: '手机号格式不对（需11位手机号）', icon: 'none' })
  }
  saving.value = true
  try {
    const composedAddress =
      [form.province, form.city, form.district, town, detailAddress]
        .filter(Boolean)
        .join('') || null
    const isLocal = form.default_delivery_mode === 'local'
    const res = await customerApi.create({
      name,
      phone,
      contact_name: contactName || null,
      contact_phone: contactPhone || null,
      tag_id: form.tag_id || null,
      sales_id: isAdmin.value && form.sales_id ? form.sales_id : null,
      referrer_customer_id: form.referrer_customer_id || null,
      level_id: form.level_id || null,
      province: form.province || null,
      city: form.city || null,
      district: form.district || null,
      town: town || null,
      detail_address: detailAddress || null,
      address: composedAddress,
      default_delivery_mode: form.default_delivery_mode,
      delivery_region_id: form.delivery_region_id || null,
      freight_line_id: isLocal ? null : form.freight_line_id || null,
      default_freight_mode: isLocal ? 'deduct' : form.default_freight_mode,
    })
    closeCreate()
    const tip = res?.warnings?.[0]?.message || '已创建并生效'
    uni.showToast({ title: tip, icon: 'none' })
    Object.assign(form, defaultForm())
    deliveryRegionText.value = ''
    referrerIndex.value = 0
    if (res?.customer?.id) goDetail(res.customer.id)
    else reload()
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string; body?: { details?: { customer_id?: number; status?: string; name?: string }; data?: { customer_id?: number; status?: string; name?: string } } }
    const info = e?.body?.details || e?.body?.data
    if (e?.status === 409 && info?.status === 'pending' && info?.customer_id) {
      const targetId = info.customer_id
      const targetName = info.name || phone
      uni.showModal({
        title: '该客户已扫码待审核',
        content: `手机号已由「${targetName}」扫码注册，是否直接去补全资料并审核通过？`,
        confirmText: '去审核',
        success: (r) => {
          if (r.confirm) {
            closeCreate()
            uni.navigateTo({ url: `/pages/home/approvals/customer?customer_id=${targetId}` })
          }
        },
      })
    } else if (!e?.status) {
      console.error('[submitCreate] failed:', err)
      uni.showToast({ title: e?.message || '保存失败，请重试', icon: 'none' })
    }
  } finally {
    saving.value = false
  }
}

async function loadSalesOptions() {
  if (!isAdmin.value || salesOptions.value.length) return
  try {
    salesOptions.value = await customerApi.salesOptions()
  } catch {
    salesOptions.value = []
  }
}

async function loadRouteTemplates() {
  if (routeTemplates.value.length) return
  try {
    routeTemplates.value = await deliveryApi.templates(true)
  } catch {
    routeTemplates.value = []
  }
}

onShow(async () => {
  await Promise.all([loadSalesOptions(), loadRouteTemplates()])
  await reload()
})
onHide(() => {
  regionPickerVisible.value = false
  createVisible.value = false
  setBodyScrollLock(false)
})
onUnmounted(() => {
  setBodyScrollLock(false)
})
onPullDownRefresh(async () => {
  await reload()
  uni.stopPullDownRefresh()
})
onReachBottom(() => {
  loadMore()
})
</script>

<style lang="scss" scoped>
.customers-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}

/* 搜索与筛选 */
.tools {
  position: sticky;
  top: 0;
  z-index: 20;
  background: #fff;
  padding: calc(var(--status-bar-height, 0px) + 16rpx) 20rpx 12rpx;
}
.search-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.search-box {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10rpx;
  height: 72rpx;
  padding: 0 24rpx;
  background: #f3f5f9;
  border-radius: 36rpx;
}
.search-icon {
  font-size: 24rpx;
  opacity: 0.5;
}
.search-input {
  flex: 1;
  font-size: 26rpx;
  color: #1f2937;
}
.clear {
  font-size: 32rpx;
  color: #9ca3af;
  padding: 0 4rpx;
}
.filter-btn {
  position: relative;
  flex: none;
  height: 64rpx;
  padding: 0 22rpx;
  display: flex;
  align-items: center;
  border: 2rpx solid #e6ebf2;
  border-radius: 32rpx;
  font-size: 24rpx;
  color: #4b5563;
}
.filter-btn.on {
  border-color: rgba(37, 99, 235, 0.35);
  color: #2563eb;
  background: #f2f7ff;
}
.filter-btn .dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: #ef4444;
  margin-left: 6rpx;
}
.panel {
  margin-top: 14rpx;
  padding: 16rpx 18rpx;
  background: #fafbfd;
  border-radius: 16rpx;
}
.prow {
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
  padding: 8rpx 0;
}
.prow + .prow {
  border-top: 1rpx dashed #eef1f6;
}
.lb {
  flex: none;
  width: 72rpx;
  font-size: 22rpx;
  color: #8d99aa;
  padding-top: 6rpx;
}
.chips {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}
.chip {
  padding: 6rpx 18rpx;
  border-radius: 24rpx;
  background: #f1f4f9;
  color: #5f6d82;
  font-size: 22rpx;
}
.chip.on {
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
  font-weight: 600;
}

/* 汇总 */
.sum {
  display: flex;
  justify-content: space-between;
  padding: 12rpx 24rpx;
  font-size: 22rpx;
  color: #8d99aa;
}
.sum-num {
  color: #1f2937;
  font-weight: 600;
}
.sum-owe {
  color: #c9343d;
  font-weight: 700;
}

/* 客户卡 */
.list {
  flex: 1;
  padding-bottom: 160rpx;
}
.cust {
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  margin: 0 20rpx 16rpx;
  box-shadow: 0 4rpx 14rpx rgba(22, 35, 58, 0.05);
}
.cust.pending {
  box-shadow: 0 4rpx 14rpx rgba(22, 35, 58, 0.05), inset 0 0 0 2rpx rgba(214, 158, 46, 0.28);
}
.c-hd {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
}
.c-name {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8rpx;
}
.name {
  font-size: 30rpx;
  font-weight: 600;
  color: #1f2937;
}
.tag {
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
  line-height: 1.6;
}
.tag-level {
  background: rgba(37, 99, 235, 0.08);
  color: #2563eb;
}
.tag-success {
  background: rgba(22, 163, 74, 0.1);
  color: #16a34a;
}
.tag-warning {
  background: rgba(234, 88, 12, 0.1);
  color: #ea580c;
}
.tag-danger {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}
.tag-grey {
  background: #f3f4f6;
  color: #6b7280;
}
.c-debt {
  flex: none;
  text-align: right;
}
.debt {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #1f2937;
}
.debt.owe {
  color: #c9343d;
}
.debt.zero {
  font-size: 24rpx;
  font-weight: 500;
  color: #9aa6b6;
}
.debt-label {
  font-size: 19rpx;
  color: #a3aebd;
}
.c-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 12rpx;
  font-size: 23rpx;
  color: #7d8ba0;
}
.c-meta .town {
  color: #4b5563;
  font-weight: 600;
}
.c-meta .sep {
  color: #d4dae3;
}
.c-foot {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 16rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid #f2f5f9;
}
.who {
  flex: 1;
  min-width: 0;
  font-size: 21rpx;
  color: #9aa6b6;
}
.acts {
  display: flex;
  gap: 12rpx;
}
.mini {
  height: 52rpx;
  padding: 0 20rpx;
  display: flex;
  align-items: center;
  border-radius: 26rpx;
  font-size: 22rpx;
  font-weight: 600;
}
.mini.call {
  color: #2563eb;
  background: #f2f7ff;
}
.mini.ok {
  color: #fff;
  background: #2563eb;
}

/* 空态与加载 */
.load-more {
  text-align: center;
  padding: 24rpx 0 8rpx;
  font-size: 22rpx;
  color: #a9b4c2;
}

/* FAB */
.fab {
  position: fixed;
  right: 32rpx;
  bottom: 140rpx;
  height: 88rpx;
  padding: 0 30rpx 0 24rpx;
  display: flex;
  align-items: center;
  gap: 10rpx;
  border-radius: 44rpx;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  box-shadow: 0 12rpx 28rpx rgba(37, 99, 235, 0.32);
  color: #fff;
}
.fab-plus {
  font-size: 36rpx;
  line-height: 1;
}
.fab-text {
  font-size: 25rpx;
  font-weight: 600;
}

/* 新建客户弹层 */
.mask {
  position: fixed;
  inset: 0;
  background: rgba(16, 25, 42, 0.42);
  z-index: 999;
}
.sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 28rpx 28rpx 0 0;
  overflow: hidden;
}
.sheet-hd {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx 20rpx;
  border-bottom: 1rpx solid #f2f5f9;
}
.sheet-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1f2937;
}
.sheet-close {
  font-size: 40rpx;
  line-height: 1;
  color: #b3bdcb;
  padding: 0 8rpx;
}
.sheet-body {
  height: 60vh;
  max-height: calc(86vh - 220rpx);
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}
.sheet-body-inner {
  padding: 20rpx 32rpx 24rpx;
}
.fld {
  margin-bottom: 22rpx;
}
.fld-label {
  display: block;
  font-size: 23rpx;
  color: #7d8ba0;
  margin-bottom: 10rpx;
  font-weight: 600;
}
.req {
  color: #ef4444;
}
.fld-input {
  width: 100%;
  height: 76rpx;
  padding: 0 22rpx;
  background: #fbfcfe;
  border: 2rpx solid #e8ecf2;
  border-radius: 14rpx;
  font-size: 26rpx;
  color: #1f2937;
}
.fld-hint {
  display: block;
  margin-top: 8rpx;
  font-size: 20rpx;
  color: #a3aebd;
  line-height: 1.5;
}
.sheet-tip {
  font-size: 21rpx;
  color: #8d99aa;
  line-height: 1.6;
  padding: 4rpx 0 12rpx;
}
.sheet-ft {
  flex: none;
  display: flex;
  gap: 18rpx;
  padding: 16rpx 32rpx calc(24rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #f2f5f9;
  background: #fff;
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

/* 常用路线快捷栏 */
.route-bar {
  margin-top: 12rpx;
  white-space: nowrap;
}
.route-line {
  display: inline-flex;
  gap: 12rpx;
  padding-bottom: 4rpx;
}
.rchip {
  flex: none;
  padding: 8rpx 22rpx;
  border-radius: 26rpx;
  background: #f3f5f9;
  color: #5f6d82;
  font-size: 23rpx;
}
.rchip.on {
  background: rgba(37, 99, 235, 0.12);
  color: #2563eb;
  font-weight: 600;
}

/* 新建客户扩展字段 */
.fld-row {
  display: flex;
  gap: 16rpx;
}
.fld-half {
  flex: 1;
  min-width: 0;
}
.fld-sec {
  margin: 26rpx 0 16rpx;
  padding-top: 18rpx;
  border-top: 1rpx dashed #e8ecf2;
  font-size: 24rpx;
  font-weight: 700;
  color: #374151;
}
.fld-textarea {
  width: 100%;
  min-height: 112rpx;
  padding: 16rpx 22rpx;
  background: #fbfcfe;
  border: 2rpx solid #e8ecf2;
  border-radius: 14rpx;
  font-size: 26rpx;
  color: #1f2937;
  line-height: 1.5;
}
.fld-pick {
  width: 100%;
  min-height: 76rpx;
  padding: 16rpx 22rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  background: #fbfcfe;
  border: 2rpx solid #e8ecf2;
  border-radius: 14rpx;
  font-size: 26rpx;
}
.pick-val {
  flex: 1;
  min-width: 0;
  color: #1f2937;
}
.pick-ph {
  flex: 1;
  color: #9ca3af;
}
.pick-arrow {
  font-size: 32rpx;
  color: #9ca3af;
  line-height: 1;
}
.pick-clear {
  font-size: 32rpx;
  color: #9ca3af;
  padding: 0 6rpx;
  line-height: 1;
}
.fld-muted {
  padding: 14rpx 20rpx;
  background: #f8fafc;
  border-radius: 12rpx;
  font-size: 22rpx;
  color: #94a3b8;
}

/* 地区级联弹层 */
.mask-sub {
  z-index: 1001;
}
.sheet-sub {
  z-index: 1002;
}
.rp-crumbs {
  flex: none;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8rpx;
  padding: 16rpx 32rpx;
  background: #f8fafc;
  border-bottom: 1rpx solid #f1f5f9;
  font-size: 24rpx;
}
.rp-crumb {
  color: #64748b;
}
.rp-crumb.on {
  color: #2563eb;
  font-weight: 600;
}
.rp-sep {
  color: #cbd5e1;
}
.rp-body {
  height: 52vh;
  max-height: calc(82vh - 280rpx);
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}
.rp-list {
  padding: 8rpx 0 20rpx;
}
.rp-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 32rpx;
  border-bottom: 1rpx solid #f4f6f9;
  font-size: 27rpx;
  color: #1f2937;
}
.rp-arrow {
  font-size: 32rpx;
  color: #9ca3af;
}
.rp-empty {
  padding: 64rpx 32rpx;
  text-align: center;
  font-size: 24rpx;
  color: #94a3b8;
}
</style>
