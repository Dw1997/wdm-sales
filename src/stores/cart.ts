// src/stores/cart.ts - 代客下单购物车：只存 SKU 与数量，价格全部来自后端报价（可手改价）。
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { priceApi } from '@/api'
import type { CatalogProductCard, QuoteItem, Sku } from '@/types'

export interface CartItem {
  sku: Sku
  spuId: number
  spuName: string
  spec: string
  unit: string
  baseQty: number
  baseUnit: string
  price: number
  minPrice: number
  quantity: number
  amount: number
  manual?: boolean
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export const useCartStore = defineStore('cart', () => {
  const customerId = ref<number | null>(null)
  const customerName = ref('')
  const items = ref<CartItem[]>([])
  const source = ref<'route_call' | 'phone_in'>('phone_in')
  const routeTripId = ref<number | null>(null)

  const totalAmount = computed(() => round2(items.value.reduce((s, it) => s + it.amount, 0)))
  const totalCount = computed(() => round2(items.value.reduce((s, it) => s + it.quantity, 0)))
  const isEmpty = computed(() => items.value.length === 0)
  const hasBelowMin = computed(() =>
    items.value.some((it) => Boolean(it.manual) && it.price < it.minPrice),
  )

  function isBelowMin(item: CartItem): boolean {
    return Boolean(item.manual) && item.price < item.minPrice
  }

  function skuQty(skuId: number): number {
    return items.value.find((it) => it.sku.id === skuId)?.quantity ?? 0
  }

  function spuQty(spuId: number): number {
    return round2(
      items.value
        .filter((it) => it.spuId === spuId)
        .reduce((sum, it) => sum + it.quantity, 0),
    )
  }

  function setCustomer(id: number, name: string) {
    const changed = customerId.value !== id
    customerId.value = id
    customerName.value = name
    if (changed && items.value.length) void refreshPrices()
  }

  function setSource(next: 'route_call' | 'phone_in', tripId?: number | null) {
    source.value = next
    routeTripId.value = tripId ?? null
  }

  async function refreshPrices() {
    if (!customerId.value || !items.value.length) return
    const res = await priceApi.quote(
      customerId.value,
      items.value.map((it) => it.sku.id),
    )
    const bySku = new Map(res.items.map((q) => [q.sku_id, q]))
    items.value.forEach((it) => {
      const q = bySku.get(it.sku.id)
      if (!q) return
      it.price = Number(q.unit_price)
      it.minPrice = Number(q.min_price ?? q.unit_price)
      it.manual = false
      it.amount = round2(it.price * it.quantity)
    })
  }

  function addFromQuote(sku: Sku, quote: QuoteItem, quantity = 1, overridePrice?: number | null) {
    if (!customerId.value) {
      uni.showToast({ title: '请先选择客户', icon: 'none' })
      return
    }
    const manual = overridePrice !== undefined && overridePrice !== null
    const finalPrice = manual ? round2(overridePrice) : Number(quote.unit_price)
    const existing = items.value.find((it) => it.sku.id === sku.id)
    if (existing) {
      existing.quantity = round2(existing.quantity + quantity)
      if (manual) {
        existing.price = finalPrice
        existing.manual = true
      }
      existing.amount = round2(existing.price * existing.quantity)
      return
    }
    items.value.push({
      sku,
      spuId: sku.spu_id,
      spuName: quote.spu_name,
      spec: quote.sku_spec,
      unit: quote.unit,
      baseQty: Number(quote.base_qty),
      baseUnit: sku.base_unit || '',
      price: finalPrice,
      minPrice: Number(quote.min_price ?? quote.unit_price),
      quantity: round2(quantity),
      amount: round2(finalPrice * quantity),
      manual,
    })
  }

  /** 分类列表 / 选规格抽屉步进器直接设置某个 SKU 的数量（<= 0 时移除）。 */
  function setSkuQuantityFromQuote(sku: Sku, quote: QuoteItem, quantity: number) {
    if (!customerId.value) {
      uni.showToast({ title: '请先选择客户', icon: 'none' })
      return
    }
    const next = round2(quantity)
    const idx = items.value.findIndex((it) => it.sku.id === sku.id)
    if (next <= 0) {
      if (idx >= 0) items.value.splice(idx, 1)
      return
    }
    if (idx >= 0) {
      items.value[idx].quantity = next
      items.value[idx].amount = round2(items.value[idx].price * next)
      return
    }
    const price = Number(quote.unit_price)
    items.value.push({
      sku,
      spuId: sku.spu_id,
      spuName: quote.spu_name,
      spec: quote.sku_spec,
      unit: quote.unit,
      baseQty: Number(quote.base_qty),
      baseUnit: sku.base_unit || '',
      price,
      minPrice: Number(quote.min_price ?? quote.unit_price),
      quantity: next,
      amount: round2(price * next),
    })
  }

  /** 分类列表单规格卡片步进器直接设置数量（使用目录接口返回的默认 SKU 报价）。 */
  function setSkuQuantityFromCatalog(card: CatalogProductCard, quantity: number) {
    if (!customerId.value) {
      uni.showToast({ title: '请先选择客户', icon: 'none' })
      return
    }
    const next = round2(quantity)
    const idx = items.value.findIndex((it) => it.sku.id === card.default_sku_id)
    if (next <= 0) {
      if (idx >= 0) items.value.splice(idx, 1)
      return
    }
    if (idx >= 0) {
      items.value[idx].quantity = next
      items.value[idx].amount = round2(items.value[idx].price * next)
      return
    }
    if (card.default_sku_price === null || card.default_sku_price === undefined) {
      uni.showToast({ title: '暂未取到客户价', icon: 'none' })
      return
    }
    const price = Number(card.default_sku_price)
    const minPrice = Number(card.default_sku_min_price ?? card.default_sku_price)
    const sku: Sku = {
      id: card.default_sku_id,
      spu_id: card.spu_id,
      specs: { 规格: card.default_sku_unit },
      base_qty: card.default_sku_base_qty,
      allow_decimal: card.default_sku_allow_decimal,
      is_enabled: true,
      is_miniprogram: false,
      spu_name: card.name,
      base_unit: card.base_unit,
    }
    items.value.push({
      sku,
      spuId: card.spu_id,
      spuName: card.name,
      spec: card.default_sku_spec,
      unit: card.default_sku_unit,
      baseQty: Number(card.default_sku_base_qty),
      baseUnit: card.base_unit,
      price,
      minPrice,
      quantity: next,
      amount: round2(price * next),
    })
  }

  function updateQuantity(item: CartItem, qty: number) {
    item.quantity = Math.max(item.sku.allow_decimal ? 0.1 : 1, round2(qty))
    item.amount = round2(item.price * item.quantity)
  }

  function updatePrice(item: CartItem, price: number) {
    item.price = round2(price)
    item.manual = true
    item.amount = round2(item.price * item.quantity)
  }

  function removeItem(item: CartItem) {
    const idx = items.value.indexOf(item)
    if (idx >= 0) items.value.splice(idx, 1)
  }

  function clearItems() {
    items.value = []
  }

  function clear() {
    items.value = []
    customerId.value = null
    customerName.value = ''
    source.value = 'phone_in'
    routeTripId.value = null
  }

  return {
    customerId,
    customerName,
    items,
    source,
    routeTripId,
    totalAmount,
    totalCount,
    isEmpty,
    hasBelowMin,
    isBelowMin,
    skuQty,
    spuQty,
    setCustomer,
    setSource,
    refreshPrices,
    addFromQuote,
    setSkuQuantityFromQuote,
    setSkuQuantityFromCatalog,
    updateQuantity,
    updatePrice,
    removeItem,
    clearItems,
    clear,
  }
})
