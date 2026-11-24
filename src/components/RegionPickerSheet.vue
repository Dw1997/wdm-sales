<template>
  <view v-if="visible" class="rps-wrap">
    <view class="rps-mask" @tap="close" @touchmove.stop.prevent />
    <view class="rps-sheet">
      <view class="rps-hd" @touchmove.stop.prevent>
        <text class="rps-title">{{ title }}</text>
        <text class="rps-close" @tap="close">×</text>
      </view>

      <!-- 关键词搜索栏 -->
      <view class="rps-search-bar" @touchmove.stop.prevent>
        <input
          v-model="keyword"
          class="rps-search-input"
          placeholder="搜乡镇或县名（如：太平、枣阳 太平）"
          confirm-type="search"
          @confirm="triggerSearchNow"
        />
        <text v-if="keyword" class="rps-search-clear" @tap="clearKeyword">×</text>
      </view>

      <!-- 搜索结果列表 -->
      <template v-if="keyword.trim()">
        <scroll-view scroll-y class="rps-body" :show-scrollbar="false" @touchmove.stop>
          <view v-if="searching" class="rps-empty">搜索中...</view>
          <view v-else-if="searchResults.length" class="rps-list">
            <view
              v-for="item in searchResults"
              :key="item.id"
              class="rps-item"
              @tap="pickNode(item)"
            >
              <view class="rps-item-main">
                <text class="rps-lv" :class="`lv-${item.level}`">{{ levelLabel(item.level) }}</text>
                <text class="rps-name">{{ item.full_name || item.name }}</text>
              </view>
            </view>
          </view>
          <view v-else class="rps-empty">未找到匹配的地区，请换个关键词</view>
        </scroll-view>
      </template>

      <!-- 逐级懒加载选择 -->
      <template v-else>
        <view class="rps-crumbs" @touchmove.stop.prevent>
          <text class="rps-crumb" :class="{ on: !path.length }" @tap="jumpTo(-1)">全部</text>
          <template v-for="(node, idx) in path" :key="node.id">
            <text class="rps-sep">/</text>
            <text
              class="rps-crumb"
              :class="{ on: idx === path.length - 1 }"
              @tap="jumpTo(idx)"
            >{{ node.name }}</text>
          </template>
        </view>
        <scroll-view scroll-y class="rps-body" :show-scrollbar="false" @touchmove.stop>
          <view v-if="loadingLevel" class="rps-empty">加载中...</view>
          <view v-else-if="loadError" class="rps-empty rps-retry" @tap="retryLoadLevel">加载失败，点此重试</view>
          <view v-else-if="currentNodes.length" class="rps-list">
            <view
              v-for="node in currentNodes"
              :key="node.id"
              class="rps-item"
              @tap="onTapNode(node)"
            >
              <text class="rps-name">{{ node.name }}</text>
              <text v-if="node.has_children" class="rps-arrow">›</text>
            </view>
          </view>
          <view v-else class="rps-empty">
            {{ path.length ? '已是最后一级，点下方「确定」完成选择' : '暂无可选地区' }}
          </view>
        </scroll-view>
      </template>

      <view class="rps-ft" @touchmove.stop.prevent>
        <button class="rps-btn ghost" @tap="close">取消</button>
        <button
          v-if="!keyword.trim()"
          class="rps-btn primary"
          :disabled="!path.length"
          @tap="confirmCurrent"
        >确定</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { regionApi } from '@/api'
import type { RegionNode, RegionSelection } from '@/types'

const childrenCache = new Map<number, RegionNode[]>()

const props = withDefaults(
  defineProps<{
    visible: boolean
    title?: string
  }>(),
  {
    title: '选择收货地点',
  },
)

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'select', v: RegionSelection): void
}>()

const keyword = ref('')
const searching = ref(false)
const searchResults = ref<RegionNode[]>([])
let timer: ReturnType<typeof setTimeout> | undefined
let searchSeq = 0

const path = ref<RegionNode[]>([])
const currentNodes = ref<RegionNode[]>([])
const loadingLevel = ref(false)
const loadError = ref(false)
const currentParentId = ref(0)

function levelLabel(lv: number) {
  if (lv === 4) return '乡镇'
  if (lv === 3) return '县区'
  if (lv === 2) return '市'
  return '省'
}

function toSelection(node: RegionNode, fallbackPath?: RegionNode[]): RegionSelection {
  const fullName = node.full_name || (fallbackPath ? fallbackPath.map((n) => n.name).join(' / ') : node.name)
  const parts = fullName.split(' / ').map((s) => s.trim()).filter(Boolean)
  return {
    id: node.id,
    level: node.level,
    name: node.name,
    full_name: fullName,
    province: parts[0] || '',
    city: parts[1] || '',
    district: parts[2] || '',
    town: parts[3] || '',
  }
}

async function loadLevel(parentId: number) {
  currentParentId.value = parentId
  loadError.value = false
  const cached = childrenCache.get(parentId)
  if (cached) {
    currentNodes.value = cached
    return
  }
  loadingLevel.value = true
  try {
    const rows =
      parentId === 0
        ? await regionApi.list({ level: 1 })
        : await regionApi.list({ parent_id: parentId })
    const list = Array.isArray(rows) ? rows : []
    if (list.length > 0) {
      childrenCache.set(parentId, list)
    }
    currentNodes.value = list
  } catch {
    loadError.value = true
    currentNodes.value = []
  } finally {
    loadingLevel.value = false
  }
}

function retryLoadLevel() {
  void loadLevel(currentParentId.value)
}

async function executeSearch(kw: string) {
  const seq = ++searchSeq
  searching.value = true
  try {
    const rows = await regionApi.list({ keyword: kw, limit: 50 })
    if (seq !== searchSeq) return
    searchResults.value = Array.isArray(rows) ? rows : []
  } catch {
    if (seq !== searchSeq) return
    searchResults.value = []
  } finally {
    if (seq === searchSeq) {
      searching.value = false
    }
  }
}

watch(keyword, (val) => {
  if (timer) clearTimeout(timer)
  const kw = val.trim()
  if (!kw) {
    searchSeq++
    searchResults.value = []
    searching.value = false
    return
  }
  searching.value = true
  timer = setTimeout(() => {
    void executeSearch(kw)
  }, 200)
})

function triggerSearchNow() {
  if (timer) clearTimeout(timer)
  const kw = keyword.value.trim()
  if (!kw) return
  void executeSearch(kw)
}

watch(
  () => props.visible,
  (v) => {
    if (!v) return
    if (timer) clearTimeout(timer)
    searchSeq++
    keyword.value = ''
    searchResults.value = []
    searching.value = false
    path.value = []
    void loadLevel(0)
  },
  { immediate: true },
)

function close() {
  emit('update:visible', false)
}

function clearKeyword() {
  keyword.value = ''
  searchResults.value = []
}

function jumpTo(idx: number) {
  if (idx < 0) {
    path.value = []
    void loadLevel(0)
  } else {
    path.value = path.value.slice(0, idx + 1)
    const last = path.value[path.value.length - 1]
    void loadLevel(last.id)
  }
}

async function onTapNode(node: RegionNode) {
  const nextPath = [...path.value, node]
  if (!node.has_children) {
    emit('select', toSelection(node, nextPath))
    close()
    return
  }
  path.value = nextPath
  await loadLevel(node.id)
  if (!loadError.value && !currentNodes.value.length) {
    emit('select', toSelection(node, nextPath))
    close()
  }
}

function pickNode(node: RegionNode) {
  emit('select', toSelection(node))
  close()
}

function confirmCurrent() {
  if (!path.value.length) return
  const last = path.value[path.value.length - 1]
  emit('select', toSelection(last, path.value))
  close()
}
</script>

<style lang="scss" scoped>
.rps-wrap {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 2000;
}
.rps-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1;
  background: rgba(0, 0, 0, 0.45);
}
.rps-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  background: #ffffff;
  border-radius: 28rpx 28rpx 0 0;
  display: flex;
  flex-direction: column;
  max-height: 78vh;
  padding-bottom: env(safe-area-inset-bottom);
}
.rps-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 26rpx 30rpx 18rpx;
  border-bottom: 1rpx solid #eef1f5;
}
.rps-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1f2937;
}
.rps-close {
  font-size: 40rpx;
  line-height: 1;
  color: #9ca3af;
  padding: 4rpx 10rpx;
}
.rps-search-bar {
  display: flex;
  align-items: center;
  margin: 18rpx 26rpx 12rpx;
  padding: 0 20rpx;
  height: 74rpx;
  background: #f3f5f8;
  border-radius: 14rpx;
}
.rps-search-input {
  flex: 1;
  font-size: 26rpx;
  color: #1f2937;
}
.rps-search-clear {
  font-size: 32rpx;
  color: #9ca3af;
  padding: 0 6rpx;
}
.rps-crumbs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8rpx;
  padding: 10rpx 28rpx 16rpx;
  border-bottom: 1rpx solid #f1f3f6;
}
.rps-crumb {
  font-size: 24rpx;
  color: #6b7280;
  &.on {
    color: #2563eb;
    font-weight: 600;
  }
}
.rps-sep {
  font-size: 22rpx;
  color: #cbd5e1;
}
.rps-body {
  height: 560rpx;
}
.rps-list {
  padding: 8rpx 0;
}
.rps-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 30rpx;
  border-bottom: 1rpx solid #f5f6f8;
  &:active {
    background: #f8fafc;
  }
}
.rps-item-main {
  display: flex;
  align-items: center;
  gap: 14rpx;
  flex: 1;
  min-width: 0;
}
.rps-lv {
  font-size: 20rpx;
  padding: 4rpx 10rpx;
  border-radius: 8rpx;
  flex-shrink: 0;
  background: #f1f5f9;
  color: #475569;
  &.lv-4 {
    background: #ecfdf5;
    color: #059669;
  }
  &.lv-3 {
    background: #fffbeb;
    color: #d97706;
  }
  &.lv-2 {
    background: #eff6ff;
    color: #2563eb;
  }
}
.rps-name {
  font-size: 27rpx;
  color: #1f2937;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rps-arrow {
  font-size: 32rpx;
  color: #cbd5e1;
  margin-left: 12rpx;
}
.rps-empty {
  padding: 80rpx 30rpx;
  text-align: center;
  font-size: 25rpx;
  color: #9ca3af;
}
.rps-retry {
  color: #2563eb;
}
.rps-ft {
  display: flex;
  gap: 18rpx;
  padding: 18rpx 26rpx 22rpx;
  border-top: 1rpx solid #eef1f5;
}
.rps-btn {
  flex: 1;
  height: 78rpx;
  line-height: 78rpx;
  font-size: 28rpx;
  border-radius: 14rpx;
  border: none;
  &::after {
    border: none;
  }
  &.ghost {
    background: #f3f4f6;
    color: #4b5563;
  }
  &.primary {
    background: #2563eb;
    color: #ffffff;
  }
  &[disabled] {
    opacity: 0.45;
  }
}
</style>
