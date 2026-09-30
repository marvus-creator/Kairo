import type { AppData, Exam, PlanItem, StartIntent, Task } from '../domain/types'
import { dueTopics } from './srs'
import { intentFromCandidate, intentFromItem, planForBlock, currentItem, windowFor } from './plan'
import { isWeakSubject, prepStatus, rankCandidates, subjectById, taskDueAt, type Candidate } from './priority'
import {
  academicSubjectsOn,
  blocksForDay,
  classBlocks,
  getNow,
  isSchoolDay,
  isStudyBlock,
  nextSchoolDay,
  PERSONAL_STUDY_KINDS,
  plannedSleepMin,
  type Block,
  type NowState,
} from './schedule'
import { addDays, dateKey, daysBetween, diffMin, formatClock, formatDuration, parseKey, startOfDay, WEEKDAY_NAMES } from './time'

export type NowMode =
  | 'class'
  | 'devotion'
  | 'break'
  | 'lunch'
  | 'clubs'
  | 'study'
  | 'get-ready'
  | 'commute'
  | 'home'
  | 'wind-down'
  | 'sleep'
  | 'free'
  | 'rest'

export interface NowView {
  mode: NowMode
  eyebrow: string
  title: string
  subtitle: string
  headline: string
  state: NowState
  plan: PlanItem[] | null
  planFresh: boolean
  deferred: number
  current: PlanItem | null
  intent: StartIntent | null
  suggestion: StartIntent | null
  teacher?: string
}

const listJoin = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

export function subjectNamesOn(data: AppData, d: Date, short = true): string[] {
  return academicAndOther(data, d).map((id) => {
    const s = subjectById(data, id)
    return (short ? s?.short : s?.name) ?? id
  })
}

function academicAndOther(data: AppData, d: Date): string[] {
  const ids: string[] = []
  for (const b of classBlocks(data, d)) if (b.subjectId && !ids.includes(b.subjectId)) ids.push(b.subjectId)
  return ids
}

export function isOverloaded(data: AppData, now: Date) {
  return data.overloaded.includes(dateKey(now))
}

export function isDoneForDay(data: AppData, now: Date) {
  return data.doneForDay.includes(dateKey(now))
}

export function topSuggestion(data: AppData, now: Date): Candidate | null {
  const window = !isSchoolDay(data, now) ? 'weekend' : now.getHours() < 8 ? 'morning' : 'evening'
  const { candidates } = rankCandidates(data, { now, window, overloaded: isOverloaded(data, now), fmt: data.preferences.timeFormat })
  return candidates[0] ?? null
}

export function headlineFor(data: AppData, now: Date, state: NowState, planTop?: PlanItem | null): string {
  const fmt = data.preferences.timeFormat
  const b = state.block
  const wd = now.getDay()
  const tomorrowSchool = isSchoolDay(data, addDays(now, 1))
  const afterSchool = !state.schoolDay || now.getHours() >= 17
  if (b.kind === 'class') return `You’re in ${b.label}.`
  if (b.kind === 'office-hours') return planTop ? `Office Hours — Recommended: ${planTop.title}.` : 'Office Hours — your time to get ahead.'
  if (b.kind === 'sleep') return 'Rest now. Tomorrow is already planned.'
  if (state.schoolDay && wd === 5 && now.getHours() >= 15) return 'Week complete. Weekend review plan ready.'
  if (!state.schoolDay && tomorrowSchool && now.getHours() >= 16) {
    const next = nextSchoolDay(data, now)!
    return `Your week starts tomorrow. Prepare ${listJoin(subjectNamesOn(data, next).slice(0, 3))}.`
  }
  if (!state.schoolDay && !tomorrowSchool) return 'Weekend mode. Deep work early, then the day is yours.'
  if (!state.schoolDay) return 'No school today. Use the study blocks, keep the rest free.'
  if (afterSchool && tomorrowSchool) {
    const next = nextSchoolDay(data, now)!
    return `Tomorrow is ${WEEKDAY_NAMES[next.getDay()]}. You have ${listJoin(subjectNamesOn(data, next))}.`
  }
  if (b.kind === 'morning-study' || b.kind === 'get-ready' || b.kind === 'devotion') {
    return `Today is ${WEEKDAY_NAMES[wd]}: ${listJoin(subjectNamesOn(data, now))}.`
  }
  if (state.next) return `Next: ${state.next.label} at ${formatClock(state.next.start, fmt)}.`
  return 'Nothing scheduled. Your time.'
}

export function getNowView(data: AppData, now: Date): NowView {
  const state = getNow(data, now)
  const fmt = data.preferences.timeFormat
  const b = state.block
  const range = `${formatClock(b.start, fmt)} – ${formatClock(b.end, fmt)}`
  const nextTxt = state.next ? `${state.next.label} at ${formatClock(state.next.start, fmt)}` : null
  const done = isDoneForDay(data, now)
  const overloaded = isOverloaded(data, now)
  const base = { state, plan: null, planFresh: false, deferred: 0, current: null, intent: null, suggestion: null } as const
  const suggest = () => {
    const c = topSuggestion(data, now)
    return c ? intentFromCandidate(c) : null
  }

  if (isStudyBlock(b) && !(done && PERSONAL_STUDY_KINDS.includes(b.kind))) {
    const { items, fresh, deferred } = planForBlock(data, b, now, { overloaded })
    const cur = currentItem(items, now, data)
    const eyebrow =
      b.kind === 'my-study' ? 'Your plan' :
      b.kind === 'office-hours' ? 'Office Hours' :
      b.kind === 'self-study' ? 'Supervised self-study' :
      b.kind === 'morning-study' ? 'Morning recall' :
      b.kind === 'evening-study' ? 'Evening study' : `Weekend · ${b.label}`
    const top = items.find((i) => i.type !== 'break') ?? null
    const onBreak = cur?.type === 'break'
    const nextWork = onBreak ? items.find((i) => i.start >= cur!.end && i.type !== 'break') ?? null : null
    return {
      ...base,
      mode: 'study',
      eyebrow: overloaded ? `${eyebrow} · Essentials only` : eyebrow,
      title: cur ? cur.title : 'Block complete',
      subtitle: cur ? (onBreak ? `Then: ${nextWork?.title ?? 'wrap up'}` : cur.detail) : 'Everything planned for this block is done. Rest, or read ahead.',
      headline: headlineFor(data, now, state, top),
      plan: items,
      planFresh: fresh,
      deferred,
      current: cur,
      intent: cur && !onBreak ? intentFromItem(cur) : nextWork ? intentFromItem(nextWork) : null,
      suggestion: suggest(),
    }
  }

  const headline = headlineFor(data, now, state)
  const teacher = b.teacherId ? data.teachers.find((t) => t.id === b.teacherId)?.name : undefined
  switch (b.kind) {
    case 'class':
      return {
        ...base,
        mode: 'class',
        eyebrow: 'In class',
        title: b.label,
        subtitle: [teacher, range, b.periods > 1 ? `${b.periods} periods` : null].filter(Boolean).join(' · '),
        headline,
        teacher,
      }
    case 'devotion':
      return { ...base, mode: 'devotion', eyebrow: 'Devotion', title: 'Morning devotion', subtitle: nextTxt ? `Then ${nextTxt}` : range, headline }
    case 'break':
      return { ...base, mode: 'break', eyebrow: 'Short break', title: 'Recharge', subtitle: nextTxt ? `Stretch, drink water. Next: ${nextTxt}` : 'Stretch, drink water.', headline }
    case 'lunch': {
      const afternoon = classBlocks(data, now).filter((x) => x.start >= b.end).map((x) => subjectById(data, x.subjectId)?.short ?? x.label)
      return { ...base, mode: 'lunch', eyebrow: 'Lunch', title: 'Lunch break', subtitle: afternoon.length ? `Eat properly. This afternoon: ${listJoin([...new Set(afternoon)])}` : 'Eat properly.', headline }
    }
    case 'clubs':
      return { ...base, mode: 'clubs', eyebrow: 'Clubs', title: b.label, subtitle: [teacher, range].filter(Boolean).join(' · '), headline }
    case 'get-ready': {
      const subjects = subjectNamesOn(data, now)
      const arrival = data.school.arrival
      return {
        ...base,
        mode: 'get-ready',
        eyebrow: 'Get ready',
        title: 'Prepare for school',
        subtitle: `Arrive by ${formatClock(parseArrival(now, arrival), fmt)} for devotion. Pack for: ${subjects.join(', ')}`,
        headline,
      }
    }
    case 'commute':
    case 'home': {
      const evening = blocksForDay(data, now).find((x) => x.kind === 'evening-study')
      let first: string | null = null
      if (evening && evening.start > now) {
        const { items } = planForBlock(data, evening, now, { overloaded })
        first = items.find((i) => i.type !== 'break')?.title ?? null
      }
      return {
        ...base,
        mode: b.kind,
        eyebrow: b.kind === 'commute' ? 'Heading home' : 'Home',
        title: b.kind === 'commute' ? 'Travel & reset' : 'Eat, rest, reset',
        subtitle: evening && !done
          ? `Evening study at ${formatClock(evening.start, fmt)}${first ? ` · first: ${first}` : ''}`
          : done ? 'You’re done for today. Enjoy the evening.' : 'Free evening. Rest counts too.',
        headline,
        suggestion: done ? null : suggest(),
      }
    }
    case 'wind-down': {
      const sleep = plannedSleepMin(data, now)
      return {
        ...base,
        mode: 'wind-down',
        eyebrow: 'Wind down',
        title: 'Wrap up for today',
        subtitle: `Books away, screens down.${sleep ? ` Sleeping now gives you ${formatDuration(sleep)}.` : ''}`,
        headline,
      }
    }
    case 'my-activity':
      return {
        ...base,
        mode: 'free',
        eyebrow: 'Your plan',
        title: b.label,
        subtitle: nextTxt ? `${range} · Next: ${nextTxt}` : range,
        headline,
      }
    case 'sleep': {
      return {
        ...base,
        mode: 'sleep',
        eyebrow: 'Sleep',
        title: 'Time to sleep',
        subtitle: `Wake at ${formatClock(b.end, fmt)}. Nothing on your list is worth more than sleep right now.`,
        headline,
      }
    }
    default: {
      if (done && isStudyBlock(b)) {
        return { ...base, mode: 'rest', eyebrow: 'Done for today', title: 'Rest — you’ve earned it', subtitle: 'Your plan picks up again tomorrow.', headline }
      }
      return {
        ...base,
        mode: 'free',
        eyebrow: 'Free time',
        title: 'Your time',
        subtitle: nextTxt ? `Next: ${nextTxt}` : 'Nothing scheduled.',
        headline,
        suggestion: done ? null : suggest(),
      }
    }
  }
}

function parseArrival(now: Date, hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  const d = startOfDay(now)
  d.setHours(h, m)
  return d
}

export interface PrepEntry {
  subjectId: string
  status: 'done' | 'todo' | 'warn'
  note: string
  intent: StartIntent
}

export interface TomorrowBriefing {
  date: Date
  label: string
  classes: Block[]
  prep: PrepEntry[]
  tasksDue: Task[]
  exams: Exam[]
  intent: StartIntent | null
  allPrepped: boolean
}

export function tomorrowBriefing(data: AppData, now: Date): TomorrowBriefing | null {
  const target = nextSchoolDay(data, now)
  if (!target) return null
  const key = dateKey(target)
  const today = dateKey(now)
  const gap = daysBetween(today, key)
  const fmt = data.preferences.timeFormat
  const classes = classBlocks(data, target)
  const prep: PrepEntry[] = academicSubjectsOn(data, target).map((subjectId) => {
    const s = subjectById(data, subjectId)!
    const { prepped } = prepStatus(data, subjectId, target, now)
    const exam = data.exams.find((e) => e.subjectId === subjectId && daysBetween(today, e.date) >= 0 && daysBetween(today, e.date) <= 3)
    const weak = isWeakSubject(data, subjectId)
    const dueReviews = dueTopics(data.topics.filter((t) => t.subjectId === subjectId), today).length
    const first = classes.find((c) => c.subjectId === subjectId)!
    const periods = classes.filter((c) => c.subjectId === subjectId).reduce((n, c) => n + c.periods, 0)
    const status: PrepEntry['status'] = prepped ? 'done' : exam || weak || dueReviews ? 'warn' : 'todo'
    const note = prepped
      ? 'Prepared'
      : exam
        ? `${exam.kind} in ${daysBetween(today, exam.date)} day${daysBetween(today, exam.date) === 1 ? '' : 's'}`
        : weak
          ? 'Weak subject — give it real time'
          : dueReviews
            ? `${dueReviews} review${dueReviews > 1 ? 's' : ''} due`
            : `${formatClock(first.start, fmt)} · ${periods} period${periods > 1 ? 's' : ''}`
    return {
      subjectId,
      status,
      note,
      intent: {
        title: `Prepare ${s.short}`,
        subjectId,
        type: 'prep',
        minutes: periods >= 3 ? 40 : periods === 2 ? 35 : 25,
      },
    }
  })
  const order = { warn: 0, todo: 1, done: 2 }
  const next = [...prep].sort((a, b) => order[a.status] - order[b.status]).find((p) => p.status !== 'done')
  const tasksDue = data.tasks.filter((t) => t.status !== 'done' && t.due && (t.due === key || (gap > 1 && t.due > today && t.due <= key)))
  const exams = data.exams.filter((e) => e.date === key)
  return {
    date: target,
    label: gap === 1 ? 'Tomorrow' : WEEKDAY_NAMES[target.getDay()],
    classes,
    prep,
    tasksDue,
    exams,
    intent: next?.intent ?? null,
    allPrepped: prep.every((p) => p.status === 'done'),
  }
}

export interface DailyBriefing {
  classes: number
  subjects: string[]
  tasksDue: Task[]
  studyBlocks: number
  studyMin: number
  officeHours: boolean
  reviewsDue: number
  examsToday: Exam[]
  mainPriority: Candidate | null
  overdue: number
}

export function dailyBriefing(data: AppData, now: Date): DailyBriefing {
  const today = dateKey(now)
  const blocks = blocksForDay(data, now)
  const study = blocks.filter((b) => PERSONAL_STUDY_KINDS.includes(b.kind))
  const classes = classBlocks(data, now)
  const { candidates } = rankCandidates(data, { now, window: 'any', overloaded: isOverloaded(data, now), fmt: data.preferences.timeFormat })
  return {
    classes: classes.length,
    subjects: subjectNamesOn(data, now),
    tasksDue: data.tasks.filter((t) => t.status !== 'done' && t.due === today),
    studyBlocks: study.length,
    studyMin: study.reduce((n, b) => n + diffMin(b.end, b.start), 0),
    officeHours: blocks.some((b) => b.kind === 'office-hours'),
    reviewsDue: dueTopics(data.topics, today).length,
    examsToday: data.exams.filter((e) => e.date === today),
    mainPriority: candidates.find((c) => c.kind !== 'project') ?? null,
    overdue: data.tasks.filter((t) => t.status !== 'done' && taskDueAt(t) !== null && taskDueAt(t)! < now).length,
  }
}

export interface WeekendDay {
  date: Date
  blocks: { block: Block; items: PlanItem[] }[]
}

export function weekendPlan(data: AppData, now: Date): WeekendDay[] {
  const out: WeekendDay[] = []
  for (let i = 0; i <= 7 && out.length < 2; i++) {
    const d = addDays(startOfDay(now), i)
    if (isSchoolDay(data, d)) {
      if (out.length) break
      continue
    }
    const blocks = blocksForDay(data, d).filter((b) => b.kind === 'weekend-study' || (b.kind === 'evening-study' && d.getDay() === 0))
    const planned = blocks
      .filter((b) => b.end > now)
      .map((block) => {
        const at = block.start > now ? block.start : now
        return { block, items: planForBlock(data, block, at).items }
      })
    out.push({ date: d, blocks: planned })
  }
  return out
}

export interface SleepInfo {
  plannedMin: number
  targetMin: number
  deficitMin: number
  bedtime: Date
  wake: Date
}

export function sleepTonight(data: AppData, now: Date): SleepInfo | null {
  const base = now.getHours() < 12 ? addDays(now, -1) : now
  const sleep = blocksForDay(data, base).find((b) => b.kind === 'sleep')
  if (!sleep) return null
  const planned = diffMin(sleep.end, sleep.start)
  return { plannedMin: planned, targetMin: data.preferences.sleepTargetMin, deficitMin: data.preferences.sleepTargetMin - planned, bedtime: sleep.start, wake: sleep.end }
}

export function schoolNightSleepMin(data: AppData): number | null {
  const probe = parseKey('2026-01-05')
  for (let i = 0; i < 7; i++) {
    const d = addDays(probe, i)
    if (isSchoolDay(data, addDays(d, 1))) {
      const m = plannedSleepMin(data, d)
      if (m !== null) return m
    }
  }
  return null
}

export { windowFor }
