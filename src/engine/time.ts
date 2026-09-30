import type { DateKey, HHMM } from '../domain/types'

export const MINUTE = 60_000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const pad = (n: number) => String(n).padStart(2, '0')

export function isHHMM(v: unknown): v is HHMM {
  return typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
}

export function toMin(hhmm: HHMM): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function fromMin(min: number): HHMM {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}

export function dateKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function isDateKey(v: unknown): v is DateKey {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = parseKey(v)
  return !Number.isNaN(d.getTime()) && dateKey(d) === v
}

export function parseKey(k: DateKey): Date {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function at(day: Date, minutes: number): Date {
  const r = startOfDay(day)
  r.setHours(0, minutes, 0, 0)
  return r
}

export function atHHMM(day: Date, hhmm: HHMM): Date {
  return at(day, toMin(hhmm))
}

export function minuteOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60
}

export function diffMin(a: Date | number, b: Date | number): number {
  return (+a - +b) / MINUTE
}

export function daysBetween(from: DateKey, to: DateKey): number {
  const a = parseKey(from)
  const b = parseKey(to)
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / DAY)
}

export function startOfWeek(d: Date, weekStart: 0 | 1): Date {
  const s = startOfDay(d)
  const diff = (s.getDay() - weekStart + 7) % 7
  return addDays(s, -diff)
}

export function formatClock(d: Date | number, fmt: '12h' | '24h', withSuffix = true): string {
  const date = typeof d === 'number' ? new Date(d) : d
  const h = date.getHours()
  const m = date.getMinutes()
  if (fmt === '24h') return `${pad(h)}:${pad(m)}`
  const h12 = h % 12 === 0 ? 12 : h % 12
  return withSuffix ? `${h12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}` : `${h12}:${pad(m)}`
}

export function formatHHMM(hhmm: HHMM, fmt: '12h' | '24h', withSuffix = false): string {
  return formatClock(at(new Date(2000, 0, 3), toMin(hhmm)), fmt, withSuffix)
}

export function formatDuration(min: number): string {
  const m = Math.max(0, Math.round(min))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h}h ${r}m` : `${h}h`
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

export function formatLongDate(d: Date): string {
  return `${WEEKDAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export function formatShortDate(k: DateKey): string {
  const d = parseKey(k)
  return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`
}

export function relativeDay(k: DateKey, today: DateKey): string {
  const n = daysBetween(today, k)
  if (n === 0) return 'Today'
  if (n === 1) return 'Tomorrow'
  if (n === -1) return 'Yesterday'
  if (n < 0) return `${-n} days ago`
  if (n < 7) return WEEKDAY_NAMES[parseKey(k).getDay()]
  return formatShortDate(k)
}

export function greeting(d: Date): string {
  const h = d.getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
