// src/utils/format.ts - Format helpers (uni-app compatible).
export function formatMoney(n: number | string | undefined | null, withSymbol = true): string {
  if (n === undefined || n === null || n === '') return withSymbol ? '¥0.00' : '0.00'
  const num = Number(n)
  if (Number.isNaN(num)) return withSymbol ? '¥0.00' : '0.00'
  return (withSymbol ? '¥' : '') + num.toFixed(2)
}

export function formatQty(n: number | undefined | null): string {
  if (n === undefined || n === null) return '0'
  return Number(n).toLocaleString('zh-CN')
}

export function formatDate(s: string | undefined | null, fmt = 'YYYY-MM-DD HH:mm'): string {
  if (!s) return '-'
  const d = new Date(s.replace(/-/g, '/').replace('T', ' ').split('.')[0])
  if (isNaN(d.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return fmt
    .replace('YYYY', String(d.getFullYear()))
    .replace('MM', pad(d.getMonth() + 1))
    .replace('DD', pad(d.getDate()))
    .replace('HH', pad(d.getHours()))
    .replace('mm', pad(d.getMinutes()))
    .replace('ss', pad(d.getSeconds()))
}

export function relativeTime(s: string | undefined | null): string {
  if (!s) return '-'
  const d = new Date(s.replace(/-/g, '/').replace('T', ' ').split('.')[0])
  if (isNaN(d.getTime())) return s
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} 天前`
  if (diff < 30 * 86400) return `${Math.floor(diff / (7 * 86400))} 周前`
  return formatDate(s, 'YYYY-MM-DD')
}

export function formatPhone(phone: string | undefined): string {
  if (!phone) return ''
  if (phone.length === 11) return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1 $2 $3')
  return phone
}

export function maskPhone(phone: string | undefined): string {
  if (!phone || phone.length !== 11) return phone || ''
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}
