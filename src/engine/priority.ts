import type { AppData, Exam, ID, SessionType, Subject, Task } from '../domain/types'
import { methodFor, SESSION_TYPE_LABEL } from './modes'
import { academicSubjectsOn, classBlocks, isSchoolDay, lastClassEndBefore, nextSchoolDay } from './schedule'
import { dueTopics, isWeakTopic, overdueDays } from './srs'
import { addDays, atHHMM, dateKey, daysBetween, DAY, diffMin, formatClock, HOUR, parseKey, relativeDay, startOfDay, WEEKDAY_NAMES } from './time'

export type StudyWindow = 'morning' | 'evening' | 'office' | 'self-study' | 'weekend' | 'any'

export interface Candidate {
  id: string
  kind: 'task' | 'exam' | 'prep' | 'review' | 'srs' | 'weak' | 'balance' | 'deep' | 'project'
  title: string
  detail: string
  reason: string
  score: number
  minutes: number
  type: SessionType
  subjectId?: ID
  topicId?: ID
  topicName?: string
  taskId?: ID
  examId?: ID
  projectId?: ID
  essential: boolean
}

export interface RankContext {
  now: Date
  window: StudyWindow
  overloaded?: boolean
  fmt?: '12h' | '24h'
}

export interface Ranking {
  candidates: Candidate[]
  deferred: number
}

export const subjectById = (data: Pick<AppData, 'subjects'>, id?: ID): Subject | undefined =>
  id ? data.subjects.find((s) => s.id === id) : undefined

export function completed(data: Pick<AppData, 'sessions'>) {
  return data.sessions.filter((s) => s.status === 'completed')
}

export function studiedMinSince(data: Pick<AppData, 'sessions'>, subjectId: ID, since: Date | number): number {
  const t = +since
  return completed(data)
    .filter((s) => s.subjectId === subjectId && s.endedAt > t)
    .reduce((sum, s) => sum + s.focusMin, 0)
}

export function lastStudiedAt(data: Pick<AppData, 'sessions' | 'topics'>, subjectId: ID): number | null {
  let last: number | null = null
  for (const s of completed(data)) if (s.subjectId === subjectId && (last === null || s.endedAt > last)) last = s.endedAt
  return last
}

export function daysSinceStudied(data: AppData, subjectId: ID, now: Date): number | null {
  const last = lastStudiedAt(data, subjectId)
  if (last === null) return null
  return Math.floor((+startOfDay(now) - +startOfDay(new Date(last))) / DAY)
}

export function isWeakSubject(data: AppData, subjectId: ID): boolean {
  const s = subjectById(data, subjectId)
  if (!s) return false
  if (s.weak) return true
  if (data.topics.some((t) => t.subjectId === subjectId && isWeakTopic(t))) return true
  const recent = completed(data)
    .filter((x) => x.subjectId === subjectId && x.feeling)
    .sort((a, b) => b.endedAt - a.endedAt)
    .slice(0, 3)
  return recent.length >= 2 && recent.filter((x) => x.feeling === 'difficult').length >= 2
}

export function taskDueAt(task: Task): Date | null {
  if (!task.due) return null
  return atHHMM(parseKey(task.due), task.dueTime ?? '08:00')
}

export function prepTargetFor(data: AppData, now: Date, window: StudyWindow): { day: Date; weight: number } | null {
  if (window === 'morning') {
    return isSchoolDay(data, now) ? { day: startOfDay(now), weight: 1 } : null
  }
  const next = nextSchoolDay(data, now)
  if (!next) return null
  const gap = Math.round((+next - +startOfDay(now)) / DAY)
  if (window === 'weekend') {
    if (gap === 1) return { day: next, weight: 1 }
    if (gap === 2) return { day: next, weight: 0.45 }
    return null
  }
  if (gap === 1) return { day: next, weight: window === 'office' ? 0.85 : window === 'self-study' ? 0.8 : 1 }
  return { day: next, weight: gap === 2 ? 0.7 : 0.5 }
}

export function prepStatus(data: AppData, subjectId: ID, target: Date, now: Date): { prepped: boolean; since: Date } {
  const floor = new Date(+startOfDay(target) - 36 * HOUR)
  const lastClass = lastClassEndBefore(data, subjectId, startOfDay(target))
  const since = lastClass && lastClass > floor ? lastClass : floor
  const mins = studiedMinSince(data, subjectId, since < now ? since : now)
  const running = data.timer && data.timer.intent.subjectId === subjectId && data.timer.startedAt >= +since
  return { prepped: mins >= 15 || !!running, since }
}

const PRIO: Record<Task['priority'], number> = { low: 0.8, medium: 1, high: 1.2 }

function taskCandidate(data: AppData, task: Task, ctx: RankContext): Candidate | null {
  const today = dateKey(ctx.now)
  const due = taskDueAt(task)
  const hrs = due ? diffMin(due, ctx.now) / 60 : null
  let urgency = 0.25
  let reason = 'No deadline'
  if (hrs !== null && task.due) {
    if (hrs < 0) {
      urgency = 1
      reason = 'Overdue'
    } else {
      urgency = hrs <= 24 ? 0.95 : hrs <= 48 ? 0.62 : hrs <= 72 ? 0.5 : hrs <= 168 ? 0.36 : 0.22
      reason = `Due ${relativeDay(task.due, today).toLowerCase()}${task.dueTime ? ` ${task.dueTime}` : ''}`
    }
  }
  let score = urgency * 100 * PRIO[task.priority]
  if (task.status === 'doing') score += 5
  const remaining = Math.max(15, task.estMin - task.spentMin)
  let type: SessionType = task.kind === 'assignment' ? 'assignment' : task.kind === 'project' ? 'project' : task.kind === 'catch-up' ? 'catch-up' : 'practice'

  if (task.kind === 'project') {
    if (ctx.window === 'morning') return null
    const w = ctx.window === 'weekend' ? 0.75 : ctx.window === 'office' ? 0.6 : ctx.window === 'any' ? 0.5 : 0.3
    score = urgency * 70 * PRIO[task.priority] * w + 10
    type = 'project'
  }
  if (task.kind === 'catch-up') {
    if (task.slot === 'office') score *= ctx.window === 'office' ? 1.3 : 0.6
    if (task.slot === 'weekend') score *= ctx.window === 'weekend' ? 1.35 : 0.45
  }
  if (task.difficulty === 'hard' && ctx.window === 'weekend') score *= 1.1
  if (ctx.window === 'morning' && task.kind !== 'catch-up' && (hrs === null || hrs > 12)) score *= 0.5

  const urgent = hrs !== null && hrs <= 24
  const cap = ctx.window === 'weekend' ? 75 : ctx.window === 'morning' ? 30 : urgent || ctx.window === 'office' ? 50 : 30
  const subject = subjectById(data, task.subjectId)
  const project = data.projects.find((p) => p.id === task.projectId)
  return {
    id: `task:${task.id}`,
    kind: task.kind === 'project' ? 'project' : 'task',
    title: task.title,
    detail: [subject?.short ?? project?.name, task.estMin - task.spentMin > cap ? 'part of a longer task' : null].filter(Boolean).join(' · ') || SESSION_TYPE_LABEL[type],
    reason,
    score,
    minutes: Math.min(remaining, cap),
    type,
    subjectId: task.subjectId,
    topicName: task.topicName,
    taskId: task.id,
    projectId: task.projectId,
    essential: task.kind !== 'project' && hrs !== null && hrs <= 36,
  }
}

const IMPORTANCE = { 1: 0.85, 2: 1, 3: 1.15 } as const

export function examPhase(days: number): { label: string; score: number; minutes: number; type: SessionType } | null {
  if (days < 0 || days > 14) return null
  if (days === 0) return { label: 'Final recall', score: 92, minutes: 15, type: 'recall' }
  if (days === 1) return { label: 'Light final review', score: 86, minutes: 30, type: 'recall' }
  if (days <= 3) return { label: 'High-priority revision', score: 80, minutes: 45, type: 'exam-prep' }
  if (days <= 7) return { label: 'Focused practice', score: 60, minutes: 40, type: 'exam-prep' }
  return { label: 'Light review', score: 36, minutes: 25, type: 'exam-prep' }
}

function examCandidate(data: AppData, exam: Exam, ctx: RankContext): Candidate | null {
  const today = dateKey(ctx.now)
  const days = daysBetween(today, exam.date)
  const phase = examPhase(days)
  if (!phase) return null
  if (days === 0) {
    const examAt = exam.time ? atHHMM(parseKey(exam.date), exam.time) : atHHMM(parseKey(exam.date), '08:00')
    if (examAt <= ctx.now) return null
  }
  let score = phase.score * IMPORTANCE[exam.importance]
  let minutes = phase.minutes
  const doneToday = completed(data).some((s) => s.examId === exam.id && dateKey(new Date(s.startedAt)) === today)
  if (doneToday) score *= 0.4
  if (ctx.window === 'morning') {
    if (days >= 2) score *= 0.5
    minutes = Math.min(minutes, 20)
  }
  const subject = subjectById(data, exam.subjectId)
  const kindLabel = exam.kind[0].toUpperCase() + exam.kind.slice(1)
  return {
    id: `exam:${exam.id}`,
    kind: 'exam',
    title: `${phase.label}: ${subject?.short ?? 'Exam'}`,
    detail: days <= 1 ? `${exam.title} — short and calm, then sleep well` : `${exam.title} · ${methodFor(subject?.category, phase.type)}`,
    reason: days === 0 ? `${kindLabel} today` : days === 1 ? `${kindLabel} tomorrow` : `${kindLabel} in ${days} days`,
    score,
    minutes,
    type: phase.type,
    subjectId: exam.subjectId,
    topicName: exam.title,
    examId: exam.id,
    essential: days <= 2,
  }
}

export function rankCandidates(data: AppData, ctx: RankContext): Ranking {
  const { now, window } = ctx
  const today = dateKey(now)
  const out: Candidate[] = []

  for (const t of data.tasks) {
    if (t.status === 'done') continue
    const c = taskCandidate(data, t, ctx)
    if (c) out.push(c)
  }
  for (const e of data.exams) {
    const c = examCandidate(data, e, ctx)
    if (c) out.push(c)
  }

  const prepSubjects = new Set<ID>()
  const target = prepTargetFor(data, now, window)
  if (target) {
    const blocks = classBlocks(data, target.day)
    const dayName = WEEKDAY_NAMES[target.day.getDay()]
    const isTomorrow = daysBetween(today, dateKey(target.day)) === 1
    for (const subjectId of academicSubjectsOn(data, target.day)) {
      const subject = subjectById(data, subjectId)!
      const own = blocks.filter((b) => b.subjectId === subjectId)
      const periods = own.reduce((n, b) => n + b.periods, 0)
      const first = own[0]
      if (window === 'morning') {
        if (first && first.end <= now) continue
        const hasDue = data.topics.some((t) => t.subjectId === subjectId && t.srs && daysBetween(t.srs.due, today) >= 0)
        out.push({
          id: `prep:${subjectId}:${dateKey(target.day)}`,
          kind: 'prep',
          title: `Quick recall: ${subject.short}`,
          detail: methodFor(subject.category, 'recall'),
          reason: `In class today at ${first ? formatClock(first.start, ctx.fmt ?? '12h') : ''}`,
          score: 52 + (isWeakSubject(data, subjectId) ? 8 : 0) + (hasDue ? 4 : 0),
          minutes: 15,
          type: 'recall',
          subjectId,
          essential: false,
        })
        prepSubjects.add(subjectId)
        continue
      }
      const { prepped } = prepStatus(data, subjectId, target.day, now)
      if (prepped) {
        prepSubjects.add(subjectId)
        continue
      }
      const weak = isWeakSubject(data, subjectId)
      const examSoon = data.exams.some((e) => e.subjectId === subjectId && daysBetween(today, e.date) >= 0 && daysBetween(today, e.date) <= 7)
      const srsDue = data.topics.some((t) => t.subjectId === subjectId && t.srs && daysBetween(t.srs.due, today) >= 0)
      const score = (60 + (weak ? 10 : 0) + Math.min(periods, 3) * 2 + (examSoon ? 5 : 0) + (srsDue ? 3 : 0)) * target.weight
      out.push({
        id: `prep:${subjectId}:${dateKey(target.day)}`,
        kind: 'prep',
        title: `Prepare ${subject.short}`,
        detail: methodFor(subject.category, 'prep'),
        reason: `${isTomorrow ? 'Tomorrow' : dayName} at ${formatClock(first.start, ctx.fmt ?? '12h')} · ${periods} period${periods > 1 ? 's' : ''}`,
        score,
        minutes: periods >= 3 ? 40 : periods === 2 ? 35 : 25,
        type: 'prep',
        subjectId,
        essential: true,
      })
      prepSubjects.add(subjectId)
    }
  }

  if ((window === 'evening' || window === 'office' || window === 'self-study' || window === 'any') && isSchoolDay(data, now)) {
    for (const b of classBlocks(data, now)) {
      if (!b.subjectId || b.end > now || prepSubjects.has(b.subjectId)) continue
      const subject = subjectById(data, b.subjectId)
      if (!subject?.academic) continue
      if (studiedMinSince(data, b.subjectId, b.end) >= 10) continue
      if (out.some((c) => c.id === `review:${b.subjectId}`)) continue
      out.push({
        id: `review:${b.subjectId}`,
        kind: 'review',
        title: `Review today’s ${subject.short}`,
        detail: methodFor(subject.category, 'review'),
        reason: 'Taught today — review while it’s fresh',
        score: 38 + (isWeakSubject(data, b.subjectId) ? 8 : 0),
        minutes: 20,
        type: 'review',
        subjectId: b.subjectId,
        essential: false,
      })
    }
  }

  for (const topic of dueTopics(data.topics, today).slice(0, 6)) {
    const od = overdueDays(topic, today) ?? 0
    const subject = subjectById(data, topic.subjectId)
    let score = 42 + Math.min(od * 4, 20) + (topic.srs && topic.srs.lapses > 0 ? 6 : 0)
    if (window === 'morning') score *= 1.2
    out.push({
      id: `srs:${topic.id}`,
      kind: 'srs',
      title: `Review ${topic.name}`,
      detail: `${subject?.short ?? ''} · ${methodFor(subject?.category, 'recall')}`,
      reason: od > 0 ? `Review overdue by ${od} day${od > 1 ? 's' : ''}` : 'Spaced review due today',
      score,
      minutes: window === 'morning' ? 10 : 15,
      type: 'recall',
      subjectId: topic.subjectId,
      topicId: topic.id,
      topicName: topic.name,
      essential: false,
    })
  }

  if (window !== 'morning') {
    const weekly = new Set<ID>()
    for (let i = 0; i < 7; i++) for (const id of academicSubjectsOn(data, addDays(now, -i))) weekly.add(id)
    for (const subject of data.subjects) {
      if (!subject.academic || prepSubjects.has(subject.id)) continue
      const days = daysSinceStudied(data, subject.id, now)
      const sinceStart = Math.floor((+startOfDay(now) - +startOfDay(new Date(data.profile.createdAt))) / DAY)
      const effective = days ?? Math.min(7, Math.max(0, sinceStart))
      if (isWeakSubject(data, subject.id)) {
        const weakDays = days ?? 7
        if (weakDays < 3) continue
        out.push({
          id: `weak:${subject.id}`,
          kind: 'weak',
          title: `Strengthen ${subject.short}`,
          detail: methodFor(subject.category, window === 'weekend' ? 'deep' : 'practice'),
          reason: days === null ? 'Weak subject, not studied yet' : `Weak subject · last studied ${days} days ago`,
          score: 34 + Math.min(weakDays * 3, 24) + (window === 'weekend' ? 6 : 0),
          minutes: window === 'weekend' ? 50 : 30,
          type: window === 'weekend' ? 'deep' : 'practice',
          subjectId: subject.id,
          essential: false,
        })
      } else if (weekly.has(subject.id) && effective >= 7) {
        out.push({
          id: `balance:${subject.id}`,
          kind: 'balance',
          title: `Catch up on ${subject.short}`,
          detail: methodFor(subject.category, 'review'),
          reason: days === null ? 'Not studied yet this term' : `Not studied in ${days} days`,
          score: 22 + Math.min(effective, 14),
          minutes: 25,
          type: 'review',
          subjectId: subject.id,
          essential: false,
        })
      }
    }
  }

  if (window === 'weekend') {
    const pickOldest = (cats: string[]) =>
      data.subjects
        .filter((s) => s.academic && cats.includes(s.category))
        .map((s) => ({ s, last: lastStudiedAt(data, s.id) ?? 0 }))
        .sort((a, b) => a.last - b.last)[0]?.s
    const addDeep = (s: Subject | undefined, title: string, reason: string, score: number) => {
      if (!s || out.some((c) => c.subjectId === s.id && (c.kind === 'weak' || c.kind === 'prep'))) return
      for (let i = out.length - 1; i >= 0; i--) if (out[i].subjectId === s.id && out[i].kind === 'balance') out.splice(i, 1)
      out.push({ id: `deep:${s.id}`, kind: 'deep', title, detail: methodFor(s.category, 'deep'), reason, score, minutes: 50, type: 'deep', subjectId: s.id, essential: false })
    }
    const code = pickOldest(['programming'])
    const numeric = pickOldest(['math', 'science'])
    addDeep(code, `${code?.short} problem practice`, 'Weekend deep work · programming', 46)
    addDeep(numeric, `${numeric?.short} problem solving`, 'Weekend deep work · problem solving', 44)
  }

  const topAcademic = Math.max(0, ...out.filter((c) => c.kind !== 'project').map((c) => c.score))
  for (const c of out) if (c.kind === 'project' && topAcademic > 70 && window !== 'weekend') c.score *= 0.5

  out.sort((a, b) => b.score - a.score)

  if (!ctx.overloaded) return { candidates: out, deferred: 0 }
  const essential: Candidate[] = []
  let prepTaken = false
  let recallTaken = false
  for (const c of out) {
    if (c.kind === 'task' && c.essential) essential.push(c)
    else if (c.kind === 'exam' && c.essential) essential.push({ ...c, minutes: Math.min(c.minutes, 30) })
    else if (c.kind === 'prep' && !prepTaken) {
      prepTaken = true
      essential.push({ ...c, minutes: Math.min(c.minutes, 25) })
    } else if ((c.kind === 'srs' || c.kind === 'review') && !recallTaken) {
      recallTaken = true
      essential.push({ ...c, title: `20-minute recall: ${subjectById(data, c.subjectId)?.short ?? c.title}`, minutes: 20, type: 'recall' })
    }
  }
  return { candidates: essential, deferred: out.length - essential.length }
}
