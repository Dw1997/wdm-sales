<template>
  <view class="approve-page">
    <custom-nav-bar title="客户审核" show-back>
      <template #right>
        <text class="nav-count">{{ list.length }} 待审</text>
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
        <view v-for="c in list" :key="c.id" class="card row-card">
          <view class="rc-hd">
            <text class="rc-name">{{ c.name }}</text>
            <text class="rc-time">{{ relativeTime(c.created_at) }}</text>
          </view>
          <view class="rc-meta">
            <text class="rc-phone" @tap="callPhone(c.phone)">{{ formatPhone(c.phone) || '无手机号' }}</text>
            <text class="tag tag-primary">{{ c.invite_code ? `推广码 ${c.invite_code}` : '小程序' }}</text>
            <text v-if="c.wechat_bound" class="tag tag-success">已绑微信</text>
          </view>
          <text class="rc-own">
            {{ c.sales_name ? `归属：${c.sales_name}（审核前已绑定）` : '未归属销售' }}
          </text>
          <text v-if="c.referrer_customer_name" class="rc-own">
            🎁 介绍人：{{ c.referrer_customer_name }}（首单送达自动发拉新券）
          </text>
          <text v-if="c.address" class="rc-sub">{{ c.address }}</text>
          <view class="rc-acts">
            <button class="btn-outline act" @tap="openReject(c)">驳回</button>
            <button class="btn-primary act" @tap="openPass(c)">通过</button>
          </view>
        </view>

        <empty-state
          v-if="!list.length"
          icon="✅"
          text="暂时没有待审核的客户"
          padding="120rpx 32rpx"
        />
      </view>
    </scroll-view>

    <!-- 通过：补全资料并选归属与等级（等级必填，后端 level_required） -->
    <view v-if="passTarget" class="mask" @tap.self="passTarget = null">
      <view class="sheet">
        <text class="sheet-title">补全资料并通过审核</text>
        <text class="sheet-sub">{{ formatPhone(passTarget.phone) || passTarget.name }}</text>

        <view class="field">
          <text class="field-label">客户名称 / 店名</text>
          <input
            v-model="passName"
            class="sheet-input"
            placeholder="填写客户真实名称或店名"
            maxlength="100"
          />
        </view>

        <view class="field">
          <text class="field-label">联系人（选填）</text>
          <input
            v-model="passContactName"
            class="sheet-input"
            placeholder="不填默认同客户名称"
            maxlength="50"
          />
        </view>

        <view class="field">
          <text class="field-label">收货地点（选填）</text>
          <view class="picker" @tap="regionPickerVisible = true">
            {{ passRegionText || '搜索或选择省 / 市 / 县 / 乡镇' }}
          </view>
        </view>

        <view class="field">
          <text class="field-label">详细地址（选填）</text>
          <input
            v-model="passAddress"
            class="sheet-input"
            placeholder="如：某菜市场 / 门牌号 / 摊位号"
            maxlength="255"
          />
        </view>

        <view v-if="auth.isAdmin" class="field">
          <text class="field-label">归属销售</text>
          <picker :range="salesLabels" :value="salesIndex" @change="onSalesChange">
            <view class="picker">{{ salesLabels[salesIndex] || '不归属（店铺自己）' }}</view>
          </picker>
        </view>

        <view class="field">
          <text class="field-label">客户等级（必选）</text>
          <picker :range="levelLabels" :value="levelIndex" @change="onLevelChange">
            <view class="picker">{{ levelLabels[levelIndex] || '没有可用等级' }}</view>
          </picker>
          <text class="hint">默认预选「默认售价」，等级决定默认价格和授信额度。</text>
        </view>

        <view v-if="tags.length" class="field">
          <text class="field-label">客户标签（选填）</text>
          <picker :range="tagLabels" :value="tagIndex" @change="onTagChange">
            <view class="picker">{{ tagLabels[tagIndex] || '暂不填（待实地考察）' }}</view>
          </picker>
        </view>

        <view v-if="referrerOptions.length" class="field">
          <text class="field-label">介绍人 / 拉新老客（选填）</text>
          <picker :range="referrerLabels" :value="referrerIndex" @change="onReferrerChange">
            <view class="picker">{{ referrerLabels[referrerIndex] || '无介绍人' }}</view>
          </picker>
          <text class="hint">填写介绍人后，该客户首单送达完成将自动给介绍人发拉新券。</text>
        </view>

        <button class="btn-primary sheet-btn" :disabled="submitting" @tap="doPass">
          确认通过
        </button>
      </view>
    </view>

    <!-- 驳回：原因必填 -->
    <view v-if="rejectTarget" class="mask" @tap.self="rejectTarget = null">
      <view class="sheet">
        <text class="sheet-title">驳回注册</text>
        <text class="sheet-sub">{{ rejectTarget.name }}</text>
        <view class="field">
          <text class="field-label">驳回原因（必填）</text>
          <textarea
            v-model="rejectReason"
            class="textarea"
            placeholder="例如：不是本地客户 / 电话打不通"
            maxlength="200"
          />
        </view>
        <button class="btn-primary sheet-btn" :disabled="submitting" @tap="doReject">
          确认驳回
        </button>
      </view>
    </view>
    <!-- 地区搜索与级联选择器 -->
    <RegionPickerSheet v-model:visible="regionPickerVisible" @select="onSelectRegion" />
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import CustomNavBar from '@/components/CustomNavBar.vue'
import EmptyState from '@/components/EmptyState.vue'
import RegionPickerSheet from '@/components/RegionPickerSheet.vue'
import { customerApi, customerLevelApi, customerTagApi, type CustomerLevel, type CustomerTag } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { formatPhone, relativeTime } from '@/utils/format'
import type { Customer, RegionSelection, SalesOption } from '@/types'

const auth = useAuthStore()

const navTotalHeight = ref(64)
try {
  const info = uni.getSystemInfoSync()
  navTotalHeight.value = (info.statusBarHeight || 20) + 44
} catch {
  /* 默认值 */
}

interface PickerEvent {
  detail: { value: number | string }
}

const list = ref<Customer[]>([])
const levels = ref<CustomerLevel[]>([])
const tags = ref<CustomerTag[]>([])
const sales = ref<SalesOption[]>([])
const referrerOptions = ref<Customer[]>([])
const refreshing = ref(false)
const submitting = ref(false)

const passTarget = ref<Customer | null>(null)
const passName = ref('')
const passContactName = ref('')
const passRegionId = ref<number | null>(null)
const passRegionText = ref('')
const passAddress = ref('')
const regionPickerVisible = ref(false)
const salesIndex = ref(0)
const levelIndex = ref(0)
const tagIndex = ref(0)
const referrerIndex = ref(0)
const focusCustomerId = ref<number | null>(null)

const rejectTarget = ref<Customer | null>(null)
const rejectReason = ref('')

const activeLevels = computed(() => levels.value.filter((l) => l.is_active && l.level_id !== 'walk_in'))
const levelLabels = computed(() =>
  activeLevels.value.map((l) => `${l.nickname}（额度 ${l.default_credit_limit}）`),
)
const tagLabels = computed(() => ['暂不填（待实地考察）', ...tags.value.map((t) => t.name)])
const salesLabels = computed(() => [
  '不归属（店铺自己）',
  ...sales.value.map((s) => `${s.is_admin ? '管理员·' : ''}${s.name}`),
])
const referrerLabels = computed(() => [
  '无介绍人',
  ...referrerOptions.value.map((c) => `${c.name}${c.phone ? `（${c.phone.slice(-4)}）` : ''}`),
])

async function load() {
  const [customers, levelList, tagList, salesList, activeCustomers] = await Promise.allSettled([
    customerApi.list({ status: 'pending', page: 1, page_size: 50 }),
    customerLevelApi.list(),
    customerTagApi.list({ is_active: true }),
    customerApi.salesOptions(),
    customerApi.list({ status: 'active', page: 1, page_size: 200 }),
  ])
  if (customers.status === 'fulfilled') list.value = customers.value
  if (levelList.status === 'fulfilled') levels.value = levelList.value
  if (tagList.status === 'fulfilled') tags.value = tagList.value
  if (salesList.status === 'fulfilled') sales.value = salesList.value
  if (activeCustomers.status === 'fulfilled') {
    referrerOptions.value = activeCustomers.value.filter((c) => !c.is_system)
  }
  if (focusCustomerId.value) {
    const matched = list.value.find((c) => c.id === focusCustomerId.value)
    if (matched) {
      focusCustomerId.value = null
      openPass(matched)
    }
  }
}

function callPhone(phone?: string | null) {
  if (!phone) return
  uni.makePhoneCall({ phoneNumber: phone })
}

async function onRefresh() {
  refreshing.value = true
  await load()
  refreshing.value = false
}

function openPass(c: Customer) {
  if (!activeLevels.value.length) {
    uni.showToast({ title: '没有可用等级，请先在 Web 管理端配置', icon: 'none' })
    return
  }
  passTarget.value = c
  passName.value = c.name || ''
  passContactName.value = c.contact_name || ''
  passRegionId.value = c.delivery_region_id ?? null
  passRegionText.value = [c.province, c.city, c.district, c.town].filter(Boolean).join(' / ')
  passAddress.value = c.detail_address || c.address || ''
  const salesIdx = c.sales_id ? sales.value.findIndex((s) => s.id === c.sales_id) : -1
  salesIndex.value = salesIdx >= 0 ? salesIdx + 1 : 0
  let levelIdx = activeLevels.value.findIndex((l) => l.id === c.level_id)
  if (levelIdx < 0) levelIdx = activeLevels.value.findIndex((l) => l.level_id === 'default_retail')
  levelIndex.value = levelIdx >= 0 ? levelIdx : 0
  const tIdx = c.tag_id ? tags.value.findIndex((t) => t.id === c.tag_id) : -1
  tagIndex.value = tIdx >= 0 ? tIdx + 1 : 0
  const rIdx = c.referrer_customer_id
    ? referrerOptions.value.findIndex((r) => r.id === c.referrer_customer_id)
    : -1
  referrerIndex.value = rIdx >= 0 ? rIdx + 1 : 0
}

function onSalesChange(e: PickerEvent) {
  salesIndex.value = Number(e.detail.value)
}

function onLevelChange(e: PickerEvent) {
  levelIndex.value = Number(e.detail.value)
}

function onTagChange(e: PickerEvent) {
  tagIndex.value = Number(e.detail.value)
}

function onReferrerChange(e: PickerEvent) {
  referrerIndex.value = Number(e.detail.value)
}

function onSelectRegion(sel: RegionSelection) {
  passRegionId.value = sel.id
  passRegionText.value = sel.full_name
}

async function doPass() {
  const c = passTarget.value
  const level = activeLevels.value[levelIndex.value]
  if (!c || !level || submitting.value) return
  submitting.value = true
  try {
    const index = salesIndex.value
    const selectedTag = tagIndex.value > 0 ? tags.value[tagIndex.value - 1] : null
    const selectedReferrer =
      referrerIndex.value > 0 ? referrerOptions.value[referrerIndex.value - 1] : null
    const detail = passAddress.value.trim()
    await customerApi.audit(c.id, {
      approved: true,
      level_id: level.id,
      tag_id: selectedTag ? selectedTag.id : null,
      // 后端只允许管理员改归属；销售从推广页进来时不要传这个字段
      sales_id: auth.isAdmin && index > 0 ? sales.value[index - 1]?.id : undefined,
      name: passName.value.trim() || undefined,
      contact_name: passContactName.value.trim() || undefined,
      delivery_region_id: passRegionId.value ?? undefined,
      detail_address: detail || undefined,
      address: !passRegionId.value && detail ? detail : undefined,
      referrer_customer_id: selectedReferrer
        ? selectedReferrer.id
        : c.referrer_customer_id
          ? 0
          : undefined,
    })
    uni.showToast({ title: '已通过', icon: 'success' })
    passTarget.value = null
    await load()
  } catch {
    /* request 已提示错误（level_required / customer_not_auditable 等） */
  } finally {
    submitting.value = false
  }
}

function openReject(c: Customer) {
  rejectTarget.value = c
  rejectReason.value = ''
}

async function doReject() {
  const c = rejectTarget.value
  if (!c || submitting.value) return
  const reason = rejectReason.value.trim()
  if (!reason) {
    uni.showToast({ title: '请填写驳回原因', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    await customerApi.audit(c.id, { approved: false, reason })
    uni.showToast({ title: '已驳回', icon: 'success' })
    rejectTarget.value = null
    await load()
  } catch {
    /* request 已提示 */
  } finally {
    submitting.value = false
  }
}

onLoad((query) => {
  const raw = query?.customer_id
  if (raw && !Number.isNaN(Number(raw))) {
    focusCustomerId.value = Number(raw)
  }
})
onShow(load)
</script>

<style lang="scss" scoped>
@import '@/styles/approval.scss';

.rc-phone {
  color: #2563eb;
  text-decoration: underline;
}
.sheet-input {
  width: 100%;
  height: 76rpx;
  padding: 0 20rpx;
  background: #f9fafb;
  border: 2rpx solid #e5e7eb;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #1f2937;
  box-sizing: border-box;
}
</style>
