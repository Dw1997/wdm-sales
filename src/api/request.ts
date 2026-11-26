// src/api/request.ts - uni.request 封装：统一信封解包、Bearer 头、幂等键、401 单飞续期。
// 接口契约以 docs/00-core/api/ 为准；BASE_URL 指向后端 /api/v1。

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9000/api/v1'

const ACCESS_KEY = 'wdm_sales_access'
const REFRESH_KEY = 'wdm_sales_refresh'

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
  /** 内部标记：401 刷新后已重放过，避免无限循环 */
  _retried?: boolean
}

interface Envelope<T> {
  code: number
  message: string
  data: T
}

interface AuthCallbacks {
  getRefreshToken?: () => string
  onTokensRefreshed?: (access: string, refresh?: string) => void
  onUnauthorized?: () => void
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
let authCallbacks: AuthCallbacks = {}

export function setTokenGetter(fn: () => string) {
  tokenGetter = fn
}

export function setAuthCallbacks(cbs: AuthCallbacks) {
  authCallbacks = { ...authCallbacks, ...cbs }
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

let redirectingToLogin = false

function handleUnauthorized() {
  if (redirectingToLogin) return
  redirectingToLogin = true
  uni.removeStorageSync(ACCESS_KEY)
  uni.removeStorageSync(REFRESH_KEY)
  authCallbacks.onUnauthorized?.()
  uni.reLaunch({
    url: '/pages/auth/login',
    complete: () => {
      setTimeout(() => {
        redirectingToLogin = false
      }, 1000)
    },
  })
}

/** 'unauthorized' 才踢登录；'network_error' 只提示重试，绝不清 token。 */
type RefreshStatus = 'ok' | 'unauthorized' | 'network_error'

async function doRefresh(): Promise<RefreshStatus> {
  const refreshToken =
    authCallbacks.getRefreshToken?.() || (uni.getStorageSync(REFRESH_KEY) as string) || ''
  if (!refreshToken) return 'unauthorized'

  return await new Promise<RefreshStatus>((resolve) => {
    uni.request({
      url: `${BASE_URL}/auth/refresh`,
      method: 'POST',
      data: { refresh_token: refreshToken },
      header: { 'Content-Type': 'application/json' },
      success: (res) => {
        const status = res.statusCode || 200
        if (status === 401 || status === 403) {
          resolve('unauthorized')
          return
        }
        if (status < 200 || status >= 300) {
          resolve('network_error')
          return
        }
        const body = res.data as Envelope<Record<string, unknown>> | Record<string, unknown> | undefined
        const payload =
          body && typeof body === 'object' && 'data' in body
            ? (body as Envelope<Record<string, unknown>>).data
            : (body as Record<string, unknown> | undefined)
        const access = payload && typeof payload.access_token === 'string' ? payload.access_token : ''
        const refresh = payload && typeof payload.refresh_token === 'string' ? payload.refresh_token : ''
        if (!access) {
          resolve('network_error')
          return
        }
        uni.setStorageSync(ACCESS_KEY, access)
        if (refresh) uni.setStorageSync(REFRESH_KEY, refresh)
        authCallbacks.onTokensRefreshed?.(access, refresh || undefined)
        resolve('ok')
      },
      fail: () => resolve('network_error'),
    })
  })
}

let refreshPromise: Promise<RefreshStatus> | null = null

/** 并发 401 只发一次 /auth/refresh，其余请求共享同一个 Promise。 */
export function tryRefreshToken(): Promise<RefreshStatus> {
  if (!refreshPromise) {
    refreshPromise = doRefresh()
      .catch(() => 'network_error' as const)
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

interface Outcome<T> {
  ok: boolean
  status: number
  data?: T
  message?: string
  body?: unknown
}

function sendRequest<T>(
  opts: RequestOptions,
  method: NonNullable<RequestOptions['method']>,
  idempotencyKey?: string,
): Promise<Outcome<T>> {
  return new Promise((resolve) => {
    const header: Record<string, string> = { 'Content-Type': 'application/json' }
    const token = tokenGetter()
    if (token) header.Authorization = `Bearer ${token}`
    if (idempotencyKey) header['Idempotency-Key'] = idempotencyKey

    uni.request({
      url: BASE_URL + buildUrl(opts.url, opts.params),
      method,
      data: opts.data as Record<string, unknown> | undefined,
      header,
      success: (res) => {
        const status = res.statusCode || 200
        const body = res.data as Envelope<T> | Record<string, unknown> | undefined
        if (status >= 200 && status < 300) {
          const data =
            body && typeof body === 'object' && 'data' in body
              ? (body as Envelope<T>).data
              : (undefined as T)
          resolve({ ok: true, status, data })
          return
        }
        resolve({ ok: false, status, message: messageOf(body, '请求失败'), body })
      },
      fail: () => resolve({ ok: false, status: 0, message: '网络异常' }),
    })
  })
}

function canRefresh(opts: RequestOptions): boolean {
  return (
    !opts._retried &&
    !opts.silent &&
    !opts.url.includes('/auth/login') &&
    !opts.url.includes('/auth/refresh') &&
    !opts.url.includes('/auth/logout')
  )
}

export async function request<T = unknown>(opts: RequestOptions): Promise<T> {
  const method = opts.method || 'GET'
  const showLoading = opts.showLoading !== false
  const idempotent = opts.idempotent ?? method !== 'GET'
  const effectiveIdempotencyKey = opts.idempotencyKey || (idempotent ? uuid() : undefined)

  if (showLoading) uni.showLoading({ title: '加载中', mask: false })

  try {
    let outcome = await sendRequest<T>(opts, method, effectiveIdempotencyKey)

    if (!outcome.ok && outcome.status === 401 && canRefresh(opts)) {
      const refreshStatus = await tryRefreshToken()
      if (refreshStatus === 'ok') {
        // showLoading: false —— 复用外层已展示的 loading，保持 show/hide 一一配对
        return await request<T>({
          ...opts,
          idempotencyKey: effectiveIdempotencyKey,
          _retried: true,
          showLoading: false,
        })
      }
      if (refreshStatus === 'network_error') {
        // 弱网/断网：token 仍可能有效，绝不能踢回登录页
        if (!opts.silent) uni.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
        throw new Error('网络异常，请稍后重试')
      }
      handleUnauthorized()
      throw Object.assign(new Error(outcome.message || '登录已过期，请重新登录'), {
        status: outcome.status,
        body: outcome.body,
      })
    }

    if (outcome.ok) return outcome.data as T

    const message = outcome.message || '请求失败'
    if (!opts.silent) {
      if (outcome.status === 401) handleUnauthorized()
      else uni.showToast({ title: message, icon: 'none' })
    }
    throw Object.assign(new Error(message), { status: outcome.status, body: outcome.body })
  } finally {
    if (showLoading) uni.hideLoading()
  }
}

interface UploadOutcome {
  ok: boolean
  status: number
  url?: string
  message?: string
  body?: unknown
}

function sendUpload(filePath: string): Promise<UploadOutcome> {
  return new Promise((resolve) => {
    const header: Record<string, string> = {}
    const token = tokenGetter()
    if (token) header.Authorization = `Bearer ${token}`

    uni.uploadFile({
      url: `${BASE_URL}/upload/image`,
      filePath,
      name: 'file',
      header,
      success: (res) => {
        const status = res.statusCode || 200
        let body: unknown
        try {
          body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
        } catch {
          body = undefined
        }
        if (status >= 200 && status < 300) {
          const payload =
            body && typeof body === 'object' && 'data' in body
              ? (body as Envelope<{ url: string }>).data
              : body
          const url = (payload as { url?: unknown } | undefined)?.url
          if (typeof url === 'string' && url) {
            resolve({ ok: true, status, url })
            return
          }
          resolve({ ok: false, status, message: '上传失败：缺少图片地址', body })
          return
        }
        resolve({ ok: false, status, message: messageOf(body, '上传失败'), body })
      },
      fail: () => resolve({ ok: false, status: 0, message: '上传失败' }),
    })
  })
}

/** 图片上传：走 multipart 表单（字段名 file），复用 Bearer 头与信封解包。 */
export async function uploadImage(
  filePath: string,
  opts: { showLoading?: boolean } = {},
): Promise<{ url: string }> {
  const showLoading = opts.showLoading !== false
  if (showLoading) uni.showLoading({ title: '上传中', mask: true })

  try {
    let outcome = await sendUpload(filePath)

    if (!outcome.ok && outcome.status === 401) {
      const refreshStatus = await tryRefreshToken()
      if (refreshStatus === 'ok') {
        outcome = await sendUpload(filePath)
        if (!outcome.ok && outcome.status === 401) handleUnauthorized()
      } else if (refreshStatus === 'unauthorized') {
        handleUnauthorized()
      } else {
        // 弱网/断网：token 仍可能有效，绝不能踢回登录页
        uni.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
        throw new Error('网络异常，请稍后重试')
      }
    }

    if (outcome.ok) return { url: outcome.url as string }

    const message = outcome.message || '上传失败'
    if (outcome.status !== 401) uni.showToast({ title: message, icon: 'none' })
    throw Object.assign(new Error(message), { status: outcome.status, body: outcome.body })
  } finally {
    if (showLoading) uni.hideLoading()
  }
}
