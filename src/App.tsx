import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { ExamDialog, NoteDialog, ProjectDialog, ShortcutsDialog, SubjectDialog, TaskDialog } from './dialogs/EditDialogs'
import { CompleteDialog, StartDialog } from './dialogs/SessionDialogs'
import { useTheme, useTimerEffects } from './hooks/useApp'
import { startNotifier } from './lib/notify'
import { Insights } from './pages/Insights'
import { MyDay } from './pages/MyDay'
import { Onboarding } from './pages/Onboarding'
import { Plan } from './pages/Plan'
import { Settings } from './pages/Settings'
import { Study } from './pages/Study'
import { FocusMode } from './pages/study/TimerPanel'
import { Timetable } from './pages/Timetable'
import { Today } from './pages/Today'
import { storageIssues, useStore } from './store/store'
import { toast, useUI } from './store/ui'
import { Shell } from './ui/Shell'
import { Toasts } from './ui/Toasts'

function DialogHost() {
  const dialog = useUI((s) => s.dialog)
  if (!dialog) return null
  switch (dialog.kind) {
    case 'start':
      return <StartDialog intent={dialog.intent} />
    case 'complete':
      return <CompleteDialog />
    case 'task':
      return <TaskDialog dialog={dialog} />
    case 'exam':
      return <ExamDialog dialog={dialog} />
    case 'note':
      return <NoteDialog dialog={dialog} />
    case 'project':
      return <ProjectDialog dialog={dialog} />
    case 'subject':
      return <SubjectDialog subjectId={dialog.subjectId} />
    case 'shortcuts':
      return <ShortcutsDialog />
  }
}

function Shortcuts() {
  const navigate = useNavigate()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable="true"]')) return
      const ui = useUI.getState()
      const s = useStore.getState()
      if (e.key === 'Escape' && ui.focus) {
        ui.setFocus(false)
        return
      }
      if (ui.dialog) return
      const k = e.key.toLowerCase()
      if (e.key === ' ' && s.timer) {
        if (el.closest('button, a')) return
        e.preventDefault()
        if (s.timer.runningSince !== null) s.pauseSession()
        else s.resumeSession()
        return
      }
      const actions: Record<string, () => void> = {
        s: () => (s.timer ? navigate('/study') : ui.open({ kind: 'start' })),
        n: () => ui.open({ kind: 'task' }),
        e: () => ui.open({ kind: 'exam' }),
        q: () => ui.open({ kind: 'note' }),
        f: () => s.timer && ui.setFocus(!ui.focus),
        h: () => navigate('/'),
        m: () => navigate('/day'),
        t: () => navigate('/timetable'),
        p: () => navigate('/plan'),
        i: () => navigate('/insights'),
        ',': () => navigate('/settings'),
        '?': () => ui.open({ kind: 'shortcuts' }),
      }
      const run = actions[e.key === '?' ? '?' : k]
      if (run) {
        e.preventDefault()
        run()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])
  return null
}

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])
  return null
}

let booted = false
function boot() {
  if (booted) return
  booted = true
  const dropped = useStore.getState().housekeeping()
  if (dropped) toast({ title: 'Backlog trimmed', body: `${dropped} old catch-up task${dropped > 1 ? 's were' : ' was'} cleared so your plan stays realistic.` })
  if (storageIssues.corrupt) toast({ title: 'Saved data couldn’t be read', body: 'Kairo started fresh and kept a copy of the damaged data. Import a backup from Settings → Data.', tone: 'warn' })
  if (storageIssues.unavailable) toast({ title: 'Storage is unavailable', body: 'Private mode or blocked storage: changes won’t survive a refresh.', tone: 'warn' })
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const s = useStore.getState()
  if (s.profile.onboarded && s.profile.timezone !== tz) {
    s.updateProfile({ timezone: tz })
    toast({ title: 'Time zone changed', body: `Kairo now follows ${tz}. Your timetable stays in local school time.` })
  }
  startNotifier()
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    const update = registerSW({
      onNeedRefresh() {
        toast({ title: 'A new version of Kairo is ready', action: { label: 'Reload', run: () => void update(true) } })
      },
      onOfflineReady() {
        toast({ title: 'Kairo works offline now', tone: 'success' })
      },
    })
  }
  window.addEventListener('offline', () => toast({ title: 'You’re offline', body: 'Everything keeps working — your data lives on this device.' }))
}

function Effects() {
  useTheme()
  useTimerEffects()
  useEffect(boot, [])
  return null
}

export function App() {
  const onboarded = useStore((s) => s.profile.onboarded)
  return (
    <BrowserRouter>
      <Effects />
      {!onboarded ? (
        <Onboarding />
      ) : (
        <>
          <Shortcuts />
          <ScrollTop />
          <Shell>
            <Routes>
              <Route path="/" element={<Today />} />
              <Route path="/day" element={<MyDay />} />
              <Route path="/timetable" element={<Timetable />} />
              <Route path="/study" element={<Study />} />
              <Route path="/plan" element={<Plan />} />
              <Route path="/insights" element={<Insights />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Shell>
          <DialogHost />
          <FocusMode />
        </>
      )}
      <Toasts />
    </BrowserRouter>
  )
}
