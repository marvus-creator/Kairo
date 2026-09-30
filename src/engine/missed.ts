import type { AppData, MissedResolution, PlanItem, Task } from '../domain/types'
import { planForBlock } from './plan'
import { blocksForDay, isSchoolDay, nextSchoolDay, PERSONAL_STUDY_KINDS, type Block } from './schedule'
import { addDays, dateKey, DAY, startOfDay } from './time'

export interface MissedInfo {
  block: Block
  items: PlanItem[]
}

export const MAX_OPEN_CATCHUPS = 4
export const CATCHUP_TTL_DAYS = 10

export function studiedDuring(data: AppData, block: Block): number {
  let min = 0
  for (const s of data.sessions) {
    if (s.status !== 'completed') continue
    if (s.startedAt < +block.end && s.endedAt > +block.start) min += s.focusMin
  }
  if (data.timer && data.timer.startedAt < +block.end && data.timer.startedAt >= +block.start - 30 * 60_000) min += 15
  return min
}

export function findMissed(data: AppData, now: Date): MissedInfo | null {
  const found: Block[] = []
  for (const offset of [0, -1]) {
    const d = addDays(startOfDay(now), offset)
    for (const b of blocksForDay(data, d)) {
      if (!PERSONAL_STUDY_KINDS.includes(b.kind)) continue
      if (b.end > now || +b.end < +now - 1.5 * DAY) continue
      if (+b.start < data.profile.createdAt) continue
      if (data.doneForDay.includes(b.day) || data.missed[b.id]) continue
      if (studiedDuring(data, b) >= 15) continue
      found.push(b)
    }
  }
  if (!found.length) return null
  const block = found.sort((a, b) => +b.end - +a.end)[0]
  const items = (data.plans[block.id] ?? planForBlock(data, block, block.start).items).filter((i) => i.type !== 'break' && !i.key.endsWith('#recall') && !i.key.endsWith('#open'))
  return { block, items }
}

export function catchUpDue(data: AppData, action: MissedResolution, now: Date): string {
  if (action === 'office') return dateKey(nextSchoolDay(data, now) ?? addDays(now, 1))
  if (action === 'weekend') {
    for (let i = 1; i <= 7; i++) {
      const d = addDays(startOfDay(now), i)
      if (d.getDay() === 0 || (d.getDay() === 6 && !isSchoolDay(data, d))) return dateKey(d.getDay() === 6 ? addDays(d, 1) : d)
    }
  }
  return dateKey(addDays(now, 2))
}

export function buildCatchUps(data: AppData, info: MissedInfo, action: MissedResolution, now: Date, makeId: () => string): Task[] {
  if (action === 'skipped') return []
  const slot = action === 'office' ? 'office' : action === 'weekend' ? 'weekend' : 'any'
  const due = catchUpDue(data, action, now)
  return info.items
    .filter((i) => !i.taskId && !i.examId)
    .slice(0, 2)
    .map((i) => ({
      id: makeId(),
      kind: 'catch-up' as const,
      title: `Catch up: ${i.title.replace(/^Catch up: /, '')}`,
      subjectId: i.subjectId,
      topicName: i.topicName,
      due,
      priority: 'medium' as const,
      estMin: Math.min(40, Math.max(15, Math.round((i.end - i.start) / 60_000))),
      spentMin: 0,
      status: 'todo' as const,
      notes: `From the ${info.block.label.toLowerCase()} on ${info.block.day}`,
      slot,
      createdAt: +now,
    }))
}

export function trimCatchUps(tasks: Task[], now: Date): { tasks: Task[]; dropped: number } {
  const ttl = +now - CATCHUP_TTL_DAYS * DAY
  let kept = tasks.filter((t) => !(t.kind === 'catch-up' && t.status !== 'done' && t.createdAt < ttl))
  let dropped = tasks.length - kept.length
  const open = kept.filter((t) => t.kind === 'catch-up' && t.status !== 'done').sort((a, b) => a.createdAt - b.createdAt)
  if (open.length > MAX_OPEN_CATCHUPS) {
    const drop = new Set(open.slice(0, open.length - MAX_OPEN_CATCHUPS).map((t) => t.id))
    kept = kept.filter((t) => !drop.has(t.id))
    dropped += drop.size
  }
  return { tasks: kept, dropped }
}
