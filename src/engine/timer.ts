import type { ActiveTimer, PomodoroPhase, Preferences, StartIntent, TimerMode } from '../domain/types'
import { MINUTE } from './time'

type TimerPrefs = Pick<Preferences, 'focusMin' | 'shortBreakMin' | 'longBreakMin' | 'cyclesBeforeLong'>

export function startTimer(intent: StartIntent, mode: TimerMode, appNow: number, realNow: number): ActiveTimer {
  return {
    intent,
    mode,
    startedAt: appNow,
    startedAtReal: realNow,
    accumulatedMs: 0,
    runningSince: realNow,
    plannedMin: Math.max(1, Math.round(intent.minutes)),
    focusMs: 0,
    pomodoro: mode === 'pomodoro' ? { phase: 'focus', cycle: 1, phaseStartedMs: 0 } : undefined,
  }
}

export function elapsedMs(t: ActiveTimer, realNow: number): number {
  return Math.max(0, t.accumulatedMs + (t.runningSince !== null ? realNow - t.runningSince : 0))
}

export function pauseTimer(t: ActiveTimer, realNow: number): ActiveTimer {
  if (t.runningSince === null) return t
  return { ...t, accumulatedMs: elapsedMs(t, realNow), runningSince: null }
}

export function resumeTimer(t: ActiveTimer, realNow: number): ActiveTimer {
  if (t.runningSince !== null) return t
  return { ...t, runningSince: realNow }
}

export function phaseLengthMs(phase: PomodoroPhase, prefs: TimerPrefs): number {
  const min = phase === 'focus' ? prefs.focusMin : phase === 'short-break' ? prefs.shortBreakMin : prefs.longBreakMin
  return Math.max(1, min) * MINUTE
}

export interface PhaseChange {
  from: PomodoroPhase
  to: PomodoroPhase
  cycle: number
}

export function advancePomodoro(t: ActiveTimer, realNow: number, prefs: TimerPrefs): { timer: ActiveTimer; changes: PhaseChange[] } {
  if (t.mode !== 'pomodoro' || !t.pomodoro) return { timer: t, changes: [] }
  const elapsed = elapsedMs(t, realNow)
  let { phase, cycle, phaseStartedMs } = t.pomodoro
  let focusMs = t.focusMs
  const changes: PhaseChange[] = []
  let guard = 0
  while (elapsed - phaseStartedMs >= phaseLengthMs(phase, prefs) && guard++ < 500) {
    const len = phaseLengthMs(phase, prefs)
    const from = phase
    if (phase === 'focus') {
      focusMs += len
      phase = cycle % Math.max(1, prefs.cyclesBeforeLong) === 0 ? 'long-break' : 'short-break'
    } else {
      phase = 'focus'
      cycle += 1
    }
    phaseStartedMs += len
    changes.push({ from, to: phase, cycle })
  }
  if (!changes.length) return { timer: t, changes }
  return { timer: { ...t, focusMs, pomodoro: { phase, cycle, phaseStartedMs } }, changes }
}

export interface TimerView {
  elapsedMs: number
  remainingMs: number | null
  progress: number
  focusMs: number
  overtime: boolean
  running: boolean
  phase?: PomodoroPhase
  phaseRemainingMs?: number
  cycle?: number
}

export function timerView(t: ActiveTimer, realNow: number, prefs: TimerPrefs): TimerView {
  const { timer } = advancePomodoro(t, realNow, prefs)
  const elapsed = elapsedMs(timer, realNow)
  const running = timer.runningSince !== null
  const plannedMs = timer.plannedMin * MINUTE
  if (timer.mode === 'pomodoro' && timer.pomodoro) {
    const len = phaseLengthMs(timer.pomodoro.phase, prefs)
    const inPhase = elapsed - timer.pomodoro.phaseStartedMs
    const focusMs = timer.focusMs + (timer.pomodoro.phase === 'focus' ? inPhase : 0)
    return {
      elapsedMs: elapsed,
      remainingMs: Math.max(0, plannedMs - focusMs),
      progress: Math.min(1, inPhase / len),
      focusMs,
      overtime: focusMs >= plannedMs,
      running,
      phase: timer.pomodoro.phase,
      phaseRemainingMs: Math.max(0, len - inPhase),
      cycle: timer.pomodoro.cycle,
    }
  }
  if (timer.mode === 'stopwatch') {
    return { elapsedMs: elapsed, remainingMs: null, progress: Math.min(1, elapsed / plannedMs), focusMs: elapsed, overtime: false, running }
  }
  return {
    elapsedMs: elapsed,
    remainingMs: Math.max(0, plannedMs - elapsed),
    progress: Math.min(1, elapsed / plannedMs),
    focusMs: elapsed,
    overtime: elapsed >= plannedMs,
    running,
  }
}
