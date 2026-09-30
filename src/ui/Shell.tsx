import { BarChart3, CalendarDays, CalendarRange, FlaskConical, ListChecks, Maximize2, Pause, Play, Settings, Sun, Timer } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useTimerView } from '../hooks/useApp'
import { formatClock, formatCountdown, formatLongDate } from '../engine/time'
import { isSimulating, setSimulation, useNow } from '../store/clock'
import { useStore } from '../store/store'
import { useUI } from '../store/ui'
import { KairoMark } from './icons'
import { cx, IconButton, SubjectDot } from './primitives'

const NAV = [
  { to: '/', label: 'Today', icon: Sun, key: 'H' },
  { to: '/day', label: 'My Day', icon: CalendarRange, key: 'M' },
  { to: '/timetable', label: 'Timetable', icon: CalendarDays, key: 'T' },
  { to: '/study', label: 'Study', icon: Timer, key: 'S' },
  { to: '/plan', label: 'Tasks & exams', icon: ListChecks, key: 'P' },
  { to: '/insights', label: 'Insights', icon: BarChart3, key: 'I' },
  { to: '/settings', label: 'Settings', icon: Settings, key: ',' },
]

function LiveClock({ compact }: { compact?: boolean }) {
  const now = useNow()
  const fmt = useStore((s) => s.preferences.timeFormat)
  return (
    <div className={compact ? 'text-right' : ''}>
      <p className="tabular text-[15px] font-semibold text-ink">{formatClock(now, fmt)}</p>
      {!compact && <p className="text-xs text-muted">{formatLongDate(now)}</p>}
    </div>
  )
}

export function MiniTimer({ floating }: { floating?: boolean }) {
  const t = useTimerView()
  const subjects = useStore((s) => s.subjects)
  const pause = useStore((s) => s.pauseSession)
  const resume = useStore((s) => s.resumeSession)
  const setFocus = useUI((s) => s.setFocus)
  const navigate = useNavigate()
  const loc = useLocation()
  if (!t || (floating && loc.pathname === '/study')) return null
  const subject = subjects.find((s) => s.id === t.timer.intent.subjectId)
  const shown = t.view.phase && t.view.phase !== 'focus' ? t.view.phaseRemainingMs! : t.view.remainingMs ?? t.view.elapsedMs
  const status = t.view.running ? (t.view.phase && t.view.phase !== 'focus' ? 'On break' : t.view.overtime ? 'Planned time done' : 'Focusing') : 'Paused'
  if (!floating) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-3">
        <button type="button" onClick={() => navigate('/study')} className="flex w-full items-center gap-2 text-left" aria-label="Open study timer">
          <SubjectDot color={subject?.color ?? 'var(--now)'} size={8} />
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{t.timer.intent.title}</span>
        </button>
        <div className="mt-1.5 flex items-center gap-1">
          <span className="min-w-0 flex-1">
            <span className={cx('tabular block text-[20px] leading-none font-semibold', t.view.overtime ? 'text-good' : 'text-ink')}>{formatCountdown(shown)}</span>
            <span className="text-[11px] text-muted">{status}</span>
          </span>
          <IconButton size="sm" icon={t.view.running ? Pause : Play} label={t.view.running ? 'Pause timer' : 'Resume timer'} onClick={() => (t.view.running ? pause() : resume())} />
          <IconButton size="sm" icon={Maximize2} label="Focus mode" onClick={() => setFocus(true)} />
        </div>
      </div>
    )
  }
  return (
    <div
      className="rise fixed inset-x-3 bottom-[76px] z-40 flex items-center gap-2 rounded-2xl border border-line bg-surface p-1.5 pl-3 shadow-[var(--shadow-lg)] lg:hidden"
    >
      <button type="button" onClick={() => navigate('/study')} className="flex min-w-0 flex-1 items-center gap-2.5 text-left" aria-label="Open study timer">
        <SubjectDot color={subject?.color ?? 'var(--now)'} size={9} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-ink">{t.timer.intent.title}</span>
          <span className="block text-[11.5px] text-muted">{status}</span>
        </span>
        <span className={cx('tabular text-[17px] font-semibold', t.view.overtime ? 'text-good' : 'text-ink')}>{formatCountdown(shown)}</span>
      </button>
      <IconButton size="sm" icon={t.view.running ? Pause : Play} label={t.view.running ? 'Pause timer' : 'Resume timer'} onClick={() => (t.view.running ? pause() : resume())} />
      <IconButton size="sm" icon={Maximize2} label="Focus mode" onClick={() => setFocus(true)} />
    </div>
  )
}

function SimBanner() {
  const now = useNow()
  const fmt = useStore((s) => s.preferences.timeFormat)
  if (!isSimulating()) return null
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-warn px-4 py-1.5 text-center text-[12.5px] font-medium text-white">
      <FlaskConical className="size-4" aria-hidden />
      <span>
        Simulated time: {formatLongDate(now)}, {formatClock(now, fmt)}
      </span>
      <button type="button" className="rounded-md bg-white/20 px-2 py-0.5 font-semibold hover:bg-white/30" onClick={() => setSimulation(null)}>
        Use real time
      </button>
    </div>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  const name = useStore((s) => s.profile.name)
  const mobileNav = NAV.filter((n) => ['/', '/day', '/study', '/timetable', '/plan'].includes(n.to))
  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-line bg-bg px-4 py-5 lg:flex" aria-label="Main navigation">
        <div className="mb-7 flex items-center gap-2.5 px-2">
          <KairoMark size={32} />
          <div>
            <p className="font-display text-[21px] leading-none text-ink">Kairo</p>
            <p className="mt-0.5 text-[11px] text-muted">The right moment, every day</p>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cx(
                  'group flex h-10 items-center gap-3 rounded-xl px-3 text-[14.5px] font-medium transition-colors',
                  isActive ? 'bg-surface text-ink shadow-[var(--shadow)]' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cx('size-[18px]', isActive ? 'text-now' : 'text-muted group-hover:text-ink-2')} strokeWidth={2} aria-hidden />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          <MiniTimer />
          <div className="flex items-center justify-between rounded-2xl border border-line bg-surface px-3.5 py-3">
            <LiveClock />
            <span className="flex size-9 items-center justify-center rounded-full bg-surface-2 font-display text-[15px] text-ink" aria-label={`Signed in as ${name}`}>
              {name.slice(0, 1).toUpperCase()}
            </span>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-[color-mix(in_oklab,var(--bg)_88%,transparent)] px-4 backdrop-blur-md lg:hidden">
        <NavLink to="/" className="flex items-center gap-2" aria-label="Kairo home">
          <KairoMark size={28} />
          <span className="font-display text-[19px] text-ink">Kairo</span>
        </NavLink>
        <div className="flex items-center gap-1">
          <LiveClock compact />
          <NavLink to="/insights" aria-label="Insights" className="ml-1 inline-flex size-10 items-center justify-center rounded-xl text-ink-2 hover:bg-surface-2">
            <BarChart3 className="size-[18px]" />
          </NavLink>
          <NavLink to="/settings" aria-label="Settings" className="inline-flex size-10 items-center justify-center rounded-xl text-ink-2 hover:bg-surface-2">
            <Settings className="size-[18px]" />
          </NavLink>
        </div>
      </header>

      <main id="main" className="pb-28 lg:pb-12 lg:pl-[248px]">
        <SimBanner />
        <div className="mx-auto w-full max-w-[1180px] px-4 pt-5 sm:px-6 lg:px-10 lg:pt-9">{children}</div>
      </main>

      <MiniTimer floating />

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-[color-mix(in_oklab,var(--surface)_94%,transparent)] backdrop-blur-md lg:hidden" aria-label="Main navigation">
        <div className="mx-auto grid h-[64px] max-w-md grid-cols-5">
          {mobileNav.map(({ to, label, icon: Icon }) => {
            const center = to === '/study'
            return (
              <NavLink key={to} to={to} end={to === '/'} className="flex flex-col items-center justify-center gap-0.5" aria-label={label}>
                {({ isActive }) =>
                  center ? (
                    <span className={cx('flex size-12 -translate-y-1.5 items-center justify-center rounded-2xl shadow-[var(--shadow-lg)] transition-colors', isActive ? 'bg-now text-white' : 'bg-brand text-brand-ink')}>
                      <Icon className="size-[22px]" strokeWidth={2.2} aria-hidden />
                    </span>
                  ) : (
                    <>
                      <Icon className={cx('size-[21px]', isActive ? 'text-now' : 'text-muted')} strokeWidth={isActive ? 2.3 : 2} aria-hidden />
                      <span className={cx('text-[10.5px] font-semibold', isActive ? 'text-ink' : 'text-muted')}>{label === 'Tasks & exams' ? 'Tasks' : label}</span>
                    </>
                  )
                }
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
