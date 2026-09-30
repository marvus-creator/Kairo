import { BatteryLow, Check, ChevronRight, Coffee, MoonStar, MoreHorizontal, Play, RefreshCcw, Shuffle, Maximize2, CalendarRange } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AppData, PlanItem } from '../../domain/types'
import { intentFromItem, itemDone } from '../../engine/plan'
import type { NowView } from '../../engine/recommend'
import { dateKey, diffMin, formatClock, formatCountdown, formatDuration } from '../../engine/time'
import { useTimerView } from '../../hooks/useApp'
import { useStartSession } from '../../hooks/useSession'
import { useStore } from '../../store/store'
import { toast, useUI } from '../../store/ui'
import { subjectIcon } from '../../ui/icons'
import { Button, cx, ProgressBar } from '../../ui/primitives'

function PlanList({ items, now, data, onStart }: { items: PlanItem[]; now: Date; data: AppData; onStart: (i: PlanItem) => void }) {
  const fmt = data.preferences.timeFormat
  return (
    <ol className="mt-5 flex flex-col gap-1" aria-label="Plan for this block">
      {items.map((i) => {
        const done = i.type !== 'break' && itemDone(data, i)
        const active = +now >= i.start && +now < i.end
        const past = i.end <= +now
        const subject = data.subjects.find((s) => s.id === i.subjectId)
        return (
          <li key={i.key}>
            <button
              type="button"
              disabled={i.type === 'break'}
              onClick={() => onStart(i)}
              className={cx(
                'group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors',
                active ? 'bg-[color-mix(in_oklab,var(--brand-ink)_14%,transparent)]' : 'hover:bg-[color-mix(in_oklab,var(--brand-ink)_8%,transparent)]',
              )}
            >
              <span className="tabular w-[62px] shrink-0 text-[12.5px] text-brand-ink/60">{formatClock(i.start, fmt, false)}</span>
              <span className={cx('flex size-5 shrink-0 items-center justify-center rounded-full border', done ? 'border-transparent bg-good text-white' : 'border-brand-ink/30')} aria-hidden>
                {done ? <Check className="size-3" strokeWidth={3} /> : i.type === 'break' ? <Coffee className="size-2.5 text-brand-ink/60" /> : subject ? <span className="size-2 rounded-full" style={{ background: subject.color }} /> : null}
              </span>
              <span className={cx('min-w-0 flex-1 truncate text-[14px]', done && 'line-through opacity-50', past && !done && !active && 'opacity-60', active ? 'font-semibold text-brand-ink' : 'text-brand-ink/85')}>
                {i.title}
              </span>
              <span className="tabular shrink-0 text-[12px] text-brand-ink/55">{Math.round((i.end - i.start) / 60000)}m</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

function Menu({ view, data, now }: { view: NowView; data: AppData; now: Date }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const key = dateKey(now)
  const s = useStore()
  const navigate = useNavigate()
  useEffect(() => {
    if (!open) return
    const off = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', off)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', off)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  const overloaded = data.overloaded.includes(key)
  const done = data.doneForDay.includes(key)
  const items = [
    view.plan && { icon: RefreshCcw, label: 'Re-plan from now', run: () => { s.clearPlan(view.state.block.id); toast({ title: 'Plan refreshed', body: 'Rebuilt from what matters most right now.' }) } },
    { icon: CalendarRange, label: 'Plan my day myself', run: () => navigate('/day') },
    { icon: BatteryLow, label: overloaded ? 'Back to the full plan' : 'I’m overloaded — essentials only', run: () => { s.toggleOverloaded(key); toast({ title: overloaded ? 'Full plan restored' : 'Essentials only today', body: overloaded ? undefined : 'Lower-priority work waits. Do the few things that matter.', tone: 'success' }) } },
    { icon: MoonStar, label: done ? 'Resume today’s plan' : 'I’m done for today', run: () => { s.toggleDoneForDay(key); toast({ title: done ? 'Plan resumed' : 'Done for today', body: done ? undefined : 'Rest well. No reminders for the rest of today’s study blocks.', tone: 'success' }) } },
  ].filter(Boolean) as { icon: typeof RefreshCcw; label: string; run: () => void }[]
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label="More options" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex size-9 items-center justify-center rounded-xl text-brand-ink/75 hover:bg-[color-mix(in_oklab,var(--brand-ink)_12%,transparent)] hover:text-brand-ink">
        <MoreHorizontal className="size-5" />
      </button>
      {open && (
        <div role="menu" className="fade absolute top-11 right-0 z-20 w-64 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 text-ink shadow-[var(--shadow-lg)]">
          {items.map((it) => (
            <button key={it.label} type="button" role="menuitem" onClick={() => { setOpen(false); it.run() }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[14px] hover:bg-surface-2">
              <it.icon className="size-4 text-muted" aria-hidden />
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function NowCard({ view, now, data }: { view: NowView; now: Date; data: AppData }) {
  const start = useStartSession()
  const open = useUI((s) => s.open)
  const setFocus = useUI((s) => s.setFocus)
  const navigate = useNavigate()
  const timer = useTimerView()
  const fmt = data.preferences.timeFormat
  const b = view.state.block
  const subject = data.subjects.find((s) => s.id === (view.current?.subjectId ?? b.subjectId))
  const Icon = subjectIcon(subject?.icon)
  const itemRemaining = view.current && view.current.type !== 'break' ? diffMin(view.current.end, now) : null
  const remaining = itemRemaining !== null && itemRemaining > 0 ? itemRemaining : view.state.remainingMin
  const progress = view.current && view.current.end > +now ? Math.max(0, (+now - view.current.start) / (view.current.end - view.current.start)) : view.state.progress
  const heroStyle = { '--c': subject?.color ?? 'var(--now)' } as CSSProperties

  return (
    <section aria-labelledby="now-title" className="rise relative overflow-hidden rounded-[28px] bg-brand text-brand-ink shadow-[var(--shadow-lg)]" style={heroStyle}>
      <div className="grain pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <div className="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full opacity-25 blur-3xl" style={{ background: 'var(--c)' }} aria-hidden />
      <div className="relative p-5 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[12px] font-semibold tracking-[0.14em] text-brand-ink/70 uppercase">
            <span className="live-dot size-2 rounded-full bg-now" aria-hidden />
            Now · {view.eyebrow}
          </p>
          <Menu view={view} data={data} now={now} />
        </div>

        <div className="mt-3 flex items-start gap-4">
          {(view.mode === 'class' || (view.mode === 'study' && subject)) && (
            <span className="mt-1 hidden size-12 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_oklab,var(--c)_40%,var(--brand))] sm:flex" aria-hidden>
              <Icon className="size-6 text-white" />
            </span>
          )}
          <div className="min-w-0">
            <h1 id="now-title" className="font-display text-[32px] leading-[1.08] font-medium text-balance sm:text-[42px]">
              {view.title}
            </h1>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-brand-ink/75">{view.subtitle}</p>
          </div>
        </div>

        {timer ? (
          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl bg-[color-mix(in_oklab,var(--brand-ink)_10%,transparent)] p-3 pl-4">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold tracking-wide text-brand-ink/60 uppercase">{timer.view.running ? 'Session in progress' : 'Session paused'}</p>
              <p className="truncate text-[15px] font-semibold">{timer.timer.intent.title}</p>
            </div>
            <span className="tabular font-display text-[28px]">{formatCountdown(timer.view.remainingMs ?? timer.view.elapsedMs)}</span>
            <div className="flex gap-2">
              <Button variant="inverse" onClick={() => navigate('/study')}>Open</Button>
              <Button variant="now" icon={Maximize2} onClick={() => setFocus(true)}>Focus</Button>
            </div>
          </div>
        ) : (
          <>
            {view.mode !== 'sleep' && remaining > 0 && (
              <div className="mt-6 max-w-md">
                <div className="mb-2 flex items-baseline justify-between text-[13px] text-brand-ink/70">
                  <span>
                    <span className="tabular font-display text-[22px] text-brand-ink">{formatDuration(remaining)}</span> remaining
                  </span>
                  <span className="tabular">until {formatClock(view.current && itemRemaining && itemRemaining > 0 ? new Date(view.current.end) : b.end, fmt)}</span>
                </div>
                <ProgressBar value={progress} color="var(--now)" className="text-brand-ink" label="Progress through the current activity" />
              </div>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-2">
              {view.intent && (
                <Button variant="now" size="lg" icon={Play} onClick={() => start(view.intent!)}>
                  Start session
                </Button>
              )}
              {view.intent && (
                <Button variant="ghost" size="lg" icon={Shuffle} className="text-brand-ink/80 hover:bg-[color-mix(in_oklab,var(--brand-ink)_10%,transparent)] hover:text-brand-ink" onClick={() => open({ kind: 'start' })}>
                  Choose another
                </Button>
              )}
              {!view.intent && view.suggestion && view.mode !== 'sleep' && view.mode !== 'wind-down' && (
                <Button variant="inverse" size="lg" icon={Play} onClick={() => open({ kind: 'start', intent: view.suggestion! })}>
                  Start early: {view.suggestion.title}
                </Button>
              )}
              {view.mode === 'class' && (
                <Button variant="ghost" size="lg" iconRight={ChevronRight} className="text-brand-ink/80 hover:bg-[color-mix(in_oklab,var(--brand-ink)_10%,transparent)] hover:text-brand-ink" onClick={() => navigate('/timetable')}>
                  Timetable
                </Button>
              )}
            </div>
          </>
        )}

        {view.plan && view.plan.length > 0 && (
          <PlanList items={view.plan} now={now} data={data} onStart={(i) => i.type !== 'break' && open({ kind: 'start', intent: intentFromItem(i) })} />
        )}
        {view.deferred > 0 && (
          <p className="mt-3 text-[13px] text-brand-ink/60">Essentials only — {view.deferred} lower-priority item{view.deferred > 1 ? 's' : ''} moved out of today.</p>
        )}
        {view.current?.reason && view.current.type !== 'break' && !timer && (
          <p className="mt-4 text-[13px] text-brand-ink/60">Why this: {view.current.reason}</p>
        )}
      </div>
    </section>
  )
}
