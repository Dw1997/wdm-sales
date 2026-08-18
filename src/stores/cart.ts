// src/stores/cart.ts - Cart state for 代客下单.
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Product, PriceResponse } from '@/types'
import { productApi } from '@/api'

export interface CartItem {
  product: Product
  unit: string
  quantity: number
  unit_price: number
  subtotal: number
}

export const useCartStore = defineStore('cart', () => {
  const customerId = ref<number | null>(null)
  const customerName = ref<string>('')
  const items = ref<CartItem[]>([])

  const totalAmount = computed(() => items.value.reduce((s, it) => s + it.subtotal, 0))
  const totalCount = computed(() => items.value.reduce((s, it) => s + it.quantity, 0))
  const isEmpty = computed(() => items.value.length === 0)

  function setCustomer(id: number, name: string) {
    customerId.value = id
    customerName.value = name
    // Re-resolve prices for all items when customer changes
    refreshPrices()
  }

  async function refreshPrices() {
    if (!customerId.value) return
    for (const it of items.value) {
      const p = await productApi.price(it.product.id, customerId.value!, it.unit)
      it.unit_price = p.unit_price
      it.subtotal = Number((p.unit_price * it.quantity).toFixed(2))
    }
  }

  async function addItem(product: Product, unit: string, quantity: number) {
    if (!customerId.value) {
      uni.showToast({ title: '请先选择客户', icon: 'none' })
      return
    }
    const existing = items.value.find((it) => it.product.id === product.id && it.unit === unit)
    if (existing) {
      existing.quantity += quantity
      existing.subtotal = Number((existing.unit_price * existing.quantity).toFixed(2))
    } else {
      const price = await productApi.price(product.id, customerId.value!, unit)
      items.value.push({
        product,
        unit,
        quantity,
        unit_price: price.unit_price,
        subtotal: Number((price.unit_price * quantity).toFixed(2)),
      })
    }
  }

  async function updateUnit(item: CartItem, newUnit: string) {
    const price = await productApi.price(item.product.id, customerId.value!, newUnit)
    item.unit = newUnit
    item.unit_price = price.unit_price
    item.subtotal = Number((price.unit_price * item.quantity).toFixed(2))
  }

  function updateQuantity(item: CartItem, qty: number) {
    item.quantity = Math.max(1, qty)
    item.subtotal = Number((item.unit_price * item.quantity).toFixed(2))
  }

  function removeItem(item: CartItem) {
    const idx = items.value.indexOf(item)
    if (idx >= 0) items.value.splice(idx, 1)
  }

  function clear() {
    items.value = []
    customerId.value = null
    customerName.value = ''
  }

  return {
    customerId,
    customerName,
    items,
    totalAmount,
    totalCount,
    isEmpty,
    setCustomer,
    addItem,
    updateUnit,
    updateQuantity,
    removeItem,
    clear,
  }
})
