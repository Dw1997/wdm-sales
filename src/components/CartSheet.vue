<template>
  <view v-if="visible" class="cart-mask" @tap="emit('close')">
    <view class="cart-sheet" @tap.stop>
      <view class="cs-hd">
        <view class="cs-title-wrap">
          <text class="cs-title">已选商品</text>
          <text class="cs-count">共 {{ formatQty(cart.totalCount) }} 件</text>
        </view>
        <view class="cs-hd-right">
          <text v-if="!cart.isEmpty" class="cs-clear" @tap="onClear">清空</text>
          <view class="cs-close" @tap="emit('close')">×</view>
        </view>
      </view>

      <scroll-view scroll-y class="cs-body">
        <view v-if="cart.items.length" class="cs-list">
          <view v-for="(item, idx) in cart.items" :key="`${item.sku.id}-${idx}`" class="cs-item">
            <view class="cs-info">
              <text class="cs-name">{{ item.spuName }}</text>
              <text class="cs-spec">{{ item.spec }}</text>
              <view class="cs-price-row">
                <text class="cs-price" :class="{ warn: cart.isBelowMin(item) }">
                  <template v-if="item.manual">[手改] </template>{{ formatMoney(item.price) }}/{{ item.unit }}
                </text>
                <text v-if="cart.isBelowMin(item)" class="cs-low-tag">低于最低价</text>
              </view>
            </view>

            <view class="cs-right">
              <text class="cs-sub">{{ formatMoney(item.amount) }}</text>
              <view class="cs-stepper">
                <view class="cs-step-btn minus" @tap="onMinus(item)">−</view>
                <text class="cs-step-num">{{ formatQty(item.quantity) }}</text>
                <view class="cs-step-btn plus" @tap="onPlus(item)">+</view>
              </view>
            </view>
          </view>
        </view>
        <view v-else class="cs-empty">
          <text>购物车空空如也</text>
        </view>
      </scroll-view>

      <view class="cs-foot">
        <view class="cs-total">
          <view class="cs-total-top">
            <text class="cs-total-label">合计</text>
            <text v-if="cart.hasBelowMin" class="cs-low-tag">含低价审批</text>
          </view>
          <text class="cs-total-val">{{ formatMoney(cart.totalAmount) }}</text>
        </view>
        <button class="btn-primary cs-submit" :disabled="cart.isEmpty" @tap="goConfirm">
          去结算 ({{ formatQty(cart.totalCount) }})
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useCartStore, type CartItem } from '@/stores/cart'
import { formatMoney, formatQty } from '@/utils/format'

defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const cart = useCartStore()

function onPlus(item: CartItem) {
  cart.updateQuantity(item, item.quantity + 1)
}

function onMinus(item: CartItem) {
  if (item.quantity > 1) {
    cart.updateQuantity(item, item.quantity - 1)
  } else {
    cart.removeItem(item)
    if (cart.isEmpty) emit('close')
  }
}

function onClear() {
  uni.showModal({
    title: '清空购物车',
    content: '确认清空当前已选商品吗？',
    success: (res) => {
      if (res.confirm) {
        cart.clearItems()
        emit('close')
      }
    },
  })
}

function goConfirm() {
  if (cart.isEmpty) return
  emit('close')
  uni.navigateTo({ url: '/pages/order/confirm' })
}
</script>

<style lang="scss" scoped>
.cart-mask {
  position: fixed;
  inset: 0;
  z-index: 350;
  background: rgba(15, 23, 42, 0.5);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}
.cart-sheet {
  background: #fff;
  border-radius: 28rpx 28rpx 0 0;
  max-height: 76vh;
  display: flex;
  flex-direction: column;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.cs-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 28rpx 18rpx;
  border-bottom: 2rpx solid #eef2f7;
}
.cs-title-wrap {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
}
.cs-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #1f2937;
}
.cs-count {
  font-size: 22rpx;
  color: #8894a5;
}
.cs-hd-right {
  display: flex;
  align-items: center;
  gap: 20rpx;
}
.cs-clear {
  font-size: 24rpx;
  color: #6b7280;
}
.cs-close {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 34rpx;
  line-height: 48rpx;
  text-align: center;
}
.cs-body {
  max-height: 52vh;
  padding: 0 28rpx;
  box-sizing: border-box;
}
.cs-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 20rpx 0;
  border-bottom: 2rpx solid #f3f4f6;
}
.cs-item:last-child {
  border-bottom: 0;
}
.cs-info {
  flex: 1;
  min-width: 0;
}
.cs-name {
  display: block;
  font-size: 27rpx;
  font-weight: 600;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cs-spec {
  display: block;
  margin-top: 4rpx;
  font-size: 21rpx;
  color: #8894a5;
}
.cs-price-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 6rpx;
}
.cs-price {
  font-size: 22rpx;
  color: #6b7280;
}
.cs-price.warn {
  color: #dc2626;
  font-weight: 600;
}
.cs-low-tag {
  font-size: 18rpx;
  color: #dc2626;
  background: #fee2e2;
  padding: 2rpx 8rpx;
  border-radius: 6rpx;
  font-weight: 600;
}
.cs-right {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10rpx;
}
.cs-sub {
  font-size: 28rpx;
  font-weight: 700;
  color: #dc2626;
  font-variant-numeric: tabular-nums;
}
.cs-stepper {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.cs-step-btn {
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
.cs-step-btn.minus {
  border: 2rpx solid $uni-color-primary;
  color: $uni-color-primary;
  background: #fff;
  box-sizing: border-box;
}
.cs-step-btn.plus {
  background: $uni-color-primary;
  color: #fff;
}
.cs-step-num {
  min-width: 44rpx;
  text-align: center;
  font-size: 26rpx;
  font-weight: 600;
  color: #1f2937;
  font-variant-numeric: tabular-nums;
}
.cs-empty {
  padding: 80rpx 0;
  text-align: center;
  font-size: 26rpx;
  color: #9ca3af;
}
.cs-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18rpx 28rpx;
  border-top: 2rpx solid #eef2f7;
  background: #fff;
}
.cs-total {
  flex: 1;
  min-width: 0;
}
.cs-total-top {
  display: flex;
  align-items: center;
  gap: 10rpx;
}
.cs-total-label {
  font-size: 22rpx;
  color: #9ca3af;
}
.cs-total-val {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  color: #dc2626;
  font-variant-numeric: tabular-nums;
}
.cs-submit {
  width: 260rpx;
  height: 78rpx;
  line-height: 78rpx;
  font-size: 28rpx;
}
.cs-submit[disabled] {
  opacity: 0.45;
}
</style>
