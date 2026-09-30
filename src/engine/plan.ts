import type { AppData, PlanItem, SessionType, StartIntent } from '../domain/types'
import { methodFor } from './modes'
import { rankCandidates, type Candidate, type StudyWindow } from './priority'
import { isSchoolDay, type Block, type BlockKind } from './schedule'
import { MINUTE } from './time'

export function windowFor(kind: BlockKind): StudyWindow {
  switch (kind) {
    case 'morning-study':
      return 'morning'
    case 'evening-study':
      return 'evening'
    case 'weekend-study':
      return 'weekend'
    case 'office-hours':
      return 'office'
    case 'self-study':
      return 'self-study'
    default:
      return 'any'
  }
}

const floor5 = (n: number) => Math.floor(n / 5) * 5

export function packPlan(cands: Candidate[], blockId: string, start: number, end: number, window: StudyWindow): PlanItem[] {
  const total = floor5((end - start) / MINUTE)
  const reserve = window === 'evening' && total >= 70 ? 10 : 0
  const items: PlanItem[] = []
  const usedSubjects = new Set<string>()
  const usedIds = new Set<string>()
  let cursor = start
  let sinceBreak = 0

  for (const c of cands) {
    if (usedIds.has(c.id)) continue
    const isWork = c.kind === 'task' || c.kind === 'exam' || c.kind === 'project'
    if (!isWork && c.subjectId && usedSubjects.has(c.subjectId)) continue
    let remaining = floor5((end - cursor) / MINUTE) - reserve
    if (remaining < 10) break
    const needsBreak = items.length > 0 && sinceBreak + Math.min(c.minutes, remaining) > 60 && remaining - 5 >= 15
    if (needsBreak) remaining -= 5
    const dur = floor5(Math.min(c.minutes, remaining))
    if (dur < 10 || (dur < 15 && c.minutes >= 15)) continue
    if (needsBreak) {
      items.push({ key: `${blockId}#break-${items.length}`, title: 'Break', detail: 'Stand up, water, no phone', reason: '', type: 'break', start: cursor, end: cursor + 5 * MINUTE })
      cursor += 5 * MINUTE
      sinceBreak = 0
    }
    items.push({
      key: `${blockId}#${c.id}`,
      title: c.title,
      detail: c.detail,
      reason: c.reason,
      type: c.type,
      start: cursor,
      end: cursor + dur * MINUTE,
      subjectId: c.subjectId,
      topicId: c.topicId,
      topicName: c.topicName,
      taskId: c.taskId,
      examId: c.examId,
      projectId: c.projectId,
    })
    cursor += dur * MINUTE
    sinceBreak += dur
    usedIds.add(c.id)
    if (!isWork && c.subjectId) usedSubjects.add(c.subjectId)
  }

  if (reserve && items.length) {
    items.push({
      key: `${blockId}#recall`,
      title: 'Recall & self-test',
      detail: 'Close your notes. Write down what you learned tonight, then check',
      reason: 'Retrieval locks in what you studied',
      type: 'recall',
      start: cursor,
      end: cursor + reserve * MINUTE,
    })
  }

  if (!items.length) {
    items.push({
      key: `${blockId}#open`,
      title: 'Open study',
      detail: 'Nothing urgent. Read ahead in any subject, or rest',
      reason: 'You are on top of things',
      type: 'review',
      start,
      end,
    })
  }
  return items
}

export interface BlockPlan {
  items: PlanItem[]
  fresh: boolean
  deferred: number
}

export function windowForBlock(data: AppData, block: Block): StudyWindow {
  if (block.kind !== 'my-study') return windowFor(block.kind)
  if (!isSchoolDay(data, block.start)) return 'weekend'
  const h = block.start.getHours()
  return h < 8 ? 'morning' : h < 17 ? 'office' : 'evening'
}

export function myBlockItem(data: AppData, block: Block): PlanItem | null {
  const m = block.mine
  if (!m || m.kind !== 'study' || (!m.subjectId && !m.taskId)) return null
  const task = m.taskId ? data.tasks.find((t) => t.id === m.taskId) : undefined
  const subjectId = m.subjectId ?? task?.subjectId
  const subject = data.subjects.find((s) => s.id === subjectId)
  const type: SessionType = m.type ?? (task ? (task.kind === 'assignment' ? 'assignment' : task.kind === 'project' ? 'project' : 'practice') : 'review')
  return {
    key: `${block.id}#mine`,
    title: m.title || task?.title || `Study ${subject?.short ?? ''}`.trim(),
    detail: [m.topicName, methodFor(subject?.category, type)].filter(Boolean).join(' · '),
    reason: 'You planned this',
    type,
    start: +block.start,
    end: +block.end,
    subjectId,
    topicName: m.topicName ?? task?.topicName,
    taskId: m.taskId,
    projectId: task?.projectId,
  }
}

export function planForBlock(data: AppData, block: Block, now: Date, opts: { overloaded?: boolean; force?: boolean } = {}): BlockPlan {
  const mine = myBlockItem(data, block)
  if (mine) return { items: [mine], fresh: false, deferred: 0 }
  const snap = data.plans[block.id]
  if (snap && !opts.force) return { items: snap, fresh: false, deferred: 0 }
  const window = windowForBlock(data, block)
  const inProgress = now > block.start && now < block.end
  const start = inProgress ? Math.ceil(+now / (5 * MINUTE)) * 5 * MINUTE : +block.start
  const rankAt = inProgress ? now : block.start
  const { candidates, deferred } = rankCandidates(data, { now: rankAt, window, overloaded: opts.overloaded, fmt: data.preferences.timeFormat })
  return { items: packPlan(candidates, block.id, start, +block.end, window), fresh: true, deferred }
}

export function itemDone(data: Pick<AppData, 'sessions'>, item: PlanItem): boolean {
  return data.sessions.some((s) => s.status === 'completed' && s.planKey === item.key)
}

export function intentFromItem(item: PlanItem): StartIntent {
  return {
    title: item.title,
    subjectId: item.subjectId,
    topicId: item.topicId,
    topicName: item.topicName,
    taskId: item.taskId,
    examId: item.examId,
    projectId: item.projectId,
    type: item.type === 'break' ? 'review' : item.type,
    minutes: Math.max(5, Math.round((item.end - item.start) / MINUTE)),
    method: item.detail,
    planKey: item.key,
  }
}

export function intentFromCandidate(c: Candidate): StartIntent {
  return {
    title: c.title,
    subjectId: c.subjectId,
    topicId: c.topicId,
    topicName: c.topicName,
    taskId: c.taskId,
    examId: c.examId,
    projectId: c.projectId,
    type: c.type,
    minutes: c.minutes,
    method: c.detail,
  }
}

export function currentItem(items: PlanItem[], now: Date, data: Pick<AppData, 'sessions'>): PlanItem | null {
  const t = +now
  const inSlot = items.find((i) => i.start <= t && t < i.end)
  if (inSlot && inSlot.type !== 'break' && !itemDone(data, inSlot)) return inSlot
  const pending = items.filter((i) => i.type !== 'break' && !itemDone(data, i))
  if (inSlot?.type === 'break') return inSlot
  return pending.find((i) => i.end > t) ?? pending[0] ?? null
}
