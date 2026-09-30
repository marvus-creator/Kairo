import { describe, expect, it } from 'vitest'
import { defaultData } from '../data/seed'
import type { AppData, StudySession, Task } from '../domain/types'
import { buildCatchUps, findMissed, trimCatchUps, MAX_OPEN_CATCHUPS } from './missed'
import { eventsBetween, inQuietHours, isAllowed } from './notifications'
import { planForBlock } from './plan'
import { examPhase, rankCandidates } from './priority'
import { dailyBriefing, getNowView, sleepTonight, tomorrowBriefing, weekendPlan } from './recommend'
import { getNow, isSchoolDay, timeline } from './schedule'
import { review } from './srs'
import { streaks, weekOverview } from './stats'
import { advancePomodoro, elapsedMs, pauseTimer, resumeTimer, startTimer, timerView } from './timer'
import { MINUTE } from './time'

const MON = (h: number, m = 0) => new Date(2026, 9, 5, h, m)
const TUE = (h: number, m = 0) => new Date(2026, 9, 6, h, m)
const WED = (h: number, m = 0) => new Date(2026, 9, 7, h, m)
const THU = (h: number, m = 0) => new Date(2026, 9, 8, h, m)
const FRI = (h: number, m = 0) => new Date(2026, 9, 9, h, m)
const SAT = (h: number, m = 0) => new Date(2026, 9, 10, h, m)
const SUN = (h: number, m = 0) => new Date(2026, 9, 11, h, m)

function fresh(): AppData {
  const d = defaultData(new Date(2026, 8, 1))
  d.profile.onboarded = true
  return d
}

function task(over: Partial<Task>): Task {
  return {
    id: over.id ?? 'task-' + Math.random().toString(36).slice(2, 8),
    kind: 'assignment',
    title: 'Task',
    priority: 'medium',
    estMin: 45,
    spentMin: 0,
    status: 'todo',
    notes: '',
    slot: 'any',
    createdAt: +new Date(2026, 9, 1),
    ...over,
  }
}

function session(over: Partial<StudySession>): StudySession {
  return {
    id: 's-' + Math.random().toString(36).slice(2, 8),
    title: 'Session',
    type: 'review',
    mode: 'countdown',
    startedAt: 0,
    endedAt: 0,
    focusMin: 30,
    plannedMin: 30,
    status: 'completed',
    ...over,
  }
}

describe('timetable data', () => {
  it('has five school days with twelve slots each', () => {
    const d = fresh()
    for (const wd of [1, 2, 3, 4, 5]) expect(d.school.periods.filter((p) => p.weekday === wd)).toHaveLength(12)
    expect(isSchoolDay(d, SAT(10))).toBe(false)
    expect(isSchoolDay(d, SUN(10))).toBe(false)
  })

  it('applies the PE / Career Guidance swap', () => {
    const d = fresh()
    const mon = d.school.periods.find((p) => p.weekday === 1 && p.start === '15:30')!
    const thu = d.school.periods.find((p) => p.weekday === 4 && p.start === '15:30')!
    expect(mon.subjectId).toBe('pe')
    expect(thu.subjectId).toBe('career')
  })

  it('builds a gap-free timeline covering the whole day', () => {
    const tl = timeline(fresh(), WED(12))
    for (let i = 1; i < tl.length; i++) expect(+tl[i].start).toBe(+tl[i - 1].end)
  })
})

describe('live NOW detection', () => {
  it('Monday 8:15 → Embedded System Software, next Web3', () => {
    const n = getNow(fresh(), MON(8, 15))
    expect(n.block.kind).toBe('class')
    expect(n.block.label).toBe('Embedded System Software')
    expect(n.block.periods).toBe(2)
    expect(Math.round(n.remainingMin)).toBe(85)
    expect(n.next?.label).toBe('Web3')
  })

  it('Monday 8:20 → the student sees they are in Embedded System Software', () => {
    const v = getNowView(fresh(), MON(8, 20))
    expect(v.mode).toBe('class')
    expect(v.headline).toBe('You’re in Embedded System Software.')
    expect(v.subtitle).toContain('Willy')
  })

  it('merges Thursday Java into one 10:00–12:30 block', () => {
    const n = getNow(fresh(), THU(11, 0))
    expect(n.block.label).toBe('Java')
    expect(n.block.periods).toBe(3)
    expect(n.block.end.getHours()).toBe(12)
    expect(n.block.end.getMinutes()).toBe(30)
  })

  it('detects break and lunch', () => {
    expect(getNow(fresh(), MON(9, 45)).block.kind).toBe('break')
    expect(getNow(fresh(), MON(12, 45)).block.kind).toBe('lunch')
  })

  it('Wednesday 4:30 PM → Office Hours', () => {
    expect(getNow(fresh(), WED(16, 30)).block.kind).toBe('office-hours')
  })

  it('Thursday 3:45 PM → Career Guidance', () => {
    const v = getNowView(fresh(), THU(15, 45))
    expect(v.mode).toBe('class')
    expect(v.title).toBe('Career Guidance')
  })

  it('Wednesday 9:00 PM → Evening study with a real plan', () => {
    const v = getNowView(fresh(), WED(21, 0))
    expect(v.state.block.kind).toBe('evening-study')
    expect(v.plan!.length).toBeGreaterThan(1)
    expect(v.intent).not.toBeNull()
  })

  it('early morning: sleep until 3:30, then morning recall', () => {
    expect(getNow(fresh(), TUE(2, 0)).block.kind).toBe('sleep')
    expect(getNow(fresh(), TUE(3, 50)).block.kind).toBe('morning-study')
    expect(getNow(fresh(), TUE(5, 0)).block.kind).toBe('get-ready')
    expect(getNow(fresh(), TUE(7, 40)).block.kind).toBe('devotion')
  })

  it('after school: commute, home, evening, wind down, sleep', () => {
    expect(getNow(fresh(), TUE(18, 0)).block.kind).toBe('commute')
    expect(getNow(fresh(), TUE(20, 30)).block.kind).toBe('home')
    expect(getNow(fresh(), TUE(22, 55)).block.kind).toBe('wind-down')
    expect(getNow(fresh(), TUE(23, 30)).block.kind).toBe('sleep')
  })

  it('weekends do not copy the school timetable', () => {
    const tl = timeline(fresh(), SAT(12))
    expect(tl.some((b) => b.school)).toBe(false)
    expect(tl.filter((b) => b.kind === 'weekend-study')).toHaveLength(3)
    expect(tl.filter((b) => b.kind === 'free').length).toBeGreaterThan(1)
  })

  it('a day off mid-week switches to off-day mode', () => {
    const d = fresh()
    d.school.daysOff = ['2026-10-07']
    expect(isSchoolDay(d, WED(10))).toBe(false)
    expect(getNow(d, WED(10)).block.kind).toBe('weekend-study')
    expect(getNow(d, TUE(21, 30)).block.kind).toBe('free')
  })
})

describe('recommendations', () => {
  it('Tuesday 4:25 PM office hours recommends the Database assignment due tomorrow', () => {
    const d = fresh()
    d.tasks.push(task({ title: 'Finish Advanced Database assignment', subjectId: 'db', due: '2026-10-07', estMin: 35 }))
    const v = getNowView(d, TUE(16, 25))
    expect(v.eyebrow).toBe('Office Hours')
    expect(v.current?.title).toBe('Finish Advanced Database assignment')
    expect(v.headline).toBe('Office Hours — Recommended: Finish Advanced Database assignment.')
    expect(v.plan!.filter((i) => i.type !== 'break').length).toBeGreaterThanOrEqual(2)
  })

  it('Wednesday 8:55 PM → prepare Thursday: DSA, Java, Physics (not Career Guidance)', () => {
    const d = fresh()
    const b = tomorrowBriefing(d, WED(20, 55))!
    expect(b.label).toBe('Tomorrow')
    expect(b.prep.map((p) => p.subjectId)).toEqual(['dsa', 'java', 'phys'])
    expect(b.classes.map((c) => c.label)).toEqual(['Data Structures (DSA)', 'Java', 'Applied Physics II', 'Career Guidance'])
    const v = getNowView(d, WED(20, 45))
    expect(v.headline).toBe('Tomorrow is Thursday. You have DSA, Java, Physics II and Career.')
  })

  it('evening plan prepares tomorrow’s subjects and leaves room for recall', () => {
    const d = fresh()
    const n = getNow(d, WED(21, 0))
    const { items } = planForBlock(d, n.block, WED(21, 0))
    const subjects = items.map((i) => i.subjectId).filter(Boolean)
    expect(subjects).toContain('java')
    expect(subjects).toContain('dsa')
    expect(items[items.length - 1].title).toBe('Recall & self-test')
    expect(items.some((i) => i.type === 'break')).toBe(true)
    expect(items[items.length - 1].end).toBeLessThanOrEqual(+n.block.end)
  })

  it('a prepared subject drops out of tomorrow prep', () => {
    const d = fresh()
    d.sessions.push(session({ subjectId: 'java', startedAt: +WED(17, 0), endedAt: +WED(17, 40), focusMin: 40 }))
    const b = tomorrowBriefing(d, WED(21, 0))!
    expect(b.prep.find((p) => p.subjectId === 'java')!.status).toBe('done')
    const { candidates } = rankCandidates(d, { now: WED(21, 0), window: 'evening' })
    expect(candidates.some((c) => c.id.startsWith('prep:java'))).toBe(false)
  })

  it('studying Java on Tuesday does not count as prep for Thursday (Wednesday class in between)', () => {
    const d = fresh()
    d.sessions.push(session({ subjectId: 'java', startedAt: +TUE(21, 0), endedAt: +TUE(21, 40), focusMin: 40 }))
    const b = tomorrowBriefing(d, WED(21, 0))!
    expect(b.prep.find((p) => p.subjectId === 'java')!.status).not.toBe('done')
  })

  it('a major assignment due tomorrow outranks tomorrow prep', () => {
    const d = fresh()
    d.tasks.push(task({ title: 'Software Engineering report', subjectId: 'se', due: '2026-10-08', priority: 'high', estMin: 90 }))
    const v = getNowView(d, WED(21, 0))
    expect(v.plan![0].title).toBe('Software Engineering report')
    expect(v.plan![0].end - v.plan![0].start).toBe(50 * MINUTE)
  })

  it('an assignment due in two days gets a slice, not the whole evening', () => {
    const d = fresh()
    d.tasks.push(task({ title: 'DB assignment', subjectId: 'db', due: '2026-10-09', priority: 'high', estMin: 60 }))
    const v = getNowView(d, WED(21, 0))
    const item = v.plan!.find((i) => i.title === 'DB assignment')
    expect(item && item.end - item.start).toBeLessThanOrEqual(30 * MINUTE)
    expect(v.plan!.filter((i) => i.type === 'prep').length).toBeGreaterThanOrEqual(2)
  })

  it('personal projects never beat urgent academic work on a school night', () => {
    const d = fresh()
    d.projects.push({ id: 'p1', name: 'App', goal: '', color: '#000', createdAt: 0 })
    d.tasks.push(task({ kind: 'project', title: 'Build notifications', projectId: 'p1', priority: 'high', due: '2026-10-08' }))
    const { candidates } = rankCandidates(d, { now: WED(21, 0), window: 'evening' })
    const proj = candidates.findIndex((c) => c.kind === 'project')
    const prep = candidates.findIndex((c) => c.kind === 'prep')
    expect(prep).toBeLessThan(proj)
  })

  it('exam preparation ramps up as the date approaches', () => {
    expect(examPhase(14)!.label).toBe('Light review')
    expect(examPhase(7)!.label).toBe('Focused practice')
    expect(examPhase(3)!.label).toBe('High-priority revision')
    expect(examPhase(1)!.label).toBe('Light final review')
    expect(examPhase(1)!.minutes).toBeLessThan(examPhase(3)!.minutes)
    expect(examPhase(20)).toBeNull()
  })

  it('recovery mode keeps only essentials', () => {
    const d = fresh()
    d.tasks.push(task({ title: 'Due tomorrow', subjectId: 'db', due: '2026-10-08' }))
    d.tasks.push(task({ title: 'Later', subjectId: 'eng', due: '2026-10-20' }))
    const normal = rankCandidates(d, { now: WED(21, 0), window: 'evening' }).candidates
    const lean = rankCandidates(d, { now: WED(21, 0), window: 'evening', overloaded: true })
    expect(lean.candidates.length).toBeLessThan(normal.length)
    expect(lean.candidates[0].title).toBe('Due tomorrow')
    expect(lean.candidates.some((c) => c.title === 'Later')).toBe(false)
    expect(lean.deferred).toBeGreaterThan(0)
  })

  it('Friday 5:30 PM → week complete and a weekend plan', () => {
    const d = fresh()
    const v = getNowView(d, FRI(17, 30))
    expect(v.headline).toBe('Week complete. Weekend review plan ready.')
    const wk = weekendPlan(d, FRI(17, 30))
    expect(wk.map((w) => w.date.getDay())).toEqual([6, 0])
    expect(wk[0].blocks.length).toBe(3)
    const kinds = wk[0].blocks.flatMap((b) => b.items).map((i) => i.type)
    expect(kinds).toContain('deep')
  })

  it('Sunday 8:30 PM → prepare Monday', () => {
    const d = fresh()
    const v = getNowView(d, SUN(20, 30))
    expect(v.headline).toBe('Your week starts tomorrow. Prepare Embedded, Web3 and Soft. Eng..')
    const b = tomorrowBriefing(d, SUN(20, 30))!
    expect(b.label).toBe('Tomorrow')
    expect(b.prep.map((p) => p.subjectId)).toEqual(['ess', 'web3', 'se'])
    const sunEvening = getNowView(d, SUN(21, 10))
    expect(sunEvening.state.block.kind).toBe('evening-study')
    expect(sunEvening.plan!.some((i) => i.subjectId === 'ess')).toBe(true)
  })

  it('morning recall targets today’s classes', () => {
    const v = getNowView(fresh(), THU(3, 50))
    expect(v.eyebrow).toBe('Morning recall')
    expect(v.plan!.some((i) => i.subjectId === 'java' || i.subjectId === 'dsa')).toBe(true)
  })

  it('daily briefing counts the day correctly', () => {
    const d = fresh()
    d.tasks.push(task({ title: 'x', due: '2026-10-06' }))
    const b = dailyBriefing(d, TUE(5, 0))
    expect(b.classes).toBe(6)
    expect(b.tasksDue).toHaveLength(1)
    expect(b.officeHours).toBe(true)
    expect(b.studyBlocks).toBe(2)
  })

  it('done for today turns study blocks into rest', () => {
    const d = fresh()
    d.doneForDay = ['2026-10-07']
    const v = getNowView(d, WED(21, 30))
    expect(v.mode).toBe('rest')
  })
})

describe('My Day — planning it yourself', () => {
  it('your own study block replaces the automatic evening plan when you take over', () => {
    const d = fresh()
    d.dayPlans['2026-10-07'] = {
      mode: 'mine',
      updatedAt: 0,
      blocks: [{ id: 'b1', kind: 'study', start: '19:00', end: '20:00', title: 'Java practice', subjectId: 'java', topicName: 'Loops' }],
    }
    const v = getNowView(d, WED(19, 15))
    expect(v.eyebrow).toBe('Your plan')
    expect(v.title).toBe('Java practice')
    expect(v.intent?.subjectId).toBe('java')
    expect(getNow(d, WED(21, 30)).block.kind).toBe('free')
  })

  it('your blocks win over routine but never over school', () => {
    const d = fresh()
    d.dayPlans['2026-10-07'] = {
      mode: 'auto',
      updatedAt: 0,
      blocks: [
        { id: 'a', kind: 'activity', start: '18:00', end: '19:00', title: 'Football' },
        { id: 'b', kind: 'activity', start: '10:00', end: '10:30', title: 'Clash' },
      ],
    }
    expect(getNow(d, WED(18, 30)).block.label).toBe('Football')
    expect(getNow(d, WED(17, 30)).block.kind).toBe('commute')
    expect(getNow(d, WED(19, 30)).block.kind).toBe('commute')
    expect(getNow(d, WED(10, 15)).block.label).toBe('Java')
    expect(getNow(d, WED(21, 30)).block.kind).toBe('evening-study')
    const tl = timeline(d, WED(12))
    for (let i = 1; i < tl.length; i++) expect(+tl[i].start).toBe(+tl[i - 1].end)
  })

  it('a study block left on "Kairo picks" gets filled by the engine', () => {
    const d = fresh()
    d.dayPlans['2026-10-07'] = { mode: 'mine', updatedAt: 0, blocks: [{ id: 'k', kind: 'study', start: '20:00', end: '21:00', title: '' }] }
    const v = getNowView(d, WED(20, 5))
    expect(v.mode).toBe('study')
    expect(v.plan!.some((i) => i.subjectId === 'java' || i.subjectId === 'dsa' || i.subjectId === 'phys')).toBe(true)
  })

  it('copying Kairo’s plan gives editable blocks inside the study windows', async () => {
    const { autoPlanAsMyBlocks, validateMyBlocks } = await import('./myday')
    const d = fresh()
    let n = 0
    const blocks = autoPlanAsMyBlocks(d, WED(12), () => `m${n++}`)
    expect(blocks.length).toBeGreaterThan(2)
    expect(blocks.every((b) => b.kind === 'study' && b.start >= '03:45')).toBe(true)
    expect(validateMyBlocks(d, WED(12), blocks).filter((i) => !i.message.includes('sleep'))).toHaveLength(0)
    const bad = validateMyBlocks(d, WED(12), [{ id: 'x', kind: 'study', start: '09:00', end: '09:30', title: 'x' }])
    expect(bad[0].message).toContain('school')
  })

  it('your study blocks count for missed-session recovery', () => {
    const d = fresh()
    d.dayPlans['2026-10-07'] = { mode: 'mine', updatedAt: 0, blocks: [{ id: 'b1', kind: 'study', start: '19:00', end: '20:00', title: 'Java practice', subjectId: 'java' }] }
    const m = findMissed(d, WED(20, 30))!
    expect(m.block.kind).toBe('my-study')
    expect(m.items[0].title).toBe('Java practice')
  })
})

describe('sleep', () => {
  it('makes the school-night sleep deficit visible', () => {
    const s = sleepTonight(fresh(), WED(21, 0))!
    expect(s.plannedMin).toBe(270)
    expect(s.deficitMin).toBe(180)
  })

  it('weekend nights are longer', () => {
    expect(sleepTonight(fresh(), FRI(21, 0))!.plannedMin).toBe(510)
  })
})

describe('timer', () => {
  const intent = { title: 'Java', subjectId: 'java', type: 'prep' as const, minutes: 30 }
  const prefs = { focusMin: 25, shortBreakMin: 5, longBreakMin: 15, cyclesBeforeLong: 4 }

  it('survives a refresh because elapsed time is derived, not counted', () => {
    const t0 = 1_000_000
    const t = startTimer(intent, 'countdown', t0, t0)
    const restored = JSON.parse(JSON.stringify(t))
    expect(elapsedMs(restored, t0 + 15 * MINUTE)).toBe(15 * MINUTE)
    expect(timerView(restored, t0 + 15 * MINUTE, prefs).remainingMs).toBe(15 * MINUTE)
  })

  it('pause and resume exclude paused time', () => {
    const t0 = 0
    let t = startTimer(intent, 'countdown', t0, t0)
    t = pauseTimer(t, 10 * MINUTE)
    expect(elapsedMs(t, 50 * MINUTE)).toBe(10 * MINUTE)
    t = resumeTimer(t, 50 * MINUTE)
    expect(elapsedMs(t, 55 * MINUTE)).toBe(15 * MINUTE)
    expect(timerView(t, 80 * MINUTE, prefs).overtime).toBe(true)
  })

  it('pomodoro advances phases, even across a long gap', () => {
    const t = startTimer({ ...intent, minutes: 100 }, 'pomodoro', 0, 0)
    const { timer, changes } = advancePomodoro(t, 31 * MINUTE, prefs)
    expect(changes.map((c) => c.to)).toEqual(['short-break', 'focus'])
    expect(timer.pomodoro!.cycle).toBe(2)
    expect(timer.focusMs).toBe(25 * MINUTE)
    const long = advancePomodoro(t, 4 * 25 * MINUTE + 3 * 5 * MINUTE + 1, prefs)
    expect(long.timer.pomodoro!.phase).toBe('long-break')
  })
})

describe('missed sessions', () => {
  it('detects a missed evening block and reschedules without piling up', () => {
    const d = fresh()
    const m = findMissed(d, WED(23, 30))!
    expect(m.block.kind).toBe('evening-study')
    expect(m.block.day).toBe('2026-10-07')
    expect(m.items.length).toBeGreaterThan(0)
    expect(findMissed(d, THU(7, 0))!.block.kind).toBe('morning-study')
    let n = 0
    const tasks = buildCatchUps(d, m, 'office', WED(23, 30), () => `c${n++}`)
    expect(tasks.length).toBeGreaterThan(0)
    expect(tasks.every((t) => t.slot === 'office' && t.due === '2026-10-08')).toBe(true)
    const many = Array.from({ length: 9 }, (_, i) => task({ id: `x${i}`, kind: 'catch-up', createdAt: +THU(7, 0) - i }))
    const { tasks: trimmed, dropped } = trimCatchUps(many, THU(8, 0))
    expect(trimmed.filter((t) => t.kind === 'catch-up')).toHaveLength(MAX_OPEN_CATCHUPS)
    expect(dropped).toBe(9 - MAX_OPEN_CATCHUPS)
  })

  it('a studied block is not missed, and a resolved block is not asked again', () => {
    const d = fresh()
    d.sessions.push(session({ startedAt: +WED(21, 5), endedAt: +WED(21, 45), focusMin: 40 }))
    expect(findMissed(d, WED(23, 30))?.block.id).not.toBe('2026-10-07|r-evening')
    const e = fresh()
    e.missed['2026-10-07|r-evening'] = 'skipped'
    e.missed['2026-10-07|r-morning'] = 'skipped'
    e.missed['2026-10-06|r-evening'] = 'skipped'
    expect(findMissed(e, WED(23, 30))).toBeNull()
  })

  it('catch-up tasks respect their slot', () => {
    const d = fresh()
    d.tasks.push(task({ kind: 'catch-up', title: 'Catch up: Java', subjectId: 'java', slot: 'office', due: '2026-10-09' }))
    const office = rankCandidates(d, { now: THU(16, 25), window: 'office' }).candidates.findIndex((c) => c.title === 'Catch up: Java')
    const evening = rankCandidates(d, { now: THU(21, 0), window: 'evening' }).candidates.findIndex((c) => c.title === 'Catch up: Java')
    expect(office).toBeLessThan(evening)
  })
})

describe('spaced repetition', () => {
  it('schedules longer intervals for easier recall', () => {
    const today = '2026-10-05'
    expect(review(null, 'again', today).due).toBe('2026-10-06')
    expect(review(null, 'good', today).due).toBe('2026-10-07')
    expect(review(null, 'easy', today).due).toBe('2026-10-09')
    const second = review(review(null, 'good', today), 'good', '2026-10-07')
    expect(second.interval).toBe(5)
    const lapse = review(second, 'again', '2026-10-12')
    expect(lapse.lapses).toBe(1)
    expect(lapse.interval).toBe(1)
  })

  it('due topics surface in recommendations', () => {
    const d = fresh()
    d.topics.push({ id: 'tp', subjectId: 'phys', name: 'Electric fields', createdAt: 0, srs: { due: '2026-10-05', interval: 2, ease: 2.5, reps: 1, lapses: 0 } })
    const { candidates } = rankCandidates(d, { now: WED(21, 0), window: 'evening' })
    expect(candidates.some((c) => c.id === 'srs:tp')).toBe(true)
  })
})

describe('statistics', () => {
  it('counts streaks without breaking before the day ends', () => {
    const d = fresh()
    for (const day of [5, 6, 7]) d.sessions.push(session({ startedAt: +new Date(2026, 9, day, 21), endedAt: +new Date(2026, 9, day, 21, 30) }))
    expect(streaks(d, THU(10)).current).toBe(3)
    expect(streaks(d, THU(10)).studiedToday).toBe(false)
    expect(streaks(d, SAT(10)).current).toBe(0)
    expect(streaks(d, SAT(10)).longest).toBe(3)
  })

  it('builds a Monday-first week overview', () => {
    const w = weekOverview(fresh(), WED(12))
    expect(w[0].date.getDay()).toBe(1)
    expect(w[2].isToday).toBe(true)
    expect(w[5].school).toBe(false)
  })
})

describe('notifications', () => {
  it('announces the first class ten minutes early', () => {
    const d = fresh()
    const ev = eventsBetween(d, MON(7, 45), MON(7, 55))
    expect(ev.find((e) => e.category === 'class')?.title).toBe('Embedded System Software starts in 10 min')
  })

  it('does not double-announce the second period of a merged class', () => {
    const d = fresh()
    const ev = eventsBetween(d, MON(8, 35), MON(8, 45))
    expect(ev.filter((e) => e.category === 'class')).toHaveLength(0)
  })

  it('announces office hours, evening study and exams', () => {
    const d = fresh()
    d.exams.push({ id: 'e1', kind: 'quiz', subjectId: 'math', title: 'Integrals', date: '2026-10-09', importance: 2, notes: '', createdAt: 0 })
    const ev = eventsBetween(d, THU(16, 0), THU(21, 0))
    expect(ev.some((e) => e.title === 'Office Hours are starting')).toBe(true)
    expect(ev.some((e) => e.title.startsWith('Evening study starts at'))).toBe(true)
    expect(ev.some((e) => e.title === 'Quiz tomorrow: Applied Math II')).toBe(true)
  })

  it('respects quiet hours, categories and do-not-disturb', () => {
    const p = { ...fresh().notifications, enabled: true }
    expect(inQuietHours(p, +TUE(1, 0))).toBe(true)
    expect(inQuietHours(p, +TUE(12, 0))).toBe(false)
    expect(isAllowed(p, { category: 'class', at: +TUE(12, 0) })).toBe(true)
    expect(isAllowed(p, { category: 'class', at: +TUE(1, 0) })).toBe(false)
    expect(isAllowed({ ...p, categories: { ...p.categories, class: false } }, { category: 'class', at: +TUE(12, 0) })).toBe(false)
    expect(isAllowed({ ...p, dndUntil: +TUE(13, 0) }, { category: 'class', at: +TUE(12, 0) })).toBe(false)
    expect(isAllowed({ ...p, enabled: false }, { category: 'timer', at: +TUE(12, 0) })).toBe(true)
  })
})
