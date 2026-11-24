<template>
  <view class="order-create-page">
    <!-- 顶部固定：客户条 -->
    <view v-if="cart.customerName" class="customer-bar" @tap="goSelectCustomer">
      <text class="cust-tag">客户</text>
      <text class="cust-name">{{ cart.customerName }}</text>
      <text class="cust-switch">切换 ›</text>
    </view>
    <view v-else class="customer-bar empty" @tap="goSelectCustomer">
      <text class="cust-warn-txt">请先选择客户，选定后显示专属批发价</text>
      <view class="cust-select-btn">选客户</view>
    </view>

    <!-- 顶部固定：搜索栏 -->
    <view class="search-bar">
      <view class="search-box">
        <text class="search-ico">🔍</text>
        <input
          v-model="keyword"
          class="search-input"
          placeholder="搜商品名 / 货号（如 花椒、白糖）"
          confirm-type="search"
          @input="onSearchInput"
          @confirm="onSearchConfirm"
        />
        <view v-if="keyword" class="clear-btn" @tap="onClearSearch">×</view>
      </view>
    </view>

    <!-- 中间主体：仅左侧分类与右侧商品各自滚动 -->
    <view class="main-body">
      <scroll-view
        class="cat-nav"
        scroll-y
        :scroll-into-view="activeCatNavId"
        scroll-with-animation
      >
        <view
          v-for="cat in categories"
          :key="cat.id"
          :id="`cat-${cat.id}`"
          class="cat-item"
          :class="{ freq: cat.isFreq, active: activeCatId === cat.id && !isSearching }"
          @tap="onSelectCategory(cat)"
        >
          <text v-if="cat.isFreq" class="star">★</text>{{ cat.name }}
        </view>
      </scroll-view>

      <view class="goods-pane">
        <view class="pane-hd">
          <text class="pane-title">{{ paneTitle }}</text>
          <text v-if="!isSearching" class="pane-sub">{{ paneSub }}</text>
          <view v-else class="back-cat-btn" @tap="onClearSearch">返回分类</view>
        </view>

        <!-- 二级子分类横向胶囊栏 -->
        <scroll-view
          v-if="!isSearching && subCategories.length"
          class="sub-cat-scroll"
          scroll-x
          :show-scrollbar="false"
        >
          <view class="sub-cat-row">
            <view
              class="sub-pill"
              :class="{ active: activeSubCatId === null }"
              @tap="onSelectSubCategory(null)"
            >全部</view>
            <view
              v-for="sub in subCategories"
              :key="sub.id"
              class="sub-pill"
              :class="{ active: activeSubCatId === sub.id }"
              @tap="onSelectSubCategory(sub.id)"
            >{{ sub.name }}</view>
          </view>
        </scroll-view>

        <!-- 滚动容器包装层：保证两个 scroll-view 在 H5/小程序都严格占满剩余高度 -->
        <view class="goods-scroll-wrap">
          <!-- 模式一：全分类无级连续滑动（v-show 保活以保留滚动位置） -->
          <scroll-view
            v-show="!isFilterMode"
            class="goods-scroll stream-scroll"
            scroll-y
            :scroll-top="streamScrollTop"
            :scroll-into-view="scrollIntoView"
            :scroll-with-animation="scrollWithAnim"
            :upper-threshold="120"
            :lower-threshold="700"
            :refresher-enabled="streamStartIdx > 0"
            :refresher-threshold="36"
            :refresher-triggered="prevRefreshing"
            @refresherrefresh="onLoadPrevCategory"
            @scrolltoupper="onStreamScrollToUpper"
            @scroll="onStreamScroll"
            @scrolltolower="onStreamLoadMore"
            @touchstart="onStreamTouchStart"
            @touchend="onStreamTouchEnd"
          >
            <view
              v-if="streamStartIdx > 0 && prevCatName"
              class="prev-cat-bar"
              @tap="onClickPrevCategory"
            >
              <text>
                {{ prevLoading ? `正在加载上一分类：${prevCatName}...` : `↑ 上一分类：${prevCatName}（上滑或点击查看）` }}
              </text>
            </view>

            <view v-if="!streamLoading && !sections.length" class="empty-wrap">
              <empty-state icon="📦" text="暂无上架商品" padding="80rpx 24rpx" />
            </view>

            <view
              v-for="sec in sections"
              :key="sec.id"
              :id="`sec-${sec.id}`"
              class="sec-block"
            >
              <view class="sec-hd" :class="{ freq: sec.isFreq }">
                <text class="sec-title">{{ sec.title }}</text>
                <text v-if="sec.subTitle" class="sec-sub">{{ sec.subTitle }}</text>
              </view>

              <view v-for="item in sec.products" :key="item.spu_id" class="g-card">
                <view class="g-thumb" @tap="goSpuDetail(item.spu_id)">
                  <text v-if="item.is_frequent && !sec.isFreq" class="freq-tag">常购</text>
                  <image v-if="item.image_url" class="g-img" :src="item.image_url" mode="aspectFill" lazy-load />
                  <text v-else class="g-placeholder">{{ shortTitle(item.name) }}</text>
                </view>

                <view class="g-info">
                  <view @tap="goSpuDetail(item.spu_id)">
                    <text class="g-name">{{ item.name }}</text>
                    <text class="g-spec">
                      {{ item.sku_count > 1 ? `${item.sku_count}种规格可选` : item.default_sku_spec }} · {{ item.code }}
                    </text>
                  </view>

                  <view class="g-foot">
                    <view v-if="item.price !== null && item.price !== undefined" class="g-price">
                      <text class="yen">¥</text>
                      <text class="num">{{ formatPriceNum(item.price) }}</text>
                      <text class="unit">{{ item.sku_count > 1 ? '起' : '/' + item.default_sku_unit }}</text>
                    </view>
                    <view v-else class="price-hidden-tag">选客户看价</view>

                    <view v-if="item.sku_count > 1" class="spec-btn" @tap="openSpecSheet(item)">
                      选规格
                      <view v-if="cart.spuQty(item.spu_id) > 0" class="spec-badge">
                        {{ formatQty(cart.spuQty(item.spu_id)) }}
                      </view>
                    </view>

                    <view v-else class="stepper">
                      <template v-if="cart.skuQty(item.default_sku_id) > 0">
                        <view class="step-btn minus" @tap="stepSingle(item, -1)">−</view>
                        <text class="step-num">{{ formatQty(cart.skuQty(item.default_sku_id)) }}</text>
                      </template>
                      <view class="step-btn plus" @tap="stepSingle(item, 1)">+</view>
                    </view>
                  </view>
                </view>
              </view>

              <view v-if="sec.loading" class="list-footer">加载中...</view>
            </view>

            <view v-if="streamLoading && !sections.length" class="list-footer">加载中...</view>
            <view v-else-if="sections.length && streamHasMore" class="list-footer">
              {{ streamLoading ? '正在加载更多商品...' : '继续下滑查看更多分类' }}
            </view>
            <view v-else-if="sections.length && !streamHasMore" class="list-footer">已浏览全部分类商品</view>
          </scroll-view>

          <!-- 模式二：搜索 / 二级子分类筛选 -->
          <scroll-view
            v-if="isFilterMode"
            class="goods-scroll"
            scroll-y
            :scroll-top="filterScrollTop"
            :lower-threshold="600"
            @scrolltolower="onFilterLoadMore"
          >
            <view v-if="!filterLoading && !filterProducts.length" class="empty-wrap">
              <empty-state icon="📦" text="未找到相关商品" padding="80rpx 24rpx" />
            </view>

            <view v-for="item in filterProducts" :key="item.spu_id" class="g-card">
              <view class="g-thumb" @tap="goSpuDetail(item.spu_id)">
                <text v-if="item.is_frequent" class="freq-tag">常购</text>
                <image v-if="item.image_url" class="g-img" :src="item.image_url" mode="aspectFill" lazy-load />
                <text v-else class="g-placeholder">{{ shortTitle(item.name) }}</text>
              </view>

              <view class="g-info">
                <view @tap="goSpuDetail(item.spu_id)">
                  <text class="g-name">{{ item.name }}</text>
                  <text class="g-spec">
                    {{ item.sku_count > 1 ? `${item.sku_count}种规格可选` : item.default_sku_spec }} · {{ item.code }}
                  </text>
                </view>

                <view class="g-foot">
                  <view v-if="item.price !== null && item.price !== undefined" class="g-price">
                    <text class="yen">¥</text>
                    <text class="num">{{ formatPriceNum(item.price) }}</text>
                    <text class="unit">{{ item.sku_count > 1 ? '起' : '/' + item.default_sku_unit }}</text>
                  </view>
                  <view v-else class="price-hidden-tag">选客户看价</view>

                  <view v-if="item.sku_count > 1" class="spec-btn" @tap="openSpecSheet(item)">
                    选规格
                    <view v-if="cart.spuQty(item.spu_id) > 0" class="spec-badge">
                      {{ formatQty(cart.spuQty(item.spu_id)) }}
                    </view>
                  </view>

                  <view v-else class="stepper">
                    <template v-if="cart.skuQty(item.default_sku_id) > 0">
                      <view class="step-btn minus" @tap="stepSingle(item, -1)">−</view>
                      <text class="step-num">{{ formatQty(cart.skuQty(item.default_sku_id)) }}</text>
                    </template>
                    <view class="step-btn plus" @tap="stepSingle(item, 1)">+</view>
                  </view>
                </view>
              </view>
            </view>

            <view v-if="filterLoading" class="list-footer">加载中...</view>
            <view v-else-if="filterProducts.length && !filterHasMore" class="list-footer">
              <text>已显示全部商品</text>
              <view v-if="!isSearching && activeSubCatId !== null" class="back-stream-btn" @tap="onSelectSubCategory(null)">
                查看全部分类
              </view>
            </view>
          </scroll-view>
        </view>
      </view>
    </view>

    <!-- 底部固定：购物车条 -->
    <view class="bottom-bar">
      <view class="cart-info" @tap="toggleCartSheet">
        <view class="cart-icon-wrap">
          <text class="cart-icon">🛒</text>
          <text v-if="cart.totalCount > 0" class="cart-badge">{{ formatQty(cart.totalCount) }}</text>
        </view>
        <view class="cart-amount">
          <view class="amount-row">
            <text class="amount-label">合计</text>
            <text v-if="cart.hasBelowMin" class="low-price-tag">含低价审批</text>
          </view>
          <text class="amount">{{ formatMoney(cart.totalAmount) }}</text>
        </view>
      </view>
      <button class="btn-primary next-btn" :disabled="cart.isEmpty" @tap="goConfirm">去结算</button>
    </view>

    <!-- 底部购物车弹出层 -->
    <cart-sheet :visible="cartSheetVisible" @close="cartSheetVisible = false" />

    <!-- 多规格选规格抽屉 -->
    <view v-if="sheetProduct" class="sheet-mask" @tap="closeSpecSheet">
      <view class="sheet-panel" @tap.stop>
        <view class="sheet-hd">
          <view class="sheet-thumb">
            <image v-if="sheetProduct.image_url" class="g-img" :src="sheetProduct.image_url" mode="aspectFill" />
            <text v-else class="g-placeholder">{{ shortTitle(sheetProduct.name) }}</text>
          </view>
          <view class="sheet-meta">
            <text class="sheet-name">{{ sheetProduct.name }}</text>
            <text class="sheet-code">{{ sheetProduct.code }}</text>
            <text class="sheet-detail-link" @tap="goDetailFromSheet">看详情 / 改价 ›</text>
          </view>
          <view class="sheet-close" @tap="closeSpecSheet">×</view>
        </view>

        <scroll-view scroll-y class="sheet-body">
          <view v-if="sheetLoading" class="sheet-loading">加载规格中...</view>
          <view v-for="sku in sheetSkus" :key="sku.id" class="sheet-sku-row">
            <view class="sheet-sku-info">
              <text class="sheet-sku-name">{{ skuSpecText(sku) }}</text>
              <text class="sheet-sku-sub">
                {{ skuConvText(sku) }}
                <template v-if="sheetStockText(sku)"> · {{ sheetStockText(sku) }}</template>
              </text>
            </view>
            <view class="sheet-sku-right">
              <text class="sheet-sku-price">{{ sheetPriceText(sku) }}</text>
              <view class="stepper">
                <template v-if="cart.skuQty(sku.id) > 0">
                  <view class="step-btn minus" @tap="stepSheetSku(sku, -1)">−</view>
                  <text class="step-num">{{ formatQty(cart.skuQty(sku.id)) }}</text>
                </template>
                <view class="step-btn plus" @tap="stepSheetSku(sku, 1)">+</view>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, reactive, ref } from 'vue'
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import EmptyState from '@/components/EmptyState.vue'
import CartSheet from '@/components/CartSheet.vue'
import { useCartStore } from '@/stores/cart'
import { customerApi, priceApi, spuApi } from '@/api'
import { formatMoney, formatQty, toNum } from '@/utils/format'
import type { CatalogCategoryNode, CatalogProductCard, Money, QuoteItem, Sku } from '@/types'

interface NavCategory {
  id: string
  catId: number | null
  name: string
  isFreq: boolean
  children: CatalogCategoryNode[]
}

interface StreamSection {
  id: string
  catId: number | null
  catIndex: number
  name: string
  isFreq: boolean
  title: string
  subTitle: string
  products: CatalogProductCard[]
  total: number
  page: number
  hasMore: boolean
  loaded: boolean
  loading: boolean
}

interface SectionOffset {
  id: string
  top: number
  bottom: number
}

const PAGE_SIZE = 20
const PRELOAD_BUFFER_PX = 900

const instance = getCurrentInstance()
const cart = useCartStore()

const keyword = ref('')
const categories = ref<NavCategory[]>([])
const activeCatId = ref('')
const activeCatNavId = ref('')
const subCategories = ref<CatalogCategoryNode[]>([])
const activeSubCatId = ref<number | null>(null)
const paneTitle = ref('全部商品')
const paneSub = ref('')

// 模式一：无级分类流
const isFilterMode = ref(false)
const sections = ref<StreamSection[]>([])
const streamStartIdx = ref(0)
const streamEndIdx = ref(-1)
const prevCatName = ref('')
const prevRefreshing = ref(false)
const prevLoading = ref(false)
const streamLoading = ref(false)
const streamHasMore = ref(false)
const streamScrollTop = ref(0)
const scrollIntoView = ref('')
const scrollWithAnim = ref(false)

// 模式二：搜索 / 二级子分类筛选
const filterProducts = ref<CatalogProductCard[]>([])
const filterPage = ref(1)
const filterHasMore = ref(false)
const filterLoading = ref(false)
const filterScrollTop = ref(0)

// 选规格抽屉 & 购物车抽屉
const sheetProduct = ref<CatalogProductCard | null>(null)
const sheetSkus = ref<Sku[]>([])
const sheetQuotes = reactive<Record<number, QuoteItem>>({})
const sheetLoading = ref(false)
const cartSheetVisible = ref(false)

// 内部滚动测量与并发控制（非响应式，避免额外渲染开销）
let searchTimer: ReturnType<typeof setTimeout> | null = null
let filterRequestSeq = 0
let streamVersion = 0
let loadingStream = false
let loadingPrev = false
let curScrollTop = 0
let lastScrollTop = 0
let touchStartY = 0
let touchStartScrollTop = 0
let viewportHeight = 600
let contentHeight = 0
let sectionOffsets: SectionOffset[] = []
let navLockUntil = 0
let loadedCustomerId: number | null | undefined = undefined

const isSearching = computed(() => keyword.value.trim().length > 0)

function shortTitle(name: string): string {
  return (name || '').slice(0, 2) || '商品'
}

function formatPriceNum(v: Money): string {
  return toNum(v).toFixed(2)
}

function clearSearchTimer() {
  if (searchTimer) {
    clearTimeout(searchTimer)
    searchTimer = null
  }
}

function makeSection(cat: NavCategory, catIndex: number): StreamSection {
  return {
    id: cat.id,
    catId: cat.catId,
    catIndex,
    name: cat.name,
    isFreq: cat.isFreq,
    title: cat.isFreq ? '★ 常购商品' : cat.name,
    subTitle: cat.isFreq ? '按历史已送达订单置顶' : '',
    products: [],
    total: 0,
    page: 0,
    hasMore: true,
    loaded: false,
    loading: false,
  }
}

function applyHeaderForCat(catId: string) {
  const cat = categories.value.find((c) => c.id === catId)
  const sec = sections.value.find((s) => s.id === catId)
  if (!cat) {
    activeCatId.value = ''
    activeCatNavId.value = ''
    subCategories.value = []
    paneTitle.value = '全部商品'
    paneSub.value = '0 款'
    return
  }
  activeCatId.value = cat.id
  activeCatNavId.value = `cat-${cat.id}`
  subCategories.value = cat.children || []
  paneTitle.value = cat.isFreq ? '★ 常购商品' : cat.name
  if (cat.isFreq) {
    paneSub.value = '按历史已送达订单置顶'
  } else if (sec && sec.loaded) {
    paneSub.value = `${sec.total} 款`
  } else {
    paneSub.value = ''
  }
}

async function loadCategories() {
  try {
    const res = await spuApi.catalogCategories(cart.customerId)
    const list: NavCategory[] = []
    if (res.has_frequent) {
      list.push({ id: 'freq', catId: null, name: '常购', isFreq: true, children: [] })
    }
    res.items.forEach((c) => {
      list.push({
        id: String(c.id),
        catId: c.id,
        name: c.name,
        isFreq: false,
        children: c.children || [],
      })
    })
    categories.value = list
    keyword.value = ''
    activeSubCatId.value = null
    isFilterMode.value = false

    if (!list.length) {
      sections.value = []
      activeCatId.value = ''
      activeCatNavId.value = ''
      subCategories.value = []
      paneTitle.value = '全部商品'
      paneSub.value = '0 款'
      streamHasMore.value = false
      streamLoading.value = false
      return
    }
    await initStreamFrom(0)
  } catch {
    categories.value = []
    sections.value = []
    streamHasMore.value = false
    streamLoading.value = false
  }
}

async function initStreamFrom(startIdx: number) {
  const cats = categories.value
  if (!cats.length || startIdx < 0 || startIdx >= cats.length) return

  const version = ++streamVersion
  loadingStream = false
  loadingPrev = false
  curScrollTop = 0
  lastScrollTop = 0
  contentHeight = 0
  sectionOffsets = []

  const firstCat = cats[startIdx]
  const firstSec = makeSection(firstCat, startIdx)

  isFilterMode.value = false
  activeSubCatId.value = null
  sections.value = [firstSec]
  streamStartIdx.value = startIdx
  streamEndIdx.value = startIdx
  prevCatName.value = startIdx > 0 ? cats[startIdx - 1].name : ''
  prevRefreshing.value = false
  prevLoading.value = false
  streamHasMore.value = true
  streamLoading.value = false
  scrollWithAnim.value = false
  scrollIntoView.value = ''
  streamScrollTop.value = streamScrollTop.value === 0 ? 1 : 0
  applyHeaderForCat(firstCat.id)

  await loadNextStreamChunk(version)
}

async function loadNextStreamChunk(version: number) {
  if (version !== streamVersion) return
  if (loadingStream || isFilterMode.value) return
  if (!categories.value.length || !sections.value.length) return

  const nextSections = sections.value.slice()
  let targetSecIdx = nextSections.length - 1
  let nextEndIdx = streamEndIdx.value

  if (!nextSections[targetSecIdx].hasMore) {
    if (streamEndIdx.value + 1 >= categories.value.length) {
      streamHasMore.value = false
      streamLoading.value = false
      return
    }
    nextEndIdx = streamEndIdx.value + 1
    nextSections.push(makeSection(categories.value[nextEndIdx], nextEndIdx))
    targetSecIdx = nextSections.length - 1
  }

  const targetSec = nextSections[targetSecIdx]
  const nextPage = targetSec.page + 1

  loadingStream = true
  nextSections[targetSecIdx] = { ...targetSec, loading: true }
  sections.value = nextSections
  streamEndIdx.value = nextEndIdx
  streamLoading.value = true

  try {
    const res = await spuApi.catalog({
      customer_id: cart.customerId || undefined,
      frequent: targetSec.isFreq || undefined,
      category_id: targetSec.isFreq ? undefined : (targetSec.catId ?? undefined),
      page: nextPage,
      page_size: PAGE_SIZE,
    })
    if (version !== streamVersion) {
      loadingStream = false
      return
    }

    const rows = res.items || []
    const total = Number(res.total) || rows.length

    const curSections = sections.value.slice()
    const curIdx = curSections.findIndex((s) => s.id === targetSec.id)
    if (curIdx < 0) {
      loadingStream = false
      return
    }
    const curSec = curSections[curIdx]
    const merged = curSec.products.concat(rows)
    // 常购接口最多 20 条且不分页，普通分类按总数判断是否还有下一页
    const secHasMore = curSec.isFreq ? false : rows.length > 0 && merged.length < total
    const subTitle = curSec.isFreq ? '按历史已送达订单置顶' : `${total} 款`

    curSections[curIdx] = {
      ...curSec,
      products: merged,
      total,
      page: nextPage,
      hasMore: secHasMore,
      loaded: true,
      loading: false,
      subTitle,
    }

    sections.value = curSections
    streamLoading.value = false
    streamHasMore.value = secHasMore || streamEndIdx.value + 1 < categories.value.length
    if (activeCatId.value === curSec.id && !curSec.isFreq) {
      paneSub.value = subTitle
    }

    loadingStream = false
    await nextTick()
    measureAndEnsureFilled(version)
  } catch {
    loadingStream = false
    if (version === streamVersion) {
      const curSections = sections.value.slice()
      const curIdx = curSections.findIndex((s) => s.id === targetSec.id)
      if (curIdx >= 0) {
        curSections[curIdx] = { ...curSections[curIdx], loading: false }
      }
      sections.value = curSections
      streamLoading.value = false
    }
  }
}

function measureAndEnsureFilled(version: number) {
  if (version !== streamVersion || isFilterMode.value) return
  const query = instance?.proxy
    ? uni.createSelectorQuery().in(instance.proxy)
    : uni.createSelectorQuery()
  query.select('.stream-scroll').boundingClientRect()
  query.selectAll('.sec-block').boundingClientRect()
  query.exec((res: any) => {
    if (version !== streamVersion || isFilterMode.value) return
    const scrollRect = res && res[0]
    const secRects: any[] = (res && res[1]) || []
    if (!scrollRect || !secRects.length) return

    const offsets: SectionOffset[] = []
    secRects.forEach((rect, idx) => {
      const sec = sections.value[idx]
      if (!sec) return
      offsets.push({
        id: sec.id,
        top: rect.top - scrollRect.top + curScrollTop,
        bottom: rect.bottom - scrollRect.top + curScrollTop,
      })
    })
    sectionOffsets = offsets

    const lastRect = secRects[secRects.length - 1]
    viewportHeight = scrollRect.height || 600
    contentHeight = lastRect.bottom - scrollRect.top + curScrollTop
    const remainingBelowViewport = lastRect.bottom - scrollRect.bottom
    if (remainingBelowViewport < PRELOAD_BUFFER_PX && streamHasMore.value && !loadingStream) {
      void loadNextStreamChunk(version)
    }
  })
}

function onStreamScroll(e: any) {
  const sTop: number = e.detail?.scrollTop ?? 0
  const isScrollingUp = sTop < lastScrollTop
  lastScrollTop = sTop
  curScrollTop = sTop

  const sHeight: number = e.detail?.scrollHeight || contentHeight
  if (sHeight > 0 && streamHasMore.value && !loadingStream) {
    const remaining = sHeight - (sTop + viewportHeight)
    if (remaining < PRELOAD_BUFFER_PX) {
      void loadNextStreamChunk(streamVersion)
    }
  }

  if (
    isScrollingUp &&
    sTop <= 120 &&
    streamStartIdx.value > 0 &&
    !loadingPrev &&
    Date.now() >= navLockUntil
  ) {
    void prependPrevCategory(false)
    return
  }

  if (Date.now() < navLockUntil) return
  if (!sectionOffsets.length) return

  const anchorY = sTop + 30
  let hitId = sectionOffsets[0].id
  for (let i = 0; i < sectionOffsets.length; i++) {
    if (sectionOffsets[i].top <= anchorY) {
      hitId = sectionOffsets[i].id
    } else {
      break
    }
  }

  if (hitId && hitId !== activeCatId.value) {
    applyHeaderForCat(hitId)
  }
}

function onStreamScrollToUpper() {
  if (isFilterMode.value) return
  if (streamStartIdx.value > 0 && !loadingPrev && Date.now() >= navLockUntil) {
    void prependPrevCategory(false)
  }
}

function onStreamTouchStart(e: any) {
  const touch = e.touches && e.touches[0]
  if (!touch) return
  touchStartY = touch.clientY
  touchStartScrollTop = curScrollTop
}

function onStreamTouchEnd(e: any) {
  if (isFilterMode.value || streamStartIdx.value <= 0 || loadingPrev) return
  const touch = e.changedTouches && e.changedTouches[0]
  if (!touch) return
  const deltaY = touch.clientY - touchStartY
  if (touchStartScrollTop <= 8 && deltaY > 45) {
    void prependPrevCategory(false)
  }
}

function onStreamLoadMore() {
  if (!streamHasMore.value || loadingStream) return
  void loadNextStreamChunk(streamVersion)
}

function onLoadPrevCategory() {
  if (streamStartIdx.value <= 0) {
    prevRefreshing.value = false
    return
  }
  prevRefreshing.value = true
  void prependPrevCategory(false)
}

function onClickPrevCategory() {
  void prependPrevCategory(true)
}

async function prependPrevCategory(fromClick: boolean) {
  if (isFilterMode.value || streamStartIdx.value <= 0 || loadingPrev) {
    prevRefreshing.value = false
    return
  }
  const version = streamVersion
  const prevIdx = streamStartIdx.value - 1
  const prevCat = categories.value[prevIdx]
  if (!prevCat) {
    prevRefreshing.value = false
    return
  }

  loadingPrev = true
  const oldScrollTop = curScrollTop
  prevLoading.value = true

  try {
    const allRows: CatalogProductCard[] = []
    let total = 0
    let p = 1
    const maxPages = prevCat.isFreq ? 1 : 5

    while (p <= maxPages) {
      const res = await spuApi.catalog({
        customer_id: cart.customerId || undefined,
        frequent: prevCat.isFreq || undefined,
        category_id: prevCat.isFreq ? undefined : (prevCat.catId ?? undefined),
        page: p,
        page_size: PAGE_SIZE,
      })
      if (version !== streamVersion) {
        loadingPrev = false
        return
      }
      const rows = res.items || []
      total = Number(res.total) || allRows.length + rows.length
      allRows.push(...rows)
      if (prevCat.isFreq || rows.length < PAGE_SIZE || allRows.length >= total) {
        break
      }
      p += 1
    }

    if (version !== streamVersion) {
      loadingPrev = false
      return
    }

    const prevSec: StreamSection = {
      ...makeSection(prevCat, prevIdx),
      products: allRows,
      total,
      page: p,
      hasMore: false,
      loaded: true,
      loading: false,
      subTitle: prevCat.isFreq ? '按历史已送达订单置顶' : `${total} 款`,
    }

    sections.value = [prevSec, ...sections.value]
    streamStartIdx.value = prevIdx
    prevCatName.value = prevIdx > 0 ? categories.value[prevIdx - 1].name : ''
    prevLoading.value = false
    prevRefreshing.value = false
    scrollIntoView.value = ''
    scrollWithAnim.value = false
    navLockUntil = Date.now() + 500

    if (fromClick) {
      streamScrollTop.value = streamScrollTop.value === 0 ? 1 : 0
      applyHeaderForCat(prevCat.id)
      await nextTick()
      curScrollTop = 0
      lastScrollTop = 0
      loadingPrev = false
      measureAndEnsureFilled(version)
      return
    }

    await nextTick()
    if (version !== streamVersion) {
      loadingPrev = false
      return
    }
    const query = instance?.proxy
      ? uni.createSelectorQuery().in(instance.proxy)
      : uni.createSelectorQuery()
    query.select(`#sec-${prevSec.id}`).boundingClientRect()
    query.exec((res: any) => {
      if (version !== streamVersion) {
        loadingPrev = false
        return
      }
      const rect = res && res[0]
      const prevHeight = rect ? rect.height : 0
      const targetTop = Math.max(0, Math.round(prevHeight + oldScrollTop - 60))
      const safeTop = targetTop === streamScrollTop.value ? targetTop + 1 : targetTop
      curScrollTop = safeTop
      lastScrollTop = safeTop
      scrollWithAnim.value = false
      streamScrollTop.value = safeTop
      if (prevHeight > 0 && targetTop < prevHeight) {
        applyHeaderForCat(prevCat.id)
      }
      loadingPrev = false
      nextTick(() => measureAndEnsureFilled(version))
    })
  } catch {
    loadingPrev = false
    if (version === streamVersion) {
      prevLoading.value = false
      prevRefreshing.value = false
    }
  }
}

// ---------- 模式二：搜索 / 二级子分类筛选 ----------

async function loadFilterProducts(reset = true) {
  if (filterLoading.value && !reset) return
  const kw = keyword.value.trim()
  const nextPage = reset ? 1 : filterPage.value + 1

  let title = ''
  if (!kw && activeSubCatId.value === null) return
  if (!kw && activeSubCatId.value !== null) {
    const sub = subCategories.value.find((s) => s.id === activeSubCatId.value)
    title = sub ? sub.name : paneTitle.value
  }

  const seq = ++filterRequestSeq
  filterLoading.value = true
  try {
    const res = await spuApi.catalog({
      customer_id: cart.customerId || undefined,
      keyword: kw || undefined,
      category_id: kw ? undefined : (activeSubCatId.value ?? undefined),
      page: nextPage,
      page_size: PAGE_SIZE,
    })
    if (seq !== filterRequestSeq) return

    const rows = res.items || []
    const total = Number(res.total) || rows.length
    const merged = reset ? rows : filterProducts.value.concat(rows)

    filterProducts.value = merged
    filterPage.value = nextPage
    filterHasMore.value = rows.length > 0 && merged.length < total
    if (kw) {
      paneTitle.value = `搜索结果（${total}）`
      paneSub.value = ''
    } else {
      paneTitle.value = title
      paneSub.value = `${total} 款`
    }
  } finally {
    if (seq === filterRequestSeq) {
      filterLoading.value = false
    }
  }
}

function onFilterLoadMore() {
  if (!filterHasMore.value || filterLoading.value) return
  void loadFilterProducts(false)
}

function restoreStreamView() {
  const version = streamVersion
  isFilterMode.value = false
  activeSubCatId.value = null
  applyHeaderForCat(activeCatId.value || categories.value[0]?.id || '')
  nextTick(() => {
    if (!sections.value.length && categories.value.length) {
      void initStreamFrom(0)
    } else {
      measureAndEnsureFilled(version)
    }
  })
}

// ---------- 分类与搜索交互 ----------

function onSelectCategory(cat: NavCategory) {
  const targetIdx = categories.value.findIndex((c) => c.id === cat.id)
  if (targetIdx < 0) return

  clearSearchTimer()
  const inLoadedStream =
    targetIdx >= streamStartIdx.value &&
    targetIdx <= streamEndIdx.value &&
    sections.value.length > 0

  if (inLoadedStream) {
    navLockUntil = Date.now() + 500
    const version = streamVersion
    keyword.value = ''
    activeSubCatId.value = null
    isFilterMode.value = false
    scrollWithAnim.value = true
    scrollIntoView.value = ''
    applyHeaderForCat(cat.id)
    nextTick(() => {
      scrollIntoView.value = `sec-${cat.id}`
      setTimeout(() => {
        measureAndEnsureFilled(version)
      }, 350)
    })
  } else {
    keyword.value = ''
    activeSubCatId.value = null
    void initStreamFrom(targetIdx)
  }
}

function onSelectSubCategory(subId: number | null) {
  if (subId === activeSubCatId.value) return
  if (subId === null) {
    restoreStreamView()
    return
  }
  activeSubCatId.value = subId
  isFilterMode.value = true
  filterProducts.value = []
  filterPage.value = 1
  filterHasMore.value = false
  filterScrollTop.value = filterScrollTop.value === 0 ? 1 : 0
  void loadFilterProducts(true)
}

function onSearchInput() {
  clearSearchTimer()
  const trimmed = keyword.value.trim()
  if (!trimmed) {
    if (activeSubCatId.value !== null) {
      void loadFilterProducts(true)
    } else {
      restoreStreamView()
    }
    return
  }
  isFilterMode.value = true
  filterScrollTop.value = filterScrollTop.value === 0 ? 1 : 0
  searchTimer = setTimeout(() => {
    void loadFilterProducts(true)
  }, 250)
}

function onSearchConfirm() {
  clearSearchTimer()
  if (keyword.value.trim()) {
    isFilterMode.value = true
    filterScrollTop.value = filterScrollTop.value === 0 ? 1 : 0
    void loadFilterProducts(true)
  }
}

function onClearSearch() {
  clearSearchTimer()
  keyword.value = ''
  if (activeSubCatId.value !== null) {
    isFilterMode.value = true
    filterScrollTop.value = filterScrollTop.value === 0 ? 1 : 0
    void loadFilterProducts(true)
  } else {
    restoreStreamView()
  }
}

// ---------- 加购与选规格 ----------

function stepSingle(card: CatalogProductCard, delta: number) {
  if (!cart.customerId) {
    uni.showToast({ title: '请先选择客户', icon: 'none' })
    return
  }
  const current = cart.skuQty(card.default_sku_id)
  const next = Number((current + delta).toFixed(1))
  cart.setSkuQuantityFromCatalog(card, next > 0 ? next : 0)
}

async function openSpecSheet(card: CatalogProductCard) {
  if (!cart.customerId) {
    uni.showToast({ title: '请先选择客户', icon: 'none' })
    return
  }
  sheetProduct.value = card
  sheetSkus.value = []
  Object.keys(sheetQuotes).forEach((k) => delete sheetQuotes[Number(k)])
  sheetLoading.value = true
  try {
    const res = await spuApi.skus(card.spu_id, { page: 1, page_size: 100, is_enabled: true })
    sheetSkus.value = res.items.filter((s) => s.is_enabled)
    if (sheetSkus.value.length && cart.customerId) {
      const qRes = await priceApi.quote(
        cart.customerId,
        sheetSkus.value.map((s) => s.id),
      )
      qRes.items.forEach((q) => (sheetQuotes[q.sku_id] = q))
    }
  } finally {
    sheetLoading.value = false
  }
}

function closeSpecSheet() {
  sheetProduct.value = null
}

function goDetailFromSheet() {
  if (!sheetProduct.value) return
  const id = sheetProduct.value.spu_id
  sheetProduct.value = null
  goSpuDetail(id)
}

function skuSpecText(sku: Sku): string {
  const vals = Object.values(sku.specs || {})
  return vals.length ? vals.join(' ') : '基础规格'
}

function skuConvText(sku: Sku): string {
  const unit = sku.specs?.['规格'] || '件'
  const base = sheetProduct.value?.base_unit || ''
  const q = toNum(sku.base_qty)
  return q > 1 ? `1${unit} = ${formatQty(q)}${base}` : `按${unit}计价`
}

function sheetPriceText(sku: Sku): string {
  const q = sheetQuotes[sku.id]
  if (!q) return '—'
  return q.unit ? `${formatMoney(q.unit_price)}/${q.unit}` : formatMoney(q.unit_price)
}

function sheetStockText(sku: Sku): string {
  const stock = sheetQuotes[sku.id]?.stock_on_hand
  if (stock === null || stock === undefined) return ''
  return `库存 ${formatQty(stock)}${sheetProduct.value?.base_unit || ''}`
}

function stepSheetSku(sku: Sku, delta: number) {
  const q = sheetQuotes[sku.id]
  if (!q) {
    uni.showToast({ title: '暂未取到客户价', icon: 'none' })
    return
  }
  const current = cart.skuQty(sku.id)
  const next = Number((current + delta).toFixed(1))
  cart.setSkuQuantityFromQuote(sku, q, next > 0 ? next : 0)
}

function goSelectCustomer() {
  uni.navigateTo({ url: '/pages-sub/product/search?type=customer' })
}

function goSpuDetail(id: number) {
  uni.navigateTo({ url: `/pages-sub/product/detail?id=${id}` })
}

function toggleCartSheet() {
  if (cart.isEmpty) {
    uni.showToast({ title: '请先添加商品', icon: 'none' })
    return
  }
  cartSheetVisible.value = !cartSheetVisible.value
}

function goConfirm() {
  if (cart.isEmpty) {
    uni.showToast({ title: '请先添加商品', icon: 'none' })
    return
  }
  cartSheetVisible.value = false
  uni.navigateTo({ url: '/pages/order/confirm' })
}

async function syncForCustomer() {
  const curId = cart.customerId ?? null
  const customerChanged = loadedCustomerId !== curId
  loadedCustomerId = curId
  if (!categories.value.length || customerChanged) {
    await loadCategories()
  }
}

onLoad(async (opts: any) => {
  if (opts?.route_trip_id) cart.setSource('route_call', Number(opts.route_trip_id))
  else if (opts?.customer_id) cart.setSource('phone_in')
  if (opts?.customer_id && cart.customerId !== Number(opts.customer_id)) {
    const c = await customerApi.get(Number(opts.customer_id))
    cart.setCustomer(c.id, c.name)
  }
  await syncForCustomer()
})

onShow(() => {
  if (loadedCustomerId !== undefined) {
    void syncForCustomer()
  }
})

onUnload(() => {
  clearSearchTimer()
})
</script>

<style lang="scss" scoped>
/* 锁死整页视口，顶部客户条/搜索栏和底部购物车条浮动固定，仅左右列表各自滚动 */
.order-create-page {
  position: fixed;
  top: var(--window-top, 0px);
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  overflow: hidden;
}

/* 顶部客户条 */
.customer-bar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 16rpx 24rpx;
  background: #f4f7fc;
  border-bottom: 2rpx solid #e8eef6;
}
.customer-bar.empty {
  background: #fff7ed;
  border-bottom-color: #fed7aa;
  justify-content: space-between;
}
.cust-tag {
  flex: none;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  background: $uni-color-primary;
  color: #fff;
  font-size: 20rpx;
  font-weight: 600;
}
.cust-name {
  flex: 1;
  min-width: 0;
  font-size: 28rpx;
  font-weight: 700;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cust-switch {
  flex: none;
  font-size: 24rpx;
  color: $uni-color-primary;
  font-weight: 600;
}
.cust-warn-txt {
  flex: 1;
  font-size: 24rpx;
  color: #b45309;
  font-weight: 600;
}
.cust-select-btn {
  flex: none;
  padding: 8rpx 22rpx;
  border-radius: 28rpx;
  background: $uni-color-primary;
  color: #fff;
  font-size: 22rpx;
  font-weight: 600;
}

/* 顶部搜索栏 */
.search-bar {
  flex: none;
  padding: 14rpx 24rpx 16rpx;
  background: #fff;
  border-bottom: 2rpx solid #eef2f7;
}
.search-box {
  height: 74rpx;
  background: #f3f5f8;
  border-radius: 37rpx;
  display: flex;
  align-items: center;
  padding: 0 22rpx;
  gap: 12rpx;
}
.search-ico { font-size: 28rpx; }
.search-input { flex: 1; font-size: 26rpx; color: #1f2937; }
.clear-btn {
  width: 38rpx; height: 38rpx; border-radius: 50%;
  background: #bac4d3; color: #fff; font-size: 26rpx;
  display: flex; align-items: center; justify-content: center;
}

/* 中间左分类 + 右商品 */
.main-body {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}
.cat-nav {
  width: 176rpx;
  height: 100%;
  background: #f4f6f9;
  flex: none;
}
.cat-item {
  position: relative;
  padding: 26rpx 10rpx;
  text-align: center;
  font-size: 26rpx;
  font-weight: 500;
  color: #465468;
  line-height: 1.35;
}
.cat-item.freq {
  color: #b34d00;
  font-weight: 700;
}
.cat-item.active {
  background: #dcebff;
  color: $uni-color-primary;
  font-weight: 700;
}
.cat-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 18rpx;
  bottom: 18rpx;
  width: 8rpx;
  border-radius: 0 6rpx 6rpx 0;
  background: $uni-color-primary;
}
.cat-item.freq.active {
  background: #ffedd5;
  color: #b34d00;
}
.cat-item.freq.active::before {
  background: #ea580c;
}
.star {
  color: #f59e0b;
  margin-right: 4rpx;
}

.goods-pane {
  flex: 1;
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  overflow: hidden;
}
.pane-hd {
  flex: none;
  padding: 18rpx 20rpx 14rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 2rpx solid #eef2f7;
}
.pane-title { font-size: 28rpx; font-weight: 700; color: #1f2937; }
.pane-sub { font-size: 22rpx; color: #8894a5; }
.back-cat-btn {
  background: rgba(37, 99, 235, 0.1);
  color: $uni-color-primary;
  font-size: 22rpx;
  font-weight: 600;
  padding: 6rpx 18rpx;
  border-radius: 20rpx;
}

/* 二级分类胶囊 */
.sub-cat-scroll {
  flex: none;
  width: 100%;
  white-space: nowrap;
  border-bottom: 2rpx solid #eef2f7;
}
.sub-cat-row {
  display: inline-flex;
  align-items: center;
  gap: 12rpx;
  padding: 12rpx 18rpx;
}
.sub-pill {
  flex: none;
  padding: 8rpx 22rpx;
  border-radius: 24rpx;
  background: #f3f5f8;
  color: #465468;
  font-size: 22rpx;
  font-weight: 500;
}
.sub-pill.active {
  background: rgba(37, 99, 235, 0.12);
  color: $uni-color-primary;
  font-weight: 700;
}

/* 商品滚动区域 */
.goods-scroll-wrap {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
}
.goods-scroll {
  position: absolute;
  inset: 0;
  height: 100%;
  padding: 0 18rpx;
  box-sizing: border-box;
}
.prev-cat-bar {
  margin-top: 14rpx;
  padding: 14rpx 20rpx;
  border-radius: 14rpx;
  background: rgba(37, 99, 235, 0.08);
  color: $uni-color-primary;
  font-size: 22rpx;
  font-weight: 600;
  text-align: center;
}
.sec-block {
  padding-top: 10rpx;
}
.sec-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10rpx 16rpx;
  margin-top: 8rpx;
  background: #f4f7fc;
  border-radius: 12rpx;
}
.sec-hd.freq {
  background: #fff7ed;
}
.sec-title {
  font-size: 26rpx;
  font-weight: 700;
  color: #1f2937;
}
.sec-hd.freq .sec-title {
  color: #b34d00;
}
.sec-sub {
  font-size: 21rpx;
  color: #8894a5;
}
.back-stream-btn {
  display: inline-block;
  margin-top: 14rpx;
  padding: 8rpx 26rpx;
  border-radius: 24rpx;
  background: rgba(37, 99, 235, 0.1);
  color: $uni-color-primary;
  font-size: 22rpx;
  font-weight: 600;
}

.g-card {
  display: flex;
  gap: 16rpx;
  padding: 20rpx 0;
  border-bottom: 2rpx solid #eef2f7;
}
.g-thumb {
  width: 140rpx;
  height: 140rpx;
  border-radius: 14rpx;
  background: #eff4fb;
  position: relative;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.g-img { width: 100%; height: 100%; }
.g-placeholder { font-size: 30rpx; font-weight: 700; color: $uni-color-primary; }
.freq-tag {
  position: absolute;
  left: 0;
  top: 0;
  background: $uni-color-primary;
  color: #fff;
  font-size: 18rpx;
  font-weight: 700;
  padding: 4rpx 8rpx;
  border-radius: 0 0 10rpx 0;
}
.g-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.g-name {
  font-size: 27rpx;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
.g-spec {
  display: block;
  margin-top: 6rpx;
  font-size: 21rpx;
  color: #8894a5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.g-foot {
  margin-top: 12rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8rpx;
}
.g-price {
  display: inline-flex;
  align-items: baseline;
  color: #dc2626;
  font-weight: 700;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.yen { font-size: 20rpx; margin-right: 2rpx; }
.num { font-size: 32rpx; }
.unit { font-size: 20rpx; color: #8894a5; font-weight: 400; margin-left: 2rpx; }
.price-hidden-tag {
  font-size: 21rpx;
  color: #8894a5;
  background: #f3f5f8;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
}
.spec-btn {
  position: relative;
  flex: none;
  background: $uni-color-primary;
  color: #fff;
  font-size: 22rpx;
  font-weight: 600;
  padding: 10rpx 20rpx;
  border-radius: 30rpx;
}
.spec-badge {
  position: absolute;
  top: -12rpx;
  right: -8rpx;
  min-width: 30rpx;
  height: 30rpx;
  padding: 0 8rpx;
  border-radius: 15rpx;
  background: #dc2626;
  color: #fff;
  font-size: 18rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2rpx solid #fff;
}
.stepper {
  display: flex;
  align-items: center;
  gap: 8rpx;
  flex: none;
}
.step-btn {
  width: 46rpx;
  height: 46rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1;
}
.step-btn.minus {
  border: 2rpx solid $uni-color-primary;
  color: $uni-color-primary;
  background: #fff;
  box-sizing: border-box;
}
.step-btn.plus {
  background: $uni-color-primary;
  color: #fff;
}
.step-num {
  min-width: 44rpx;
  text-align: center;
  font-size: 26rpx;
  font-weight: 600;
  color: #1f2937;
  font-variant-numeric: tabular-nums;
}
.list-footer {
  padding: 28rpx 0 40rpx;
  text-align: center;
  font-size: 22rpx;
  color: #9ca3af;
}

/* 底部固定购物车条 */
.bottom-bar {
  flex: none;
  height: 112rpx;
  display: flex;
  align-items: center;
  background: #fff;
  padding: 0 24rpx;
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.06);
  z-index: 100;
  box-sizing: border-box;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.cart-info { display: flex; align-items: center; gap: 16rpx; flex: 1; min-width: 0; }
.cart-icon-wrap {
  position: relative; width: 76rpx; height: 76rpx; background: $uni-color-primary;
  border-radius: 50%; display: flex; align-items: center; justify-content: center; flex: none;
}
.cart-icon { font-size: 38rpx; }
.cart-badge {
  position: absolute; top: -4rpx; right: -4rpx; min-width: 32rpx; height: 32rpx; line-height: 32rpx;
  padding: 0 8rpx; background: #dc2626; color: #fff; border-radius: 16rpx; font-size: 18rpx; text-align: center;
}
.cart-amount { flex: 1; min-width: 0; }
.amount-row { display: flex; align-items: center; gap: 10rpx; }
.amount-label { font-size: 22rpx; color: #9ca3af; }
.low-price-tag {
  font-size: 18rpx; color: #dc2626; background: #fee2e2;
  padding: 2rpx 8rpx; border-radius: 6rpx; font-weight: 600;
}
.amount { display: block; font-size: 32rpx; font-weight: 700; color: #dc2626; font-variant-numeric: tabular-nums; }
.next-btn { width: 240rpx; height: 78rpx; line-height: 78rpx; font-size: 28rpx; }
.next-btn[disabled] { opacity: 0.45; }

/* 选规格抽屉 */
.sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 300;
  background: rgba(15, 23, 42, 0.5);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}
.sheet-panel {
  background: #fff;
  border-radius: 28rpx 28rpx 0 0;
  padding: 28rpx 28rpx 36rpx;
  max-height: 76vh;
  display: flex;
  flex-direction: column;
}
.sheet-hd {
  display: flex;
  align-items: flex-start;
  gap: 18rpx;
  padding-bottom: 20rpx;
  border-bottom: 2rpx solid #eef2f7;
}
.sheet-thumb {
  width: 112rpx;
  height: 112rpx;
  border-radius: 14rpx;
  background: #eff4fb;
  overflow: hidden;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sheet-meta { flex: 1; min-width: 0; }
.sheet-name { display: block; font-size: 30rpx; font-weight: 700; color: #1f2937; }
.sheet-code { display: block; margin-top: 4rpx; font-size: 22rpx; color: #8894a5; }
.sheet-detail-link {
  display: inline-block;
  margin-top: 8rpx;
  font-size: 23rpx;
  color: $uni-color-primary;
  font-weight: 600;
}
.sheet-close {
  width: 48rpx; height: 48rpx; border-radius: 50%;
  background: #f3f4f6; color: #6b7280; font-size: 34rpx;
  line-height: 48rpx; text-align: center; flex: none;
}
.sheet-body {
  max-height: 52vh;
  margin-top: 8rpx;
}
.sheet-loading { padding: 48rpx 0; text-align: center; font-size: 24rpx; color: #9ca3af; }
.sheet-sku-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 20rpx 0;
  border-bottom: 2rpx solid #f3f4f6;
}
.sheet-sku-row:last-child { border-bottom: 0; }
.sheet-sku-info { flex: 1; min-width: 0; }
.sheet-sku-name { display: block; font-size: 28rpx; font-weight: 600; color: #1f2937; }
.sheet-sku-sub { display: block; margin-top: 4rpx; font-size: 22rpx; color: #8894a5; }
.sheet-sku-right { display: flex; flex-direction: column; align-items: flex-end; gap: 10rpx; flex: none; }
.sheet-sku-price { font-size: 28rpx; font-weight: 700; color: #dc2626; font-variant-numeric: tabular-nums; }
</style>
