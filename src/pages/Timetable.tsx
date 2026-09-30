import { BookOpenCheck, CalendarDays, GraduationCap, ListTodo } from 'lucide-react'
import { useMemo, useState, type CSSProperties } from 'react'
import type { AppData, SchoolPeriod } from '../domain/types'
import { subjectById } from '../engine/priority'
import { getNow, periodLabel } from '../engine/schedule'
import { weekOverview } from '../engine/stats'
import { addDays, dateKey, diffMin, formatDuration, formatHHMM, startOfDay, toMin, WEEKDAY_NAMES } from '../engine/time'
import { useData } from '../hooks/useApp'
import { useNow } from '../store/clock'
import { Card, Chip, cx, ProgressBar, Segmented } from '../ui/primitives'

interface Cell {
  period: SchoolPeriod
  span: number
  end: string
}

function buildGrid(data: AppData) {
  const slots = [...new Map(data.school.periods.map((p) => [`${p.start}-${p.end}`, { start: p.start, end: p.end }])).values()].sort((a, b) => toMin(a.start) - toMin(b.start))
  const days = [1, 2, 3, 4, 5]
  const cells = new Map<string, Cell | null>()
  for (const d of days) {
    const ps = data.school.periods.filter((p) => p.weekday === d)
    for (let i = 0; i < slots.length; i++) {
      const key = `${d}-${i}`
      if (cells.has(key)) continue
      const p = ps.find((x) => x.start === slots[i].start)
      if (!p) {
        cells.set(key, null)
        continue
      }
      let span = 1
      let end = p.end
      while (i + span < slots.length) {
        const n = ps.find((x) => x.start === slots[i + span].start)
        if (n && n.kind === 'class' && p.kind === 'class' && n.subjectId === p.subjectId && n.start === end) {
          cells.set(`${d}-${i + span}`, null)
          end = n.end
          span++
        } else break
      }
      cells.set(key, { period: p, span, end })
    }
  }
  return { slots, days, cells }
}

export function Timetable() {
  const data = useData()
  const now = useNow('second')
  const [tab, setTab] = useState<'week' | 'overview'>('week')
  return (
    <div className="flex flex-col gap-5">
      <header className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[30px] leading-tight text-ink sm:text-[36px]">Timetable</h1>
          <p className="mt-1 text-[15px] text-ink-2">Your school week, live. The current class is highlighted as it happens.</p>
        </div>
        <Segmented label="View" value={tab} onChange={setTab} options={[{ value: 'week', label: 'School week', icon: CalendarDays }, { value: 'overview', label: 'Week overview', icon: ListTodo }]} />
      </header>
      {tab === 'week' ? <WeekGrid data={data} now={now} /> : <WeekOverview data={data} now={now} />}
    </div>
  )
}

function WeekGrid({ data, now }: { data: AppData; now: Date }) {
  const { slots, days, cells } = useMemo(() => buildGrid(data), [data])
  const fmt = data.preferences.timeFormat
  const state = getNow(data, now)
  const todayWd = now.getDay()
  const [mobileDay, setMobileDay] = useState<number>(todayWd >= 1 && todayWd <= 5 ? todayWd : 1)
  const nextClass = state.nextClass
  const isLive = (wd: number, start: string, end: string) => wd === todayWd && state.schoolDay && toMin(start) <= now.getHours() * 60 + now.getMinutes() && now.getHours() * 60 + now.getMinutes() < toMin(end)
  const isNext = (wd: number, start: string) =>
    !!nextClass && nextClass.start.getDay() === wd && nextClass.start.getHours() * 60 + nextClass.start.getMinutes() === toMin(start) && diffMin(nextClass.start, now) < 24 * 60

  const renderCell = (wd: number, cell: Cell, compact = false) => {
    const p = cell.period
    const subject = subjectById(data, p.subjectId)
    const teacher = p.teacherId ? data.teachers.find((t) => t.id === p.teacherId)?.name : undefined
    const live = isLive(wd, p.start, cell.end)
    const next = !live && isNext(wd, p.start)
    const label = periodLabel(p, data.subjects)
    const light = p.kind === 'break' || p.kind === 'lunch'
    const mins = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
    const progress = live ? (mins - toMin(p.start)) / (toMin(cell.end) - toMin(p.start)) : 0
    const remaining = live ? toMin(cell.end) - mins : 0
    return (
      <div
        className={cx(
          'relative flex h-full flex-col justify-between overflow-hidden rounded-xl border p-2.5 transition-shadow',
          subject ? 'subject-tint' : light ? 'border-transparent bg-surface-2/60' : p.kind === 'office-hours' ? 'border-dashed border-[color-mix(in_oklab,var(--now)_45%,var(--line))] bg-[color-mix(in_oklab,var(--now)_6%,var(--surface))]' : 'border-line bg-surface',
          live && 'ring-2 ring-now shadow-[var(--shadow-lg)]',
          compact ? 'min-h-[64px]' : '',
        )}
        style={{ '--c': subject?.color ?? '#71767e' } as CSSProperties}
        aria-current={live ? 'time' : undefined}
      >
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-1">
            <p className={cx('leading-tight font-semibold', light ? 'text-[12px] text-muted' : 'text-[13px]', subject ? 'subject-text' : 'text-ink')}>{light ? label : subject?.short && !compact ? subject.name : label}</p>
            {live && <Chip tone="now" className="shrink-0">Now</Chip>}
            {next && <Chip tone="brand" className="shrink-0">Next</Chip>}
          </div>
          {!light && teacher && <p className="mt-0.5 truncate text-[11.5px] text-muted">{teacher}</p>}
        </div>
        {!light && (
          <div>
            {live && (
              <div className="mt-2">
                <ProgressBar value={progress} className="text-ink" label="Class progress" />
                <p className="mt-1 text-[11px] font-semibold text-now">{formatDuration(remaining)} remaining</p>
              </div>
            )}
            {!live && cell.span > 1 && <p className="mt-1 text-[11px] text-muted tabular">{formatHHMM(p.start, fmt)}–{formatHHMM(cell.end, fmt)}</p>}
          </div>
        )}
      </div>
    )
  }

  const monday = addDays(startOfDay(now), -((todayWd + 6) % 7))

  return (
    <>
      {state.block.kind === 'class' && (
        <Card className="rise flex flex-wrap items-center gap-4 p-4" aria-label="Current class">
          <span className="live-dot size-2.5 rounded-full bg-now" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] font-semibold tracking-[0.1em] text-muted uppercase">Current</p>
            <p className="font-display text-[22px] text-ink">{state.block.label}</p>
          </div>
          <div className="w-full max-w-xs">
            <ProgressBar value={state.progress} className="text-ink" label="Class progress" />
            <p className="mt-1 text-[12.5px] text-muted">{formatDuration(state.remainingMin)} remaining · next: {nextClass?.label ?? '—'}</p>
          </div>
        </Card>
      )}

      <div className="hidden overflow-x-auto md:block">
        <div className="card min-w-[760px] p-3">
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `72px repeat(${days.length}, minmax(0, 1fr))` }}>
            <div />
            {days.map((d) => {
              const date = addDays(monday, d - 1)
              const off = data.school.daysOff.includes(dateKey(date))
              return (
                <div key={d} className={cx('rounded-lg py-2 text-center', d === todayWd && 'bg-[color-mix(in_oklab,var(--now)_10%,transparent)]')}>
                  <p className={cx('text-[13px] font-semibold', d === todayWd ? 'text-now' : 'text-ink')}>{WEEKDAY_NAMES[d]}</p>
                  <p className="text-[11px] text-muted">{off ? 'Day off' : date.getDate()}</p>
                </div>
              )
            })}
            {slots.map((slot, i) => {
              const light = toMin(slot.end) - toMin(slot.start) <= 20
              return (
                <div key={slot.start} className="contents">
                  <div className="tabular pt-2 pr-2 text-right text-[11.5px] text-muted" style={{ gridRow: i + 2, gridColumn: 1 }}>
                    {formatHHMM(slot.start, fmt)}
                  </div>
                  {days.map((d, di) => {
                    const cell = cells.get(`${d}-${i}`)
                    if (!cell) return null
                    return (
                      <div key={`${d}-${i}`} style={{ gridRow: `${i + 2} / span ${cell.span}`, gridColumn: di + 2, minHeight: light ? 34 : 62 * cell.span }}>
                        {renderCell(d, cell)}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="md:hidden">
        <div className="mb-3 grid grid-cols-5 gap-1 rounded-2xl bg-surface-2 p-1" role="tablist" aria-label="Day">
          {days.map((d) => (
            <button key={d} role="tab" aria-selected={mobileDay === d} type="button" onClick={() => setMobileDay(d)} className={cx('rounded-xl py-2 text-[13px] font-semibold', mobileDay === d ? 'bg-surface text-ink shadow-[var(--shadow)]' : d === todayWd ? 'text-now' : 'text-muted')}>
              {WEEKDAY_NAMES[d].slice(0, 3)}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          {slots.map((slot, i) => {
            const cell = cells.get(`${mobileDay}-${i}`)
            if (!cell) return null
            return (
              <div key={slot.start} className="flex gap-3">
                <span className="tabular w-[54px] shrink-0 pt-2.5 text-right text-[12px] text-muted">{formatHHMM(slot.start, fmt)}</span>
                <div className="min-w-0 flex-1">{renderCell(mobileDay, cell, true)}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Subjects">
        {data.subjects.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-2">
            <span className="size-2.5 rounded-full" style={{ background: s.color }} aria-hidden />
            {s.name}
            {s.teacherId && <span className="text-muted">· {data.teachers.find((t) => t.id === s.teacherId)?.name}</span>}
          </span>
        ))}
      </div>
    </>
  )
}

function WeekOverview({ data, now }: { data: AppData; now: Date }) {
  const days = weekOverview(data, now)
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
      {days.map((d) => (
        <Card key={d.key} className={cx('flex flex-col gap-3 p-4', d.isToday && 'ring-2 ring-now')} aria-label={WEEKDAY_NAMES[d.date.getDay()]}>
          <div className="flex items-baseline justify-between">
            <p className={cx('text-[14px] font-semibold', d.isToday ? 'text-now' : 'text-ink')}>{WEEKDAY_NAMES[d.date.getDay()].slice(0, 3)}</p>
            <p className="text-[12px] text-muted">{d.date.getDate()}</p>
          </div>
          <div className="text-[12.5px] text-ink-2">
            {d.school ? <p className="line-clamp-3">{d.subjects.join(' · ')}</p> : <p className="text-muted">No school</p>}
          </div>
          <div className="mt-auto flex flex-col gap-1.5 border-t border-line pt-3 text-[12px]">
            <p className="flex items-center gap-1.5 text-ink-2"><BookOpenCheck className="size-3.5 text-muted" aria-hidden />{formatDuration(d.studyMin)}{d.plannedMin ? <span className="text-muted"> / {formatDuration(d.plannedMin)}</span> : null}</p>
            {d.tasksDue > 0 && <p className="flex items-center gap-1.5 text-warn"><ListTodo className="size-3.5" aria-hidden />{d.tasksDue} due</p>}
            {d.tests > 0 && <p className="flex items-center gap-1.5 text-now"><GraduationCap className="size-3.5" aria-hidden />{d.tests} test{d.tests > 1 ? 's' : ''}</p>}
            {d.completion !== null && <ProgressBar value={d.completion} color={d.completion >= 0.7 ? 'var(--good)' : 'var(--now)'} className="mt-1 text-ink" label="Study completion" />}
          </div>
        </Card>
      ))}
    </div>
  )
}
