<template>
  <page-meta :page-style="createVisible || regionPickerVisible || activeDropdown ? 'overflow: hidden;' : ''" />
  <view class="customers-page">
    <view class="tools">
      <view class="search-box">
        <view class="search-icon" />
        <input
          v-model="keyword"
          class="search-input"
          placeholder="搜索客户名称 / 手机号"
          confirm-type="search"
          @confirm="reload"
        />
        <text v-if="keyword" class="clear" @tap="clearKeyword">×</text>
      </view>

      <!-- 单行多维筛选条 -->
      <view class="filter-bar">
        <view
          class="f-item"
          :class="{ hl: !!routeTemplateId || !!tripDay || activeDropdown === 'route' }"
          @tap="toggleDropdown('route')"
        >
          <text class="f-text">{{ routeLabel }}</text>
          <view class="caret" :class="{ up: activeDropdown === 'route' }" />
        </view>
        <view
          v-if="isAdmin"
          class="f-item"
          :class="{ hl: !!salesId || activeDropdown === 'sales' }"
          @tap="toggleDropdown('sales')"
        >
          <text class="f-text">{{ salesLabel }}</text>
          <view class="caret" :class="{ up: activeDropdown === 'sales' }" />
        </view>
        <view
          class="f-item"
          :class="{ hl: !!status || activeDropdown === 'status' }"
          @tap="toggleDropdown('status')"
        >
          <text class="f-text">{{ statusText }}</text>
          <view class="caret" :class="{ up: activeDropdown === 'status' }" />
        </view>
        <view
          class="f-item"
          :class="{ hl: orderBy !== 'id' || activeDropdown === 'sort' }"
          @tap="toggleDropdown('sort')"
        >
          <text class="f-text">{{ sortLabel }}</text>
          <view class="caret" :class="{ up: activeDropdown === 'sort' }" />
        </view>
      </view>

      <view v-if="activeDropdown" class="dropdown-panel">
        <scroll-view scroll-y class="dropdown-scroll" :show-scrollbar="false">
          <template v-if="activeDropdown === 'route'">
            <view class="dropdown-item" :class="{ on: !routeTemplateId && !tripDay }" @tap="pickRoute(0)">
              <text class="d-text">全部路线</text>
              <text v-if="!routeTemplateId && !tripDay" class="d-check">✓</text>
            </view>
            <view class="dropdown-sec">按出车日期</view>
            <view
              v-for="opt in tripDayOpts"
              :key="opt.value"
              class="dropdown-item"
              :class="{ on: tripDay === opt.value }"
              @tap="pickTripDay(opt.value)"
            >
              <view class="d-text-row">
                <text class="d-text">{{ opt.label }}</text>
                <text class="d-sub">{{ opt.dateText }}</text>
              </view>
              <text v-if="tripDay === opt.value" class="d-check">✓</text>
            </view>
            <view v-if="routeTemplates.length" class="dropdown-sec">常用路线</view>
            <view
              v-for="r in routeTemplates"
              :key="r.id"
              class="dropdown-item"
              :class="{ on: routeTemplateId === r.id }"
              @tap="pickRoute(r.id)"
            >
              <text class="d-text">{{ r.name }}</text>
              <text v-if="routeTemplateId === r.id" class="d-check">✓</text>
            </view>
          </template>

          <template v-else-if="activeDropdown === 'sales'">
            <view class="dropdown-item" :class="{ on: !salesId }" @tap="pickSales(0)">
              <text class="d-text">全部归属</text>
              <text v-if="!salesId" class="d-check">✓</text>
            </view>
            <view
              v-for="s in salesOptions"
              :key="s.id"
              class="dropdown-item"
              :class="{ on: salesId === s.id }"
              @tap="pickSales(s.id)"
            >
              <text class="d-text">{{ s.is_admin ? `管·${s.name}` : s.name }}</text>
              <text v-if="salesId === s.id" class="d-check">✓</text>
            </view>
          </template>

          <template v-else-if="activeDropdown === 'status'">
            <view
              v-for="opt in statusOpts"
              :key="opt.value"
              class="dropdown-item"
              :class="{ on: status === opt.value }"
              @tap="pickStatus(opt.value)"
            >
              <text class="d-text">{{ opt.label }}</text>
              <text v-if="status === opt.value" class="d-check">✓</text>
            </view>
          </template>

          <template v-else>
            <view
              v-for="opt in sortOpts"
              :key="opt.value"
              class="dropdown-item"
              :class="{ on: orderBy === opt.value }"
              @tap="pickSort(opt.value)"
            >
              <text class="d-text">{{ opt.label }}</text>
              <text v-if="orderBy === opt.value" class="d-check">✓</text>
            </view>
          </template>
        </scroll-view>
      </view>
    </view>

    <view v-if="activeDropdown" class="dropdown-mask" @tap="closeDropdown" @touchmove.stop.prevent />

    <view class="sum">
      <text>已加载 {{ list.length }} 位<text v-if="list.length"> · 欠款 <text class="sum-owe">{{ formatMoney(totalDebt) }}</text></text></text>
      <text v-if="hasFilter || keyword" class="sum-reset" @tap="resetFilter">重置筛选</text>
    </view>

    <view class="list">
      <view v-if="list.length" class="cust-list">
        <view
          v-for="c in list"
          :key="c.id"
          class="cust-row"
          :class="{ pending: c.status === 'pending' }"
          @tap="goDetail(c.id)"
        >
          <view class="row-top">
            <view class="row-title">
              <text class="name">{{ c.name }}</text>
              <text v-if="c.level_nickname" class="badge badge-level">{{ c.level_nickname }}</text>
              <text
                v-if="c.status !== 'active'"
                class="badge"
                :class="`badge-${statusType(c.status)}`"
              >{{ statusLabel(c.status) }}</text>
            </view>
            <view class="row-debt">
              <text v-if="owe(c) > 0" class="debt-amt">{{ formatMoney(c.ar_balance) }}</text>
              <text v-else class="debt-none">无欠款</text>
            </view>
          </view>

          <view class="row-sub">
            <view class="row-meta">
              <text class="town">{{ c.town || c.district || c.city || c.province || '未设地点' }}</text>
              <text> · {{ deliveryLabel(c.default_delivery_mode) }}</text>
              <text v-if="c.contact_name"> · {{ c.contact_name }}</text>
              <text v-if="c.sales_name"> · {{ c.sales_name }}</text>
              <text v-if="c.referrer_customer_name"> · 荐:{{ c.referrer_customer_name }}</text>
            </view>
            <view class="row-acts">
              <view v-if="isAdmin && c.status === 'pending'" class="a-btn audit" @tap.stop="goAudit()">审核</view>
              <view v-if="c.phone" class="a-btn call" @tap.stop="callPhone(c.phone)">拨号</view>
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

type TripDayKey = '' | 'today' | 'tomorrow' | 'after_tomorrow'

const keyword = ref('')
const status = ref('')
const salesId = ref(0)
const routeTemplateId = ref(0)
const tripDay = ref<TripDayKey>('')
const orderBy = ref('id')

type DropdownKey = '' | 'route' | 'sales' | 'status' | 'sort'
const activeDropdown = ref<DropdownKey>('')

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
  { label: '全部状态', value: '' },
  { label: '待审核', value: 'pending' },
  { label: '正常', value: 'active' },
  { label: '禁止下单', value: 'order_disabled' },
  { label: '禁止登录', value: 'login_disabled' },
]

const sortOpts = [
  { label: '默认排序', value: 'id' },
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

function offsetDate(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}
function formatYmd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function formatMd(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${m}-${day}`
}

const tripDayOpts = computed(() => [
  { value: 'today' as const, label: '今天出车', offset: 0, dateText: formatMd(offsetDate(0)) },
  { value: 'tomorrow' as const, label: '明天出车', offset: 1, dateText: formatMd(offsetDate(1)) },
  { value: 'after_tomorrow' as const, label: '后天出车', offset: 2, dateText: formatMd(offsetDate(2)) },
])

const hasFilter = computed(
  () => !!status.value || !!salesId.value || !!routeTemplateId.value || !!tripDay.value || orderBy.value !== 'id',
)
const totalDebt = computed(() => list.value.reduce((sum, c) => sum + owe(c), 0))

const routeLabel = computed(() => {
  if (tripDay.value) {
    return tripDayOpts.value.find((o) => o.value === tripDay.value)?.label || '全部路线'
  }
  if (!routeTemplateId.value) return '全部路线'
  return routeTemplates.value.find((r) => r.id === routeTemplateId.value)?.name || '全部路线'
})
const salesLabel = computed(() => {
  if (!salesId.value) return '全部归属'
  const s = salesOptions.value.find((it) => it.id === salesId.value)
  if (!s) return '全部归属'
  return s.is_admin ? `管·${s.name}` : s.name
})
const statusText = computed(() =>
  status.value ? statusLabel(status.value as CustomerStatus) : '全部状态',
)
const sortLabel = computed(
  () => sortOpts.find((o) => o.value === orderBy.value)?.label || '默认排序',
)

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
  const tripOpt = tripDay.value ? tripDayOpts.value.find((o) => o.value === tripDay.value) : undefined
  return {
    page: p,
    page_size: PAGE_SIZE,
    keyword: keyword.value || undefined,
    status: status.value || undefined,
    sales_id: salesId.value || undefined,
    route_template_id: routeTemplateId.value || undefined,
    trip_date: tripOpt ? formatYmd(offsetDate(tripOpt.offset)) : undefined,
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

function toggleDropdown(key: Exclude<DropdownKey, ''>) {
  activeDropdown.value = activeDropdown.value === key ? '' : key
}
function closeDropdown() {
  activeDropdown.value = ''
}
function pickRoute(id: number) {
  routeTemplateId.value = id
  tripDay.value = ''
  closeDropdown()
  reload()
}
function pickTripDay(day: Exclude<TripDayKey, ''>) {
  tripDay.value = day
  routeTemplateId.value = 0
  closeDropdown()
  reload()
}
function pickSales(id: number) {
  salesId.value = id
  closeDropdown()
  reload()
}
function pickStatus(v: string) {
  status.value = v
  closeDropdown()
  reload()
}
function pickSort(v: string) {
  orderBy.value = v
  closeDropdown()
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
  tripDay.value = ''
  orderBy.value = 'id'
  closeDropdown()
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

watch([createVisible, regionPickerVisible, activeDropdown], ([a, b, d]) => {
  setBodyScrollLock(a || b || !!d)
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
  activeDropdown.value = ''
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
  activeDropdown.value = ''
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

/* 紧凑搜索栏 */
.tools {
  position: sticky;
  top: 0;
  z-index: 20;
  background: #fff;
  padding: calc(var(--status-bar-height, 0px) + 12rpx) 20rpx 10rpx;
}
.search-box {
  display: flex;
  align-items: center;
  gap: 12rpx;
  height: 64rpx;
  padding: 0 24rpx;
  background: #f3f5f9;
  border-radius: 32rpx;
}
.search-icon {
  position: relative;
  flex: none;
  width: 24rpx;
  height: 24rpx;
  border: 3rpx solid #9aa6b6;
  border-radius: 50%;
}
.search-icon::after {
  content: '';
  position: absolute;
  right: -7rpx;
  bottom: -5rpx;
  width: 11rpx;
  height: 3rpx;
  background: #9aa6b6;
  border-radius: 2rpx;
  transform: rotate(45deg);
}
.search-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  font-size: 25rpx;
  color: #1f2937;
}
.clear {
  flex: none;
  font-size: 30rpx;
  line-height: 1;
  color: #9ca3af;
  padding: 0 4rpx;
}

/* 单行多维筛选条 */
.filter-bar {
  display: flex;
  align-items: center;
  height: 68rpx;
  margin: 10rpx -20rpx -10rpx;
  background: #fff;
  border-bottom: 1rpx solid #eef1f6;
}
.f-item {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 8rpx;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
}
.f-text {
  display: block;
  min-width: 0;
  max-width: 100%;
  padding: 0 2rpx;
  font-size: 24rpx;
  color: #4b5563;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.caret {
  flex: none;
  width: 0;
  height: 0;
  border-left: 8rpx solid transparent;
  border-right: 8rpx solid transparent;
  border-top: 9rpx solid #9aa6b6;
  transition: transform 0.18s ease;
}
.caret.up {
  transform: rotate(180deg);
}
.f-item.hl .f-text {
  color: #2563eb;
  font-weight: 600;
}
.f-item.hl .caret {
  border-top-color: #2563eb;
}

/* 下拉浮层 */
.dropdown-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 19;
  background: rgba(15, 23, 42, 0.28);
}
.dropdown-panel {
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  z-index: 30;
  background: #fff;
  border-radius: 0 0 20rpx 20rpx;
  box-shadow: 0 12rpx 32rpx rgba(15, 23, 42, 0.1);
  overflow: hidden;
}
.dropdown-scroll {
  max-height: 52vh;
}
.dropdown-sec {
  padding: 14rpx 32rpx 8rpx;
  font-size: 21rpx;
  color: #9aa6b6;
  background: #f8fafc;
  border-bottom: 1rpx solid #f3f5f8;
}
.dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 84rpx;
  padding: 0 32rpx;
  border-bottom: 1rpx solid #f3f5f8;
  box-sizing: border-box;
}
.d-text-row {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.d-text-row .d-text {
  flex: none;
}
.d-sub {
  flex: none;
  font-size: 22rpx;
  color: #9aa6b6;
}
.dropdown-item:last-child {
  border-bottom: none;
}
.dropdown-item.on {
  background: #f5f9ff;
}
.d-text {
  flex: 1;
  min-width: 0;
  font-size: 26rpx;
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dropdown-item.on .d-text {
  color: #2563eb;
  font-weight: 600;
}
.d-check {
  flex: none;
  margin-left: 16rpx;
  font-size: 26rpx;
  color: #2563eb;
}

/* 新建客户弹窗内的胶囊选择 */
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

/* 紧凑汇总条 */
.sum {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 10rpx 24rpx;
  background: #f5f7fa;
  font-size: 22rpx;
  color: #6b7280;
}
.sum-owe {
  color: #c9343d;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.sum-reset {
  flex: none;
  color: #2563eb;
}

/* 高密度客户列表 */
.list {
  flex: 1;
  padding-bottom: 160rpx;
}
.cust-list {
  background: #fff;
  border-top: 1rpx solid #eef1f6;
  border-bottom: 1rpx solid #eef1f6;
}
.cust-row {
  padding: 18rpx 24rpx;
  border-bottom: 1rpx solid #f0f3f7;
}
.cust-row:last-child {
  border-bottom: none;
}
.cust-row:active {
  background: #f8fafc;
}
.cust-row.pending {
  padding-left: 18rpx;
  border-left: 6rpx solid #f59e0b;
  background: #fffdf7;
}
.row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.row-title {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.name {
  display: block;
  flex: 0 1 auto;
  min-width: 0;
  font-size: 28rpx;
  font-weight: 600;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.badge {
  flex: none;
  font-size: 19rpx;
  line-height: 1.5;
  padding: 2rpx 8rpx;
  border-radius: 6rpx;
}
.badge-level {
  background: rgba(37, 99, 235, 0.08);
  color: #2563eb;
}
.badge-warning {
  background: rgba(245, 158, 11, 0.12);
  color: #b45309;
}
.badge-danger {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}
.badge-grey {
  background: #f3f4f6;
  color: #6b7280;
}
.row-debt {
  flex: none;
}
.debt-amt {
  font-size: 28rpx;
  font-weight: 700;
  color: #c9343d;
  font-variant-numeric: tabular-nums;
}
.debt-none {
  font-size: 22rpx;
  font-weight: 400;
  color: #b0b8c5;
}
.row-sub {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 8rpx;
}
.row-meta {
  flex: 1;
  min-width: 0;
  font-size: 22rpx;
  color: #8c96a6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row-meta .town {
  color: #4b5563;
  font-weight: 500;
}
.row-acts {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10rpx;
}
.a-btn {
  height: 44rpx;
  padding: 0 16rpx;
  display: flex;
  align-items: center;
  border-radius: 22rpx;
  font-size: 21rpx;
  font-weight: 600;
  line-height: 1;
  box-sizing: border-box;
}
.a-btn.audit {
  background: #2563eb;
  color: #fff;
}
.a-btn.call {
  background: #eff6ff;
  color: #2563eb;
  border: 1rpx solid rgba(37, 99, 235, 0.16);
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
  right: 28rpx;
  bottom: 130rpx;
  z-index: 15;
  height: 76rpx;
  padding: 0 26rpx 0 20rpx;
  display: flex;
  align-items: center;
  gap: 10rpx;
  border-radius: 38rpx;
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

</style>
