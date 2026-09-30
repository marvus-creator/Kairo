import { useEffect, useMemo, useRef } from 'react'
import type { AppData } from '../domain/types'
import { getNowView } from '../engine/recommend'
import { timerView } from '../engine/timer'
import { formatDuration } from '../engine/time'
import { deliver } from '../lib/notify'
import { realNow, useNow, useTick } from '../store/clock'
import { useStore, type Store } from '../store/store'
import { toast, useUI } from '../store/ui'

const DATA_KEYS: (keyof AppData)[] = [
  'version', 'profile', 'preferences', 'notifications', 'school', 'routine', 'teachers', 'subjects', 'topics',
  'tasks', 'exams', 'projects', 'sessions', 'notes', 'timer', 'plans', 'dayPlans', 'missed', 'doneForDay', 'overloaded', 'notifLog',
]

export function useData(): AppData {
  const parts = useStore((s) => s)
  return useMemo(() => {
    const out = {} as Record<string, unknown>
    for (const k of DATA_KEYS) out[k] = parts[k as keyof Store]
    return out as unknown as AppData
  },DATA_KEYS.filter((k) => k !== 'notifLog').map((k) => parts[k as keyof Store]))
}

export function useNowView() {
  const data = useData()
  const now = useNow('minute')
  const view = useMemo(() => getNowView(data, now), [data, now])
  const savePlan = useStore((s) => s.savePlan)
  useEffect(() => {
    const b = view.state.block
    if (view.plan && view.planFresh && now > b.start && now < b.end) savePlan(b.id, view.plan)
  }, [view, now, savePlan])
  return { view, now, data }
}

export function useTimerView() {
  useTick()
  const timer = useStore((s) => s.timer)
  const prefs = useStore((s) => s.preferences)
  return timer ? { timer, view: timerView(timer, realNow(), prefs) } : null
}

export function useTimerEffects() {
  const tick = useTick()
  const lastPhase = useRef<string | null>(null)
  useEffect(() => {
    const s = useStore.getState()
    const t = s.timer
    if (!t) {
      lastPhase.current = null
      return
    }
    if (t.mode === 'pomodoro') {
      const changes = s.tickTimer()
      for (const c of changes.slice(-1)) {
        const title = c.to === 'focus' ? `Break over — focus block ${c.cycle}` : c.to === 'long-break' ? 'Long break — well earned' : 'Focus block done — short break'
        const body = c.to === 'focus' ? t.intent.title : `${s.preferences[c.to === 'long-break' ? 'longBreakMin' : 'shortBreakMin']} minutes. Step away from the screen.`
        void deliver({ id: `pomo:${t.startedAt}:${c.cycle}:${c.to}`, title, body, url: '/study', category: 'study' }, document.visibilityState !== 'visible')
      }
    }
    const v = timerView(useStore.getState().timer!, realNow(), s.preferences)
    if (v.overtime && t.mode !== 'stopwatch' && !t.finishedNotified) {
      s.markTimerFinishedNotified()
      const title = 'Study session complete'
      const body = `${t.intent.title} · ${formatDuration(t.plannedMin)} done. End it when you’re ready.`
      if (document.visibilityState === 'visible') {
        toast({ title, body, tone: 'success', action: { label: 'Finish', run: () => useUI.getState().open({ kind: 'complete' }) } })
      } else {
        void deliver({ id: `timer:${t.startedAt}`, title, body, url: '/study', category: 'study' }, true)
      }
    }
  }, [tick])
}

export function useTheme() {
  const theme = useStore((s) => s.preferences.theme)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const resolved = theme === 'system' ? (mq.matches ? 'dark' : 'light') : theme
      document.documentElement.dataset.theme = resolved
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#0e1011' : '#f5f3ee')
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
}
