import type { AppData, DateKey, ID, MyBlock, PeriodKind, RoutineBlock, RoutineKind, SchoolPeriod, Subject } from '../domain/types'
import { addDays, at, dateKey, diffMin, startOfDay, toMin } from './time'

export type BlockKind = PeriodKind | 'devotion' | RoutineKind | 'my-study' | 'my-activity'

export interface Block {
  id: string
  kind: BlockKind
  label: string
  start: Date
  end: Date
  day: DateKey
  subjectId?: ID
  teacherId?: ID
  periods: number
  school: boolean
  mine?: MyBlock
}

export type ScheduleData = Pick<AppData, 'school' | 'routine' | 'subjects' | 'teachers'> & Partial<Pick<AppData, 'dayPlans'>>

export const STUDY_KINDS: BlockKind[] = ['morning-study', 'evening-study', 'weekend-study', 'office-hours', 'self-study', 'my-study']
export const PERSONAL_STUDY_KINDS: BlockKind[] = ['morning-study', 'evening-study', 'weekend-study', 'my-study']
export const AUTO_STUDY_KINDS: BlockKind[] = ['morning-study', 'evening-study', 'weekend-study']

const rank = (b: Block) => (b.school ? 3 : b.mine ? 2 : 1)

export function dayPlanMode(data: ScheduleData, d: Date): 'auto' | 'mine' {
  return data.dayPlans?.[dateKey(d)]?.mode ?? 'auto'
}

export function myBlocks(data: ScheduleData, d: Date): Block[] {
  const key = dateKey(d)
  const plan = data.dayPlans?.[key]
  if (!plan) return []
  return plan.blocks
    .filter((m) => toMin(m.end) > toMin(m.start))
    .map((m) => ({
      id: `${key}|my-${m.id}`,
      kind: m.kind === 'study' ? ('my-study' as const) : ('my-activity' as const),
      label: m.title || (m.kind === 'study' ? (m.subjectId ? `Study ${data.subjects.find((s) => s.id === m.subjectId)?.short ?? ''}`.trim() : 'Study — Kairo picks') : 'Activity'),
      start: at(d, toMin(m.start)),
      end: at(d, toMin(m.end)),
      day: key,
      subjectId: m.subjectId,
      periods: 0,
      school: false,
      mine: m,
    }))
}

export const isStudyBlock = (b: Block) => STUDY_KINDS.includes(b.kind)

export function isSchoolDay(data: Pick<AppData, 'school'>, d: Date): boolean {
  const wd = d.getDay()
  if (data.school.daysOff.includes(dateKey(d))) return false
  return data.school.periods.some((p) => p.weekday === wd)
}

function routineApplies(r: RoutineBlock, data: Pick<AppData, 'school'>, d: Date): boolean {
  if (r.weekdays && r.weekdays.length && !r.weekdays.includes(d.getDay() as never)) return false
  switch (r.when) {
    case 'every-day':
      return true
    case 'school-day':
      return isSchoolDay(data, d)
    case 'off-day':
      return !isSchoolDay(data, d)
    case 'before-school-day':
      return isSchoolDay(data, addDays(d, 1))
    case 'before-off-day':
      return !isSchoolDay(data, addDays(d, 1))
  }
}

export function periodsFor(data: Pick<AppData, 'school'>, weekday: number): SchoolPeriod[] {
  return data.school.periods.filter((p) => p.weekday === weekday).sort((a, b) => toMin(a.start) - toMin(b.start))
}

export function periodLabel(p: SchoolPeriod, subjects: Subject[]): string {
  if (p.subjectId) return subjects.find((s) => s.id === p.subjectId)?.name ?? p.label ?? 'Class'
  if (p.label) return p.label
  switch (p.kind) {
    case 'break':
      return 'Short Break'
    case 'lunch':
      return 'Lunch Break'
    case 'office-hours':
      return 'Office Hours'
    case 'self-study':
      return 'Self-Study'
    case 'clubs':
      return 'Clubs'
    default:
      return 'Class'
  }
}

export function schoolBlocks(data: ScheduleData, d: Date): Block[] {
  if (!isSchoolDay(data, d)) return []
  const key = dateKey(d)
  const out: Block[] = []
  if (data.school.devotion) {
    out.push({
      id: `${key}|devotion`,
      kind: 'devotion',
      label: 'Devotion',
      start: at(d, toMin(data.school.devotion.start)),
      end: at(d, toMin(data.school.devotion.end)),
      day: key,
      periods: 0,
      school: true,
    })
  }
  for (const p of periodsFor(data, d.getDay())) {
    const start = at(d, toMin(p.start))
    const end = at(d, toMin(p.end))
    if (end <= start) continue
    const prev = out[out.length - 1]
    if (
      prev &&
      prev.kind === p.kind &&
      p.kind === 'class' &&
      prev.subjectId === p.subjectId &&
      +prev.end === +start
    ) {
      prev.end = end
      prev.periods += 1
      continue
    }
    out.push({
      id: `${key}|${p.id}`,
      kind: p.kind,
      label: periodLabel(p, data.subjects),
      start,
      end,
      day: key,
      subjectId: p.subjectId,
      teacherId: p.teacherId,
      periods: 1,
      school: true,
    })
  }
  return out
}

export function routineBlocks(data: ScheduleData, d: Date): Block[] {
  const key = dateKey(d)
  return data.routine
    .filter((r) => routineApplies(r, data, d))
    .map((r) => {
      const s = toMin(r.start)
      let e = toMin(r.end)
      if (e <= s) e += 1440
      return {
        id: `${key}|${r.id}`,
        kind: r.kind,
        label: r.label,
        start: at(d, s),
        end: at(d, e),
        day: key,
        periods: 0,
        school: false,
      }
    })
}

export function blocksForDay(data: ScheduleData, d: Date): Block[] {
  const mine = dayPlanMode(data, d) === 'mine'
  const routine = routineBlocks(data, d).filter((b) => !(mine && AUTO_STUDY_KINDS.includes(b.kind)))
  return [...schoolBlocks(data, d), ...myBlocks(data, d), ...routine].sort((a, b) => +a.start - +b.start)
}

export function timeline(data: ScheduleData, d: Date): Block[] {
  const dayStart = startOfDay(d)
  const dayEnd = addDays(dayStart, 1)
  const raw = [...blocksForDay(data, addDays(dayStart, -1)), ...blocksForDay(data, dayStart)]
    .filter((b) => b.end > dayStart && b.start < dayEnd)
    .sort((a, b) => +a.start - +b.start || rank(b) - rank(a))

  const placed: Block[] = []
  for (const level of [3, 2, 1]) {
    for (const b of raw) {
      if (rank(b) !== level) continue
      let pieces: Array<{ start: Date; end: Date }> = [{ start: b.start, end: b.end }]
      for (const p of placed) {
        pieces = pieces.flatMap((seg) => {
          if (p.end <= seg.start || p.start >= seg.end) return [seg]
          const out: Array<{ start: Date; end: Date }> = []
          if (p.start > seg.start) out.push({ start: seg.start, end: p.start })
          if (p.end < seg.end) out.push({ start: p.end, end: seg.end })
          return out
        })
      }
      pieces
        .filter((seg) => +seg.end - +seg.start >= 60_000)
        .forEach((seg, i) => placed.push({ ...b, id: i ? `${b.id}~${i}` : b.id, start: seg.start, end: seg.end }))
    }
  }
  const resolved = placed.sort((a, b) => +a.start - +b.start)

  const key = dateKey(dayStart)
  const out: Block[] = []
  let cursor = dayStart
  for (const b of resolved) {
    if (b.start > cursor) out.push(freeBlock(key, cursor, b.start))
    out.push(b)
    if (b.end > cursor) cursor = b.end
  }
  if (cursor < dayEnd) out.push(freeBlock(key, cursor, dayEnd))
  return out
}

function freeBlock(key: DateKey, start: Date, end: Date): Block {
  return { id: `${key}|free-${start.getHours()}${start.getMinutes()}`, kind: 'free', label: 'Free time', start, end, day: key, periods: 0, school: false }
}

export interface NowState {
  block: Block
  next: Block | null
  nextClass: Block | null
  remainingMin: number
  elapsedMin: number
  progress: number
  today: Block[]
  schoolDay: boolean
}

export function upcoming(data: ScheduleData, now: Date, days = 2): Block[] {
  const seen = new Set<string>()
  const out: Block[] = []
  for (let i = 0; i <= days; i++) {
    for (const b of timeline(data, addDays(now, i))) {
      if (seen.has(b.id) || b.end <= now) continue
      seen.add(b.id)
      out.push(b)
    }
  }
  return out.sort((a, b) => +a.start - +b.start)
}

export function getNow(data: ScheduleData, now: Date): NowState {
  const today = timeline(data, now)
  const block = today.find((b) => b.start <= now && now < b.end) ?? today[today.length - 1]
  const later = upcoming(data, now, 7).filter((b) => b.start >= block.end)
  const next = later.find((b) => b.kind !== 'free' && b.kind !== 'break') ?? null
  const nextClass = later.find((b) => b.kind === 'class') ?? null
  const total = diffMin(block.end, block.start)
  const elapsed = diffMin(now, block.start)
  return {
    block,
    next,
    nextClass,
    remainingMin: Math.max(0, diffMin(block.end, now)),
    elapsedMin: Math.max(0, elapsed),
    progress: total > 0 ? Math.min(1, Math.max(0, elapsed / total)) : 0,
    today,
    schoolDay: isSchoolDay(data, now),
  }
}

export function nextSchoolDay(data: Pick<AppData, 'school'>, from: Date): Date | null {
  for (let i = 1; i <= 14; i++) {
    const d = addDays(startOfDay(from), i)
    if (isSchoolDay(data, d)) return d
  }
  return null
}

export function classBlocks(data: ScheduleData, d: Date): Block[] {
  return schoolBlocks(data, d).filter((b) => b.kind === 'class')
}

export function academicSubjectsOn(data: ScheduleData, d: Date): string[] {
  const ids: string[] = []
  for (const b of classBlocks(data, d)) {
    const s = data.subjects.find((x) => x.id === b.subjectId)
    if (s && s.academic && !ids.includes(s.id)) ids.push(s.id)
  }
  return ids
}

export function lastClassEndBefore(data: ScheduleData, subjectId: string, before: Date): Date | null {
  for (let i = 0; i <= 14; i++) {
    const d = addDays(startOfDay(before), -i)
    const blocks = classBlocks(data, d).filter((b) => b.subjectId === subjectId && b.end <= before)
    if (blocks.length) return blocks[blocks.length - 1].end
  }
  return null
}

export function plannedSleepMin(data: ScheduleData, night: Date): number | null {
  const sleep = blocksForDay(data, night).find((b) => b.kind === 'sleep')
  return sleep ? diffMin(sleep.end, sleep.start) : null
}
