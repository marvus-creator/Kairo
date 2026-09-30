import { ArrowLeft, ArrowRight, Bell, Check, Moon, Sparkles } from 'lucide-react'
import { useMemo, useState, type CSSProperties } from 'react'
import { DEFAULT_ROUTINE } from '../data/seed'
import type { RoutineBlock } from '../domain/types'
import { schoolBlocks } from '../engine/schedule'
import { addDays, formatDuration, formatHHMM, fromMin, toMin, WEEKDAY_NAMES } from '../engine/time'
import { useData } from '../hooks/useApp'
import { notificationSupport, requestPermission } from '../lib/notify'
import { useStore } from '../store/store'
import { KairoMark } from '../ui/icons'
import { Button, cx, Field, Input, Switch } from '../ui/primitives'

interface Day {
  wake: string
  morning: boolean
  home: string
  studyStart: string
  studyEnd: string
  bedtime: string
}

export function buildRoutine(d: Day): RoutineBlock[] {
  const wake = toMin(d.wake)
  const r = DEFAULT_ROUTINE.map((x) => ({ ...x }))
  const set = (id: string, p: Partial<RoutineBlock>) => {
    const i = r.findIndex((x) => x.id === id)
    if (i >= 0) r[i] = { ...r[i], ...p }
  }
  set('r-sleep-school', { start: d.bedtime, end: d.wake })
  const morningEnd = fromMin(wake + 60)
  if (d.morning) set('r-morning', { start: fromMin(wake + 15), end: morningEnd })
  set('r-ready', { start: d.morning ? morningEnd : fromMin(wake), end: '07:30' })
  set('r-commute', { end: d.home })
  set('r-home', { start: d.home, end: d.studyStart })
  set('r-evening', { start: d.studyStart, end: d.studyEnd })
  set('r-wind', { start: d.studyEnd, end: d.bedtime })
  return r.filter((x) => (x.id === 'r-morning' ? d.morning : true)).filter((x) => x.id !== 'r-wind' || toMin(d.bedtime) > toMin(d.studyEnd))
}

function sleepMinutes(d: Day) {
  let m = toMin(d.wake) - toMin(d.bedtime)
  if (m <= 0) m += 1440
  return m
}

export function Onboarding() {
  const data = useData()
  const complete = useStore((s) => s.completeOnboarding)
  const [step, setStep] = useState(0)
  const [name, setName] = useState(data.profile.name)
  const [day, setDay] = useState<Day>({ wake: '03:30', morning: true, home: '20:00', studyStart: '21:00', studyEnd: '22:50', bedtime: '23:00' })
  const [target, setTarget] = useState(7.5)
  const [weak, setWeak] = useState<string[]>([])
  const [goal, setGoal] = useState(10)
  const [samples, setSamples] = useState(true)
  const [perm, setPerm] = useState(notificationSupport().permission)
  const sleep = sleepMinutes(day)
  const short = target * 60 - sleep
  const steps = ['Welcome', 'Your day', 'Timetable', 'Subjects', 'Reminders']
  const fmt = data.preferences.timeFormat
  const monday = useMemo(() => {
    const d = new Date()
    return addDays(d, -((d.getDay() + 6) % 7))
  }, [])

  const finish = () => complete({ name, routine: buildRoutine(day), sleepTargetMin: Math.round(target * 60), weeklyGoalMin: goal * 60, weakSubjects: weak, includeSamples: samples })

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4 py-8">
      <div className="w-full max-w-xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <KairoMark size={34} />
            <span className="font-display text-[22px] text-ink">Kairo</span>
          </div>
          <ol className="flex gap-1.5" aria-label="Setup progress">
            {steps.map((s, i) => (
              <li key={s} aria-current={i === step ? 'step' : undefined} className={cx('h-1.5 rounded-full transition-all', i === step ? 'w-7 bg-now' : i < step ? 'w-3 bg-ink' : 'w-3 bg-line')}>
                <span className="sr-only">{s}</span>
              </li>
            ))}
          </ol>
        </div>

        <div key={step} className="card rise p-6 sm:p-8">
          {step === 0 && (
            <div>
              <h1 className="font-display text-[34px] leading-[1.1] text-ink sm:text-[40px]">Open it. Know what to do.</h1>
              <p className="mt-3 text-[15.5px] leading-relaxed text-ink-2">Kairo reads your timetable, the clock and your workload, then tells you what deserves your time right now: class, study, rest, or preparing for tomorrow.</p>
              <Field label="What should Kairo call you?" className="mt-6">{(id) => <Input id={id} data-autofocus value={name} onChange={(e) => setName(e.target.value)} />}</Field>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="font-display text-[28px] text-ink">Your real day</h2>
              <p className="mt-1 text-[14.5px] text-ink-2">School runs from devotion at 7:30 to Office Hours ending at 5:20. Tell Kairo about the rest.</p>
              <div className="mt-5 grid grid-cols-2 gap-4">
                <Field label="Wake up">{(id) => <Input id={id} type="time" value={day.wake} onChange={(e) => e.target.value && setDay({ ...day, wake: e.target.value })} />}</Field>
                <Field label="Home by">{(id) => <Input id={id} type="time" value={day.home} onChange={(e) => e.target.value && setDay({ ...day, home: e.target.value })} />}</Field>
                <Field label="Evening study from">{(id) => <Input id={id} type="time" value={day.studyStart} onChange={(e) => e.target.value && setDay({ ...day, studyStart: e.target.value })} />}</Field>
                <Field label="Evening study until">{(id) => <Input id={id} type="time" value={day.studyEnd} onChange={(e) => e.target.value && setDay({ ...day, studyEnd: e.target.value })} />}</Field>
                <Field label="Bedtime">{(id) => <Input id={id} type="time" value={day.bedtime} onChange={(e) => e.target.value && setDay({ ...day, bedtime: e.target.value })} />}</Field>
                <Field label="Sleep target (hours)">{(id) => <Input id={id} type="number" min={5} max={11} step={0.5} value={target} onChange={(e) => setTarget(Number(e.target.value) || 7.5)} />}</Field>
              </div>
              <Switch checked={day.morning} onChange={(v) => setDay({ ...day, morning: v })} label="Short morning recall after waking" description="45 minutes of light active recall before getting ready." />
              <div className={cx('mt-4 flex items-start gap-3 rounded-2xl p-4', short > 30 ? 'bg-[color-mix(in_oklab,var(--warn)_12%,transparent)]' : 'bg-[color-mix(in_oklab,var(--good)_10%,transparent)]')}>
                <Moon className={cx('mt-0.5 size-5 shrink-0', short > 30 ? 'text-warn' : 'text-good')} aria-hidden />
                <div className="text-[14px]">
                  <p className="font-semibold text-ink">That gives you {formatDuration(sleep)} of sleep on school nights.</p>
                  {short > 30 ? (
                    <>
                      <p className="mt-1 text-ink-2">That’s {formatDuration(short)} below your target. Kairo will never schedule study into your sleep, and it will show this every day so it stays visible.</p>
                      <Button size="sm" className="mt-2" onClick={() => setDay({ ...day, studyEnd: '22:00', bedtime: '22:15' })}>Try ending study at 10:00 PM</Button>
                    </>
                  ) : (
                    <p className="mt-1 text-ink-2">Sustainable. Good sleep is what makes studying stick.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-display text-[28px] text-ink">Your timetable is loaded</h2>
              <p className="mt-1 text-[14.5px] text-ink-2">From your school timetable, with Physical Education and Career Guidance swapped. You can edit any period later in Settings.</p>
              <div className="mt-5 grid grid-cols-5 gap-1.5">
                {[0, 1, 2, 3, 4].map((i) => {
                  const d = addDays(monday, i)
                  const blocks = schoolBlocks(data, d).filter((b) => b.kind === 'class' || b.kind === 'clubs' || b.kind === 'office-hours')
                  return (
                    <div key={i} className="min-w-0">
                      <p className="mb-1.5 text-center text-[11.5px] font-semibold text-muted uppercase">{WEEKDAY_NAMES[d.getDay()].slice(0, 3)}</p>
                      <div className="flex flex-col gap-1">
                        {blocks.map((b) => {
                          const s = data.subjects.find((x) => x.id === b.subjectId)
                          return (
                            <div key={b.id} className={cx('truncate rounded-md border px-1 py-0.5 text-[10.5px] font-semibold', s ? 'subject-tint subject-text' : 'border-dashed border-line text-muted')} style={{ '--c': s?.color ?? '#888' } as CSSProperties} title={b.label}>
                              {s?.short ?? (b.kind === 'office-hours' ? 'Office Hrs' : 'Clubs')}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="mt-4 text-[13px] text-muted">Classes {formatHHMM('08:00', fmt)} – {formatHHMM('16:20', fmt)} · Office Hours {formatHHMM('16:20', fmt)} – {formatHHMM('17:20', fmt)} every school day.</p>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="font-display text-[28px] text-ink">Which subjects need extra care?</h2>
              <p className="mt-1 text-[14.5px] text-ink-2">Weak subjects get more practice and earlier reviews. Kairo also learns this from how your sessions go.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {data.subjects.filter((s) => s.academic).map((s) => {
                  const on = weak.includes(s.id)
                  return (
                    <button key={s.id} type="button" aria-pressed={on} onClick={() => setWeak(on ? weak.filter((x) => x !== s.id) : [...weak, s.id])} className={cx('inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13.5px] font-medium transition-colors', on ? 'border-now bg-[color-mix(in_oklab,var(--now)_10%,transparent)] text-ink' : 'border-line text-ink-2 hover:bg-surface-2')}>
                      <span className="size-2.5 rounded-full" style={{ background: s.color }} aria-hidden />
                      {s.name}
                      {on && <Check className="size-3.5 text-now" aria-hidden />}
                    </button>
                  )
                })}
              </div>
              <Field label="Weekly study goal (hours)" className="mt-6 max-w-[200px]">{(id) => <Input id={id} type="number" min={1} max={40} value={goal} onChange={(e) => setGoal(Math.max(1, Number(e.target.value) || 1))} />}</Field>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="font-display text-[28px] text-ink">Smart reminders</h2>
              <p className="mt-1 text-[14.5px] text-ink-2">Class in 10 minutes, Office Hours starting, tomorrow’s prep, tests coming up. Never during your sleep.</p>
              <div className="mt-5 rounded-2xl bg-surface-2 p-4">
                {perm === 'granted' ? (
                  <p className="flex items-center gap-2 text-[14.5px] font-semibold text-good"><Check className="size-5" aria-hidden />Notifications enabled</p>
                ) : perm === 'denied' ? (
                  <p className="text-[14px] text-ink-2">Notifications are blocked in this browser. No problem — reminders will show inside Kairo. You can allow them later.</p>
                ) : perm === 'unsupported' ? (
                  <p className="text-[14px] text-ink-2">This browser can’t show notifications. Reminders will show inside Kairo.</p>
                ) : (
                  <Button variant="primary" icon={Bell} onClick={async () => setPerm(await requestPermission())}>Enable notifications</Button>
                )}
              </div>
              <Switch checked={samples} onChange={setSamples} label="Add a few sample tasks to explore" description="Clearly marked “Sample” and removable in one click from Settings." />
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            {step > 0 ? <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep(step - 1)}>Back</Button> : <span />}
            {step < steps.length - 1 ? (
              <Button variant="primary" size="lg" iconRight={ArrowRight} onClick={() => setStep(step + 1)} disabled={step === 0 && !name.trim()}>Continue</Button>
            ) : (
              <Button variant="now" size="lg" icon={Sparkles} onClick={finish}>Open my day</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
