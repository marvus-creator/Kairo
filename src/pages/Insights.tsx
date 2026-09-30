import { Award, CalendarClock, Flame, Lightbulb, Scale, Target, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { subjectById } from '../engine/priority'
import { completionRate, consistencyScore, insights, milestones, minutesBetween, minutesByDay, neglected, streaks, subjectShare } from '../engine/stats'
import { addDays, dateKey, daysBetween, formatDuration, relativeDay, startOfDay, startOfWeek, WEEKDAY_SHORT } from '../engine/time'
import { useData } from '../hooks/useApp'
import { useNow } from '../store/clock'
import { Card, Chip, cx, Empty, Ring, SectionTitle, SubjectDot } from '../ui/primitives'

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="text-[12px] font-medium text-muted">{label}</p>
      <p className="tabular mt-1 font-display text-[26px] leading-none text-ink">{value}</p>
      {sub && <p className="mt-1.5 text-[12px] text-muted">{sub}</p>}
    </div>
  )
}

function DailyBars({ days }: { days: { key: string; label: string; min: number; today: boolean }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(60, ...days.map((d) => d.min))
  return (
    <div>
      <div className="relative flex h-40 items-end gap-[2px] border-b border-line" role="img" aria-label="Minutes studied per day, last 14 days">
        {[0.5, 1].map((f) => (
          <div key={f} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: `${f * 100}%` }} aria-hidden>
            <span className="absolute -top-2 right-0 bg-surface pl-1 text-[10.5px] text-muted">{formatDuration(max * f)}</span>
          </div>
        ))}
        {days.map((d, i) => (
          <div key={d.key} className="relative flex h-full flex-1 items-end justify-center" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${d.label}: ${formatDuration(d.min)}`}>
            <div className={cx('w-full max-w-[26px] rounded-t-[4px] transition-colors', d.today ? 'bg-now' : 'bg-[color-mix(in_oklab,var(--now)_55%,var(--surface))]', hover === i && 'brightness-110')} style={{ height: `${Math.max(d.min ? 3 : 0, (d.min / max) * 100)}%` }} />
            {hover === i && (
              <div className="absolute bottom-full z-10 mb-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-center whitespace-nowrap shadow-[var(--shadow-lg)]">
                <p className="text-[11px] text-muted">{d.label}</p>
                <p className="tabular text-[13px] font-semibold text-ink">{formatDuration(d.min)}</p>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[2px]">
        {days.map((d) => (
          <span key={d.key} className={cx('flex-1 text-center text-[10.5px]', d.today ? 'font-semibold text-ink' : 'text-muted')}>{d.label.slice(0, 2)}</span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Minutes studied per day</caption>
        <tbody>{days.map((d) => <tr key={d.key}><th>{d.key}</th><td>{d.min}</td></tr>)}</tbody>
      </table>
    </div>
  )
}

export function Insights() {
  const data = useData()
  const now = useNow('minute')
  const today = startOfDay(now)
  const weekStart = startOfWeek(now, data.preferences.weekStart)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const todayMin = minutesBetween(data, today, addDays(today, 1))
  const weekMin = minutesBetween(data, weekStart, addDays(weekStart, 7))
  const monthMin = minutesBetween(data, monthStart, addDays(today, 1))
  const s = streaks(data, now)
  const completed = data.sessions.filter((x) => x.status === 'completed')
  const rate = completionRate(data, now)
  const score = consistencyScore(data, now)
  const goal = data.preferences.weeklyGoalMin
  const byDay = minutesByDay(data)
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(today, i - 13)
    const k = dateKey(d)
    return { key: k, label: WEEKDAY_SHORT[d.getDay()], min: byDay.get(k) ?? 0, today: i === 13 }
  })
  const share = subjectShare(data, addDays(today, -13), addDays(today, 1))
  const lagging = neglected(data, now)
  const tips = insights(data, now)
  const miles = milestones(data, now)
  const todayKey = dateKey(now)
  const upcoming = [
    ...data.exams.filter((e) => e.date >= todayKey).map((e) => ({ id: e.id, date: e.date, label: `${e.kind[0].toUpperCase() + e.kind.slice(1)} · ${subjectById(data, e.subjectId)?.short}`, color: subjectById(data, e.subjectId)?.color, exam: true })),
    ...data.tasks.filter((t) => t.status !== 'done' && t.due && t.due >= todayKey).map((t) => ({ id: t.id, date: t.due!, label: t.title, color: subjectById(data, t.subjectId)?.color, exam: false })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6)
  const studiedSubjects = new Set(completed.filter((x) => x.startedAt >= +weekStart).map((x) => x.subjectId).filter(Boolean)).size

  return (
    <div className="flex flex-col gap-5">
      <header className="rise">
        <h1 className="font-display text-[30px] leading-tight text-ink sm:text-[36px]">Insights</h1>
        <p className="mt-1 text-[15px] text-ink-2">Consistency over cramming. Showing up counts more than total hours.</p>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="flex flex-col items-center p-6 text-center" aria-labelledby="goal-title">
          <SectionTitle id="goal-title" icon={Target}>Weekly goal</SectionTitle>
          <Ring value={weekMin / goal} size={168} stroke={12} color={weekMin >= goal ? 'var(--good)' : 'var(--now)'} label={`${Math.round((weekMin / goal) * 100)}% of weekly goal`}>
            <div>
              <p className="tabular font-display text-[34px] leading-none text-ink">{formatDuration(weekMin)}</p>
              <p className="mt-1 text-[12.5px] text-muted">of {formatDuration(goal)}</p>
            </div>
          </Ring>
          <div className="mt-5 grid w-full grid-cols-2 gap-3">
            <div className="rounded-2xl bg-surface-2 p-3">
              <p className="flex items-center justify-center gap-1 text-[12px] text-muted"><Flame className="size-3.5 text-now" aria-hidden />Streak</p>
              <p className="tabular text-[20px] font-semibold text-ink">{s.current} <span className="text-[12px] font-normal text-muted">days</span></p>
              <p className="text-[11px] text-muted">best {s.longest}</p>
            </div>
            <div className="rounded-2xl bg-surface-2 p-3">
              <p className="flex items-center justify-center gap-1 text-[12px] text-muted"><TrendingUp className="size-3.5 text-good" aria-hidden />Consistency</p>
              <p className="tabular text-[20px] font-semibold text-ink">{score}<span className="text-[12px] font-normal text-muted">/100</span></p>
              <p className="text-[11px] text-muted">last 14 days</p>
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Today" value={formatDuration(todayMin)} />
            <Tile label="This week" value={formatDuration(weekMin)} sub={`${studiedSubjects} subject${studiedSubjects === 1 ? '' : 's'}`} />
            <Tile label="This month" value={formatDuration(monthMin)} />
            <Tile label="Sessions" value={String(completed.length)} sub={rate !== null ? `${rate}% completed` : undefined} />
          </div>
          <Card className="p-5" aria-labelledby="daily-title">
            <SectionTitle id="daily-title" icon={CalendarClock}>Last 14 days</SectionTitle>
            {completed.length ? <DailyBars days={days} /> : <Empty icon={CalendarClock} title="Nothing to chart yet" body="Finish a session and your study rhythm appears here." />}
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-5" aria-labelledby="ins-title">
          <SectionTitle id="ins-title" icon={Lightbulb}>What Kairo notices</SectionTitle>
          {tips.length === 0 ? (
            <p className="text-[14px] text-muted">Insights appear after a few sessions.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {tips.map((t) => (
                <li key={t.text} className="flex items-start gap-2.5 text-[14px] text-ink">
                  <span className={cx('mt-1.5 size-2 shrink-0 rounded-full', t.tone === 'good' ? 'bg-good' : t.tone === 'warn' ? 'bg-warn' : 'bg-muted')} aria-hidden />
                  {t.text}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5" aria-labelledby="bal-title">
          <SectionTitle id="bal-title" icon={Scale}>Study balance · 14 days</SectionTitle>
          {share.length === 0 ? (
            <p className="text-[14px] text-muted">No subject time logged yet.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {share.slice(0, 7).map((x) => {
                const sub = subjectById(data, x.subjectId)
                return (
                  <li key={x.subjectId}>
                    <div className="mb-1 flex items-center justify-between text-[13px]">
                      <span className="flex items-center gap-2 text-ink"><SubjectDot color={sub?.color ?? 'var(--muted)'} />{sub?.name}</span>
                      <span className="tabular text-muted">{formatDuration(x.minutes)} · {Math.round(x.share * 100)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-2">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(3, x.share * 100)}%`, background: sub?.color ?? 'var(--muted)' }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {lagging.length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <p className="mb-2 text-[12px] font-semibold tracking-[0.08em] text-muted uppercase">Getting less attention</p>
              <div className="flex flex-wrap gap-1.5">
                {lagging.slice(0, 6).map((n) => <Chip key={n.subjectId} tone="warn">{subjectById(data, n.subjectId)?.short} · {n.days === null ? 'never' : `${n.days}d`}</Chip>)}
              </div>
            </div>
          )}
        </Card>

        <Card className="p-5" aria-labelledby="up-title">
          <SectionTitle id="up-title" icon={CalendarClock}>Upcoming deadlines & tests</SectionTitle>
          {upcoming.length === 0 ? (
            <p className="text-[14px] text-muted">Nothing due. Enjoy the calm.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {upcoming.map((u) => (
                <li key={u.id} className="flex items-center gap-3 text-[14px]">
                  <SubjectDot color={u.color ?? 'var(--muted)'} />
                  <span className="min-w-0 flex-1 truncate text-ink">{u.label}</span>
                  {u.exam && <Chip tone="now">Test</Chip>}
                  <span className={cx('shrink-0 text-[12.5px]', daysBetween(todayKey, u.date) <= 1 ? 'font-semibold text-warn' : 'text-muted')}>{relativeDay(u.date, todayKey)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5" aria-labelledby="ms-title">
          <SectionTitle id="ms-title" icon={Award}>Milestones</SectionTitle>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {miles.map((m) => (
              <li key={m.label} className={cx('rounded-2xl border px-3 py-3 text-center text-[13px] font-medium', m.reached ? 'border-transparent bg-[color-mix(in_oklab,var(--good)_12%,transparent)] text-good' : 'border-dashed border-line text-muted')}>
                {m.label}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12.5px] text-muted">Late-night sessions never count extra. Sleep is part of the plan.</p>
        </Card>
      </div>
    </div>
  )
}
