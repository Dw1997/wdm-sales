// src/api/request.ts - uni.request 封装：统一信封解包、Bearer 头、幂等键、401 处理。
// 接口契约以 docs/00-core/api/ 为准；BASE_URL 指向后端 /api/v1。

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9000/api/v1'

export interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: unknown
  params?: Record<string, unknown>
  showLoading?: boolean
  /** 写操作默认带 Idempotency-Key（接口规范 §10） */
  idempotent?: boolean
  /** 离线队列重放时必须复用入队时生成的幂等键，后端据此去重 */
  idempotencyKey?: string
  /** 登录类请求：失败不弹 toast，401 也不跳登录页（由页面自己显示错误） */
  silent?: boolean
}

interface Envelope<T> {
  code: number
  message: string
  data: T
}

function buildUrl(url: string, params?: Record<string, unknown>): string {
  if (!params) return url
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')
  if (!q) return url
  return url.includes('?') ? `${url}&${q}` : `${url}?${q}`
}

function uuid(): string {
  const hex = '0123456789abcdef'
  let out = ''
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += '-'
    else if (i === 14) out += '4'
    else if (i === 19) out += hex[(Math.random() * 4 | 8)]
    else out += hex[Math.random() * 16 | 0]
  }
  return out
}

/** 离线队列入队时先取一个幂等键，重放时原样带回去重。 */
export function newIdempotencyKey(): string {
  return uuid()
}

let tokenGetter: () => string = () => ''

export function setTokenGetter(fn: () => string) {
  tokenGetter = fn
}

function messageOf(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback
  const b = body as Record<string, unknown>
  if (typeof b.message === 'string' && b.message) return b.message
  if (typeof b.detail === 'string' && b.detail) return b.detail
  if (Array.isArray(b.detail) && b.detail.length) {
    const first = b.detail[0] as Record<string, unknown>
    if (first && typeof first.msg === 'string') return first.msg
  }
  return fallback
}

function handleUnauthorized() {
  uni.removeStorageSync('wdm_sales_access')
  uni.removeStorageSync('wdm_sales_refresh')
  uni.reLaunch({ url: '/pages/auth/login' })
}

export async function request<T = unknown>(opts: RequestOptions): Promise<T> {
  const method = opts.method || 'GET'
  const showLoading = opts.showLoading !== false
  if (showLoading) uni.showLoading({ title: '加载中', mask: false })

  try {
    return await new Promise<T>((resolve, reject) => {
      const header: Record<string, string> = { 'Content-Type': 'application/json' }
      const token = tokenGetter()
      if (token) header.Authorization = `Bearer ${token}`
      const idempotent = opts.idempotent ?? method !== 'GET'
      if (opts.idempotencyKey) header['Idempotency-Key'] = opts.idempotencyKey
      else if (idempotent) header['Idempotency-Key'] = uuid()

      uni.request({
        url: BASE_URL + buildUrl(opts.url, opts.params),
        method,
        data: opts.data as Record<string, unknown> | undefined,
        header,
        success: (res) => {
          const status = res.statusCode || 200
          const body = res.data as Envelope<T> | Record<string, unknown> | undefined
          if (status >= 200 && status < 300) {
            if (body && typeof body === 'object' && 'data' in body) {
              resolve((body as Envelope<T>).data)
            } else {
              resolve(undefined as T)
            }
            return
          }
          const message = messageOf(body, '请求失败')
          if (opts.silent) {
            /* 登录页自己显示错误条，不弹 toast、不重定向 */
          } else if (status === 401) {
            handleUnauthorized()
          } else {
            uni.showToast({ title: message, icon: 'none' })
          }
          reject(Object.assign(new Error(message), { status, body }))
        },
        fail: () => {
          if (!opts.silent) uni.showToast({ title: '网络异常', icon: 'none' })
          reject(new Error('网络异常'))
        },
      })
    })
  } finally {
    if (showLoading) uni.hideLoading()
  }
}
