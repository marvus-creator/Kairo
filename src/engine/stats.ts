import type { AppData, DateKey, ID } from '../domain/types'
import { completed, subjectById } from './priority'
import { academicSubjectsOn, blocksForDay, classBlocks, PERSONAL_STUDY_KINDS } from './schedule'
import { addDays, dateKey, DAY, daysBetween, diffMin, formatDuration, startOfDay, startOfWeek, WEEKDAY_NAMES } from './time'

export const STREAK_MIN = 10

export function minutesByDay(data: AppData): Map<DateKey, number> {
  const m = new Map<DateKey, number>()
  for (const s of completed(data)) {
    const k = dateKey(new Date(s.startedAt))
    m.set(k, (m.get(k) ?? 0) + s.focusMin)
  }
  return m
}

export function minutesBetween(data: AppData, from: Date, to: Date): number {
  return completed(data)
    .filter((s) => s.startedAt >= +from && s.startedAt < +to)
    .reduce((n, s) => n + s.focusMin, 0)
}

export function streaks(data: AppData, now: Date): { current: number; longest: number; studiedToday: boolean } {
  const byDay = minutesByDay(data)
  const active = (d: Date) => (byDay.get(dateKey(d)) ?? 0) >= STREAK_MIN
  const today = startOfDay(now)
  const studiedToday = active(today)
  let current = 0
  let cursor = studiedToday ? today : addDays(today, -1)
  while (active(cursor)) {
    current++
    cursor = addDays(cursor, -1)
  }
  const days = [...byDay.entries()].filter(([, m]) => m >= STREAK_MIN).map(([k]) => k).sort()
  let longest = 0
  let run = 0
  let prev: DateKey | null = null
  for (const k of days) {
    run = prev && daysBetween(prev, k) === 1 ? run + 1 : 1
    longest = Math.max(longest, run)
    prev = k
  }
  return { current, longest: Math.max(longest, current), studiedToday }
}

export function consistencyScore(data: AppData, now: Date): number {
  const byDay = minutesByDay(data)
  const created = startOfDay(new Date(data.profile.createdAt))
  let planned = 0
  let hit = 0
  for (let i = 0; i < 14; i++) {
    const d = addDays(startOfDay(now), -i)
    if (d < created) break
    const hasBlock = blocksForDay(data, d).some((b) => PERSONAL_STUDY_KINDS.includes(b.kind))
    if (!hasBlock) continue
    if (i === 0 && (byDay.get(dateKey(d)) ?? 0) < STREAK_MIN) continue
    planned++
    if ((byDay.get(dateKey(d)) ?? 0) >= STREAK_MIN) hit++
  }
  return planned ? Math.round((hit / planned) * 100) : 0
}

export function completionRate(data: AppData, now: Date): number | null {
  const since = +now - 30 * DAY
  const recent = data.sessions.filter((s) => s.startedAt >= since)
  const skipped = Object.entries(data.missed).filter(([k, v]) => v === 'skipped' && k >= dateKey(new Date(since))).length
  const total = recent.length + skipped
  if (!total) return null
  return Math.round((recent.filter((s) => s.status === 'completed').length / total) * 100)
}

export interface SubjectShare {
  subjectId: ID
  minutes: number
  share: number
}

export function subjectShare(data: AppData, from: Date, to: Date): SubjectShare[] {
  const m = new Map<ID, number>()
  let total = 0
  for (const s of completed(data)) {
    if (s.startedAt < +from || s.startedAt >= +to || !s.subjectId) continue
    m.set(s.subjectId, (m.get(s.subjectId) ?? 0) + s.focusMin)
    total += s.focusMin
  }
  return [...m.entries()]
    .map(([subjectId, minutes]) => ({ subjectId, minutes, share: total ? minutes / total : 0 }))
    .sort((a, b) => b.minutes - a.minutes)
}

export function neglected(data: AppData, now: Date, minDays = 6): { subjectId: ID; days: number | null }[] {
  const weekly = new Set<ID>()
  for (let i = 0; i < 7; i++) for (const id of academicSubjectsOn(data, addDays(now, -i))) weekly.add(id)
  const out: { subjectId: ID; days: number | null }[] = []
  for (const id of weekly) {
    const last = completed(data).filter((s) => s.subjectId === id).reduce((mx, s) => Math.max(mx, s.endedAt), 0)
    const days = last ? Math.floor((+startOfDay(now) - +startOfDay(new Date(last))) / DAY) : null
    if (days === null || days >= minDays) out.push({ subjectId: id, days })
  }
  return out.sort((a, b) => (b.days ?? 999) - (a.days ?? 999))
}

export function bestWeekday(data: AppData): number | null {
  const counts = new Array(7).fill(0)
  for (const [k, m] of minutesByDay(data)) if (m >= STREAK_MIN) counts[new Date(k + 'T12:00').getDay()]++
  const max = Math.max(...counts)
  return max >= 2 ? counts.indexOf(max) : null
}

export interface WeekDay {
  date: Date
  key: DateKey
  classes: number
  subjects: string[]
  studyMin: number
  plannedMin: number
  tasksDue: number
  tests: number
  completion: number | null
  isToday: boolean
  school: boolean
}

export function weekOverview(data: AppData, now: Date): WeekDay[] {
  const start = startOfWeek(now, data.preferences.weekStart)
  const byDay = minutesByDay(data)
  const todayKey = dateKey(now)
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i)
    const key = dateKey(d)
    const classes = classBlocks(data, d)
    const planned = blocksForDay(data, d)
      .filter((b) => PERSONAL_STUDY_KINDS.includes(b.kind))
      .reduce((n, b) => n + diffMin(b.end, b.start), 0)
    const studyMin = byDay.get(key) ?? 0
    return {
      date: d,
      key,
      classes: classes.length,
      subjects: [...new Set(classes.map((c) => subjectById(data, c.subjectId)?.short ?? c.label))],
      studyMin,
      plannedMin: planned,
      tasksDue: data.tasks.filter((t) => t.due === key && t.status !== 'done').length,
      tests: data.exams.filter((e) => e.date === key).length,
      completion: planned && key <= todayKey ? Math.min(1, studyMin / planned) : null,
      isToday: key === todayKey,
      school: classes.length > 0,
    }
  })
}

export interface Insight {
  tone: 'good' | 'info' | 'warn'
  text: string
}

export function insights(data: AppData, now: Date): Insight[] {
  const out: Insight[] = []
  const weekStart = startOfWeek(now, data.preferences.weekStart)
  const week = minutesBetween(data, weekStart, addDays(weekStart, 7))
  if (week > 0) out.push({ tone: 'good', text: `You studied ${formatDuration(week)} this week.` })
  const share = subjectShare(data, addDays(now, -14), addDays(now, 1))
  if (share.length >= 2 && share[0].share >= 0.3) {
    out.push({ tone: 'info', text: `${subjectById(data, share[0].subjectId)?.short} has received ${Math.round(share[0].share * 100)}% of your study time in the last two weeks.` })
  }
  const lagging = neglected(data, now).slice(0, 2)
  for (const n of lagging) {
    const name = subjectById(data, n.subjectId)?.name
    out.push({ tone: 'warn', text: n.days === null ? `${name} has not been revised yet.` : `${name} has not been revised in ${n.days} days.` })
  }
  const best = bestWeekday(data)
  if (best !== null) out.push({ tone: 'info', text: `Your most consistent study day is ${WEEKDAY_NAMES[best]}.` })
  const s = streaks(data, now)
  const byDay = minutesByDay(data)
  const yesterday = dateKey(addDays(now, -1))
  const gapBefore = dateKey(addDays(now, -2))
  if (s.studiedToday && !(byDay.get(yesterday) ?? 0) && !(byDay.get(gapBefore) ?? 0) && byDay.size > 1) {
    out.push({ tone: 'good', text: 'Welcome back. Returning after a gap is the habit that matters most.' })
  }
  const late = completed(data).filter((x) => {
    if (x.endedAt < +now - 7 * DAY) return false
    const d = new Date(x.endedAt)
    const sleep = blocksForDay(data, addDays(d, d.getHours() < 12 ? -1 : 0)).find((b) => b.kind === 'sleep')
    return sleep ? x.endedAt > +sleep.start + 15 * 60_000 && x.startedAt < +sleep.end : false
  }).length
  if (late) out.push({ tone: 'warn', text: `${late} session${late > 1 ? 's' : ''} ran into your sleep window this week. Sleep is part of the plan.` })
  return out
}

export interface Milestone {
  label: string
  reached: boolean
}

export function milestones(data: AppData, now: Date): Milestone[] {
  const sessions = completed(data).length
  const totalMin = completed(data).reduce((n, s) => n + s.focusMin, 0)
  const { longest } = streaks(data, now)
  return [
    { label: 'First session', reached: sessions >= 1 },
    { label: '10 sessions', reached: sessions >= 10 },
    { label: '7-day streak', reached: longest >= 7 },
    { label: '25 hours studied', reached: totalMin >= 1500 },
    { label: '50 sessions', reached: sessions >= 50 },
    { label: '30-day streak', reached: longest >= 30 },
  ]
}
