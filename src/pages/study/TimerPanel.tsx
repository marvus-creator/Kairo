import { CircleStop, Maximize2, Pause, Play, X } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { SESSION_TYPE_LABEL } from '../../engine/modes'
import { formatCountdown, formatDuration } from '../../engine/time'
import { useTimerView } from '../../hooks/useApp'
import { useStore } from '../../store/store'
import { toast, useUI } from '../../store/ui'
import { subjectIcon } from '../../ui/icons'
import { Button, cx, Ring } from '../../ui/primitives'

const PHASE_LABEL = { focus: 'Focus', 'short-break': 'Short break', 'long-break': 'Long break' } as const

export function TimerPanel({ variant = 'page' }: { variant?: 'page' | 'focus' }) {
  const t = useTimerView()
  const subjects = useStore((s) => s.subjects)
  const pause = useStore((s) => s.pauseSession)
  const resume = useStore((s) => s.resumeSession)
  const cancel = useStore((s) => s.cancelSession)
  const open = useUI((s) => s.open)
  const setFocus = useUI((s) => s.setFocus)
  const [confirmCancel, setConfirmCancel] = useState(false)
  if (!t) return null
  const { timer, view } = t
  const subject = subjects.find((s) => s.id === timer.intent.subjectId)
  const Icon = subjectIcon(subject?.icon)
  const onBreak = view.phase && view.phase !== 'focus'
  const big = onBreak ? view.phaseRemainingMs! : timer.mode === 'stopwatch' ? view.elapsedMs : view.overtime && timer.mode === 'countdown' ? view.elapsedMs - timer.plannedMin * 60_000 : timer.mode === 'pomodoro' ? view.phaseRemainingMs! : view.remainingMs!
  const ringValue = timer.mode === 'pomodoro' ? view.progress : timer.mode === 'stopwatch' ? (view.elapsedMs % 3_600_000) / 3_600_000 : view.progress
  const focusMode = variant === 'focus'
  const size = focusMode ? 300 : 248

  return (
    <div className={cx('flex flex-col items-center text-center', !focusMode && 'card rise p-6 sm:p-8')} style={{ '--c': subject?.color ?? 'var(--now)' } as CSSProperties}>
      <div className="flex items-center gap-2 text-[12.5px] font-semibold tracking-[0.12em] text-muted uppercase">
        <span className={cx('size-2 rounded-full', view.running ? 'live-dot bg-now' : 'bg-muted')} aria-hidden />
        {view.running ? (onBreak ? PHASE_LABEL[view.phase!] : 'Focusing') : 'Paused'}
        {timer.mode === 'pomodoro' && ` · Round ${view.cycle}`}
      </div>
      <div className="mt-3 flex items-center gap-2">
        {subject && <Icon className="subject-text size-5" aria-hidden />}
        <p className="text-[15px] font-medium text-ink-2">{subject?.name ?? SESSION_TYPE_LABEL[timer.intent.type]}</p>
      </div>
      <h2 className={cx('mt-1 max-w-lg font-display leading-tight text-ink', focusMode ? 'text-[30px] sm:text-[38px]' : 'text-[26px]')}>{timer.intent.title}</h2>
      {timer.intent.topicName && <p className="mt-1 text-[14px] text-muted">{timer.intent.topicName}</p>}

      <div className="my-7">
        <Ring value={ringValue} size={size} stroke={focusMode ? 10 : 9} color={onBreak ? 'var(--good)' : view.overtime ? 'var(--good)' : 'var(--now)'} label="Session progress">
          <div>
            <p className={cx('tabular font-display leading-none text-ink', focusMode ? 'text-[68px]' : 'text-[56px]')} aria-live="off">
              {view.overtime && timer.mode === 'countdown' ? '+' : ''}
              {formatCountdown(big)}
            </p>
            <p className="mt-2 text-[13px] text-muted">
              {onBreak ? 'Break remaining' : timer.mode === 'stopwatch' ? 'Elapsed' : view.overtime ? 'Over plan — nice' : timer.mode === 'pomodoro' ? 'Left in this round' : 'Remaining'}
            </p>
          </div>
        </Ring>
      </div>

      <div className="grid w-full max-w-sm grid-cols-3 gap-3 text-center">
        <Stat label="Elapsed" value={formatCountdown(view.elapsedMs)} />
        <Stat label="Focused" value={formatDuration(view.focusMs / 60000)} />
        <Stat label="Planned" value={formatDuration(timer.plannedMin)} />
      </div>

      {timer.intent.method && !focusMode && <p className="mt-6 max-w-md rounded-2xl bg-surface-2 px-4 py-3 text-[14px] text-ink-2"><span className="font-semibold text-ink">How: </span>{timer.intent.method}</p>}

      <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
        {view.running ? (
          <Button size="lg" icon={Pause} onClick={pause} aria-keyshortcuts="Space">Pause</Button>
        ) : (
          <Button size="lg" variant="now" icon={Play} onClick={resume} aria-keyshortcuts="Space">Resume</Button>
        )}
        <Button size="lg" variant="primary" icon={CircleStop} onClick={() => open({ kind: 'complete' })}>End session</Button>
        {!focusMode && <Button size="lg" variant="ghost" icon={Maximize2} onClick={() => setFocus(true)} aria-keyshortcuts="F">Focus mode</Button>}
      </div>
      <div className="mt-4 h-8">
        {confirmCancel ? (
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-muted">Discard this session?</span>
            <Button size="sm" variant="danger" onClick={() => { cancel(); setConfirmCancel(false); toast({ title: 'Session cancelled', body: 'Time studied was still counted as a cancelled session.' }) }}>Discard</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmCancel(false)}>Keep going</Button>
          </div>
        ) : (
          <button type="button" className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-bad" onClick={() => setConfirmCancel(true)}>
            <X className="size-3.5" aria-hidden /> Cancel session
          </button>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="tabular text-[16px] font-semibold text-ink">{value}</p>
      <p className="text-[11.5px] text-muted">{label}</p>
    </div>
  )
}

export function FocusMode() {
  const focus = useUI((s) => s.focus)
  const setFocus = useUI((s) => s.setFocus)
  const t = useTimerView()
  if (!focus || !t) return null
  return (
    <div className="fade fixed inset-0 z-[55] flex flex-col bg-bg" role="dialog" aria-modal="true" aria-label="Focus mode">
      <div className="flex justify-end p-4">
        <Button variant="ghost" icon={X} onClick={() => setFocus(false)} aria-keyshortcuts="Escape">Exit focus</Button>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-y-auto px-4 pb-10">
        <TimerPanel variant="focus" />
      </div>
      <div className="h-1 bg-surface-2">
        <div className="bar-fill h-full bg-now" style={{ width: `${Math.round(Math.min(1, t.view.focusMs / (t.timer.plannedMin * 60000)) * 100)}%` }} />
      </div>
    </div>
  )
}
