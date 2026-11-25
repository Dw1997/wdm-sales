<template>
  <view class="plan-page">
    <scroll-view scroll-y class="content">
      <view class="wrap">
        <!-- 1 出车日期 -->
        <view class="card">
          <view class="label">
            <text class="lb">出车日期</text>
            <text class="ls">最早今天</text>
          </view>
          <view class="days">
            <view
              v-for="d in dateOptions"
              :key="d.value"
              class="day"
              :class="{ on: date === d.value }"
              @tap="date = d.value"
            >
              <text class="day-t">{{ d.label }}</text>
              <text class="day-s">{{ d.sub }}</text>
            </view>
            <picker class="day-picker" mode="date" :value="date" :start="today" @change="onPickDate">
              <view class="day" :class="{ on: !dateOptions.some((d) => d.value === date) }">
                <text class="day-t">选日期</text>
                <text class="day-s">{{ dateOptions.some((d) => d.value === date) ? '其他日期' : cnDate(date).slice(0, 5) }}</text>
              </view>
            </picker>
          </view>
          <view class="named">
            <text class="named-lb">出车名称</text>
            <input
              v-model="tripName"
              class="named-inp"
              maxlength="50"
              placeholder="选填，默认使用路线名称"
              placeholder-style="color:#a8b3c2"
            />
          </view>
          <text class="hint">{{ dateHint }}</text>
        </view>

        <!-- 2 常用路线 -->
        <view class="card">
          <view class="label">
            <text class="lb">常用路线</text>
            <text class="ls">仅读，Web 端维护</text>
          </view>
          <scroll-view scroll-x class="routes">
            <view class="route" :class="{ on: templateId === null }" @tap="pickTemplate(null)">
              <text class="route-n">不选路线</text>
            </view>
            <view
              v-for="t in templates"
              :key="t.id"
              class="route"
              :class="{ on: templateId === t.id }"
              @tap="pickTemplate(t.id)"
            >
              <text class="route-n">{{ t.name }}</text>
              <text class="route-s">{{ t.next_trip_date ? cnDate(t.next_trip_date) : '未排下次' }}</text>
            </view>
          </scroll-view>
          <text class="hint">{{ routeHint }}</text>
        </view>

        <!-- 3 经过地点 -->
        <view class="card">
          <view class="label">
            <text class="lb">经过地点</text>
            <text class="ls">已选 <b>{{ selectedStops.length }}</b> 个 · <b>{{ willCall }}</b> 家客户</text>
          </view>

          <view v-for="(c, ci) in countyGroups" :key="c.id" class="cty" :class="{ on: isCountyOn(c) || c.selectedTowns.length }">
            <view class="cty-hd">
              <view class="cbx" :class="{ on: isCountyOn(c) }" @tap="toggleCounty(c.id)">
                <text v-if="isCountyOn(c)" class="tick">✓</text>
              </view>
              <view class="cty-nm" @tap="toggleFold(ci)">
                <text class="cty-t">{{ c.name }}</text>
                <text class="cty-s">
                  <template v-if="c.customerCount">县城 {{ c.customerCount }} 家 · </template>
                  {{ c.selectedTowns.length }}/{{ c.towns.length }} 个乡镇已选
                </text>
              </view>
              <text class="fold" :class="{ open: fold[ci] }" @tap="toggleFold(ci)">˅</text>
            </view>

            <view v-if="fold[ci]" class="towns">
              <view
                v-for="t in c.towns"
                :key="t.id"
                class="town"
                :class="{ on: selected.has(t.id) }"
                @tap="toggleTown(t.id)"
              >
                <text class="town-t">{{ t.name }}</text>
                <text class="town-n">{{ t.customerCount }}</text>
              </view>
              <text v-if="!c.towns.length" class="town-empty">这条县城还没维护沿线乡镇</text>
            </view>
          </view>

          <view v-if="!countyGroups.length && !loading" class="cty-empty">
            没有可选县城 · 先在 Web 端配好县城沿线和常用路线
          </view>

          <view class="seq">
            <text v-for="(s, i) in selectedStops" :key="s.region_id" class="seqitem">
              <text class="seqi-n">{{ i + 1 }}</text>{{ s.name }}
            </text>
            <text v-if="!selectedStops.length" class="seqitem">还没选地点</text>
          </view>
          <text class="hint">取消县城只取消县城本身，乡镇要单独取消；顺序按实地路线排列</text>
        </view>

        <!-- 4 负责人 -->
        <view class="card">
          <view class="label">
            <text class="lb">负责人</text>
            <text class="ls">管理员或销售</text>
          </view>
          <picker mode="selector" :range="ownerLabels" :value="ownerIndex" @change="onOwnerChange">
            <view class="owner">
              <view class="av">{{ ownerName.slice(0, 1) }}</view>
              <view class="owner-nm">
                <text class="on-t">{{ ownerName || '请选择' }}</text>
                <text class="on-s">{{ ownerHint }}</text>
              </view>
              <text class="chev">›</text>
            </view>
          </picker>
        </view>

        <!-- 5 本趟预览 -->
        <view class="preview">
          <view class="pnums">
            <view class="pnum"><text class="pv">{{ draft?.customer_count ?? willCall }}</text><text class="pk">将列入询单</text></view>
            <view class="pnum"><text class="pv">{{ includedJoinCount }}</text><text class="pk">自动加入订单</text></view>
            <view class="pnum"><text class="pv">{{ draft?.move_order_count ?? 0 }}</text><text class="pk">自动挪单</text></view>
          </view>

          <view v-if="draft?.join_orders?.length" class="pblock">
            <view class="pb-hd">
              <text class="pb-t">待排车订单</text>
              <text class="pb-s">点订单可排除 · 将加入 {{ includedJoinCount }}/{{ draft.join_orders.length }}</text>
            </view>
            <view
              v-for="o in draft.join_orders"
              :key="o.order_id"
              class="porder"
              :class="{ off: excludedOrderIds.has(o.order_id) }"
              @tap="toggleOrder(o.order_id)"
            >
              <view class="po-chk" :class="{ on: !excludedOrderIds.has(o.order_id) }">
                <text v-if="!excludedOrderIds.has(o.order_id)" class="po-tick">✓</text>
              </view>
              <view class="po-main">
                <view class="po-top">
                  <text class="po-no">{{ o.order_no }}</text>
                  <text class="po-amt">{{ formatMoney(o.total_amount) }}</text>
                </view>
                <text class="po-sub">{{ o.customer_name }} · {{ o.region_name }}</text>
              </view>
            </view>
          </view>

          <view v-if="draft?.move_orders?.length" class="pblock">
            <view class="pb-hd">
              <text class="pb-t">将自动挪过来的订单</text>
              <text class="pb-s">{{ draft.move_orders.length }} 单</text>
            </view>
            <view v-for="o in draft.move_orders" :key="o.order_id" class="porder plain">
              <view class="po-main">
                <view class="po-top">
                  <text class="po-no">{{ o.order_no }}</text>
                  <text class="po-amt">{{ formatMoney(o.total_amount) }}</text>
                </view>
                <text class="po-sub">{{ o.customer_name }} · {{ o.from_trip_date }} → {{ o.to_trip_date }}</text>
              </view>
            </view>
          </view>

          <view v-if="isEdit && draft?.return_orders?.length" class="pblock">
            <view class="pb-hd">
              <text class="pb-t">将退回待排车</text>
              <text class="pb-s">{{ draft.return_orders.length }} 单</text>
            </view>
            <view v-for="o in draft.return_orders" :key="o.order_id" class="porder plain">
              <view class="po-main">
                <view class="po-top">
                  <text class="po-no">{{ o.order_no }}</text>
                  <text class="po-amt">{{ formatMoney(o.total_amount) }}</text>
                </view>
                <text class="po-sub">{{ o.customer_name }} · {{ o.region_name }}</text>
              </view>
            </view>
          </view>

          <view class="pmsgs">
            <text class="pmsg">· 保存后本趟生成「计划中」，地点内正常客户进询单清单</text>
            <text v-if="includedJoinCount" class="pmsg">
              · {{ includedJoinCount }} 张待排车订单按地点自动加入，可在上方排除个别订单
            </text>
            <text v-if="draft?.move_order_count" class="pmsg">
              · {{ draft.move_order_count }} 张更晚趟次上的待配送订单会自动挪到本趟（写调度备注）
            </text>
            <text v-if="!willCall" class="pmsg warn">· 所选地点没有客户，仍可保存（出车后补单）</text>
            <text v-for="(w, i) in draft?.warnings || []" :key="i" class="pmsg warn">· {{ w.message || w.code }}</text>
            <text v-if="draftError" class="pmsg warn">· 预览失败：{{ draftError }}</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="footer">
      <view class="foot-info">
        <text class="fi-t">{{ selectedStops.length ? `${selectedStops.length} 个地点 · 询单 ${willCall} 家` : '还没选经过地点' }}</text>
        <text class="fi-s">{{ selectedStops.length ? '保存后可在出车列表查看' : '至少选择一个县城或乡镇' }}</text>
      </view>
      <view class="save-btn" :class="{ off: !selectedStops.length || saving }" @tap="save">
        {{ saving ? '保存中…' : isEdit ? '保存修改' : '保存出车' }}
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { customerApi, deliveryApi, regionApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { cnDate, formatMoney, ymd } from '@/utils/format'
import type {
  CountyCorridorSummary,
  RegionNode,
  RouteStopIn,
  RouteStopOrigin,
  RouteTemplate,
  RouteTrip,
  RouteTripCreatePayload,
  RouteTripDraft,
  SalesOption,
} from '@/types'

interface Town {
  id: number
  name: string
  customerCount: number
}

interface CountyGroup {
  id: number
  name: string
  customerCount: number
  towns: Town[]
}

interface CountyView extends CountyGroup {
  selectedTowns: Town[]
}

interface RefStop {
  region_id: number
  region_name: string
  parent_region_name?: string | null
}

interface SelectedStop {
  region_id: number
  name: string
  origin: RouteStopOrigin
}

const auth = useAuthStore()
const canPlan = computed(() => auth.isAdmin && (auth.can('delivery.route.manage') || !auth.permissions.length))
const today = ymd(0)
const tripId = ref(0)
const isEdit = computed(() => tripId.value > 0)
const editTrip = ref<RouteTrip | null>(null)
const date = ref(ymd(1))
const tripName = ref('')
const templateId = ref<number | null>(null)
const templates = ref<RouteTemplate[]>([])
const corridors = ref<CountyCorridorSummary[]>([])
const counties = ref<CountyGroup[]>([])
const corridorTownMap = ref<Map<number, Town[]>>(new Map())
const selected = reactive(new Set<number>())
const stopOrder = ref<number[]>([])
const excludedOrderIds = reactive(new Set<number>())
const fold = reactive<Record<number, boolean>>({})
const owners = ref<SalesOption[]>([])
const ownerId = ref<number | null>(null)
const draft = ref<RouteTripDraft | null>(null)
const draftError = ref('')
const loading = ref(true)
const saving = ref(false)
const prevTemplateName = ref<string | null>(null)
const pickedTemplate = computed(() => templates.value.find((t) => t.id === templateId.value) || null)

const dateOptions = computed(() => [
  { value: ymd(0), label: '今天', sub: cnDate(ymd(0)).slice(0, 5) },
  { value: ymd(1), label: '明天', sub: cnDate(ymd(1)).slice(0, 5) },
  { value: ymd(2), label: '后天', sub: cnDate(ymd(2)).slice(0, 5) },
])

const dateHint = computed(() =>
  pickedTemplate.value?.next_trip_date
    ? `已按「${pickedTemplate.value.name}」带出下一次发车日期 ${cnDate(pickedTemplate.value.next_trip_date)}`
    : '不选路线时默认明天，可作为临时加趟',
)

const routeHint = computed(() =>
  templateId.value !== null
    ? '已带出路线里的全部县城和乡镇并默认勾选；取消不要去的乡镇即可'
    : '直接勾县城和沿线乡镇，相当于一条临时路线',
)

const ownerLabels = computed(() => owners.value.map((o) => `${o.name}${o.is_admin ? '（管理员）' : ''}`))
const ownerIndex = computed(() => Math.max(owners.value.findIndex((o) => o.id === ownerId.value), 0))
const ownerName = computed(() => owners.value.find((o) => o.id === ownerId.value)?.name || '')
const ownerHint = computed(() => {
  if (templateId.value !== null && pickedTemplate.value && ownerId.value === pickedTemplate.value.default_owner_id) {
    return '取路线默认负责人'
  }
  if (ownerId.value && ownerId.value === auth.user?.id) return '默认自己'
  return '本趟负责人，可改为其他人'
})

const countyGroups = computed<CountyView[]>(() =>
  counties.value.map((c) => ({
    ...c,
    selectedTowns: c.towns.filter((t) => selected.has(t.id)),
  })),
)

const regionNames = computed(() => {
  const map = new Map<number, string>()
  counties.value.forEach((c) => {
    map.set(c.id, c.name)
    c.towns.forEach((t) => map.set(t.id, t.name))
  })
  templates.value.forEach((t) =>
    t.stops.forEach((s) => {
      if (!map.has(s.region_id)) map.set(s.region_id, s.region_name)
    }),
  )
  editTrip.value?.stops.forEach((s) => {
    if (!map.has(s.region_id)) map.set(s.region_id, s.region_name)
  })
  return map
})

const corridorTownIds = computed(() => {
  const ids = new Set<number>()
  corridorTownMap.value.forEach((towns) => towns.forEach((t) => ids.add(t.id)))
  return ids
})

function asOrigin(value: unknown): RouteStopOrigin | null {
  return value === 'county' || value === 'corridor' || value === 'manual' ? value : null
}

/** 编辑趟次 / 常用路线里的原始 origin 优先，避免二次编辑时语义漂移。 */
function baseOrigin(id: number): RouteStopOrigin | null {
  if (isEdit.value && editTrip.value) {
    const stop = editTrip.value.stops.find((s) => s.region_id === id)
    const origin = asOrigin(stop?.origin)
    if (origin) return origin
  }
  const templateStop = pickedTemplate.value?.stops.find((s) => s.region_id === id)
  return asOrigin(templateStop?.origin)
}

function originOf(id: number): RouteStopOrigin {
  const base = baseOrigin(id)
  if (base) return base
  if (counties.value.some((c) => c.id === id)) return 'county'
  if (corridorTownIds.value.has(id)) return 'corridor'
  return 'manual'
}

/** 已选地点：优先按模板 / 已有趟次顺序，手动新增的按勾选先后追加。 */
const selectedStops = computed<SelectedStop[]>(() => {
  const ids: number[] = []
  stopOrder.value.forEach((id) => {
    if (selected.has(id) && !ids.includes(id)) ids.push(id)
  })
  counties.value.forEach((c) => {
    if (selected.has(c.id) && !ids.includes(c.id)) ids.push(c.id)
    c.towns.forEach((t) => {
      if (selected.has(t.id) && !ids.includes(t.id)) ids.push(t.id)
    })
  })
  return ids.map((id) => ({
    region_id: id,
    name: regionNames.value.get(id) || `地点 ${id}`,
    origin: originOf(id),
  }))
})

const willCall = computed(() => {
  let n = 0
  counties.value.forEach((c) => {
    if (selected.has(c.id)) n += c.customerCount
    c.towns.forEach((t) => {
      if (selected.has(t.id)) n += t.customerCount
    })
  })
  return n
})

function isCountyOn(c: CountyView): boolean {
  return selected.has(c.id)
}

function setPicked(id: number, on: boolean) {
  if (on) {
    selected.add(id)
    if (!stopOrder.value.includes(id)) stopOrder.value.push(id)
  } else {
    selected.delete(id)
    const idx = stopOrder.value.indexOf(id)
    if (idx >= 0) stopOrder.value.splice(idx, 1)
  }
}

function toggleCounty(id: number) {
  setPicked(id, !selected.has(id))
}

function toggleTown(id: number) {
  setPicked(id, !selected.has(id))
}

function toggleFold(ci: number) {
  fold[ci] = !fold[ci]
}

function onPickDate(e: { detail: { value: string } }) {
  date.value = e.detail.value
}

function onOwnerChange(e: { detail: { value: number | string } }) {
  const idx = Number(e.detail.value)
  const owner = owners.value[idx]
  if (owner) ownerId.value = owner.id
}

/** 选路线：带出地点（全部勾选）、默认负责人、下一次发车日期。 */
function pickTemplate(id: number | null) {
  templateId.value = id
  selected.clear()
  stopOrder.value = []
  excludedOrderIds.clear()
  Object.keys(fold).forEach((k) => delete fold[Number(k)])
  if (id === null) {
    draft.value = null
    draftError.value = ''
    return
  }
  const tpl = templates.value.find((t) => t.id === id)
  if (!tpl) return
  tpl.stops.forEach((s) => {
    selected.add(s.region_id)
    if (!stopOrder.value.includes(s.region_id)) stopOrder.value.push(s.region_id)
  })
  if (tpl.default_owner_id) ownerId.value = tpl.default_owner_id
  if (tpl.next_trip_date && tpl.next_trip_date >= today) date.value = tpl.next_trip_date
  if (!isEdit.value) {
    const current = tripName.value.trim()
    if (!current || current === prevTemplateName.value) tripName.value = tpl.name
  }
  prevTemplateName.value = tpl.name
  const firstCounty = countyGroups.value.findIndex((c) => selected.has(c.id) || c.towns.some((t) => selected.has(t.id)))
  if (firstCounty >= 0) fold[firstCounty] = true
  uni.showToast({ title: `已带出「${tpl.name}」的地点`, icon: 'none' })
}

/**
 * 预处理可选地点：
 * 1. 已配置沿线的县城优先，保留 Web 端维护的乡镇顺序；
 * 2. 模板 / 已有趟次引用但不在沿线列表里的乡镇补进对应县城；
 * 3. 其余有客户或被引用的县城从行政区划树补充，避免已选地点被静默丢弃。
 */
function buildCounties(tree: RegionNode[], corridorTowns: Map<number, Town[]>, refStops: RefStop[]) {
  const flat: RegionNode[] = []
  const walk = (nodes: RegionNode[]) => {
    nodes.forEach((n) => {
      flat.push(n)
      if (n.children?.length) walk(n.children)
    })
  }
  walk(tree)

  const byId = new Map(flat.map((n) => [n.id, n]))
  const byParent = new Map<number, RegionNode[]>()
  flat.forEach((n) => {
    if (n.parent_id == null) return
    const list = byParent.get(n.parent_id) || []
    list.push(n)
    byParent.set(n.parent_id, list)
  })
  const countyCount = (id: number) => byId.get(id)?.customer_count ?? 0

  const groups: CountyGroup[] = []
  const groupById = new Map<number, CountyGroup>()
  const addGroup = (group: CountyGroup) => {
    if (groupById.has(group.id)) return
    groups.push(group)
    groupById.set(group.id, group)
  }

  corridors.value.forEach((c) => {
    addGroup({
      id: c.county_region_id,
      name: c.county_name,
      customerCount: countyCount(c.county_region_id),
      towns: [...(corridorTowns.get(c.county_region_id) || [])],
    })
  })

  const parentCounty = (stop: RefStop): { id: number; name: string } | null => {
    const node = byId.get(stop.region_id)
    if (node) {
      if (node.level === 3) return { id: node.id, name: node.name }
      if (node.parent_id != null) {
        const parent = byId.get(node.parent_id)
        if (parent && parent.level === 3) return { id: parent.id, name: parent.name }
      }
    }
    if (stop.parent_region_name) {
      const group = groups.find((g) => g.name === stop.parent_region_name)
      if (group) return { id: group.id, name: group.name }
      const county = flat.find((n) => n.level === 3 && n.name === stop.parent_region_name)
      if (county) return { id: county.id, name: county.name }
    }
    return null
  }

  const mergeTown = (group: CountyGroup, stop: RefStop) => {
    if (byId.get(stop.region_id)?.level === 3) return
    if (group.towns.some((t) => t.id === stop.region_id)) return
    group.towns.push({
      id: stop.region_id,
      name: stop.region_name,
      customerCount: byId.get(stop.region_id)?.customer_count ?? 0,
    })
  }

  refStops.forEach((stop) => {
    const county = parentCounty(stop)
    if (!county) return
    const group = groupById.get(county.id)
    if (group) mergeTown(group, stop)
  })

  const referencedCountyIds = new Set<number>()
  refStops.forEach((stop) => {
    const county = parentCounty(stop)
    if (county) referencedCountyIds.add(county.id)
  })

  flat
    .filter((n) => n.level === 3)
    .forEach((county) => {
      if (groupById.has(county.id)) return
      const towns = (byParent.get(county.id) || [])
        .filter((t) => t.level >= 4)
        .map((t) => ({ id: t.id, name: t.name, customerCount: t.customer_count }))
      refStops.forEach((stop) => {
        if (stop.region_id === county.id) return
        const node = byId.get(stop.region_id)
        const underCounty = node ? node.parent_id === county.id : stop.parent_region_name === county.name
        if (underCounty && !towns.some((t) => t.id === stop.region_id)) {
          towns.push({
            id: stop.region_id,
            name: stop.region_name,
            customerCount: node?.customer_count ?? 0,
          })
        }
      })
      if (
        county.customer_count <= 0 &&
        !towns.some((t) => t.customerCount > 0) &&
        !referencedCountyIds.has(county.id)
      ) {
        return
      }
      addGroup({
        id: county.id,
        name: county.name,
        customerCount: county.customer_count,
        towns,
      })
    })

  // 行政区划树里也查不到的引用地点，按名称兜底成组
  refStops.forEach((stop) => {
    const county = parentCounty(stop)
    if (!county || groupById.has(county.id)) return
    addGroup({
      id: county.id,
      name: county.name,
      customerCount: countyCount(county.id),
      towns: [],
    })
    const group = groupById.get(county.id)
    if (group) mergeTown(group, stop)
  })

  counties.value = groups
  if (groups.length) fold[0] = true
}

let draftTimer: ReturnType<typeof setTimeout> | undefined
let draftSeq = 0

const includedJoinCount = computed(() => {
  const list = draft.value?.join_orders
  if (list?.length) return list.filter((o) => !excludedOrderIds.has(o.order_id)).length
  return draft.value?.join_order_count ?? 0
})

function toggleOrder(id: number) {
  if (excludedOrderIds.has(id)) excludedOrderIds.delete(id)
  else excludedOrderIds.add(id)
}

async function refreshDraft() {
  const seq = ++draftSeq
  if (!selectedStops.value.length) {
    draft.value = null
    draftError.value = ''
    return
  }
  const stops: RouteStopIn[] = selectedStops.value.map((s) => ({ region_id: s.region_id, origin: s.origin }))
  try {
    const res = await deliveryApi.draftTrip({
      trip_date: date.value,
      template_id: templateId.value,
      trip_id: isEdit.value ? tripId.value : null,
      stops,
      exclude_order_ids: Array.from(excludedOrderIds),
    })
    if (seq !== draftSeq) return
    draft.value = res
    draftError.value = ''
  } catch (error) {
    if (seq !== draftSeq) return
    draft.value = null
    draftError.value = (error as Error).message || '请稍后重试'
  }
}

watch(date, () => {
  excludedOrderIds.clear()
})

watch(
  () => [date.value, templateId.value, selectedStops.value.map((s) => s.region_id).join(',')].join('|'),
  () => {
    if (draftTimer) clearTimeout(draftTimer)
    draftTimer = setTimeout(refreshDraft, 300)
  },
)

onLoad(async (opts) => {
  auth.restore()
  if (auth.user && !canPlan.value) {
    uni.showToast({ title: '只有管理员能安排出车', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 800)
    return
  }

  const id = Number(opts?.id || 0)
  if (id > 0) {
    tripId.value = id
    uni.setNavigationBarTitle({ title: '修改出车' })
  }

  const tripPromise: Promise<RouteTrip | null> =
    id > 0 ? deliveryApi.getTrip(id).catch(() => null) : Promise.resolve(null)

  const [tplRes, corrRes, treeRes, ownerRes, tripRes] = await Promise.all([
    deliveryApi.templates(true).catch(() => [] as RouteTemplate[]),
    deliveryApi.corridors().catch(() => [] as CountyCorridorSummary[]),
    regionApi.tree().catch(() => [] as RegionNode[]),
    customerApi.salesOptions().catch(() => [] as SalesOption[]),
    tripPromise,
  ])
  templates.value = tplRes
  corridors.value = corrRes
  owners.value = ownerRes
  ownerId.value = ownerRes.find((o) => o.is_owner)?.id || ownerRes[0]?.id || auth.user?.id || null

  if (id > 0) {
    if (!tripRes) {
      uni.showToast({ title: '趟次加载失败', icon: 'none' })
      setTimeout(() => uni.navigateBack(), 800)
      return
    }
    if (tripRes.status !== 'planned') {
      uni.showToast({ title: '当前状态不可修改', icon: 'none' })
      setTimeout(() => uni.navigateBack(), 800)
      return
    }
    editTrip.value = tripRes
  }

  // 沿线乡镇从县城沿线详情取，带出 Web 端维护的顺序
  const corridorTowns = new Map<number, Town[]>()
  if (corrRes.length) {
    const details = await Promise.all(
      corrRes.map((c) => deliveryApi.corridor(c.county_region_id).catch(() => null)),
    )
    details.forEach((d) => {
      if (!d) return
      corridorTowns.set(
        d.county_region_id,
        d.towns.map((t) => ({ id: t.region_id, name: t.region_name, customerCount: t.customer_count })),
      )
    })
  }
  corridorTownMap.value = corridorTowns

  const refStops: RefStop[] = []
  tplRes.forEach((t) =>
    t.stops.forEach((s) =>
      refStops.push({
        region_id: s.region_id,
        region_name: s.region_name,
        parent_region_name: s.parent_region_name,
      }),
    ),
  )
  tripRes?.stops.forEach((s) =>
    refStops.push({
      region_id: s.region_id,
      region_name: s.region_name,
      parent_region_name: s.parent_region_name,
    }),
  )
  buildCounties(treeRes, corridorTowns, refStops)

  if (tripRes) {
    date.value = tripRes.trip_date
    tripName.value = tripRes.name || ''
    templateId.value = tripRes.template_id
    ownerId.value = tripRes.owner_id
    selected.clear()
    stopOrder.value = []
    tripRes.stops.forEach((s) => {
      selected.add(s.region_id)
      if (!stopOrder.value.includes(s.region_id)) stopOrder.value.push(s.region_id)
    })
    const firstCounty = countyGroups.value.findIndex(
      (c) => selected.has(c.id) || c.towns.some((t) => selected.has(t.id)),
    )
    if (firstCounty >= 0) fold[firstCounty] = true
  }

  loading.value = false
})

async function save() {
  if (!selectedStops.value.length || saving.value) return
  if (!ownerId.value) {
    uni.showToast({ title: '先选负责人', icon: 'none' })
    return
  }
  saving.value = true
  try {
    const stops: RouteStopIn[] = selectedStops.value.map((s) => ({ region_id: s.region_id, origin: s.origin }))
    const payload: RouteTripCreatePayload = {
      trip_date: date.value,
      name: tripName.value.trim() || null,
      owner_id: ownerId.value,
      template_id: templateId.value,
      stops,
      exclude_order_ids: Array.from(excludedOrderIds),
    }
    const res = isEdit.value
      ? await deliveryApi.updateTrip(tripId.value, payload)
      : await deliveryApi.createTrip(payload)

    const joined = res.joined_orders?.length ?? 0
    const moved = res.moved_orders?.length ?? 0
    const returned = res.returned_orders?.length ?? 0
    const extras = [
      joined ? `加入 ${joined} 单` : '',
      moved ? `挪单 ${moved} 单` : '',
      returned ? `退回 ${returned} 单` : '',
    ].filter(Boolean)
    const summary = `${isEdit.value ? '已保存修改' : '已安排'} ${date.value} · 询单 ${draft.value?.customer_count ?? willCall.value} 家${extras.length ? ` · ${extras.join(' · ')}` : ''}`

    if (res.warnings?.length) {
      uni.showModal({
        title: '已保存，请留意',
        content: [summary, ...res.warnings.map((w) => w.message || w.code)].join('\n'),
        showCancel: false,
        success: () => uni.navigateBack(),
        fail: () => uni.navigateBack(),
      })
    } else {
      uni.showToast({ title: summary, icon: 'none' })
      setTimeout(() => uni.navigateBack(), 900)
    }
  } catch {
    /* 请求封装已提示 */
  } finally {
    saving.value = false
  }
}
</script>

<style lang="scss" scoped>
.plan-page { height: 100vh; background: #f4f6f9; display: flex; flex-direction: column; box-sizing: border-box; }
/* H5 顶部有 44px 原生导航栏，100vh 会多出一屏底部被截掉 */
/* #ifdef H5 */
.plan-page { height: calc(100vh - 44px); }
/* #endif */
.content { flex: 1; height: 0; }
.wrap { padding: 16rpx 16rpx 30rpx; }

.card { background: #fff; border-radius: 22rpx; padding: 24rpx; margin-bottom: 16rpx; }
.label { display: flex; align-items: baseline; justify-content: space-between; gap: 12rpx; }
.lb { font-size: 27rpx; font-weight: 600; color: #1c2534; }
.ls { font-size: 20rpx; color: #8894a5; }
.ls b { color: $uni-color-primary; }
.hint { display: block; margin-top: 12rpx; font-size: 20rpx; line-height: 1.5; color: #8894a5; }

/* 日期 */
.days { display: flex; gap: 10rpx; margin-top: 16rpx; }
.day-picker { flex: 1; min-width: 0; }
.day-picker .day { width: 100%; }
.day {
  flex: 1; padding: 12rpx 0; border-radius: 14rpx; background: #f6f8fb; text-align: center;
  border: 1rpx solid transparent;
}
.day.on { background: #eef4ff; border-color: rgba(37, 99, 235, 0.4); }
.day-t { display: block; font-size: 24rpx; font-weight: 600; color: #2f3b4d; }
.day.on .day-t { color: $uni-color-primary; }
.day-s { display: block; margin-top: 2rpx; font-size: 18rpx; color: #9aa6b6; }

/* 出车名称 */
.named {
  display: flex; align-items: center; gap: 16rpx; margin-top: 16rpx; padding-top: 16rpx;
  border-top: 1rpx dashed #eef1f5;
}
.named-lb { flex: none; font-size: 23rpx; font-weight: 600; color: #46536a; }
.named-inp {
  flex: 1; min-width: 0; height: 60rpx; padding: 0 18rpx; border-radius: 12rpx;
  background: #f6f8fb; font-size: 23rpx; color: #1c2534; box-sizing: border-box;
}

/* 路线 */
.routes { white-space: nowrap; margin-top: 14rpx; }
.route {
  display: inline-flex; flex-direction: column; gap: 2rpx; padding: 12rpx 18rpx; margin-right: 10rpx;
  border-radius: 14rpx; background: #f6f8fb; border: 1rpx solid transparent;
}
.route.on { background: #eef4ff; border-color: rgba(37, 99, 235, 0.4); }
.route-n { font-size: 23rpx; font-weight: 600; color: #2f3b4d; }
.route.on .route-n { color: $uni-color-primary; }
.route-s { font-size: 18rpx; color: #9aa6b6; }

/* 经过地点 */
.cty { border: 1rpx solid #eef1f5; border-radius: 16rpx; padding: 16rpx; margin-top: 12rpx; }
.cty.on { border-color: rgba(37, 99, 235, 0.28); background: #fcfdff; }
.cty-hd { display: flex; align-items: center; gap: 12rpx; }
.cbx {
  width: 36rpx; height: 36rpx; border-radius: 10rpx; border: 2rpx solid #d5dde8; flex: none;
  display: flex; align-items: center; justify-content: center;
}
.cbx.on { background: $uni-color-primary; border-color: $uni-color-primary; }
.tick { color: #fff; font-size: 20rpx; font-weight: 700; }
.cty-nm { flex: 1; min-width: 0; }
.cty-t { display: block; font-size: 25rpx; font-weight: 600; color: #1c2534; }
.cty-s { display: block; margin-top: 2rpx; font-size: 19rpx; color: #8894a5; }
.fold { font-size: 22rpx; color: #9aa6b6; padding: 0 6rpx; transition: transform 0.15s; }
.fold.open { transform: rotate(180deg); }

.towns { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 14rpx; padding-left: 48rpx; }
.town {
  display: flex; align-items: center; gap: 6rpx; padding: 8rpx 16rpx; border-radius: 24rpx;
  background: #f6f8fb; border: 1rpx solid transparent;
}
.town.on { background: #eef4ff; border-color: rgba(37, 99, 235, 0.32); }
.town-t { font-size: 21rpx; color: #46536a; }
.town.on .town-t { color: #2570b3; font-weight: 600; }
.town-n { font-size: 18rpx; color: #9aa6b6; }
.town-empty { font-size: 19rpx; color: #a8b3c2; }
.cty-empty { padding: 40rpx 0; text-align: center; font-size: 22rpx; color: #8894a5; }

.seq { display: flex; flex-wrap: wrap; gap: 8rpx; margin-top: 16rpx; padding-top: 14rpx; border-top: 1rpx dashed #eef1f5; }
.seqitem {
  display: inline-flex; align-items: center; gap: 6rpx; font-size: 20rpx; color: #64738a;
  background: #f6f8fb; border-radius: 8rpx; padding: 4rpx 10rpx;
}
.seqi-n {
  width: 26rpx; height: 26rpx; line-height: 26rpx; text-align: center; border-radius: 6rpx;
  background: #16233a; color: #fff; font-size: 16rpx;
}

/* 负责人 */
.owner { display: flex; align-items: center; gap: 16rpx; margin-top: 16rpx; }
.av {
  width: 64rpx; height: 64rpx; border-radius: 50%; flex: none; font-size: 26rpx; font-weight: 700;
  background: linear-gradient(135deg, #3b82f6, $uni-color-primary); color: #fff;
  display: flex; align-items: center; justify-content: center;
}
.owner-nm { flex: 1; min-width: 0; }
.on-t { display: block; font-size: 26rpx; font-weight: 600; color: #1c2534; }
.on-s { display: block; margin-top: 2rpx; font-size: 19rpx; color: #8894a5; }
.chev { font-size: 30rpx; color: #cbd5e1; }

/* 预览 */
.preview {
  border-radius: 22rpx; padding: 24rpx; color: #fff; margin-bottom: 16rpx;
  background: linear-gradient(140deg, #16233a, #263d59 62%, #2c4a68);
  box-shadow: 0 10rpx 24rpx rgba(22, 35, 58, 0.22);
}
.pnums { display: flex; }
.pnum { flex: 1; min-width: 0; }
.pnum + .pnum { border-left: 1rpx solid rgba(255, 255, 255, 0.14); padding-left: 18rpx; }
.pv { display: block; font-size: 36rpx; font-weight: 700; }
.pk { display: block; margin-top: 4rpx; font-size: 19rpx; color: rgba(255, 255, 255, 0.6); }
.pmsgs { margin-top: 18rpx; display: flex; flex-direction: column; gap: 6rpx; }
.pmsg { font-size: 19rpx; line-height: 1.5; color: rgba(255, 255, 255, 0.68); }
.pmsg.warn { color: #fcd34d; }

/* 预览 · 订单明细 */
.pblock { margin-top: 18rpx; padding-top: 16rpx; border-top: 1rpx solid rgba(255, 255, 255, 0.12); }
.pb-hd { display: flex; align-items: baseline; justify-content: space-between; gap: 12rpx; }
.pb-t { font-size: 21rpx; font-weight: 600; color: rgba(255, 255, 255, 0.9); }
.pb-s { font-size: 18rpx; color: rgba(255, 255, 255, 0.52); }
.porder { display: flex; align-items: flex-start; gap: 14rpx; margin-top: 14rpx; }
.porder.off { opacity: 0.5; }
.porder.off .po-no { text-decoration: line-through; }
.po-chk {
  flex: none; width: 32rpx; height: 32rpx; margin-top: 2rpx; border-radius: 8rpx; box-sizing: border-box;
  border: 2rpx solid rgba(255, 255, 255, 0.4);
  display: flex; align-items: center; justify-content: center;
}
.po-chk.on { background: $uni-color-primary; border-color: $uni-color-primary; }
.po-tick { font-size: 16rpx; font-weight: 700; line-height: 1; color: #fff; }
.po-main { flex: 1; min-width: 0; }
.po-top { display: flex; align-items: baseline; justify-content: space-between; gap: 12rpx; }
.po-no { font-size: 20rpx; color: rgba(255, 255, 255, 0.86); }
.po-amt { flex: none; font-size: 20rpx; font-weight: 600; color: #fff; }
.po-sub { display: block; margin-top: 2rpx; font-size: 18rpx; color: rgba(255, 255, 255, 0.55); }

/* 底栏 */
.footer {
  flex: none; display: flex; align-items: center; gap: 16rpx; padding: 16rpx 24rpx; background: #fff;
  border-top: 1rpx solid #eef1f5;
  padding-bottom: calc(16rpx + constant(safe-area-inset-bottom));
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
}
.foot-info { flex: 1; min-width: 0; }
.fi-t { display: block; font-size: 23rpx; font-weight: 600; color: #1c2534; }
.fi-s { display: block; margin-top: 2rpx; font-size: 20rpx; color: #8894a5; }
.save-btn {
  flex: none; width: 220rpx; height: 80rpx; border-radius: 16rpx; background: $uni-color-primary; color: #fff;
  font-size: 27rpx; font-weight: 600; display: flex; align-items: center; justify-content: center;
}
.save-btn.off { background: #e8edf4; color: #9aa6b6; }
</style>
