import {
  AlarmClock,
  ArrowRight,
  Bed,
  BookOpen,
  CalendarCheck2,
  CalendarPlus,
  CalendarRange,
  Check,
  CircleAlert,
  ClipboardList,
  Flame,
  GraduationCap,
  NotebookPen,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  SkipForward,
  Sunrise,
  TriangleAlert,
  Briefcase,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import type { AppData, MissedResolution } from '../../domain/types'
import { findMissed } from '../../engine/missed'
import { subjectById } from '../../engine/priority'
import { dailyBriefing, sleepTonight, tomorrowBriefing, weekendPlan, type NowView } from '../../engine/recommend'
import { PERSONAL_STUDY_KINDS, schoolBlocks, type Block } from '../../engine/schedule'
import type { CSSProperties } from 'react'
import { minutesBetween, streaks } from '../../engine/stats'
import { addDays, dateKey, diffMin, formatClock, formatDuration, formatShortDate, startOfDay, WEEKDAY_NAMES } from '../../engine/time'
import { useStartSession } from '../../hooks/useSession'
import { useStore } from '../../store/store'
import { toast, useUI } from '../../store/ui'
import { Button, Card, Chip, cx, SampleTag, SectionTitle, SubjectBadge, SubjectDot } from '../../ui/primitives'

export function Briefing({ data, now }: { data: AppData; now: Date }) {
  const b = dailyBriefing(data, now)
  const main = b.mainPriority
  const chips: { label: string; tone?: 'now' | 'warn' | 'good' | 'default' }[] = []
  if (b.classes) chips.push({ label: `${b.classes} class${b.classes > 1 ? 'es' : ''}` })
  if (b.tasksDue.length) chips.push({ label: `${b.tasksDue.length} due today`, tone: 'warn' })
  if (b.overdue) chips.push({ label: `${b.overdue} overdue`, tone: 'warn' })
  if (b.examsToday.length) chips.push({ label: `${b.examsToday.length} test today`, tone: 'now' })
  if (b.studyBlocks) chips.push({ label: `${b.studyBlocks} study block${b.studyBlocks > 1 ? 's' : ''} · ${formatDuration(b.studyMin)}` })
  if (b.officeHours) chips.push({ label: 'Office Hours available' })
  if (b.reviewsDue) chips.push({ label: `${b.reviewsDue} review${b.reviewsDue > 1 ? 's' : ''} due` })
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Daily briefing">
      {chips.map((c) => (
        <Chip key={c.label} tone={c.tone}>{c.label}</Chip>
      ))}
      {main && (
        <span className="ml-0.5 inline-flex items-center gap-1.5 text-[12.5px] text-muted">
          <Sparkles className="size-3.5 text-now" aria-hidden />
          Main priority: <span className="font-semibold text-ink">{subjectById(data, main.subjectId)?.name ?? main.title}</span>
        </span>
      )}
    </div>
  )
}

export function NextCard({ view, now, data }: { view: NowView; now: Date; data: AppData }) {
  const next = view.state.next
  if (!next) return null
  const subject = subjectById(data, next.subjectId)
  const inMin = diffMin(next.start, now)
  const teacher = next.teacherId ? data.teachers.find((t) => t.id === next.teacherId)?.name : undefined
  const fmt = data.preferences.timeFormat
  const tomorrowish = dateKey(next.start) !== dateKey(now)
  return (
    <Card className="rise flex items-center gap-4 p-4 sm:p-5" aria-label="Next">
      {subject ? <SubjectBadge subject={subject} /> : <span className="flex size-9 items-center justify-center rounded-xl bg-surface-2 text-muted"><AlarmClock className="size-[18px]" aria-hidden /></span>}
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] font-semibold tracking-[0.1em] text-muted uppercase">Next{tomorrowish ? ` · ${WEEKDAY_NAMES[next.start.getDay()]}` : ''}</p>
        <p className="truncate text-[16px] font-semibold text-ink">{next.label}</p>
        <p className="truncate text-[13px] text-muted">{[teacher, `${formatClock(next.start, fmt)} – ${formatClock(next.end, fmt)}`].filter(Boolean).join(' · ')}</p>
      </div>
      <div className="text-right">
        <p className="tabular font-display text-[22px] leading-none text-ink">{inMin < 60 ? Math.max(0, Math.round(inMin)) : formatClock(next.start, fmt, false)}</p>
        <p className="mt-1 text-[11.5px] text-muted">{inMin < 60 ? 'min' : 'starts'}</p>
      </div>
    </Card>
  )
}

export function MissedCard({ data, now }: { data: AppData; now: Date }) {
  const missed = findMissed(data, now)
  const resolve = useStore((s) => s.resolveMissed)
  if (!missed) return null
  const fmt = data.preferences.timeFormat
  const when = dateKey(missed.block.start) === dateKey(now) ? 'today' : 'yesterday'
  const act = (a: MissedResolution) => {
    const dropped = resolve(missed, a)
    const msg: Record<MissedResolution, string> = {
      rescheduled: 'Moved into your next study blocks.',
      office: 'Added to your next Office Hours.',
      weekend: 'Added to the weekend plan.',
      skipped: 'Skipped. No guilt — tomorrow is a new plan.',
    }
    toast({ title: a === 'skipped' ? 'Let it go' : 'Rescheduled', body: dropped ? `${msg[a]} Oldest catch-up dropped to keep things realistic.` : msg[a], tone: 'success' })
  }
  return (
    <Card className="rise border-[color-mix(in_oklab,var(--warn)_35%,var(--line))] p-4 sm:p-5" aria-label="Missed session">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--warn)_14%,transparent)] text-warn"><RotateCcw className="size-[18px]" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-ink">Missed: {missed.block.label.toLowerCase()} {when}, {formatClock(missed.block.start, fmt)}</p>
          <p className="mt-0.5 text-[13.5px] text-muted">
            {missed.items.length ? `Planned: ${missed.items.slice(0, 3).map((i) => i.title).join(' · ')}` : 'Nothing was logged in this block.'}
          </p>
          <p className="mt-3 text-[13px] font-medium text-ink-2">What should happen to it?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="primary" icon={CalendarPlus} onClick={() => act('rescheduled')}>Reschedule</Button>
            <Button size="sm" icon={Briefcase} onClick={() => act('office')}>Add to Office Hours</Button>
            <Button size="sm" icon={CalendarRange} onClick={() => act('weekend')}>Add to weekend</Button>
            <Button size="sm" variant="ghost" icon={SkipForward} onClick={() => act('skipped')}>Skip</Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

export function TomorrowCard({ data, now }: { data: AppData; now: Date }) {
  const b = tomorrowBriefing(data, now)
  const start = useStartSession()
  const open = useUI((s) => s.open)
  if (!b) return null
  const fmt = data.preferences.timeFormat
  const seen = new Set<string>()
  const classes = b.classes.filter((c) => (seen.has(c.subjectId ?? c.id) ? false : (seen.add(c.subjectId ?? c.id), true)))
  const pending = b.prep.filter((p) => p.status !== 'done').length
  return (
    <Card id="tomorrow" className="rise p-5" aria-labelledby="tomorrow-title">
      <SectionTitle id="tomorrow-title" icon={Sunrise} action={<span className="text-[12.5px] text-muted">{formatShortDate(dateKey(b.date))}</span>}>
        {b.label === 'Tomorrow' ? 'Tomorrow' : `Next school day · ${b.label}`}
      </SectionTitle>
      <ul className="flex flex-col gap-1.5">
        {classes.map((c) => {
          const s = subjectById(data, c.subjectId)
          const teacher = c.teacherId ? data.teachers.find((t) => t.id === c.teacherId)?.name : undefined
          return (
            <li key={c.id} className="flex items-center gap-3 text-[14px]">
              <span className="tabular w-[52px] shrink-0 text-[12.5px] text-muted">{formatClock(c.start, fmt, false)}</span>
              <SubjectDot color={s?.color ?? 'var(--muted)'} />
              <span className="min-w-0 flex-1 truncate text-ink">{c.label}</span>
              {teacher && <span className="shrink-0 text-[12.5px] text-muted">{teacher}</span>}
            </li>
          )
        })}
      </ul>
      {(b.tasksDue.length > 0 || b.exams.length > 0) && (
        <div className="mt-4 flex flex-col gap-1.5">
          {b.exams.map((e) => (
            <p key={e.id} className="flex items-center gap-2 text-[13.5px] font-medium text-now"><GraduationCap className="size-4" aria-hidden />{e.kind[0].toUpperCase() + e.kind.slice(1)}: {subjectById(data, e.subjectId)?.name} — {e.title}</p>
          ))}
          {b.tasksDue.map((t) => (
            <p key={t.id} className="flex items-center gap-2 text-[13.5px] font-medium text-warn"><CircleAlert className="size-4" aria-hidden />Due: {t.title}</p>
          ))}
        </div>
      )}
      <div className="mt-5 border-t border-line pt-4">
        <p className="mb-2 text-[12px] font-semibold tracking-[0.08em] text-muted uppercase">Prepare tonight</p>
        <ul className="flex flex-col gap-1">
          {b.prep.map((p) => {
            const s = subjectById(data, p.subjectId)
            return (
              <li key={p.subjectId}>
                <button
                  type="button"
                  disabled={p.status === 'done'}
                  onClick={() => open({ kind: 'start', intent: p.intent })}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-surface-2 disabled:hover:bg-transparent"
                >
                  <span className={cx('flex size-5 shrink-0 items-center justify-center rounded-full', p.status === 'done' ? 'bg-good text-white' : p.status === 'warn' ? 'bg-[color-mix(in_oklab,var(--warn)_18%,transparent)] text-warn' : 'border border-line')}>
                    {p.status === 'done' ? <Check className="size-3" strokeWidth={3} /> : p.status === 'warn' ? <TriangleAlert className="size-3" strokeWidth={2.5} /> : null}
                  </span>
                  <span className={cx('min-w-0 flex-1 truncate text-[14px]', p.status === 'done' ? 'text-muted line-through' : 'text-ink')}>{s?.name}</span>
                  <span className={cx('shrink-0 text-[12px]', p.status === 'warn' ? 'font-medium text-warn' : 'text-muted')}>{p.note}</span>
                </button>
              </li>
            )
          })}
        </ul>
        {b.allPrepped ? (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-[color-mix(in_oklab,var(--good)_10%,transparent)] px-3 py-2 text-[13.5px] font-medium text-good"><CalendarCheck2 className="size-4" aria-hidden />You’re prepared. Spaced reviews or rest are next.</p>
        ) : (
          b.intent && (
            <Button variant="primary" className="mt-4 w-full" icon={Play} onClick={() => start(b.intent!)}>
              Start {b.label.toLowerCase()} prep · {pending} left
            </Button>
          )
        )}
      </div>
    </Card>
  )
}

const KIND_LABEL: Partial<Record<Block['kind'], string>> = {
  'morning-study': 'Study',
  'evening-study': 'Study',
  'weekend-study': 'Study',
  'my-study': 'Your study',
  'my-activity': 'Your plan',
  'office-hours': 'Independent',
  'self-study': 'Independent',
}

export function TodayPlanCard({ view, now, data }: { view: NowView; now: Date; data: AppData }) {
  const fmt = data.preferences.timeFormat
  const blocks = view.state.today.filter((b) => b.kind !== 'free' && b.kind !== 'break' && !(b.kind === 'sleep' && b.end <= now && b.start < startOfDay(now)) && !(b.kind === 'sleep' && diffMin(b.end, b.start) < 1))
  const day = dateKey(now)
  const due = data.tasks.filter((t) => t.status !== 'done' && t.due === day)
  const custom = data.dayPlans[day]
  return (
    <Card className="rise p-5" aria-labelledby="today-plan">
      <SectionTitle id="today-plan" icon={ClipboardList} action={<Link to="/day" className="inline-flex items-center gap-1 text-[13px] font-medium text-now hover:underline">{custom?.mode === 'mine' ? 'Edit' : 'Plan it myself'}<ArrowRight className="size-3.5" /></Link>}>
        {custom?.mode === 'mine' ? 'Your plan today' : 'Today’s plan'}
      </SectionTitle>
      <ol className="relative flex flex-col">
        {blocks.map((b) => {
          const current = b.id === view.state.block.id
          const past = b.end <= now
          const subject = subjectById(data, b.subjectId)
          const studied = PERSONAL_STUDY_KINDS.includes(b.kind) && data.sessions.some((s) => s.status === 'completed' && s.startedAt < +b.end && s.endedAt > +b.start)
          return (
            <li key={b.id} className={cx('relative flex items-center gap-3 rounded-xl px-2 py-2', current && 'bg-[color-mix(in_oklab,var(--now)_9%,transparent)]')} aria-current={current ? 'step' : undefined}>
              <span className="tabular w-[58px] shrink-0 text-[12.5px] text-muted">{formatClock(b.start, fmt, false)}</span>
              <span className={cx('size-2.5 shrink-0 rounded-full', current && 'live-dot')} style={{ background: current ? 'var(--now)' : subject?.color ?? (PERSONAL_STUDY_KINDS.includes(b.kind) || b.kind === 'office-hours' ? 'var(--now)' : 'var(--line)') }} aria-hidden />
              <span className={cx('min-w-0 flex-1 truncate text-[14px]', current ? 'font-semibold text-ink' : past ? 'text-muted' : 'text-ink')}>{b.label}</span>
              {studied && <Check className="size-4 text-good" aria-label="Studied" />}
              {KIND_LABEL[b.kind] && !studied && <span className="shrink-0 text-[11.5px] font-medium text-muted">{KIND_LABEL[b.kind]}</span>}
              {current && <Chip tone="now">Now</Chip>}
            </li>
          )
        })}
      </ol>
      {due.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          {due.map((t) => (
            <p key={t.id} className="flex items-center gap-2 py-1 text-[13.5px] text-warn"><CircleAlert className="size-4" aria-hidden /><span className="font-medium">Due today:</span> <span className="truncate text-ink">{t.title}</span>{t.sample && <SampleTag />}</p>
          ))}
        </div>
      )}
    </Card>
  )
}

export function WeekendCard({ data, now }: { data: AppData; now: Date }) {
  const wd = now.getDay()
  const show = wd === 6 || wd === 0 || (wd === 5 && now.getHours() >= 15)
  const open = useUI((s) => s.open)
  if (!show) return null
  const plan = weekendPlan(data, now)
  if (!plan.length) return null
  const fmt = data.preferences.timeFormat
  const weekStart = addDays(startOfDay(now), -((wd + 6) % 7))
  const weekMin = minutesBetween(data, weekStart, addDays(weekStart, 7))
  return (
    <Card className="rise p-5" aria-labelledby="weekend-title">
      <SectionTitle id="weekend-title" icon={CalendarRange}>Weekend plan</SectionTitle>
      {weekMin > 0 && <p className="mb-3 text-[13.5px] text-muted">This week so far: <span className="font-semibold text-ink">{formatDuration(weekMin)}</span> of focused study.</p>}
      <div className="flex flex-col gap-4">
        {plan.map((d) => (
          <div key={dateKey(d.date)}>
            <p className="mb-1.5 text-[13px] font-semibold text-ink">{WEEKDAY_NAMES[d.date.getDay()]}</p>
            {d.blocks.length === 0 && <p className="text-[13px] text-muted">Rest day — nothing planned.</p>}
            {d.blocks.map(({ block, items }) => (
              <div key={block.id} className="mb-2 rounded-xl bg-surface-2 px-3 py-2">
                <p className="text-[12px] font-medium text-muted">{formatClock(block.start, fmt)} · {block.label}</p>
                {items.filter((i) => i.type !== 'break').map((i) => (
                  <button key={i.key} type="button" onClick={() => open({ kind: 'start', intent: { title: i.title, subjectId: i.subjectId, topicName: i.topicName, taskId: i.taskId, examId: i.examId, projectId: i.projectId, type: i.type === 'break' ? 'review' : i.type, minutes: Math.round((i.end - i.start) / 60000), method: i.detail } })} className="flex w-full items-center gap-2 py-0.5 text-left text-[13.5px] text-ink hover:text-now">
                    <SubjectDot color={subjectById(data, i.subjectId)?.color ?? 'var(--muted)'} />
                    <span className="truncate">{i.title}</span>
                    <span className="ml-auto shrink-0 text-[12px] text-muted">{Math.round((i.end - i.start) / 60000)}m</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-2 text-[12.5px] text-muted">Everything outside these blocks is free time. Rest is part of the plan.</p>
    </Card>
  )
}

export function SleepCard({ data, now }: { data: AppData; now: Date }) {
  const s = sleepTonight(data, now)
  if (!s || s.deficitMin < 30) return null
  const fmt = data.preferences.timeFormat
  return (
    <Card className="rise p-4" aria-label="Sleep">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-2"><Bed className="size-[18px]" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-semibold text-ink">{formatDuration(s.plannedMin)} of sleep planned tonight</p>
          <p className="mt-0.5 text-[13px] text-muted">
            {formatClock(s.bedtime, fmt)} → {formatClock(s.wake, fmt)} · {formatDuration(s.deficitMin)} under your {formatDuration(s.targetMin)} target. Kairo never adds study time here.
          </p>
          <Link to="/settings#routine" className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-now hover:underline">Adjust bedtime or wake time <ArrowRight className="size-3.5" /></Link>
        </div>
      </div>
    </Card>
  )
}

export function QuickActions() {
  const open = useUI((s) => s.open)
  const navigate = useNavigate()
  const actions = [
    { icon: Play, label: 'Start study', run: () => open({ kind: 'start' }), primary: true },
    { icon: Plus, label: 'Add task', run: () => open({ kind: 'task' }) },
    { icon: GraduationCap, label: 'Add exam', run: () => open({ kind: 'exam' }) },
    { icon: NotebookPen, label: 'Add note', run: () => open({ kind: 'note' }) },
    { icon: CalendarRange, label: 'Plan my day', run: () => navigate('/day') },
  ]
  return (
    <div className="grid grid-cols-5 gap-2" role="group" aria-label="Quick actions">
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          onClick={a.run}
          className={cx(
            'flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 py-3 text-[12px] font-semibold transition-all hover:-translate-y-0.5',
            a.primary ? 'border-transparent bg-now text-white shadow-[0_8px_20px_-10px_var(--now)]' : 'border-line bg-surface text-ink-2 hover:text-ink',
          )}
        >
          <a.icon className="size-[18px]" aria-hidden />
          <span className="text-center leading-tight">{a.label}</span>
        </button>
      ))}
    </div>
  )
}

export function MomentumStrip({ data, now }: { data: AppData; now: Date }) {
  const today = minutesBetween(data, startOfDay(now), addDays(startOfDay(now), 1))
  const { current } = streaks(data, now)
  const sessions = data.sessions.filter((s) => s.status === 'completed' && dateKey(new Date(s.startedAt)) === dateKey(now)).length
  return (
    <div className="grid grid-cols-3 gap-2">
      {[
        { icon: BookOpen, value: formatDuration(today), label: 'today' },
        { icon: Check, value: String(sessions), label: sessions === 1 ? 'session' : 'sessions' },
        { icon: Flame, value: `${current}`, label: current === 1 ? 'day streak' : 'day streak' },
      ].map((s) => (
        <div key={s.label} className="card flex items-center gap-2.5 px-3 py-3">
          <s.icon className="size-4 shrink-0 text-muted" aria-hidden />
          <div className="min-w-0">
            <p className="tabular truncate text-[16px] font-semibold text-ink">{s.value}</p>
            <p className="truncate text-[11.5px] text-muted">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export function TimetablePreview({ data, now }: { data: AppData; now: Date }) {
  const fmt = data.preferences.timeFormat
  return (
    <Card className="rise p-5" aria-labelledby="tt-prev">
      <SectionTitle id="tt-prev" icon={CalendarCheck2} action={<Link to="/timetable" className="inline-flex items-center gap-1 text-[13px] font-medium text-now hover:underline">Full week <ArrowRight className="size-3.5" /></Link>}>
        This week’s timetable
      </SectionTitle>
      <WeekStrip data={data} now={now} fmt={fmt} />
    </Card>
  )
}

function WeekStrip({ data, now }: { data: AppData; now: Date; fmt: '12h' | '24h' }) {
  const monday = addDays(startOfDay(now), -((now.getDay() + 6) % 7))
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {[0, 1, 2, 3, 4].map((i) => {
        const d = addDays(monday, i)
        const isToday = dateKey(d) === dateKey(now)
        const blocks = schoolBlocks({ ...data, school: { ...data.school, daysOff: [] } }, d).filter((b) => b.kind === 'class' || b.kind === 'clubs')
        return (
          <div key={i} className={cx('min-w-0 rounded-xl p-1', isToday && 'bg-[color-mix(in_oklab,var(--now)_9%,transparent)]')}>
            <p className={cx('mb-1.5 text-center text-[11px] font-semibold uppercase', isToday ? 'text-now' : 'text-muted')}>{WEEKDAY_NAMES[d.getDay()].slice(0, 3)}</p>
            <div className="flex flex-col gap-1">
              {blocks.map((b) => {
                const s = subjectById(data, b.subjectId)
                const live = b.start <= now && now < b.end
                return (
                  <div
                    key={b.id}
                    title={`${b.label} · ${b.start.toTimeString().slice(0, 5)}`}
                    className={cx('subject-tint subject-text truncate rounded-md border px-1 text-[10.5px] leading-[18px] font-semibold', live && 'ring-2 ring-now')}
                    style={{ '--c': s?.color ?? '#71767e', minHeight: `${b.periods > 1 ? 18 + (b.periods - 1) * 8 : 18}px` } as CSSProperties}
                  >
                    {s?.short ?? b.label}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
