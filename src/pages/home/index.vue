<template>
  <view class="home-page">
    <scroll-view scroll-y class="content">
      <view class="wrap">
        <!-- 身份条 -->
        <view class="who">
          <view class="avatar">{{ auth.userInitial }}</view>
          <view class="meta">
            <text class="name">{{ auth.user?.real_name || auth.user?.username || '—' }}</text>
            <text class="sub">
              {{ auth.isAdmin ? '管理员 · 全店' : '销售' }}
              <template v-if="auth.user?.invite_code"> · 推广码 {{ auth.user.invite_code }}</template>
            </text>
          </view>
          <view class="promo" @tap="openQrModal">推广码</view>
        </view>

        <!-- 今日经营四格（管理员，第一屏最上；全 0 时整块不渲染） -->
        <view v-if="auth.isAdmin && kpi.length" class="kpi">
          <view
            v-for="k in kpi"
            :key="k.label"
            class="kpi-cell"
            :class="{ warn: k.warn }"
            @tap="k.tap"
          >
            <text class="kpi-label">{{ k.label }}</text>
            <text class="kpi-value">{{ k.value }}</text>
            <text class="kpi-sub">{{ k.sub }}</text>
          </view>
        </view>

        <!-- 今日线路：销售一张大卡 -->
        <view v-if="!auth.isAdmin" class="trip" :class="{ 'trip-empty': !mainTrip }">
          <template v-if="mainTrip">
            <view class="trip-head">
              <text class="trip-name">{{ mainTrip.name || '今日出车' }}</text>
              <text class="trip-status" :class="statusClass(mainTrip.status)">{{ statusLabel(mainTrip.status) }}</text>
            </view>
            <text class="trip-sub">{{ mainTrip.stops_text || '—' }}</text>
            <view class="trip-nums">
              <view class="num"><text class="v">{{ mainTrip.customer_count }}</text><text class="k">家客户</text></view>
              <view class="num"><text class="v">{{ mainTrip.called_count }}</text><text class="k">已询</text></view>
              <view class="num"><text class="v">{{ mainTrip.order_count }}</text><text class="k">订单</text></view>
              <view class="num"><text class="v">{{ formatMoney(mainTrip.order_amount) }}</text><text class="k">金额</text></view>
            </view>
            <view class="trip-bar">
              <view class="bar-txt">
                <text>已送达 {{ mainTrip.delivered_count }} / {{ mainTrip.order_count }} 单</text>
                <text>剩余 {{ remainOrders }} 单</text>
              </view>
              <view class="bar-track"><view class="bar-fill" :style="{ width: tripProgress + '%' }" /></view>
            </view>
            <view class="trip-go" @tap="goTrips">{{ tripAction }}</view>
          </template>
          <template v-else>
            <view @tap="goTrips">
              <text class="trip-name empty">今天没有出车安排</text>
              <text class="trip-sub">有线路时，这里显示今天的送货进度</text>
              <view class="trip-go">查看近期出车 ›</view>
            </view>
          </template>
        </view>

        <!-- 今日待办 -->
        <view class="card">
          <view class="card-head">
            <text class="card-title">今日待办</text>
            <text class="card-extra">{{ todos.length }} 项</text>
          </view>
          <view v-if="todos.length" class="todo-list">
            <view v-for="t in todos" :key="t.code" class="todo" @tap="t.tap">
              <view class="todo-icon" :style="{ background: t.bg }">{{ t.icon }}</view>
              <view class="todo-text">
                <text class="todo-title">{{ t.title }}</text>
                <text class="todo-desc">{{ t.desc }}</text>
              </view>
              <text class="todo-arrow">›</text>
            </view>
          </view>
          <empty-state v-else icon="✅" text="今日暂无待办" padding="48rpx 24rpx" />
        </view>

        <!-- 今日出车（管理员，最多两张小卡） -->
        <view v-if="auth.isAdmin" class="trip-block">
          <view class="trip-block-head">
            <text class="block-title">今日出车 · {{ todayTrips.length }} 趟</text>
            <text class="more-link" @tap="goTrips">全部 ›</text>
          </view>
          <view v-for="t in todayTrips.slice(0, 2)" :key="t.id" class="trip mini" @tap="goTrips">
            <view class="trip-head">
              <text class="trip-name">{{ t.name || '出车' }}</text>
              <text class="trip-status" :class="statusClass(t.status)">{{ statusLabel(t.status) }}</text>
            </view>
            <text class="trip-sub">{{ t.owner_name }} · {{ t.stops_text || '—' }}</text>
            <view class="trip-nums">
              <view class="num"><text class="v">{{ t.customer_count }}</text><text class="k">家客户</text></view>
              <view class="num"><text class="v">{{ t.called_count }}</text><text class="k">已询</text></view>
              <view class="num"><text class="v">{{ formatMoney(t.order_amount) }}</text><text class="k">金额</text></view>
            </view>
            <text class="trip-mini-foot">已送达 {{ t.delivered_count }} / {{ t.order_count }} 单</text>
          </view>
          <view v-if="!todayTrips.length" class="trip empty">
            <text class="trip-name empty">今天没有出车安排</text>
            <text class="trip-sub">安排线路后，客户订单才能挂趟</text>
            <view class="trip-go" @tap="goTrips">去安排 ›</view>
          </view>
        </view>

        <!-- 录单横幅 -->
        <view class="cta" @tap="goOrderCreate">
          <view class="cta-plus">＋</view>
          <view class="cta-text">
            <text class="cta-title">电话录单</text>
            <text class="cta-sub">{{ auth.isAdmin ? '代客下单，选客户后选商品' : '客户来电时，边打边下单' }}</text>
          </view>
          <text class="cta-arrow">›</text>
        </view>

        <!-- 快捷入口 -->
        <view class="card">
          <view class="grid">
            <view class="grid-item" @tap="goCustomers">
              <view class="grid-icon">👥</view>
              <text class="grid-label">客户</text>
            </view>
            <view class="grid-item" @tap="goOrders">
              <view class="grid-icon">📋</view>
              <text class="grid-label">订单</text>
            </view>
            <view class="grid-item" @tap="goPayments">
              <view class="grid-icon">💳</view>
              <text class="grid-label">支付记录</text>
            </view>
            <view class="grid-item" @tap="goPriceQuery">
              <view class="grid-icon">🏷️</view>
              <text class="grid-label">查价</text>
            </view>
            <view class="grid-item" @tap="goMessages">
              <view class="grid-icon">💬</view>
              <text class="grid-label">消息</text>
              <text v-if="unreadCount > 0" class="grid-badge">{{ unreadCount }}</text>
            </view>
            <view v-if="auth.isAdmin" class="grid-item" @tap="goCustomerApprovals">
              <view class="grid-icon">✅</view>
              <text class="grid-label">客户审核</text>
              <text v-if="customerApprovalCount > 0" class="grid-badge">{{ customerApprovalCount }}</text>
            </view>
          </view>
        </view>

        <!-- 今日数据（销售两格；管理员四格在顶部） -->
        <view v-if="!auth.isAdmin && stats.length" class="card">
          <view class="stats">
            <view v-for="s in stats" :key="s.label" class="stat">
              <text class="stat-value">{{ s.value }}</text>
              <text class="stat-label">{{ s.label }}</text>
            </view>
          </view>
        </view>

        <!-- 最近订单 -->
        <view class="card">
          <view class="card-head">
            <text class="card-title">最近订单</text>
            <text class="more-link" @tap="goOrders">查看全部 ›</text>
          </view>
          <view v-if="recentOrders.length" class="order-list">
            <view v-for="o in recentOrders" :key="o.id" class="order-row" @tap="goOrderDetail(o.id)">
              <view class="order-text">
                <text class="order-customer">{{ o.customer_name }}</text>
                <text class="order-time">{{ formatDate(o.created_at, 'MM-DD HH:mm') }}</text>
              </view>
              <view class="order-right">
                <text class="order-amount">{{ formatMoney(o.total_amount) }}</text>
                <text class="order-status" :class="`os-${o.status}`">{{ orderStatusLabel(o.status) }}</text>
              </view>
            </view>
          </view>
          <empty-state v-else icon="📦" text="暂无订单" padding="48rpx 24rpx" />
        </view>
      </view>
    </scroll-view>

    <!-- 推广码弹窗 -->
    <view v-if="qrVisible" class="qr-mask" @tap="qrVisible = false">
      <view class="qr-modal" @tap.stop>
        <view class="qr-modal-head">
          <text class="qr-modal-title">我的专属推广码</text>
          <view class="qr-close" @tap="qrVisible = false">×</view>
        </view>
        <view class="qr-stage" @tap="previewQr">
          <image
            v-if="qrInfo?.qrcode_url"
            :src="qrInfo.qrcode_url"
            mode="aspectFit"
            class="qr-image"
            show-menu-by-longpress
          />
          <view v-else class="qr-placeholder" @tap.stop="loadQrcode()">
            <text class="qr-placeholder-text">
              {{ qrLoading ? '正在生成小程序码...' : (qrInfo?.unavailable_reason || '暂未生成小程序码，点击重试') }}
            </text>
          </view>
        </view>
        <text class="qr-hint">微信扫一扫 · 绑定专属客户</text>
        <view v-if="qrCodeText" class="qr-code-bar">
          <text class="qr-code-label">推广码 {{ qrCodeText }}</text>
          <text class="qr-copy" @tap="copyQrCode">复制</text>
        </view>
        <view class="qr-actions">
          <view class="qr-btn qr-btn-ghost" @tap="goPoster">推广海报</view>
          <view
            class="qr-btn qr-btn-primary"
            :class="{ disabled: !qrInfo?.qrcode_url }"
            @tap="saveQrImage"
          >
            保存图片
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import { useAuthStore } from '@/stores/auth'
import { customerApi, dashboardApi, deliveryApi, messageApi, orderApi, orderApprovalApi, promotionApi, salesApi } from '@/api'
import { formatDate, formatMoney } from '@/utils/format'
import type { DashboardOverview, MyDashboard, Order, PromotionQrcode, RouteTrip, RouteTripStatus } from '@/types'

interface TodoRow {
  code: string
  icon: string
  bg: string
  title: string
  desc: string
  tap: () => void
}

const auth = useAuthStore()

const trips = ref<RouteTrip[]>([])
const myDashboard = ref<MyDashboard | null>(null)
const overview = ref<DashboardOverview | null>(null)
const pendingCustomerCount = ref(0)
const pendingOrderTotal = ref(0)
/** 超额度待审批订单数：overview.todos 里没有这一项，单独取 total。 */
const pendingApprovalTotal = ref(0)
const recentOrders = ref<Order[]>([])
const unreadCount = ref(0)

// ---------- 推广码弹窗 ----------
const qrVisible = ref(false)
const qrLoading = ref(false)
const qrInfo = ref<PromotionQrcode | null>(null)
const qrLoadedUserId = ref<number | null>(null)

const qrCodeText = computed(() => qrInfo.value?.invite_code || auth.user?.invite_code || '')

async function loadQrcode() {
  if (qrLoading.value) return
  qrLoading.value = true
  try {
    qrInfo.value = await promotionApi.qrcode(false)
    qrLoadedUserId.value = auth.user?.id ?? null
  } catch {
    /* request 已提示 */
  } finally {
    qrLoading.value = false
  }
}

function openQrModal() {
  qrVisible.value = true
  const currentUserId = auth.user?.id ?? null
  if (qrLoadedUserId.value !== currentUserId) {
    qrInfo.value = null
  }
  if (!qrInfo.value?.qrcode_url) {
    loadQrcode()
  }
}

function previewQr() {
  if (!qrInfo.value?.qrcode_url) return
  uni.previewImage({ urls: [qrInfo.value.qrcode_url] })
}

function copyQrCode() {
  if (!qrCodeText.value) return
  uni.setClipboardData({ data: qrCodeText.value })
}

function saveQrImage() {
  const url = qrInfo.value?.qrcode_url
  if (!url) return
  // #ifdef H5
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.download = `wdm-promo-${qrCodeText.value || 'qrcode'}.png`
  a.click()
  uni.showToast({ title: '已触发下载，也可长按图片保存', icon: 'none' })
  // #endif
  // #ifndef H5
  uni.downloadFile({
    url,
    success: (res) => {
      if (res.statusCode !== 200) {
        uni.showToast({ title: '下载图片失败', icon: 'none' })
        return
      }
      uni.saveImageToPhotosAlbum({
        filePath: res.tempFilePath,
        success: () => uni.showToast({ title: '已保存到相册', icon: 'success' }),
        fail: () => uni.showToast({ title: '请允许相册权限后重试', icon: 'none' }),
      })
    },
    fail: () => uni.showToast({ title: '下载图片失败', icon: 'none' }),
  })
  // #endif
}

function goPoster() {
  qrVisible.value = false
  uni.navigateTo({ url: '/pages/promotion/poster' })
}

// ---------- 今日线路 ----------
const todayTrips = computed(() => trips.value.filter((t) => t.status !== 'cancelled'))

const mainTrip = computed(() => {
  const list = todayTrips.value
  if (!list.length) return null
  return (
    list.find((t) => t.status === 'delivering') ||
    list.find((t) => t.status === 'planned') ||
    list[0]
  )
})

const remainOrders = computed(() => {
  const t = mainTrip.value
  if (!t) return 0
  return Math.max(t.order_count - t.delivered_count, 0)
})

const tripProgress = computed(() => {
  const t = mainTrip.value
  if (!t || t.order_count <= 0) return 0
  return Math.min(Math.round((t.delivered_count / t.order_count) * 100), 100)
})

const tripAction = computed(() => {
  const t = mainTrip.value
  if (!t) return ''
  if (t.status === 'planned') return '出车'
  if (t.status === 'delivering') return '继续送达'
  return '查看清单 ›'
})

function statusLabel(s: RouteTripStatus): string {
  return { planned: '未出车', delivering: '在途', finished: '已收车', cancelled: '已取消' }[s] || s
}

function statusClass(s: RouteTripStatus): string {
  if (s === 'delivering') return 'st-go'
  if (s === 'finished') return 'st-done'
  return 'st-plan'
}

// ---------- 待办 ----------
const ADMIN_TODO_META: Record<
  string,
  { icon: string; bg: string; title: (n: number) => string; desc: string; go?: () => void }
> = {
  pool_orders: {
    icon: '🚚',
    bg: '#e9f2ff',
    title: (n) => `${n} 张订单待排车`,
    desc: '安排出车后自动挂到对应趟次',
    go: () => goTrips(),
  },
  pending_customers: {
    icon: '✅',
    bg: '#fff2dd',
    title: (n) => `${n} 位客户待审核`,
    desc: '通过推广码注册，审核后即可下单',
    go: () => goCustomerApprovals(),
  },
  pending_returns: {
    icon: '↩️',
    bg: '#f2ecff',
    title: (n) => `${n} 张退货单待确认`,
    desc: '确认后加库存、冲应收、重算利润',
    go: () => goReturnApprovals(),
  },
  credit_applications: {
    icon: '💳',
    bg: '#e8f6ef',
    title: (n) => `${n} 笔调额申请待审批`,
    desc: '批了立即生效，下次录单按新额度校验',
    go: () => goCreditApprovals(),
  },
  negative_stock: {
    icon: '📦',
    bg: '#ffecee',
    title: (n) => `${n} 个商品负库存`,
    desc: '核对库存后再安排出车（回 Web 处理）',
  },
  no_upcoming_trip: {
    icon: '🗓️',
    bg: '#f0f2f5',
    title: () => '近期没有出车安排',
    desc: '出车前先安排线路，客户订单才能挂趟',
    go: () => goTrips(),
  },
}

/** 管理员待办顺序（工作台.md「今日待办」）；订单待审批后端未进 todos，前端单列。 */
const ADMIN_TODO_ORDER = [
  'pool_orders',
  'pending_approval',
  'pending_customers',
  'pending_returns',
  'credit_applications',
  'negative_stock',
  'no_upcoming_trip',
]

const todos = computed<TodoRow[]>(() => {
  if (auth.isAdmin) {
    const byCode = new Map<string, TodoRow>()
    ;(overview.value?.todos || []).forEach((t) => {
      const meta = ADMIN_TODO_META[t.code]
      if (!meta || !t.count) return
      byCode.set(t.code, {
        code: t.code,
        icon: meta.icon,
        bg: meta.bg,
        title: meta.title(t.count),
        desc: meta.desc,
        tap: meta.go || needWeb,
      })
    })
    if (pendingApprovalTotal.value > 0) {
      byCode.set('pending_approval', {
        code: 'pending_approval',
        icon: '📝',
        bg: '#ffecee',
        title: `${pendingApprovalTotal.value} 张超额度订单待审批`,
        desc: '通过后转待配送，待排车期限从此刻算',
        tap: goOrderApprovals,
      })
    }
    return ADMIN_TODO_ORDER.filter((code) => byCode.has(code)).map((code) => byCode.get(code)!)
  }
  const rows: TodoRow[] = []
  if (pendingCustomerCount.value > 0) {
    rows.push({
      code: 'pending_customers',
      icon: '✅',
      bg: '#fff2dd',
      title: `${pendingCustomerCount.value} 位客户待审核`,
      desc: '通过推广码注册，审核后即可下单',
      tap: goCustomerApprovals,
    })
  }
  if (pendingOrderTotal.value > 0) {
    rows.push({
      code: 'pending_orders',
      icon: '📋',
      bg: '#e9f2ff',
      title: `${pendingOrderTotal.value} 张订单待处理`,
      desc: '待审批、待配送或配送中',
      tap: goOrders,
    })
  }
  return rows
})

// ---------- 今日数据 ----------
interface KpiCell {
  label: string
  value: string
  sub: string
  warn?: boolean
  tap: () => void
}

/** 客户审核角标：管理员看 overview.todos，销售看自己名下待审数。 */
const customerApprovalCount = computed(() =>
  auth.isAdmin
    ? overview.value?.todos.find((t) => t.code === 'pending_customers')?.count || 0
    : pendingCustomerCount.value,
)

/** 管理员四格（工作台.md「今日经营四格」）；数据全 0 时整块不渲染。 */
const kpi = computed<KpiCell[]>(() => {
  const t = overview.value?.today
  const m = overview.value?.money
  if (!t || !m) return []
  const allZero =
    !t.sales_order_count &&
    !Number(t.sales_amount) &&
    !Number(t.payment_amount) &&
    !Number(t.gross_profit) &&
    !Number(m.ar_total)
  if (allZero) return []
  return [
    {
      label: '今日销售额',
      value: formatMoney(t.sales_amount),
      sub: `${t.sales_order_count} 单`,
      tap: goOrders,
    },
    {
      label: '今日收款',
      value: formatMoney(t.payment_amount),
      sub: '已扣除退款',
      tap: goPayments,
    },
    {
      label: '今日毛利',
      value: formatMoney(t.gross_profit),
      sub: '按今日送达订单算',
      tap: goProfitHint,
    },
    {
      label: '客户欠款',
      value: formatMoney(m.ar_total),
      sub: `超期 ${formatMoney(m.ar_overdue_total)} · ${m.ar_customer_count} 户`,
      warn: Number(m.ar_overdue_total) > 0,
      tap: goDebtHint,
    },
  ]
})

const stats = computed<{ value: string; label: string }[]>(() => {
  const d = myDashboard.value
  if (!d) return []
  return [
    { value: formatMoney(d.today.sales_amount), label: `今日销售额 · ${d.today.order_count} 单` },
    { value: formatMoney(d.month.sales_amount), label: `本月销售额 · ${d.month.order_count} 单` },
  ]
})

function orderStatusLabel(s: string): string {
  const map: Record<string, string> = {
    pending_approval: '待审批',
    pending: '待配送',
    delivering: '配送中',
    delivered: '已送达',
    cancelled: '已取消',
    rejected: '已驳回',
  }
  return map[s] || s
}

// ---------- 加载 ----------
function todayStr(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

async function loadTrips() {
  const date = todayStr()
  const res = await deliveryApi.listTrips({ date_from: date, date_to: date, page_size: 50 })
  trips.value = res.items
}

async function loadSalesNumbers() {
  const [dash, pendingCust, pendingOrders] = await Promise.allSettled([
    salesApi.myDashboard(),
    customerApi.list({ status: 'pending', page: 1, page_size: 100 }),
    orderApi.list({ status: 'pending_approval,pending,delivering', page: 1, page_size: 1 }),
  ])
  if (dash.status === 'fulfilled') myDashboard.value = dash.value
  if (pendingCust.status === 'fulfilled') pendingCustomerCount.value = pendingCust.value.length
  if (pendingOrders.status === 'fulfilled') pendingOrderTotal.value = pendingOrders.value.total
}

async function loadAdminNumbers() {
  const [overviewRes, approvals] = await Promise.allSettled([
    dashboardApi.overview(),
    // 待办里没有「超额度订单」这一项，单独取待审批列表的 total（D29）
    orderApprovalApi.list({ page: 1, page_size: 1 }),
  ])
  if (overviewRes.status === 'fulfilled') overview.value = overviewRes.value
  if (approvals.status === 'fulfilled') pendingApprovalTotal.value = approvals.value.total
}

async function loadCommon() {
  const [unread, recent] = await Promise.allSettled([
    messageApi.unreadCount(),
    orderApi.list({ page: 1, page_size: 3 }),
  ])
  if (unread.status === 'fulfilled') unreadCount.value = unread.value.count
  if (recent.status === 'fulfilled') recentOrders.value = recent.value.items
}

async function refreshAll() {
  const jobs: Promise<unknown>[] = [loadCommon(), loadTrips().catch(() => undefined)]
  jobs.push(auth.isAdmin ? loadAdminNumbers() : loadSalesNumbers())
  await Promise.allSettled(jobs)
}

onShow(() => {
  auth.restore()
  if (!auth.isLoggedIn) {
    uni.reLaunch({ url: '/pages/auth/login' })
    return
  }
  refreshAll()
})

onPullDownRefresh(async () => {
  await refreshAll()
  uni.stopPullDownRefresh()
})

function goOrderCreate() { uni.navigateTo({ url: '/pages/order/create' }) }
function goCustomers() { uni.switchTab({ url: '/pages/customers/index' }) }
function goCustomerApprovals() { uni.navigateTo({ url: '/pages/home/approvals/customer' }) }
function goOrderApprovals() { uni.navigateTo({ url: '/pages/home/approvals/order' }) }
function goCreditApprovals() { uni.navigateTo({ url: '/pages/home/approvals/credit' }) }
function goReturnApprovals() { uni.navigateTo({ url: '/pages/home/approvals/return' }) }
function goMessages() { uni.navigateTo({ url: '/pages/messages/index' }) }
function goOrders() { uni.navigateTo({ url: '/pages/order/history' }) }
function goPayments() { uni.navigateTo({ url: '/pages/finance/payments' }) }
function goPriceQuery() { uni.navigateTo({ url: '/pages/customers/price-query' }) }
function goTrips() { uni.switchTab({ url: '/pages/trip/index' }) }
function goOrderDetail(id: number) { uni.navigateTo({ url: `/pages/order/detail?id=${id}` }) }
function goProfitHint() { uni.showToast({ title: '利润明细在 Web 成本中心', icon: 'none' }) }
function goDebtHint() { uni.showToast({ title: '欠款明细在 Web 客户账期', icon: 'none' }) }
function needWeb() { uni.showToast({ title: '该待办需在 Web 管理端处理', icon: 'none' }) }
</script>

<style lang="scss" scoped>
.home-page { min-height: 100vh; background: #f4f6f9; }
.content { height: 100vh; box-sizing: border-box; padding-top: var(--status-bar-height, 0px); }
/* H5 的 tabBar 是 fixed 覆盖层，滚动区要减掉它的高度（小程序 tabBar 不占视口，不用减） */
/* #ifdef H5 */
.content { height: calc(100vh - 50px); }
/* #endif */
.wrap { padding: 0 16rpx 160rpx; }

/* 身份条 */
.who { display: flex; align-items: center; gap: 20rpx; padding: 16rpx 8rpx 4rpx; }
.avatar {
  width: 76rpx; height: 76rpx; border-radius: 50%; flex: none;
  background: linear-gradient(135deg, #3b82f6, $uni-color-primary);
  color: #fff; font-size: 30rpx; font-weight: 600;
  display: flex; align-items: center; justify-content: center;
}
.meta { flex: 1; min-width: 0; }
.name { display: block; font-size: 30rpx; font-weight: 600; color: #1f2937; }
.sub { font-size: 22rpx; color: #8894a5; }
.promo {
  flex: none; padding: 10rpx 20rpx; border-radius: 40rpx; background: #fff;
  border: 1rpx solid rgba(37, 99, 235, 0.28); color: $uni-color-primary; font-size: 22rpx;
}

/* 管理员四格 */
.kpi {
  display: flex;
  flex-wrap: wrap;
  margin-top: 16rpx;
  background: #fff;
  border-radius: 20rpx;
  overflow: hidden;
}
.kpi-cell {
  width: 50%;
  box-sizing: border-box;
  padding: 22rpx 24rpx;
}
.kpi-cell:nth-child(odd) { border-right: 1rpx solid #eef1f5; }
.kpi-cell:nth-child(n + 3) { border-top: 1rpx solid #eef1f5; }
.kpi-label { display: block; font-size: 22rpx; color: #6b7889; }
.kpi-value { display: block; margin-top: 8rpx; font-size: 34rpx; font-weight: 700; color: #1f2937; }
.kpi-sub { display: block; margin-top: 4rpx; font-size: 20rpx; color: #8894a5; }
.kpi-cell.warn .kpi-value { color: #dc2626; }
.kpi-cell.warn .kpi-sub { color: #dc2626; opacity: 0.85; }

/* 今日线路 */
.trip {
  margin-top: 16rpx; padding: 28rpx 28rpx 24rpx; border-radius: 24rpx; color: #fff;
  background: linear-gradient(140deg, #16233a, #263d59 62%, #2c4a68);
  box-shadow: 0 12rpx 28rpx rgba(22, 35, 58, 0.28);
}
.trip.mini { padding: 22rpx 24rpx; box-shadow: none; }
.trip.trip-empty { background: #eef2f8; box-shadow: none; }
.trip.trip-empty .trip-name { color: #475569; }
.trip.trip-empty .trip-sub { color: #8894a5; }
.trip.empty { background: #eef2f8; color: #4b5563; box-shadow: none; text-align: center; padding: 40rpx 24rpx; }
.trip-head { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; }
.trip-name { font-size: 30rpx; font-weight: 600; }
.trip-name.empty { display: block; color: #475569; font-size: 28rpx; }
.trip-status { font-size: 20rpx; padding: 4rpx 14rpx; border-radius: 20rpx; flex: none; }
.st-go { background: rgba(52, 211, 153, 0.18); color: #6ee7b7; }
.st-plan { background: rgba(255, 255, 255, 0.16); color: #e2e8f0; }
.st-done { background: rgba(255, 255, 255, 0.12); color: #cbd5e1; }
.trip-sub { display: block; margin-top: 8rpx; font-size: 22rpx; color: rgba(255, 255, 255, 0.62); }
.trip.empty .trip-sub { color: #8894a5; }
.trip-nums { display: flex; margin-top: 24rpx; }
.trip-nums .num { flex: 1; min-width: 0; }
.trip-nums .num + .num { border-left: 1rpx solid rgba(255, 255, 255, 0.14); padding-left: 20rpx; }
.trip-nums .v { display: block; font-size: 34rpx; font-weight: 700; }
.trip-nums .k { display: block; margin-top: 4rpx; font-size: 20rpx; color: rgba(255, 255, 255, 0.6); }
.trip-bar { margin-top: 24rpx; }
.bar-txt { display: flex; justify-content: space-between; font-size: 22rpx; color: rgba(255, 255, 255, 0.7); margin-bottom: 10rpx; }
.bar-track { height: 10rpx; border-radius: 6rpx; background: rgba(255, 255, 255, 0.18); overflow: hidden; }
.bar-fill { height: 100%; border-radius: 6rpx; background: linear-gradient(90deg, #93c5fd, #e0f2fe); }
.trip-go {
  margin-top: 24rpx; height: 76rpx; border-radius: 16rpx; background: rgba(255, 255, 255, 0.94);
  color: #16233a; font-size: 26rpx; font-weight: 600;
  display: flex; align-items: center; justify-content: center;
}
.trip.empty .trip-go { background: #fff; color: $uni-color-primary; }
.trip-mini-foot { display: block; margin-top: 16rpx; font-size: 22rpx; color: rgba(255, 255, 255, 0.66); }
.trip-block { margin-top: 16rpx; display: flex; flex-direction: column; gap: 16rpx; }
.trip-block-head { display: flex; align-items: center; justify-content: space-between; padding: 8rpx 8rpx 0; }
.block-title { font-size: 26rpx; font-weight: 600; color: #1f2937; }

/* 卡片 */
.card { background: #fff; margin-top: 16rpx; border-radius: 20rpx; padding: 24rpx 24rpx 8rpx; }
.card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8rpx; }
.card-title { font-size: 27rpx; font-weight: 600; color: #1f2937; }
.card-extra { font-size: 22rpx; color: #8894a5; }
.more-link { font-size: 22rpx; color: $uni-color-primary; }

/* 待办 */
.todo-list { padding-bottom: 8rpx; }
.todo { display: flex; align-items: center; gap: 20rpx; padding: 18rpx 0; border-top: 1rpx solid #eef1f5; }
.todo:first-child { border-top: 0; }
.todo-icon {
  width: 60rpx; height: 60rpx; border-radius: 16rpx; flex: none;
  display: flex; align-items: center; justify-content: center; font-size: 30rpx;
}
.todo-text { flex: 1; min-width: 0; }
.todo-title { display: block; font-size: 26rpx; font-weight: 500; color: #1f2937; }
.todo-desc { font-size: 22rpx; color: #8894a5; }
.todo-arrow { font-size: 34rpx; color: #cbd5e1; }

/* 录单横幅 */
.cta {
  margin-top: 16rpx; padding: 24rpx 28rpx; border-radius: 20rpx;
  background: linear-gradient(135deg, #3b82f6, $uni-color-primary);
  display: flex; align-items: center; gap: 20rpx; color: #fff;
  box-shadow: 0 10rpx 24rpx rgba(37, 99, 235, 0.28);
}
.cta-plus {
  width: 64rpx; height: 64rpx; border-radius: 18rpx; flex: none; font-size: 36rpx;
  background: rgba(255, 255, 255, 0.2); display: flex; align-items: center; justify-content: center;
}
.cta-text { flex: 1; }
.cta-title { display: block; font-size: 30rpx; font-weight: 600; }
.cta-sub { font-size: 22rpx; color: rgba(255, 255, 255, 0.8); }
.cta-arrow { font-size: 36rpx; color: rgba(255, 255, 255, 0.8); }

/* 快捷入口 */
.grid { display: flex; padding: 8rpx 0 20rpx; }
.grid-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 12rpx; position: relative; }
.grid-icon {
  width: 84rpx; height: 84rpx; border-radius: 24rpx; background: #f3f6fa;
  display: flex; align-items: center; justify-content: center; font-size: 38rpx;
}
.grid-label { font-size: 22rpx; color: #4b5563; }
.grid-badge {
  position: absolute; top: -4rpx; right: 26rpx; min-width: 28rpx; height: 28rpx; line-height: 28rpx;
  padding: 0 8rpx; border-radius: 14rpx; background: #dc2626; color: #fff; font-size: 18rpx; text-align: center;
}

/* 今日数据 */
.stats { display: flex; padding: 4rpx 0 20rpx; }
.stat { flex: 1; min-width: 0; }
.stat + .stat { border-left: 1rpx solid #eef1f5; padding-left: 24rpx; }
.stat-value { display: block; font-size: 38rpx; font-weight: 700; color: #1f2937; }
.stat-label { display: block; margin-top: 6rpx; font-size: 21rpx; color: #8894a5; }

/* 最近订单 */
.order-list { padding-bottom: 8rpx; }
.order-row { display: flex; align-items: center; gap: 16rpx; padding: 18rpx 0; border-top: 1rpx solid #eef1f5; }
.order-row:first-child { border-top: 0; }
.order-text { flex: 1; min-width: 0; }
.order-customer { display: block; font-size: 26rpx; font-weight: 500; color: #1f2937; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.order-time { font-size: 21rpx; color: #8894a5; }
.order-right { text-align: right; flex: none; }
.order-amount { display: block; font-size: 27rpx; font-weight: 600; color: #1f2937; }
.order-status { display: inline-block; margin-top: 4rpx; padding: 2rpx 10rpx; border-radius: 8rpx; font-size: 19rpx; }
.os-pending_approval { background: #fff2dd; color: #a96a10; }
.os-pending { background: #e9f2ff; color: #2570b3; }
.os-delivering { background: #e9f2ff; color: #2570b3; }
.os-delivered { background: #e6f7ee; color: #1f8459; }
.os-cancelled, .os-rejected { background: #f0f2f5; color: #77849a; }

/* 推广码弹窗 */
.qr-mask {
  position: fixed;
  inset: 0;
  z-index: 999;
  background: rgba(15, 23, 42, 0.56);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
}
.qr-modal {
  width: 100%;
  max-width: 600rpx;
  background: #fff;
  border-radius: 28rpx;
  padding: 32rpx 32rpx 28rpx;
  box-sizing: border-box;
  text-align: center;
}
.qr-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}
.qr-modal-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1f2937;
}
.qr-close {
  width: 52rpx;
  height: 52rpx;
  border-radius: 50%;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 36rpx;
  line-height: 52rpx;
  text-align: center;
}
.qr-stage {
  width: 380rpx;
  height: 380rpx;
  margin: 0 auto 20rpx;
  padding: 16rpx;
  border-radius: 20rpx;
  border: 2rpx solid #e5e7eb;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.qr-image {
  width: 100%;
  height: 100%;
}
.qr-placeholder {
  padding: 24rpx;
}
.qr-placeholder-text {
  font-size: 24rpx;
  color: #6b7280;
  line-height: 1.6;
}
.qr-hint {
  display: block;
  font-size: 24rpx;
  color: #6b7280;
}
.qr-code-bar {
  margin-top: 20rpx;
  padding: 14rpx 24rpx;
  border-radius: 14rpx;
  background: #f3f6fa;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.qr-code-label {
  font-size: 26rpx;
  font-weight: 600;
  color: #1f2937;
  font-family: -apple-system, monospace;
}
.qr-copy {
  font-size: 24rpx;
  color: $uni-color-primary;
  font-weight: 500;
}
.qr-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 24rpx;
}
.qr-btn {
  flex: 1;
  height: 76rpx;
  border-radius: 16rpx;
  font-size: 26rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.qr-btn-ghost {
  background: #f3f6fa;
  color: #374151;
}
.qr-btn-primary {
  background: $uni-color-primary;
  color: #fff;
}
.qr-btn-primary.disabled {
  opacity: 0.45;
}
</style>
