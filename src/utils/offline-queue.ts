// src/utils/offline-queue.ts - 出车当天的弱网本地队列。
// 乡镇信号差，送达 / 退回 / 出车 / 收车 / 交车先写 uni.storage，联网后按入队顺序重放；
// 每条带客户端生成的 Idempotency-Key，重放复用同一个键，后端据此去重（见 送达.md「弱网处理」）。

import { ref } from 'vue'
import { newIdempotencyKey, request } from '@/api/request'

const STORAGE_KEY = 'wdm_sales_delivery_queue'

export type QueueKind = 'deliver' | 'reschedule' | 'depart' | 'finish' | 'mark_call' | 'hand_over'

export interface QueueOp {
  id: string
  kind: QueueKind
  /** 给人看的操作描述，同步失败时提示用 */
  label: string
  /** 关联的业务对象 id（订单 id / 客户 id），页面据此做本地乐观覆盖 */
  refId?: number
  url: string
  method: 'POST' | 'PUT'
  data?: Record<string, unknown> | null
  idempotencyKey: string
  createdAt: string
}

/** 待同步条数，页面直接绑定显示「待同步 N 条」。 */
export const pendingCount = ref(0)

function read(): QueueOp[] {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY)
    if (!raw) return []
    const list = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(list) ? (list as QueueOp[]) : []
  } catch {
    return []
  }
}

function write(list: QueueOp[]) {
  try {
    uni.setStorageSync(STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* 存储满了也只能丢，不能让页面挂掉 */
  }
  pendingCount.value = list.length
}

/** 恢复一次待同步条数（App 冷启动时调用）。 */
export function refreshPendingCount() {
  pendingCount.value = read().length
  return pendingCount.value
}

export function listOps(): QueueOp[] {
  return read()
}

/** 某类操作是否还在队列里（页面用它判断哪一单「待同步」）。 */
export function hasPending(kind: QueueKind, refId?: number): boolean {
  return read().some((op) => op.kind === kind && (refId === undefined || op.refId === refId))
}

export function enqueue(op: Omit<QueueOp, 'id' | 'idempotencyKey' | 'createdAt'>): QueueOp {
  const full: QueueOp = {
    ...op,
    id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    idempotencyKey: newIdempotencyKey(),
    createdAt: new Date().toISOString(),
  }
  const list = read()
  list.push(full)
  write(list)
  return full
}

export function removeOps(predicate: (op: QueueOp) => boolean) {
  write(read().filter((op) => !predicate(op)))
}

export function clearQueue() {
  uni.removeStorageSync(STORAGE_KEY)
  pendingCount.value = 0
}

let flushing = false

export interface FlushResult {
  synced: number
  failed: number
  left: number
}

/**
 * 按入队顺序重放。网络异常就停在这一条（保留后续操作），
 * 服务端明确拒绝（4xx / 5xx 带 status）说明这条不可能成功，直接丢弃并计入 failed。
 */
export async function flushQueue(): Promise<FlushResult> {
  const result: FlushResult = { synced: 0, failed: 0, left: 0 }
  if (flushing) {
    result.left = read().length
    return result
  }
  const snapshot = read()
  if (!snapshot.length) {
    pendingCount.value = 0
    return result
  }
  flushing = true
  try {
    for (const op of snapshot) {
      try {
        await request({
          url: op.url,
          method: op.method,
          data: op.data ?? undefined,
          showLoading: false,
          idempotencyKey: op.idempotencyKey,
        })
        removeOps((x) => x.id === op.id)
        result.synced += 1
      } catch (error) {
        const status = (error as { status?: number }).status
        if (typeof status === 'number') {
          removeOps((x) => x.id === op.id)
          result.failed += 1
          continue
        }
        break
      }
    }
  } finally {
    flushing = false
    result.left = refreshPendingCount()
  }
  return result
}

/** 联网后自动重放：页面 onLoad 时注册、onUnload 时解绑。 */
export function watchNetwork(onFlushed: (r: FlushResult) => void) {
  const handler = (res: { isConnected: boolean }) => {
    if (!res.isConnected) return
    flushQueue().then((r) => {
      if (r.synced || r.failed) onFlushed(r)
    })
  }
  uni.onNetworkStatusChange(handler)
  return () => uni.offNetworkStatusChange(handler)
}
