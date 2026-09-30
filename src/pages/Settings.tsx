import { Bell, BellOff, CalendarDays, Database, Download, FlaskConical, Moon, Palette, Plus, RotateCcw, Timer, Trash2, Upload, User, BookOpen, Smartphone } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { PeriodKind, RoutineKind, SchoolPeriod, TimerMode, Weekday } from '../domain/types'
import { schoolNightSleepMin } from '../engine/recommend'
import { addDays, dateKey, formatDuration, formatLongDate, formatClock, toMin, WEEKDAY_NAMES } from '../engine/time'
import { useData } from '../hooks/useApp'
import { notificationSupport, requestPermission, showSystem } from '../lib/notify'
import { appNow, isSimulating, parseSimParam, setSimulation, useNow } from '../store/clock'
import { useStore } from '../store/store'
import { toast } from '../store/ui'
import { Button, Card, cx, Field, Input, Segmented, Select, Switch } from '../ui/primitives'

function Section({ id, icon: Icon, title, description, children }: { id: string; icon: typeof User; title: string; description?: string; children: ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-20 p-5 sm:p-6" aria-labelledby={`${id}-t`}>
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-2"><Icon className="size-[18px]" aria-hidden /></span>
        <div>
          <h2 id={`${id}-t`} className="text-[17px] font-semibold text-ink">{title}</h2>
          {description && <p className="text-[13.5px] text-muted">{description}</p>}
        </div>
      </div>
      {children}
    </Card>
  )
}

const ROUTINE_KINDS: { value: RoutineKind; label: string }[] = [
  { value: 'sleep', label: 'Sleep' },
  { value: 'morning-study', label: 'Morning study' },
  { value: 'get-ready', label: 'Get ready' },
  { value: 'commute', label: 'Commute' },
  { value: 'home', label: 'Home' },
  { value: 'evening-study', label: 'Evening study' },
  { value: 'weekend-study', label: 'Weekend study' },
  { value: 'wind-down', label: 'Wind down' },
  { value: 'free', label: 'Free' },
]

const WHEN_LABEL = {
  'school-day': 'School days',
  'off-day': 'Days off & weekends',
  'before-school-day': 'Nights before school',
  'before-off-day': 'Nights before a day off',
  'every-day': 'Every day',
} as const

const NAV = [
  ['profile', 'Profile'],
  ['routine', 'Routine & sleep'],
  ['timetable', 'Timetable'],
  ['subjects', 'Subjects'],
  ['study', 'Study'],
  ['notifications', 'Notifications'],
  ['appearance', 'Appearance'],
  ['data', 'Data'],
  ['developer', 'Developer'],
] as const

export function Settings() {
  const data = useData()
  const s = useStore()
  const now = useNow('minute')
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [editDay, setEditDay] = useState<Weekday>(1)
  const [support, setSupport] = useState(notificationSupport())
  const [simInput, setSimInput] = useState('')
  const sleepMin = schoolNightSleepMin(data)
  const p = data.preferences
  const n = data.notifications

  useEffect(() => {
    if (window.location.hash) setTimeout(() => document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [])

  const exportData = () => {
    const blob = new Blob([s.exportJSON()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kairo-backup-${dateKey(new Date())}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast({ title: 'Backup downloaded', body: 'Keep it somewhere safe — it contains all your study data.', tone: 'success' })
  }

  const importData = async (file: File) => {
    const text = await file.text()
    const res = s.importJSON(text)
    toast(res.ok ? { title: 'Backup restored', tone: 'success' } : { title: 'Import failed', body: res.error, tone: 'warn' })
  }

  const periods = data.school.periods.filter((x) => x.weekday === editDay).sort((a, b) => toMin(a.start) - toMin(b.start))

  return (
    <div className="flex flex-col gap-5">
      <header className="rise">
        <h1 className="font-display text-[30px] leading-tight text-ink sm:text-[36px]">Settings</h1>
        <p className="mt-1 text-[15px] text-ink-2">Everything Kairo uses to plan your day. Saved on this device automatically.</p>
      </header>
      <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1 scrollbar-none" aria-label="Settings sections">
        {NAV.map(([id, label]) => (
          <a key={id} href={`#${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }) }} className="shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-ink-2 hover:text-ink">{label}</a>
        ))}
      </nav>

      <Section id="profile" icon={User} title="Profile">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name">{(id) => <Input id={id} value={data.profile.name} onChange={(e) => s.updateProfile({ name: e.target.value })} />}</Field>
          <Field label="School name">{(id) => <Input id={id} value={data.school.name} onChange={(e) => s.updateSchool({ name: e.target.value })} />}</Field>
          <Field label="Time zone" hint="Kairo always follows your device’s clock and time zone.">{(id) => <Input id={id} value={Intl.DateTimeFormat().resolvedOptions().timeZone} readOnly />}</Field>
          <Field label="Arrive at school by">{(id) => <Input id={id} type="time" value={data.school.arrival} onChange={(e) => e.target.value && s.updateSchool({ arrival: e.target.value })} />}</Field>
        </div>
      </Section>

      <Section id="routine" icon={Moon} title="Daily routine & sleep" description="Your usual day. To change just one day, use My Day instead.">
        {sleepMin !== null && (
          <div className={cx('mb-4 rounded-2xl px-4 py-3 text-[14px]', sleepMin < p.sleepTargetMin - 30 ? 'bg-[color-mix(in_oklab,var(--warn)_12%,transparent)] text-ink' : 'bg-[color-mix(in_oklab,var(--good)_10%,transparent)] text-ink')}>
            <p className="font-semibold">School nights: {formatDuration(sleepMin)} of sleep planned · target {formatDuration(p.sleepTargetMin)}</p>
            {sleepMin < p.sleepTargetMin - 30 && <p className="mt-0.5 text-[13px] text-ink-2">That’s {formatDuration(p.sleepTargetMin - sleepMin)} short every school night. Ending evening study earlier or waking a little later protects your memory and focus more than extra study time does.</p>}
          </div>
        )}
        <div className="mb-4 max-w-xs">
          <Field label="Sleep target (hours)">{(id) => <Input id={id} type="number" min={5} max={11} step={0.5} value={p.sleepTargetMin / 60} onChange={(e) => s.updatePreferences({ sleepTargetMin: Math.round(Math.min(11, Math.max(5, Number(e.target.value) || 7.5)) * 60) })} />}</Field>
        </div>
        <ul className="flex flex-col divide-y divide-line">
          {data.routine.map((r) => (
            <li key={r.id} className="grid grid-cols-2 items-end gap-2 py-3 sm:grid-cols-[1.4fr_1fr_1fr_1.3fr_auto]">
              <Field label="Label" className="col-span-2 sm:col-span-1">{(id) => <Input id={id} value={r.label} onChange={(e) => s.updateRoutine(r.id, { label: e.target.value })} />}</Field>
              <Field label="From">{(id) => <Input id={id} type="time" value={r.start} onChange={(e) => e.target.value && s.updateRoutine(r.id, { start: e.target.value })} />}</Field>
              <Field label="To">{(id) => <Input id={id} type="time" value={r.end} onChange={(e) => e.target.value && s.updateRoutine(r.id, { end: e.target.value })} />}</Field>
              <Field label="When">
                {(id) => (
                  <Select id={id} value={r.when} onChange={(e) => s.updateRoutine(r.id, { when: e.target.value as typeof r.when })}>
                    {Object.entries(WHEN_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                )}
              </Field>
              <Button variant="ghost" size="sm" icon={Trash2} aria-label={`Remove ${r.label}`} className="h-11" onClick={() => s.setRoutine(data.routine.filter((x) => x.id !== r.id))} />
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <Select aria-label="Add routine block" className="h-10 w-auto" value="" onChange={(e) => { if (!e.target.value) return; const kind = e.target.value as RoutineKind; s.setRoutine([...data.routine, { id: `r-${Date.now()}`, kind, label: ROUTINE_KINDS.find((k) => k.value === kind)!.label, start: '18:00', end: '19:00', when: kind === 'weekend-study' ? 'off-day' : 'school-day' }]) }}>
            <option value="">+ Add a routine block…</option>
            {ROUTINE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </Select>
        </div>
      </Section>

      <Section id="timetable" icon={CalendarDays} title="School timetable" description="Your real timetable drives everything. Edit a period and the whole app updates.">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Segmented label="Day" value={String(editDay) as '1'} onChange={(v) => setEditDay(Number(v) as Weekday)} options={[1, 2, 3, 4, 5].map((d) => ({ value: String(d) as '1', label: WEEKDAY_NAMES[d].slice(0, 3) }))} />
          <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => { s.resetTimetable(); toast({ title: 'Timetable restored', body: 'Back to the timetable Kairo shipped with.' }) }}>Restore original</Button>
        </div>
        <ul className="flex flex-col gap-2">
          {periods.map((per) => <PeriodRow key={per.id} period={per} />)}
        </ul>
        <Button size="sm" className="mt-3" icon={Plus} onClick={() => { const last = periods[periods.length - 1]; s.addPeriod({ weekday: editDay, start: last?.end ?? '08:00', end: last ? formatClock(new Date(2000, 0, 1, 0, toMin(last.end) + 50), '24h') : '08:50', kind: 'class' }) }}>Add period</Button>
        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-1 text-[14px] font-medium text-ink">Days off</p>
          <p className="mb-2 text-[13px] text-muted">Holidays or no-school days. Kairo switches those days to weekend mode.</p>
          <div className="flex flex-wrap items-center gap-2">
            {data.school.daysOff.sort().map((k) => (
              <button key={k} type="button" className="rounded-full bg-surface-2 px-3 py-1 text-[13px] text-ink hover:text-bad" onClick={() => s.toggleDayOff(k)} aria-label={`Remove day off ${k}`}>{k} ×</button>
            ))}
            <Input type="date" aria-label="Add a day off" className="h-9 w-auto" value="" onChange={(e) => e.target.value && s.toggleDayOff(e.target.value)} />
          </div>
        </div>
      </Section>

      <Section id="subjects" icon={BookOpen} title="Subjects & teachers">
        <ul className="flex flex-col divide-y divide-line">
          {data.subjects.map((sub) => (
            <li key={sub.id} className="grid grid-cols-[auto_1fr] items-center gap-3 py-2.5 sm:grid-cols-[auto_2fr_1.2fr_auto_auto]">
              <input type="color" aria-label={`${sub.name} colour`} className="size-8 cursor-pointer rounded-lg border border-line bg-transparent" value={sub.color} onChange={(e) => s.updateSubject(sub.id, { color: e.target.value })} />
              <Input aria-label="Subject name" className="h-9" value={sub.name} onChange={(e) => s.updateSubject(sub.id, { name: e.target.value })} />
              <Input aria-label="Teacher" className="h-9" placeholder="Teacher" key={`${sub.id}-${sub.teacherId ?? ''}`} defaultValue={data.teachers.find((t) => t.id === sub.teacherId)?.name ?? ''} onBlur={(e) => { const name = e.target.value; if (!name.trim()) { s.updateSubject(sub.id, { teacherId: undefined }); return } const tid = s.addTeacher(name); s.updateSubject(sub.id, { teacherId: tid }) }} />
              <label className="flex items-center gap-2 text-[13px] text-ink-2"><input type="checkbox" className="accent-[var(--now)]" checked={sub.weak} onChange={(e) => s.updateSubject(sub.id, { weak: e.target.checked })} />Weak</label>
              <label className="flex items-center gap-2 text-[13px] text-ink-2"><input type="checkbox" className="accent-[var(--now)]" checked={sub.academic} onChange={(e) => s.updateSubject(sub.id, { academic: e.target.checked })} />Needs study</label>
            </li>
          ))}
        </ul>
        <Button size="sm" className="mt-3" icon={Plus} onClick={() => s.addSubject({ name: 'New subject', short: 'New', color: '#475569', icon: 'cap', category: 'engineering', academic: true, weak: false, notes: '' })}>Add subject</Button>
      </Section>

      <Section id="study" icon={Timer} title="Study preferences">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Weekly study goal (hours)">{(id) => <Input id={id} type="number" min={1} max={60} value={Math.round(p.weeklyGoalMin / 60)} onChange={(e) => s.updatePreferences({ weeklyGoalMin: Math.max(60, Math.min(3600, (Number(e.target.value) || 1) * 60)) })} />}</Field>
          <Field label="Default timer">
            {(id) => (
              <Select id={id} value={p.defaultMode} onChange={(e) => s.updatePreferences({ defaultMode: e.target.value as TimerMode })}>
                <option value="countdown">Countdown</option>
                <option value="pomodoro">Pomodoro</option>
                <option value="stopwatch">Stopwatch</option>
              </Select>
            )}
          </Field>
          <Field label="Pomodoro focus (min)">{(id) => <Input id={id} type="number" min={5} max={120} value={p.focusMin} onChange={(e) => s.updatePreferences({ focusMin: Math.max(5, Number(e.target.value) || 25) })} />}</Field>
          <Field label="Short break (min)">{(id) => <Input id={id} type="number" min={1} max={30} value={p.shortBreakMin} onChange={(e) => s.updatePreferences({ shortBreakMin: Math.max(1, Number(e.target.value) || 5) })} />}</Field>
          <Field label="Long break (min)">{(id) => <Input id={id} type="number" min={5} max={60} value={p.longBreakMin} onChange={(e) => s.updatePreferences({ longBreakMin: Math.max(5, Number(e.target.value) || 15) })} />}</Field>
          <Field label="Rounds before a long break">{(id) => <Input id={id} type="number" min={2} max={8} value={p.cyclesBeforeLong} onChange={(e) => s.updatePreferences({ cyclesBeforeLong: Math.max(2, Number(e.target.value) || 4) })} />}</Field>
        </div>
      </Section>

      <Section id="notifications" icon={Bell} title="Notifications" description="Only the reminders that matter. Everything else stays quiet.">
        <div className={cx('mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3', support.permission === 'granted' ? 'bg-[color-mix(in_oklab,var(--good)_10%,transparent)]' : 'bg-surface-2')}>
          <div className="text-[14px]">
            <p className="font-semibold text-ink">
              {support.permission === 'granted' ? 'Notifications are allowed' : support.permission === 'denied' ? 'Notifications are blocked by the browser' : support.permission === 'unsupported' ? 'This browser can’t show notifications' : 'Notifications are not enabled yet'}
            </p>
            <p className="text-[13px] text-muted">
              {support.permission === 'denied'
                ? 'Allow them in your browser’s site settings. Kairo keeps working — reminders appear inside the app instead.'
                : support.ios && !support.installed
                  ? 'On iPhone, add Kairo to your Home Screen first (Share → Add to Home Screen), then enable notifications.'
                  : 'Reminders fire while Kairo is open or running in the background.'}
            </p>
          </div>
          {support.permission === 'default' && <Button variant="primary" icon={Bell} onClick={async () => { await requestPermission(); setSupport(notificationSupport()) }}>Enable</Button>}
          {support.permission === 'granted' && <Button size="sm" onClick={async () => { const ok = await showSystem('Kairo test', 'Notifications are working.', { tag: 'test' }); toast(ok ? { title: 'Test sent', tone: 'success' } : { title: 'Couldn’t show a notification', tone: 'warn' }) }}>Send a test</Button>}
        </div>
        <Switch checked={n.enabled} onChange={(v) => s.updateNotifications({ enabled: v })} label="Reminders" description="Master switch for all categories below." />
        <div className="grid gap-x-8 sm:grid-cols-2">
          {([
            ['class', 'Classes', 'Before each class starts'],
            ['study', 'Study blocks', 'Office Hours, study blocks, tomorrow prep'],
            ['assignment', 'Assignments', 'The day before and 2 hours before'],
            ['exam', 'Tests & exams', '3 days and the evening before'],
            ['daily', 'Daily plan', 'Get-ready, tomorrow briefing, wind down'],
            ['missed', 'Missed sessions', 'A nudge 15 minutes into a block'],
          ] as const).map(([k, label, desc]) => (
            <Switch key={k} checked={n.categories[k]} onChange={(v) => s.updateNotifications({ categories: { ...n.categories, [k]: v } })} label={label} description={desc} />
          ))}
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <Field label="Remind me before (min)">{(id) => <Input id={id} type="number" min={0} max={60} value={n.leadMin} onChange={(e) => s.updateNotifications({ leadMin: Math.max(0, Math.min(60, Number(e.target.value) || 0)) })} />}</Field>
          <Field label="Quiet hours from">{(id) => <Input id={id} type="time" value={n.quiet.start} onChange={(e) => e.target.value && s.updateNotifications({ quiet: { ...n.quiet, start: e.target.value } })} />}</Field>
          <Field label="Quiet hours until">{(id) => <Input id={id} type="time" value={n.quiet.end} onChange={(e) => e.target.value && s.updateNotifications({ quiet: { ...n.quiet, end: e.target.value } })} />}</Field>
        </div>
        <Switch checked={n.quiet.enabled} onChange={(v) => s.updateNotifications({ quiet: { ...n.quiet, enabled: v } })} label="Quiet hours" description="No reminders during sleep. Timer alerts you started still come through." />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {n.dndUntil && n.dndUntil > appNow() ? (
            <>
              <span className="flex items-center gap-2 text-[14px] text-ink"><BellOff className="size-4 text-now" aria-hidden />Do not disturb until {formatClock(n.dndUntil, p.timeFormat)}</span>
              <Button size="sm" variant="ghost" onClick={() => s.updateNotifications({ dndUntil: null })}>Turn off</Button>
            </>
          ) : (
            <>
              <span className="text-[14px] text-ink-2">Do not disturb:</span>
              <Button size="sm" onClick={() => s.updateNotifications({ dndUntil: appNow() + 3_600_000 })}>1 hour</Button>
              <Button size="sm" onClick={() => { const t = addDays(new Date(appNow()), 1); t.setHours(6, 0, 0, 0); s.updateNotifications({ dndUntil: +t }) }}>Until tomorrow</Button>
            </>
          )}
        </div>
      </Section>

      <Section id="appearance" icon={Palette} title="Appearance">
        <div className="flex flex-col gap-4">
          <div><p className="mb-1.5 text-[13px] font-medium text-ink-2">Theme</p><Segmented label="Theme" value={p.theme} onChange={(v) => s.updatePreferences({ theme: v })} options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} /></div>
          <div><p className="mb-1.5 text-[13px] font-medium text-ink-2">Time format</p><Segmented label="Time format" value={p.timeFormat} onChange={(v) => s.updatePreferences({ timeFormat: v })} options={[{ value: '12h', label: '9:00 PM' }, { value: '24h', label: '21:00' }]} /></div>
          <div><p className="mb-1.5 text-[13px] font-medium text-ink-2">Week starts on</p><Segmented label="Week start" value={String(p.weekStart) as '1'} onChange={(v) => s.updatePreferences({ weekStart: Number(v) as 0 | 1 })} options={[{ value: '1', label: 'Monday' }, { value: '0' as '1', label: 'Sunday' }]} /></div>
        </div>
      </Section>

      <Section id="data" icon={Database} title="Your data" description="Stored only on this device. Back it up regularly.">
        <div className="flex flex-wrap gap-2">
          <Button icon={Download} onClick={exportData}>Export backup (JSON)</Button>
          <Button icon={Upload} onClick={() => fileRef.current?.click()}>Import backup</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importData(f); e.target.value = '' }} />
          {[...data.tasks, ...data.exams, ...data.projects, ...data.topics].some((x) => x.sample) ? (
            <Button variant="ghost" icon={Trash2} onClick={() => { s.removeSamples(); toast({ title: 'Sample data removed', body: 'Only your own data is left.', tone: 'success' }) }}>Remove sample data</Button>
          ) : (
            <Button variant="ghost" icon={Plus} onClick={() => { s.loadSamples(); toast({ title: 'Sample data added', body: 'Marked “Sample” everywhere so it’s easy to spot.' }) }}>Add sample data</Button>
          )}
        </div>
        <div className="mt-5 border-t border-line pt-4">
          {confirmReset ? (
            <div className="flex flex-wrap items-center gap-2 text-[14px]">
              <span className="text-bad">This erases every session, task and setting on this device.</span>
              <Button variant="danger" onClick={() => { s.resetAll(); setConfirmReset(false); toast({ title: 'Kairo was reset' }) }}>Erase everything</Button>
              <Button variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button>
            </div>
          ) : (
            <Button variant="danger" icon={Trash2} onClick={() => setConfirmReset(true)}>Reset all data…</Button>
          )}
        </div>
      </Section>

      <Section id="developer" icon={FlaskConical} title="Developer · time simulation" description="Pretend it’s any day and time to test the plan. Time keeps ticking from there.">
        <p className="mb-3 text-[14px] text-ink">Kairo thinks it’s <span className="font-semibold">{formatLongDate(now)}, {formatClock(now, p.timeFormat)}</span>{isSimulating() && <span className="text-warn"> (simulated)</span>}</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {[
            ['Mon 08:20', 'Mon 8:20 AM'],
            ['Tue 16:25', 'Tue 4:25 PM'],
            ['Wed 20:55', 'Wed 8:55 PM'],
            ['Wed 21:00', 'Wed 9:00 PM'],
            ['Thu 15:45', 'Thu 3:45 PM'],
            ['Fri 17:30', 'Fri 5:30 PM'],
            ['Sun 20:30', 'Sun 8:30 PM'],
            ['Tue 03:50', 'Tue 3:50 AM'],
          ].map(([v, label]) => (
            <Button key={v} size="sm" onClick={() => { const d = parseSimParam(v, new Date()); if (d) setSimulation(d) }}>{label}</Button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Or pick any moment">{(id) => <Input id={id} type="datetime-local" className="w-auto" value={simInput} onChange={(e) => setSimInput(e.target.value)} />}</Field>
          <Button onClick={() => { const d = new Date(simInput); if (!Number.isNaN(+d)) setSimulation(d) }} disabled={!simInput}>Simulate</Button>
          {isSimulating() && <Button variant="primary" onClick={() => setSimulation(null)}>Back to real time</Button>}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-muted"><Smartphone className="size-3.5" aria-hidden />Tip: add <code className="rounded bg-surface-2 px-1">?sim=wed-21:00</code> to the URL to jump straight to a moment.</p>
      </Section>
    </div>
  )
}

function PeriodRow({ period }: { period: SchoolPeriod }) {
  const data = useData()
  const { updatePeriod, removePeriod } = useStore()
  return (
    <li className="grid grid-cols-2 items-center gap-2 rounded-2xl border border-line p-2 sm:grid-cols-[88px_88px_1fr_1.4fr_1fr_auto]">
      <Input aria-label="Start" type="time" className="h-9" value={period.start} onChange={(e) => e.target.value && updatePeriod(period.id, { start: e.target.value })} />
      <Input aria-label="End" type="time" className="h-9" value={period.end} onChange={(e) => e.target.value && updatePeriod(period.id, { end: e.target.value })} />
      <Select aria-label="Kind" className="h-9" value={period.kind} onChange={(e) => updatePeriod(period.id, { kind: e.target.value as PeriodKind })}>
        <option value="class">Class</option>
        <option value="break">Break</option>
        <option value="lunch">Lunch</option>
        <option value="office-hours">Office Hours</option>
        <option value="self-study">Self-study</option>
        <option value="clubs">Clubs</option>
      </Select>
      {period.kind === 'class' ? (
        <Select aria-label="Subject" className="h-9" value={period.subjectId ?? ''} onChange={(e) => { const sub = data.subjects.find((x) => x.id === e.target.value); updatePeriod(period.id, { subjectId: e.target.value || undefined, teacherId: sub?.teacherId }) }}>
          <option value="">Choose subject</option>
          {data.subjects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </Select>
      ) : (
        <Input aria-label="Label" className="h-9" value={period.label ?? ''} placeholder="Label" onChange={(e) => updatePeriod(period.id, { label: e.target.value })} />
      )}
      <Select aria-label="Teacher" className="h-9" value={period.teacherId ?? ''} onChange={(e) => updatePeriod(period.id, { teacherId: e.target.value || undefined })}>
        <option value="">No teacher</option>
        {data.teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </Select>
      <Button variant="ghost" size="sm" icon={Trash2} aria-label="Remove period" onClick={() => removePeriod(period.id)} />
    </li>
  )
}
