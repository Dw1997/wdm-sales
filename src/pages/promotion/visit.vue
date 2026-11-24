<template>
  <view class="visit-page">
    <scroll-view scroll-y="true" class="content">
      <view class="form-card">
        <view class="card-title">拜访签到</view>
        <view class="form-item">
          <text class="form-label">拜访客户</text>
          <picker :range="customerNames" range-key="name" :value="customerIdx" @change="onCustomerChange">
            <view class="picker-value">{{ currentCustomer?.name || '请选择客户' }} ›</view>
          </picker>
        </view>
        <view class="form-item">
          <text class="form-label">当前位置</text>
          <view class="location">
            <text class="location-icon">📍</text>
            <text class="location-text" :class="{ muted: !location }">
              {{ locating ? '定位中...' : (location || locationError || '未获取到位置，请点击刷新') }}
            </text>
            <view class="refresh-btn" :class="{ disabled: locating }" @tap="getLocation(true)">
              <text>{{ locating ? '定位中' : '刷新' }}</text>
            </view>
          </view>
        </view>
        <view class="form-item">
          <text class="form-label">现场照片 ({{ photos.length }}/3)</text>
          <view class="photos">
            <view v-for="(p, i) in photos" :key="i" class="photo-item">
              <image :src="p" mode="aspectFill" class="photo" />
              <view class="photo-del" @tap="photos.splice(i, 1)">×</view>
            </view>
            <view v-if="photos.length < 3" class="photo-add" @tap="addPhoto">
              <text class="add-icon">+</text>
              <text class="add-text">添加</text>
            </view>
          </view>
        </view>
        <view class="form-item">
          <text class="form-label">拜访内容</text>
          <textarea class="form-textarea" v-model="content" placeholder="如：确认补货需求、客户反馈、店内情况等" maxlength="500" />
        </view>
        <button class="btn-primary" :loading="submitting" @tap="onSubmit">提交签到</button>
      </view>

      <view class="section">
        <view class="section-title">最近拜访</view>
        <view v-if="visits.length" class="visit-list">
          <view v-for="v in visits" :key="v.id" class="visit-item">
            <view class="visit-icon">📍</view>
            <view class="visit-content">
              <text class="visit-customer">{{ v.customer_name }}</text>
              <text class="visit-text">{{ v.content }}</text>
              <text class="visit-meta">{{ v.location }} · {{ relativeTime(v.created_at) }}</text>
            </view>
          </view>
        </view>
        <empty-state v-else icon="📍" text="暂无拜访记录" padding="60rpx 0" />
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import EmptyState from '@/components/EmptyState.vue'
import { customerApi, promotionApi } from '@/api'
import { relativeTime } from '@/utils/format'
import type { Customer, VisitRecord } from '@/types'

const customers = ref<Customer[]>([])
const customerIdx = ref(0)
const location = ref('')
const locationError = ref('')
const locating = ref(false)
const latitude = ref<number | undefined>()
const longitude = ref<number | undefined>()
const photos = ref<string[]>([])
const content = ref('')
const submitting = ref(false)
const visits = ref<VisitRecord[]>([])

const customerNames = computed(() => customers.value.map((c) => ({ name: c.name })))
const currentCustomer = computed(() => customers.value[customerIdx.value])

function onCustomerChange(e: any) {
  customerIdx.value = Number(e.detail.value)
}

function formatCoords(lat: number, lng: number) {
  return `经度 ${lng.toFixed(4)}°, 纬度 ${lat.toFixed(4)}°`
}

function formatAppAddress(addr?: {
  province?: string
  city?: string
  district?: string
  street?: string
  streetNum?: string
  poiName?: string
}) {
  if (!addr) return ''
  return [addr.province, addr.city, addr.district, addr.street, addr.streetNum, addr.poiName]
    .filter(Boolean)
    .join('')
}

// #ifdef H5
function reverseGeocodeH5(lat: number, lng: number): Promise<string> {
  return new Promise((resolve) => {
    const amap = (window as unknown as { AMap?: { plugin?: (name: string, cb: () => void) => void; Geocoder?: new () => { getAddress: (lnglat: [number, number], cb: (status: string, result?: { regeocode?: { formattedAddress?: string } }) => void) => void } } }).AMap
    if (!amap?.plugin) {
      resolve('')
      return
    }
    amap.plugin('AMap.Geocoder', () => {
      try {
        if (!amap.Geocoder) {
          resolve('')
          return
        }
        const geocoder = new amap.Geocoder()
        geocoder.getAddress([lng, lat], (status, result) => {
          if (status === 'complete' && result?.regeocode?.formattedAddress) {
            resolve(result.regeocode.formattedAddress)
          } else {
            resolve('')
          }
        })
      } catch {
        resolve('')
      }
    })
  })
}
// #endif

async function onLocationSuccess(
  lat: number,
  lng: number,
  manual: boolean,
  resolvedAddress = '',
) {
  latitude.value = lat
  longitude.value = lng
  locationError.value = ''
  let addr = resolvedAddress
  // #ifdef H5
  if (!addr) {
    addr = await reverseGeocodeH5(lat, lng)
  }
  // #endif
  location.value = addr || formatCoords(lat, lng)
  locating.value = false
  if (manual) {
    uni.showToast({ title: '定位已更新', icon: 'none' })
  }
}

function onLocationFail(reason: string, manual: boolean) {
  locationError.value = reason
  locating.value = false
  if (manual) {
    uni.showToast({ title: reason, icon: 'none' })
  }
}

function getLocation(manual = false) {
  if (locating.value) return
  locating.value = true
  locationError.value = ''

  uni.getLocation({
    type: 'gcj02',
    geocode: true,
    success: (res) => {
      const appAddr = formatAppAddress(
        (res as unknown as { address?: Parameters<typeof formatAppAddress>[0] }).address,
      )
      void onLocationSuccess(res.latitude, res.longitude, manual, appAddr)
    },
    fail: (err) => {
      const errMsg = String((err as { errMsg?: string })?.errMsg || '')
      const denied = errMsg.includes('auth deny') || errMsg.includes('authorize') || errMsg.includes('denied')
      // #ifndef H5
      if (denied && manual) {
        onLocationFail('未开启定位权限', false)
        uni.showModal({
          title: '需要定位权限',
          content: '拜访签到需要获取当前位置，是否前往设置开启定位权限？',
          confirmText: '去设置',
          success: (r) => {
            if (r.confirm) {
              uni.openSetting({
                success: (s) => {
                  if (s.authSetting?.['scope.userLocation']) {
                    getLocation(true)
                  }
                },
              })
            }
          },
        })
        return
      }
      // #endif
      onLocationFail(denied ? '未开启定位权限，请允许定位后重试' : '定位失败，请点击刷新重试', manual)
    },
  })
}

function addPhoto() {
  uni.chooseImage({
    count: 3 - photos.value.length,
    success: (res) => {
      photos.value.push(...res.tempFilePaths)
    },
  })
}

async function load(refreshLoc = true) {
  if (refreshLoc) getLocation(false)
  const [cRes, vRes] = await Promise.allSettled([
    customerApi.all(),
    promotionApi.visits(),
  ])
  if (cRes.status === 'fulfilled') customers.value = cRes.value
  if (vRes.status === 'fulfilled') visits.value = vRes.value
}

async function onSubmit() {
  if (!currentCustomer.value) {
    uni.showToast({ title: '请选择客户', icon: 'none' })
    return
  }
  if (!content.value.trim()) {
    uni.showToast({ title: '请填写拜访内容', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    await promotionApi.checkIn({
      customer_id: currentCustomer.value.id,
      customer_name: currentCustomer.value.name,
      location: location.value,
      latitude: latitude.value,
      longitude: longitude.value,
      photos: photos.value,
      content: content.value,
    })
    uni.showToast({ title: '签到成功', icon: 'success' })
    content.value = ''
    photos.value = []
    load(false)
  } finally {
    submitting.value = false
  }
}

onMounted(() => load(true))
</script>

<style lang="scss" scoped>
.visit-page {
  min-height: 100vh;
  background: #f5f5f7;
}
.content {
  height: 100vh;
}
.form-card, .section {
  background: #fff;
  margin: 16rpx;
  border-radius: 16rpx;
  padding: 24rpx;
}
.card-title, .section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 16rpx;
  display: block;
}
.form-item {
  margin-bottom: 24rpx;
}
.form-label {
  display: block;
  font-size: 26rpx;
  color: #6b7280;
  margin-bottom: 12rpx;
}
.picker-value {
  height: 88rpx;
  line-height: 88rpx;
  border: 2rpx solid #e5e7eb;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: #1f2937;
}
.location {
  display: flex;
  align-items: center;
  gap: 12rpx;
  height: 88rpx;
  border: 2rpx solid #e5e7eb;
  border-radius: 12rpx;
  padding: 0 24rpx;
}
.location-icon {
  font-size: 32rpx;
}
.location-text {
  flex: 1;
  font-size: 24rpx;
  color: #1f2937;
  font-variant-numeric: tabular-nums;
  &.muted {
    color: #9ca3af;
  }
}
.refresh-btn {
  padding: 8rpx 16rpx;
  background: rgba(37, 99, 235, 0.08);
  color: $uni-color-primary;
  border-radius: 8rpx;
  font-size: 22rpx;
  flex-shrink: 0;
  &.disabled {
    opacity: 0.5;
  }
}
.photos {
  display: flex;
  gap: 16rpx;
  flex-wrap: wrap;
}
.photo-item {
  position: relative;
  width: 160rpx;
  height: 160rpx;
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
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  background: #dc2626;
  color: #fff;
  text-align: center;
  line-height: 36rpx;
  font-size: 28rpx;
}
.photo-add {
  width: 160rpx;
  height: 160rpx;
  border: 2rpx dashed #d1d5db;
  border-radius: 12rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}
.add-icon {
  font-size: 48rpx;
  color: #9ca3af;
}
.add-text {
  font-size: 22rpx;
  color: #9ca3af;
}
.form-textarea {
  width: 100%;
  height: 200rpx;
  border: 2rpx solid #e5e7eb;
  border-radius: 12rpx;
  padding: 16rpx 24rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}
.visit-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.visit-item {
  display: flex;
  gap: 16rpx;
  padding: 16rpx;
  background: #f9fafb;
  border-radius: 12rpx;
}
.visit-icon {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: rgba(37, 99, 235, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  flex-shrink: 0;
}
.visit-content {
  flex: 1;
}
.visit-customer {
  display: block;
  font-size: 28rpx;
  font-weight: 500;
  color: #1f2937;
  margin-bottom: 4rpx;
}
.visit-text {
  display: block;
  font-size: 24rpx;
  color: #6b7280;
  line-height: 1.5;
  margin-bottom: 4rpx;
}
.visit-meta {
  font-size: 22rpx;
  color: #9ca3af;
}
</style>
