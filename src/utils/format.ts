// src/utils/format.ts - 格式化工具（uni-app 兼容，避免依赖 dayjs 内部实现）。
import type { Money } from '@/types'

/** 后端金额是两位小数字符串，这里统一转成数字。 */
export function toNum(v: Money | null | undefined): number {
  if (v === null || v === undefined || v === '') return 0
  const n = Number(v)
  return Number.isNaN(n) ? 0 : n
}

export function formatMoney(n: Money | null | undefined, withSymbol = true): string {
  const num = toNum(n)
  return (withSymbol ? '¥' : '') + num.toFixed(2)
}

export function formatQty(n: Money | null | undefined): string {
  const num = toNum(n)
  return Number.isInteger(num) ? String(num) : String(Number(num.toFixed(2)))
}

export function formatDate(s: string | null | undefined, fmt = 'YYYY-MM-DD HH:mm'): string {
  if (!s) return '-'
  const d = new Date(s.replace(/-/g, '/').replace('T', ' ').split('.')[0])
  if (Number.isNaN(d.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return fmt
    .replace('YYYY', String(d.getFullYear()))
    .replace('MM', pad(d.getMonth() + 1))
    .replace('DD', pad(d.getDate()))
    .replace('HH', pad(d.getHours()))
    .replace('mm', pad(d.getMinutes()))
    .replace('ss', pad(d.getSeconds()))
}

export function relativeTime(s: string | null | undefined): string {
  if (!s) return '-'
  const d = new Date(s.replace(/-/g, '/').replace('T', ' ').split('.')[0])
  if (Number.isNaN(d.getTime())) return s
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} 天前`
  if (diff < 30 * 86400) return `${Math.floor(diff / (7 * 86400))} 周前`
  return formatDate(s, 'YYYY-MM-DD')
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  if (phone.length === 11) return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1 $2 $3')
  return phone
}

export function maskPhone(phone: string | null | undefined): string {
  if (!phone || phone.length !== 11) return phone || ''
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

// ---------- 出车相关：日期与倒计时 ----------

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function parseYmd(s: string): Date | null {
  const d = new Date(s.replace(/-/g, '/').slice(0, 10))
  return Number.isNaN(d.getTime()) ? null : d
}

/** 今天起偏移 n 天的 YYYY-MM-DD。 */
export function ymd(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** 11月18日 周三 */
export function cnDate(s: string | null | undefined): string {
  if (!s) return '-'
  const d = parseYmd(s)
  if (!d) return s
  return `${d.getMonth() + 1}月${d.getDate()}日 ${WEEKDAYS[d.getDay()]}`
}

/** 今天 / 明天 / 后天 / 11月21日 周六 */
export function dayLabel(s: string | null | undefined): string {
  if (!s) return '-'
  const d = parseYmd(s)
  if (!d) return s
  const today = parseYmd(ymd())
  const diff = today ? Math.round((d.getTime() - today.getTime()) / 86400000) : 99
  if (diff === 0) return '今天'
  if (diff === 1) return '明天'
  if (diff === 2) return '后天'
  if (diff === -1) return '昨天'
  return cnDate(s)
}

/** 与今天相差几天（出车列表分组用）。 */
export function dayDiff(s: string | null | undefined): number {
  if (!s) return 99
  const d = parseYmd(s)
  const today = parseYmd(ymd())
  if (!d || !today) return 99
  return Math.round((d.getTime() - today.getTime()) / 86400000)
}

/** 距离某个时间点还剩多久：还剩 2 小时 20 分 / 已过 15 分钟 */
export function timeLeft(iso: string | null | undefined): string {
  const d = toDate(iso)
  if (!d) return ''
  const mins = Math.round((d.getTime() - Date.now()) / 60000)
  const abs = Math.abs(mins)
  const text = abs >= 60 ? `${Math.floor(abs / 60)} 小时 ${abs % 60} 分` : `${abs} 分钟`
  return mins >= 0 ? `还剩 ${text}` : `已过 ${text}`
}

/** 2026-11-18 10:42:11 → 10:42 */
export function clockOf(s: string | null | undefined): string {
  if (!s) return ''
  const d = toDate(s)
  if (!d) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 后端下发的 datetime 可能是带时区的 ISO，也可能是 "YYYY-MM-DD HH:mm:ss"，两种都认。 */
export function toDate(s: string | null | undefined): Date | null {
  if (!s) return null
  const native = new Date(s)
  if (!Number.isNaN(native.getTime())) return native
  const d = new Date(s.replace(/-/g, '/').replace('T', ' ').split('.')[0])
  return Number.isNaN(d.getTime()) ? null : d
}
