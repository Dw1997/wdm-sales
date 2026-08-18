<template>
  <view class="cart-page">
    <view class="customer-bar">
      <text class="cust-label">下单客户</text>
      <text class="cust-name">{{ cart.customerName || '未选择' }}</text>
    </view>

    <scroll-view scroll-y="true" class="cart-list">
      <view v-if="cart.items.length">
        <view v-for="(item, i) in cart.items" :key="i" class="cart-item">
          <image class="cover" :src="item.product.cover || defaultCover" mode="aspectFill" />
          <view class="info">
            <text class="name">{{ item.product.name }}</text>
            <view class="units-row">
              <text v-for="u in item.product.units" :key="u.name" class="unit-tag" :class="{ active: item.unit === u.name }" @tap="onUnitChange(item, u)">{{ u.name }}</text>
            </view>
            <view class="price-row">
              <text class="price">¥{{ item.unit_price.toFixed(2) }}/{{ item.unit }}</text>
              <text class="subtotal">小计 ¥{{ item.subtotal.toFixed(2) }}</text>
            </view>
            <view class="qty-row">
              <view class="qty-control">
                <text class="qty-btn" @tap="onMinus(item)">-</text>
                <text class="qty-num">{{ item.quantity }}</text>
                <text class="qty-btn plus" @tap="onPlus(item)">+</text>
              </view>
              <text class="del-btn" @tap="onRemove(item)">删除</text>
            </view>
          </view>
        </view>
      </view>
      <empty-state v-else icon="🛒" text="购物车空空如也" action="去选购" @action="goBack" />
    </scroll-view>

    <view v-if="cart.items.length" class="bottom-bar">
      <view class="total-wrap">
        <text class="total-label">合计</text>
        <text class="total">¥{{ formatQty(cart.totalAmount.toFixed(2)) }}</text>
      </view>
      <button class="btn-primary submit-btn" @tap="goConfirm">去结算 ({{ cart.totalCount }})</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import EmptyState from '@/components/EmptyState.vue'
import { useCartStore, type CartItem } from '@/stores/cart'
import { formatQty } from '@/utils/format'
import type { ProductUnit } from '@/types'

const cart = useCartStore()
const defaultCover = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="%23f3f4f6"/><text x="100" y="105" text-anchor="middle" font-size="60" fill="%239ca3af">📦</text></svg>'

function onPlus(item: CartItem) {
  cart.updateQuantity(item, item.quantity + 1)
}
function onMinus(item: CartItem) {
  if (item.quantity > 1) cart.updateQuantity(item, item.quantity - 1)
  else cart.removeItem(item)
}
function onRemove(item: CartItem) {
  cart.removeItem(item)
}
function onUnitChange(item: CartItem, u: ProductUnit) {
  if (item.unit !== u.name) cart.updateUnit(item, u.name)
}
function goConfirm() {
  uni.navigateTo({ url: '/pages/order/confirm' })
}
function goBack() {
  uni.navigateBack()
}
</script>

<style lang="scss" scoped>
.cart-page {
  min-height: 100vh;
  background: #f5f5f7;
  display: flex;
  flex-direction: column;
  padding-bottom: 120rpx;
}
.customer-bar {
  display: flex;
  justify-content: space-between;
  background: #fff;
  padding: 24rpx;
  margin: 16rpx;
  border-radius: 16rpx;
}
.cust-label {
  font-size: 26rpx;
  color: #6b7280;
}
.cust-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #1f2937;
}
.cart-list {
  flex: 1;
}
.cart-item {
  display: flex;
  gap: 16rpx;
  background: #fff;
  margin: 16rpx;
  border-radius: 16rpx;
  padding: 20rpx;
}
.cover {
  width: 140rpx;
  height: 140rpx;
  border-radius: 12rpx;
  background: #f3f4f6;
  flex-shrink: 0;
}
.info {
  flex: 1;
  min-width: 0;
}
.name {
  font-size: 28rpx;
  font-weight: 500;
  color: #1f2937;
  margin-bottom: 8rpx;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.units-row {
  display: flex;
  gap: 6rpx;
  margin-bottom: 8rpx;
}
.unit-tag {
  font-size: 20rpx;
  padding: 2rpx 12rpx;
  background: #f3f4f6;
  color: #6b7280;
  border-radius: 6rpx;
}
.unit-tag.active {
  background: $uni-color-primary;
  color: #fff;
}
.price-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12rpx;
}
.price {
  font-size: 24rpx;
  color: #6b7280;
}
.subtotal {
  font-size: 24rpx;
  color: #dc2626;
  font-weight: 500;
}
.qty-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.qty-control {
  display: flex;
  align-items: center;
  gap: 16rpx;
  background: #f3f4f6;
  border-radius: 32rpx;
  padding: 4rpx;
}
.qty-btn {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: #fff;
  text-align: center;
  line-height: 48rpx;
  font-size: 32rpx;
  color: #6b7280;
}
.qty-btn.plus {
  background: $uni-color-primary;
  color: #fff;
}
.qty-num {
  min-width: 32rpx;
  text-align: center;
  font-size: 28rpx;
}
.del-btn {
  font-size: 24rpx;
  color: #dc2626;
  padding: 8rpx 16rpx;
}
.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  background: #fff;
  padding: 16rpx 24rpx;
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.05);
}
.total-wrap {
  flex: 1;
}
.total-label {
  font-size: 24rpx;
  color: #9ca3af;
}
.total {
  display: block;
  font-size: 36rpx;
  font-weight: 600;
  color: #dc2626;
  font-variant-numeric: tabular-nums;
}
.submit-btn {
  width: 280rpx;
  height: 80rpx;
  line-height: 80rpx;
  font-size: 28rpx;
}
</style>
