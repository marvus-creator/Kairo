import { Frown, Meh, PartyPopper, Play, Smile, Sparkles, Timer, Watch, Hourglass } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Feeling, SessionType, SrsRating, StartIntent, TimerMode } from '../domain/types'
import { methodFor, SESSION_TYPE_LABEL } from '../engine/modes'
import { intentFromCandidate } from '../engine/plan'
import { rankCandidates, subjectById, type StudyWindow } from '../engine/priority'
import { isSchoolDay } from '../engine/schedule'
import { RATING_LABEL } from '../engine/srs'
import { streaks } from '../engine/stats'
import { formatDuration } from '../engine/time'
import { timerView } from '../engine/timer'
import { useData } from '../hooks/useApp'
import { useStartSession } from '../hooks/useSession'
import { appNow, realNow } from '../store/clock'
import { useStore } from '../store/store'
import { toast, useUI } from '../store/ui'
import { Modal } from '../ui/Dialog'
import { Button, cx, Field, Input, Segmented, Select, SubjectDot, Textarea } from '../ui/primitives'

export function windowNow(data: ReturnType<typeof useData>, now: Date): StudyWindow {
  if (!isSchoolDay(data, now)) return 'weekend'
  const h = now.getHours()
  if (h < 8) return 'morning'
  if (h >= 16 && h < 18) return 'office'
  return 'evening'
}

export function StartDialog({ intent }: { intent?: StartIntent }) {
  const data = useData()
  const close = useUI((s) => s.close)
  const start = useStartSession()
  const now = new Date(appNow())
  const suggestions = useMemo(() => rankCandidates(data, { now, window: windowNow(data, now), fmt: data.preferences.timeFormat }).candidates.slice(0, 4), [data])
  const initial = intent ?? (suggestions[0] ? intentFromCandidate(suggestions[0]) : { title: 'Study session', type: 'review' as SessionType, minutes: 25 })
  const [draft, setDraft] = useState<StartIntent>(initial)
  const [mode, setMode] = useState<TimerMode>(data.preferences.defaultMode)
  const subject = subjectById(data, draft.subjectId)
  const pick = (i: StartIntent) => setDraft(i)

  const go = () => {
    const title = draft.title.trim() || (subject ? `${SESSION_TYPE_LABEL[draft.type]}: ${subject.short}` : 'Study session')
    start({ ...draft, title, method: draft.method ?? methodFor(subject?.category, draft.type) }, mode)
  }

  return (
    <Modal
      title="Start a study session"
      subtitle="Suggested for right now — or choose your own."
      onClose={close}
      footer={
        <>
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button variant="now" size="lg" icon={Play} onClick={go} data-autofocus>Start · {formatDuration(draft.minutes)}</Button>
        </>
      }
    >
      {suggestions.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold tracking-[0.08em] text-muted uppercase"><Sparkles className="size-3.5 text-now" aria-hidden />Recommended for you now</p>
          <div className="flex flex-col gap-1.5">
            {suggestions.map((c) => {
              const i = intentFromCandidate(c)
              const active = draft.title === i.title && draft.subjectId === i.subjectId
              return (
                <button key={c.id} type="button" onClick={() => pick(i)} className={cx('flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors', active ? 'border-now bg-[color-mix(in_oklab,var(--now)_7%,transparent)]' : 'border-line hover:bg-surface-2')}>
                  <SubjectDot color={subjectById(data, c.subjectId)?.color ?? 'var(--muted)'} size={10} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-ink">{c.title}</span>
                    <span className="block truncate text-[12.5px] text-muted">{c.reason}</span>
                  </span>
                  <span className="shrink-0 text-[12.5px] text-muted">{formatDuration(c.minutes)}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Subject">
          {(id) => (
            <Select id={id} value={draft.subjectId ?? ''} onChange={(e) => setDraft((d) => ({ ...d, subjectId: e.target.value || undefined, title: '', taskId: undefined, examId: undefined, planKey: undefined, method: undefined }))}>
              <option value="">No subject / general</option>
              {data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Session type">
          {(id) => (
            <Select id={id} value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as SessionType, method: undefined }))}>
              {(Object.keys(SESSION_TYPE_LABEL) as SessionType[]).map((t) => <option key={t} value={t}>{SESSION_TYPE_LABEL[t]}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Task" className="sm:col-span-2">
          {(id) => <Input id={id} placeholder={subject ? `${SESSION_TYPE_LABEL[draft.type]}: ${subject.short}` : 'What will you do?'} value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />}
        </Field>
        <Field label="Topic (optional)" className="sm:col-span-2">
          {(id) => (
            <>
              <Input id={id} list="topic-list" placeholder="e.g. Linked lists" value={draft.topicName ?? ''} onChange={(e) => setDraft((d) => ({ ...d, topicName: e.target.value || undefined, topicId: undefined }))} />
              <datalist id="topic-list">{data.topics.filter((t) => !draft.subjectId || t.subjectId === draft.subjectId).map((t) => <option key={t.id} value={t.name} />)}</datalist>
            </>
          )}
        </Field>
      </div>
      <div className="mt-4 flex flex-col gap-3">
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-ink-2">Duration</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {[15, 25, 30, 45, 60, 90].map((m) => (
              <button key={m} type="button" onClick={() => setDraft((d) => ({ ...d, minutes: m }))} className={cx('h-9 rounded-xl px-3 text-[13px] font-semibold', draft.minutes === m ? 'bg-ink text-bg' : 'bg-surface-2 text-ink-2 hover:text-ink')}>{formatDuration(m)}</button>
            ))}
            <Input type="number" min={1} max={300} aria-label="Custom minutes" className="h-9 w-20" value={draft.minutes} onChange={(e) => setDraft((d) => ({ ...d, minutes: Math.max(1, Math.min(300, Number(e.target.value) || 1)) }))} />
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-ink-2">Timer</p>
          <Segmented label="Timer mode" value={mode} onChange={setMode} options={[{ value: 'countdown', label: 'Countdown', icon: Hourglass }, { value: 'pomodoro', label: `Pomodoro ${data.preferences.focusMin}/${data.preferences.shortBreakMin}`, icon: Timer }, { value: 'stopwatch', label: 'Stopwatch', icon: Watch }]} />
        </div>
        {(draft.method || subject) && <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-[13.5px] text-ink-2"><span className="font-semibold text-ink">How: </span>{draft.method ?? methodFor(subject?.category, draft.type)}</p>}
      </div>
    </Modal>
  )
}

const FEELINGS: { value: Feeling; label: string; icon: typeof Smile }[] = [
  { value: 'great', label: 'Great', icon: Smile },
  { value: 'okay', label: 'Okay', icon: Meh },
  { value: 'difficult', label: 'Difficult', icon: Frown },
]

export function CompleteDialog() {
  const close = useUI((s) => s.close)
  const timer = useStore((s) => s.timer)
  const prefs = useStore((s) => s.preferences)
  const finish = useStore((s) => s.finishSession)
  const tasks = useStore((s) => s.tasks)
  const data = useData()
  const [feeling, setFeeling] = useState<Feeling | undefined>()
  const [rating, setRating] = useState<SrsRating | undefined>()
  const [note, setNote] = useState('')
  const [topic, setTopic] = useState(timer?.intent.topicName ?? '')
  const task = tasks.find((t) => t.id === timer?.intent.taskId)
  const [taskDone, setTaskDone] = useState(false)
  if (!timer) return null
  const view = timerView(timer, realNow(), prefs)
  const focusMin = Math.max(1, Math.round(view.focusMs / 60000))
  const subject = subjectById(data, timer.intent.subjectId)

  const save = () => {
    const session = finish({ feeling, rating, note, topicName: topic, markTaskDone: taskDone })
    close()
    if (!session) return
    const after = { ...data, sessions: [...data.sessions, session] }
    const s = streaks(after, new Date(appNow()))
    toast({
      title: `${formatDuration(session.focusMin)} logged`,
      body: s.current > 1 ? `${s.current}-day streak. Consistency beats cramming.` : 'Every session counts. Keep showing up.',
      tone: 'success',
    })
  }

  return (
    <Modal
      title="How did this session go?"
      subtitle={`${timer.intent.title} · ${formatDuration(focusMin)} focused`}
      onClose={close}
      footer={
        <>
          <Button variant="ghost" onClick={close}>Keep studying</Button>
          <Button variant="primary" size="lg" icon={PartyPopper} onClick={save}>Complete session</Button>
        </>
      }
    >
      <div className="pop mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--good)_15%,transparent)] text-good">
        <PartyPopper className="size-7" aria-hidden />
      </div>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="How did it go">
        {FEELINGS.map((f) => (
          <button key={f.value} type="button" role="radio" aria-checked={feeling === f.value} onClick={() => setFeeling(f.value)} className={cx('flex flex-col items-center gap-1.5 rounded-2xl border py-3 text-[13.5px] font-semibold transition-colors', feeling === f.value ? 'border-now bg-[color-mix(in_oklab,var(--now)_8%,transparent)] text-ink' : 'border-line text-ink-2 hover:bg-surface-2')}>
            <f.icon className={cx('size-6', feeling === f.value ? 'text-now' : 'text-muted')} aria-hidden />
            {f.label}
          </button>
        ))}
      </div>

      {subject && (
        <div className="mt-5">
          <Field label={`Topic in ${subject.short}`} hint="Naming the topic lets Kairo schedule reviews for you.">
            {(id) => (
              <>
                <Input id={id} list="complete-topics" placeholder="e.g. Recursion" value={topic} onChange={(e) => setTopic(e.target.value)} />
                <datalist id="complete-topics">{data.topics.filter((t) => t.subjectId === subject.id).map((t) => <option key={t.id} value={t.name} />)}</datalist>
              </>
            )}
          </Field>
          {topic.trim() && (
            <div className="mt-3">
              <p className="mb-1.5 text-[13px] font-medium text-ink-2">How well do you know it now?</p>
              <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Recall rating">
                {(['again', 'hard', 'good', 'easy'] as SrsRating[]).map((r) => (
                  <button key={r} type="button" role="radio" aria-checked={rating === r} onClick={() => setRating(r)} className={cx('rounded-xl border px-1 py-2 text-[12.5px] font-semibold', rating === r ? 'border-ink bg-ink text-bg' : 'border-line text-ink-2 hover:bg-surface-2')}>
                    {RATING_LABEL[r]}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[12px] text-muted">Kairo schedules the next review: sooner if it was hard, later if it was easy.</p>
            </div>
          )}
        </div>
      )}

      {task && (
        <label className="mt-4 flex items-center gap-2.5 rounded-xl bg-surface-2 px-3 py-2.5 text-[14px] text-ink">
          <input type="checkbox" className="size-4 accent-[var(--now)]" checked={taskDone} onChange={(e) => setTaskDone(e.target.checked)} />
          “{task.title}” is finished
        </label>
      )}

      <Field label="What should you remember from this session? (optional)" className="mt-4">
        {(id) => <Textarea id={id} maxLength={280} placeholder="One line is enough." value={note} onChange={(e) => setNote(e.target.value)} />}
      </Field>
    </Modal>
  )
}
