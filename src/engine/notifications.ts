import type { AppData, NotifCategory, NotificationPrefs } from '../domain/types'
import { planForBlock } from './plan'
import { subjectById, taskDueAt } from './priority'
import { subjectNamesOn, tomorrowBriefing } from './recommend'
import { blocksForDay, type Block } from './schedule'
import { addDays, atHHMM, dateKey, formatClock, MINUTE, minuteOfDay, parseKey, startOfDay, toMin, HOUR, DAY } from './time'
import { studiedDuring } from './missed'

export interface NotifEvent {
  id: string
  category: NotifCategory
  at: number
  title: string
  body: string
  url: string
  conditional?: boolean
}

function firstItem(data: AppData, b: Block): string | null {
  const { items } = planForBlock(data, b, b.start)
  return items.find((i) => i.type !== 'break')?.title ?? null
}

export function eventsBetween(data: AppData, from: Date, to: Date): NotifEvent[] {
  const fmt = data.preferences.timeFormat
  const lead = Math.max(0, data.notifications.leadMin) * MINUTE
  const out: NotifEvent[] = []
  const seen = new Set<string>()
  const push = (e: NotifEvent) => {
    if (e.at >= +from && e.at < +to && !seen.has(e.id)) {
      seen.add(e.id)
      out.push(e)
    }
  }

  for (let d = addDays(startOfDay(from), -1); d <= to; d = addDays(d, 1)) {
    const blocks = blocksForDay(data, d)
    const day = dateKey(d)
    const done = data.doneForDay.includes(day)
    for (const b of blocks) {
      const teacher = b.teacherId ? data.teachers.find((t) => t.id === b.teacherId)?.name : undefined
      switch (b.kind) {
        case 'class':
          push({
            id: `class:${b.id}`,
            category: 'class',
            at: +b.start - lead,
            title: `${b.label} starts in ${data.notifications.leadMin} min`,
            body: [teacher, `${formatClock(b.start, fmt)} – ${formatClock(b.end, fmt)}`].filter(Boolean).join(' · '),
            url: '/timetable',
          })
          break
        case 'office-hours':
          if (+b.start >= +from - HOUR && +b.start < +to) {
            const top = firstItem(data, b)
            push({ id: `office:${b.id}`, category: 'study', at: +b.start, title: 'Office Hours are starting', body: top ? `Recommended: ${top}` : 'Your time to get ahead.', url: '/' })
          }
          break
        case 'my-activity':
          push({ id: `mine:${b.id}`, category: 'daily', at: +b.start - lead, title: `${b.label} at ${formatClock(b.start, fmt)}`, body: 'From your plan for today', url: '/' })
          break
        case 'my-study':
        case 'morning-study':
        case 'evening-study':
        case 'weekend-study':
          if (done) break
          if (+b.start - lead >= +from - HOUR && +b.start - lead < +to) {
            const top = firstItem(data, b)
            push({
              id: `study:${b.id}`,
              category: 'study',
              at: +b.start - lead,
              title: b.kind === 'morning-study' ? 'Good morning — recall time' : b.kind === 'my-study' ? `Your study block starts at ${formatClock(b.start, fmt)}` : `${b.label} starts at ${formatClock(b.start, fmt)}`,
              body: top ? `First up: ${top}` : 'Open Kairo to see your plan.',
              url: '/',
            })
          }
          if (+b.start + 15 * MINUTE >= +from && +b.start + 15 * MINUTE < +to && !data.missed[b.id] && studiedDuring(data, b) < 1 && !data.timer) {
            const top = data.plans[b.id]?.find((i) => i.type !== 'break')?.title ?? firstItem(data, b)
            push({
              id: `missed:${b.id}`,
              category: 'missed',
              at: +b.start + 15 * MINUTE,
              title: top ? `You planned to ${top.charAt(0).toLowerCase()}${top.slice(1)} now` : 'Your study block has started',
              body: 'Start a short session — even 15 minutes keeps the habit alive.',
              url: '/',
              conditional: true,
            })
          }
          if (b.kind === 'evening-study' && +b.start + HOUR >= +from && +b.start + HOUR < +to) {
            const brief = tomorrowBriefing(data, b.start)
            const pending = brief?.prep.filter((p) => p.status !== 'done') ?? []
            const warn = pending.find((p) => p.status === 'warn') ?? pending[0]
            if (warn) {
              push({
                id: `prep:${b.id}`,
                category: 'study',
                at: +b.start + HOUR,
                title: `You haven’t prepared for ${brief!.label.toLowerCase() === 'tomorrow' ? 'tomorrow’s' : `${brief!.label}’s`} ${subjectById(data, warn.subjectId)?.name} yet`,
                body: warn.note,
                url: '/?view=tomorrow',
                conditional: true,
              })
            }
          }
          break
        case 'get-ready':
          push({ id: `ready:${b.id}`, category: 'daily', at: +b.start, title: 'Time to prepare for school', body: `Today: ${subjectNamesOn(data, d).join(', ')}`, url: '/' })
          break
        case 'home': {
          if (+b.start < +from - HOUR || +b.start >= +to) break
          const brief = tomorrowBriefing(data, b.start)
          if (brief && brief.label === 'Tomorrow') {
            push({
              id: `brief:${b.id}`,
              category: 'daily',
              at: +b.start,
              title: `Tomorrow: ${brief.classes.map((c) => subjectById(data, c.subjectId)?.short ?? c.label).filter((v, i, a) => a.indexOf(v) === i).join(' · ')}`,
              body: brief.allPrepped ? 'You are already prepared. Nice.' : `${brief.prep.filter((p) => p.status !== 'done').length} subjects to prepare tonight`,
              url: '/?view=tomorrow',
            })
          }
          break
        }
        case 'wind-down':
          push({ id: `wind:${b.id}`, category: 'daily', at: +b.start, title: 'Wrap up for today', body: 'Books away. Sleep is part of the plan.', url: '/' })
          break
      }
    }
  }

  for (const t of data.tasks) {
    if (t.status === 'done') continue
    const due = taskDueAt(t)
    if (!due) continue
    const subject = subjectById(data, t.subjectId)?.short
    push({ id: `task24:${t.id}:${t.due}`, category: 'assignment', at: +due - DAY, title: `Due tomorrow: ${t.title}`, body: [subject, `${t.estMin} min estimated`].filter(Boolean).join(' · '), url: '/plan' })
    if (t.dueTime) push({ id: `task2:${t.id}:${t.due}`, category: 'assignment', at: +due - 2 * HOUR, title: `Due in 2 hours: ${t.title}`, body: subject ?? '', url: '/plan' })
  }

  for (const e of data.exams) {
    const day = parseKey(e.date)
    const subject = subjectById(data, e.subjectId)?.name ?? 'Exam'
    const kind = e.kind[0].toUpperCase() + e.kind.slice(1)
    push({ id: `exam1:${e.id}:${e.date}`, category: 'exam', at: +atHHMM(addDays(day, -1), '20:00'), title: `${kind} tomorrow: ${subject}`, body: 'Light review only, then a full night’s sleep.', url: '/plan?tab=exams' })
    push({ id: `exam3:${e.id}:${e.date}`, category: 'exam', at: +atHHMM(addDays(day, -3), '17:30'), title: `${kind} in 3 days: ${subject}`, body: `${e.title} — revision is now high priority.`, url: '/plan?tab=exams' })
  }

  return out.sort((a, b) => a.at - b.at)
}

export function inQuietHours(prefs: NotificationPrefs, at: number): boolean {
  if (!prefs.quiet.enabled) return false
  const m = minuteOfDay(new Date(at))
  const s = toMin(prefs.quiet.start)
  const e = toMin(prefs.quiet.end)
  if (s === e) return false
  return s < e ? m >= s && m < e : m >= s || m < e
}

export function isAllowed(prefs: NotificationPrefs, e: { category: NotifCategory | 'timer'; at: number }): boolean {
  if (prefs.dndUntil && e.at < prefs.dndUntil) return false
  if (e.category === 'timer') return true
  if (!prefs.enabled) return false
  if (!prefs.categories[e.category]) return false
  return !inQuietHours(prefs, e.at)
}
