import { Check, Copy, Lock, PenLine, Pencil, Plus, RotateCcw, Sparkles, Trash2, TriangleAlert, Wand2 } from 'lucide-react'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { uid } from '../data/seed'
import type { MyBlock, SessionType } from '../domain/types'
import { SESSION_TYPE_LABEL } from '../engine/modes'
import { autoStudyBlocks, validateMyBlocks } from '../engine/myday'
import { planForBlock } from '../engine/plan'
import { subjectById } from '../engine/priority'
import { timeline, type Block } from '../engine/schedule'
import { addDays, dateKey, formatClock, formatDuration, formatLongDate, fromMin, isDateKey, minuteOfDay, parseKey, startOfDay, toMin } from '../engine/time'
import { useData } from '../hooks/useApp'
import { useNow } from '../store/clock'
import { useStore } from '../store/store'
import { toast } from '../store/ui'
import { Button, Card, cx, Field, Input, SectionTitle, Segmented, Select, SubjectDot } from '../ui/primitives'

const ACTIVITY_PRESETS = ['Rest', 'Exercise', 'Family time', 'Chores', 'Personal project', 'Church', 'Reading']

type Draft = MyBlock

function emptyDraft(defaultStart: string): Draft {
  const s = toMin(defaultStart)
  return { id: '', kind: 'study', start: fromMin(s), end: fromMin(Math.min(s + 45, 1439)), title: '' }
}

export function MyDay() {
  const data = useData()
  const now = useNow('minute')
  const store = useStore()
  const [which, setWhich] = useState<'today' | 'tomorrow' | 'pick'>('today')
  const [picked, setPicked] = useState(dateKey(addDays(now, 2)))
  const day = which === 'today' ? startOfDay(now) : which === 'tomorrow' ? addDays(startOfDay(now), 1) : isDateKey(picked) ? parseKey(picked) : startOfDay(now)
  const key = dateKey(day)
  const plan = data.dayPlans[key]
  const mode = plan?.mode ?? 'auto'
  const mine = plan?.blocks ?? []
  const fmt = data.preferences.timeFormat
  const blocks = useMemo(() => timeline(data, day).filter((b) => b.kind !== 'free'), [data, day])
  const issues = useMemo(() => validateMyBlocks(data, day, mine), [data, day, mine])
  const autoBlocks = useMemo(() => autoStudyBlocks(data, day), [data, day])

  const suggestedStart = useMemo(() => {
    const evening = autoBlocks.find((b) => b.kind === 'evening-study')
    if (key === dateKey(now) && minuteOfDay(now) > 17 * 60) return fromMin(Math.ceil(minuteOfDay(now) / 15) * 15 + 15)
    return evening ? fromMin(minuteOfDay(evening.start)) : '19:00'
  }, [autoBlocks, key, now])

  const [draft, setDraft] = useState<Draft>(() => emptyDraft(suggestedStart))
  useEffect(() => {
    setDraft(emptyDraft(suggestedStart))
  }, [key, suggestedStart])

  const draftIssues = draft.start && draft.end ? validateMyBlocks(data, day, [...mine.filter((b) => b.id !== draft.id), { ...draft, id: draft.id || '__draft' }]).filter((i) => i.id === (draft.id || '__draft')) : []
  const openTasks = data.tasks.filter((t) => t.status !== 'done')

  const save = () => {
    if (toMin(draft.end) <= toMin(draft.start)) {
      toast({ title: 'Check the times', body: 'The block has to end after it starts.', tone: 'warn' })
      return
    }
    if (draft.kind === 'activity' && !draft.title.trim()) {
      toast({ title: 'Name the activity', body: 'For example: Football, Family time, Rest.', tone: 'warn' })
      return
    }
    const block: MyBlock = { ...draft, id: draft.id || uid(), title: draft.title.trim() }
    store.saveMyBlock(key, block)
    if (!plan && block.kind === 'study') store.setDayMode(key, 'mine')
    toast({ title: draft.id ? 'Block updated' : 'Added to your day', body: `${formatClock(parseTime(day, block.start), fmt)} – ${formatClock(parseTime(day, block.end), fmt)} · ${blockTitle(block)}`, tone: 'success' })
    setDraft(emptyDraft(block.end))
  }

  const blockTitle = (b: MyBlock) => b.title || (b.kind === 'study' ? (b.subjectId ? `Study ${subjectById(data, b.subjectId)?.short}` : 'Study — Kairo picks') : 'Activity')

  return (
    <div className="flex flex-col gap-5">
      <header className="rise flex flex-col gap-3">
        <div>
          <p className="text-[13px] font-medium text-muted">{formatLongDate(day)}</p>
          <h1 className="font-display text-[30px] leading-tight text-ink sm:text-[36px]">My Day</h1>
          <p className="mt-1 max-w-2xl text-[15px] text-ink-2">Kairo plans your study automatically. Whenever you want, take over and plan the day yourself — school stays fixed, everything else is yours.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Which day"
            value={which}
            onChange={setWhich}
            options={[
              { value: 'today', label: 'Today' },
              { value: 'tomorrow', label: 'Tomorrow' },
              { value: 'pick', label: 'Pick a day' },
            ]}
          />
          {which === 'pick' && <Input type="date" aria-label="Day to plan" className="h-9 w-auto" value={picked} min={dateKey(now)} onChange={(e) => setPicked(e.target.value)} />}
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Who plans your study">
        {[
          { value: 'auto' as const, icon: Sparkles, title: 'Kairo plans for me', body: 'Study blocks are filled automatically from your timetable, deadlines, tests and reviews.' },
          { value: 'mine' as const, icon: PenLine, title: 'I’ll plan it myself', body: 'Your own study blocks replace the automatic ones for this day. Kairo still reminds and tracks.' },
        ].map((o) => {
          const active = mode === o.value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                store.setDayMode(key, o.value)
                toast({ title: o.value === 'auto' ? 'Kairo is planning your study' : 'You’re planning this day', body: o.value === 'mine' && !mine.some((b) => b.kind === 'study') ? 'Add study blocks below, or copy Kairo’s plan to start from it.' : undefined })
              }}
              className={cx('card flex items-start gap-3 p-4 text-left transition-all', active ? 'ring-2 ring-now' : 'hover:-translate-y-0.5')}
            >
              <span className={cx('flex size-10 shrink-0 items-center justify-center rounded-xl', active ? 'bg-now text-white' : 'bg-surface-2 text-ink-2')}>
                <o.icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-[15.5px] font-semibold text-ink">
                  {o.title}
                  {active && <Check className="size-4 text-now" aria-hidden />}
                </span>
                <span className="mt-0.5 block text-[13.5px] text-muted">{o.body}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          icon={Copy}
          onClick={() => {
            const n = store.copyAutoPlan(key)
            toast({ title: n ? `Copied ${n} blocks from Kairo’s plan` : 'Nothing to copy', body: n ? 'They’re yours now — edit, move or delete any of them.' : 'There are no automatic study blocks on this day.', tone: n ? 'success' : 'warn' })
          }}
        >
          Start from Kairo’s plan
        </Button>
        {plan && (
          <Button
            variant="ghost"
            icon={RotateCcw}
            onClick={() => {
              store.resetDay(key)
              toast({ title: 'Back to Kairo’s plan', body: 'Your custom blocks for this day were removed.' })
            }}
          >
            Reset this day
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="p-5" aria-labelledby="day-timeline">
          <SectionTitle id="day-timeline">The day</SectionTitle>
          {mode === 'mine' && !mine.some((b) => b.kind === 'study') && (
            <p className="mb-3 rounded-xl bg-[color-mix(in_oklab,var(--warn)_10%,transparent)] px-3 py-2 text-[13.5px] text-warn">No study planned yet for this day. Add a block, or copy Kairo’s plan to start from it.</p>
          )}
          <ol className="flex flex-col gap-1">
            {blocks.map((b) => (
              <TimelineRow
                key={b.id}
                block={b}
                now={now}
                fmt={fmt}
                data={data}
                issue={b.mine ? issues.find((i) => i.id === b.mine!.id)?.message : undefined}
                onEdit={b.mine ? () => setDraft({ ...b.mine! }) : undefined}
                onDelete={
                  b.mine
                    ? () => {
                        store.removeMyBlock(key, b.mine!.id)
                        toast({ title: 'Removed', body: b.label })
                      }
                    : undefined
                }
              />
            ))}
          </ol>
          <p className="mt-4 flex items-center gap-1.5 text-[12.5px] text-muted"><Lock className="size-3.5" aria-hidden />School periods are fixed. Your blocks override the routine around them. Change your usual routine in Settings.</p>
        </Card>

        <Card className="h-fit p-5 lg:sticky lg:top-6" aria-labelledby="add-block">
          <SectionTitle id="add-block" icon={draft.id ? Pencil : Plus}>{draft.id ? 'Edit block' : 'Add to your day'}</SectionTitle>
          <div className="flex flex-col gap-4">
            <Segmented
              label="Block type"
              value={draft.kind}
              onChange={(k) => setDraft((d) => ({ ...d, kind: k, title: '' }))}
              options={[
                { value: 'study', label: 'Study' },
                { value: 'activity', label: 'Activity' },
              ]}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Starts">{(id) => <Input id={id} type="time" value={draft.start} onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))} />}</Field>
              <Field label="Ends">{(id) => <Input id={id} type="time" value={draft.end} onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))} />}</Field>
            </div>
            <div className="flex flex-wrap gap-1.5" aria-label="Quick durations">
              {[25, 45, 60, 90].map((m) => (
                <button key={m} type="button" className="rounded-lg bg-surface-2 px-2.5 py-1 text-[12.5px] font-medium text-ink-2 hover:text-ink" onClick={() => setDraft((d) => ({ ...d, end: fromMin(Math.min(toMin(d.start) + m, 1439)) }))}>
                  {formatDuration(m)}
                </button>
              ))}
            </div>

            {draft.kind === 'study' ? (
              <>
                <Field label="Subject" hint={!draft.subjectId && !draft.taskId ? 'Kairo will choose the most valuable work when the block starts.' : undefined}>
                  {(id) => (
                    <Select id={id} value={draft.subjectId ?? ''} onChange={(e) => setDraft((d) => ({ ...d, subjectId: e.target.value || undefined }))}>
                      <option value="">✦ Kairo picks for me</option>
                      {data.subjects.filter((s) => s.academic).map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </Select>
                  )}
                </Field>
                {draft.subjectId && (
                  <>
                    <Field label="Topic (optional)">{(id) => <Input id={id} placeholder="e.g. Binary trees" value={draft.topicName ?? ''} list="myday-topics" onChange={(e) => setDraft((d) => ({ ...d, topicName: e.target.value || undefined }))} />}</Field>
                    <datalist id="myday-topics">
                      {data.topics.filter((t) => t.subjectId === draft.subjectId).map((t) => <option key={t.id} value={t.name} />)}
                    </datalist>
                    <Field label="What kind of session">
                      {(id) => (
                        <Select id={id} value={draft.type ?? 'review'} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as SessionType }))}>
                          {(['prep', 'review', 'practice', 'recall', 'assignment', 'deep', 'exam-prep'] as SessionType[]).map((t) => <option key={t} value={t}>{SESSION_TYPE_LABEL[t]}</option>)}
                        </Select>
                      )}
                    </Field>
                  </>
                )}
                {openTasks.length > 0 && (
                  <Field label="Work on a task (optional)">
                    {(id) => (
                      <Select
                        id={id}
                        value={draft.taskId ?? ''}
                        onChange={(e) => {
                          const t = openTasks.find((x) => x.id === e.target.value)
                          setDraft((d) => ({ ...d, taskId: t?.id, subjectId: t?.subjectId ?? d.subjectId, title: t ? t.title : d.title, type: t ? (t.kind === 'assignment' ? 'assignment' : t.kind === 'project' ? 'project' : 'practice') : d.type }))
                        }}
                      >
                        <option value="">No task</option>
                        {openTasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                      </Select>
                    )}
                  </Field>
                )}
                <Field label="Label (optional)">{(id) => <Input id={id} placeholder={draft.subjectId ? `Study ${subjectById(data, draft.subjectId)?.short}` : 'Study — Kairo picks'} value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />}</Field>
              </>
            ) : (
              <>
                <Field label="Activity">{(id) => <Input id={id} placeholder="e.g. Football, Family time" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />}</Field>
                <div className="flex flex-wrap gap-1.5">
                  {ACTIVITY_PRESETS.map((p) => (
                    <button key={p} type="button" className={cx('rounded-full border px-3 py-1 text-[12.5px] font-medium', draft.title === p ? 'border-now bg-[color-mix(in_oklab,var(--now)_10%,transparent)] text-now' : 'border-line text-ink-2 hover:text-ink')} onClick={() => setDraft((d) => ({ ...d, title: p }))}>
                      {p}
                    </button>
                  ))}
                </div>
              </>
            )}

            {draftIssues.length > 0 && (
              <ul className="flex flex-col gap-1">
                {draftIssues.map((i) => (
                  <li key={i.message} className="flex items-center gap-2 text-[13px] text-warn"><TriangleAlert className="size-3.5 shrink-0" aria-hidden />{i.message}</li>
                ))}
              </ul>
            )}

            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" icon={draft.id ? Check : Plus} onClick={save}>{draft.id ? 'Save changes' : 'Add block'}</Button>
              {draft.id && <Button variant="ghost" onClick={() => setDraft(emptyDraft(suggestedStart))}>Cancel</Button>}
            </div>
          </div>
        </Card>
      </div>

      {mode === 'auto' && autoBlocks.length > 0 && <AutoPreview blocks={autoBlocks} fmt={fmt} />}
    </div>
  )
}

function parseTime(day: Date, hhmm: string) {
  const d = new Date(day)
  const [h, m] = hhmm.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  return d
}

function TimelineRow({ block: b, now, fmt, data, issue, onEdit, onDelete }: { block: Block; now: Date; fmt: '12h' | '24h'; data: ReturnType<typeof useData>; issue?: string; onEdit?: () => void; onDelete?: () => void }) {
  const subject = subjectById(data, b.subjectId)
  const live = b.start <= now && now < b.end
  const isMine = !!b.mine
  const tone = b.school ? 'school' : isMine ? 'mine' : ['morning-study', 'evening-study', 'weekend-study'].includes(b.kind) ? 'auto' : 'routine'
  return (
    <li
      className={cx(
        'flex items-center gap-3 rounded-xl border px-3 py-2.5',
        tone === 'mine' ? 'subject-tint' : 'border-transparent',
        tone === 'auto' && 'bg-[color-mix(in_oklab,var(--now)_7%,transparent)]',
        live && 'ring-2 ring-now',
      )}
      style={{ '--c': subject?.color ?? (b.kind === 'my-activity' ? '#a8681a' : '#d9482b') } as CSSProperties}
    >
      <span className="tabular w-[104px] shrink-0 text-[12.5px] text-muted">{formatClock(b.start, fmt, false)} – {formatClock(b.end, fmt, false)}</span>
      <SubjectDot color={subject?.color ?? (tone === 'school' ? 'var(--line)' : tone === 'routine' ? 'var(--line)' : 'var(--now)')} />
      <span className="min-w-0 flex-1">
        <span className={cx('block truncate text-[14px]', tone === 'routine' || tone === 'school' ? 'text-ink-2' : 'font-semibold text-ink')}>{b.label}</span>
        {issue && <span className="flex items-center gap-1 text-[12px] text-warn"><TriangleAlert className="size-3" aria-hidden />{issue}</span>}
      </span>
      <span className="shrink-0 text-[11px] font-semibold tracking-wide text-muted uppercase">{tone === 'mine' ? 'You' : tone === 'auto' ? 'Kairo' : tone === 'school' ? 'School' : ''}</span>
      {onEdit && (
        <button type="button" aria-label={`Edit ${b.label}`} onClick={onEdit} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-ink"><Pencil className="size-4" /></button>
      )}
      {onDelete && (
        <button type="button" aria-label={`Delete ${b.label}`} onClick={onDelete} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-bad"><Trash2 className="size-4" /></button>
      )}
    </li>
  )
}

function AutoPreview({ blocks, fmt }: { blocks: Block[]; fmt: '12h' | '24h' }) {
  const data = useData()
  return (
    <Card className="p-5" aria-labelledby="auto-prev">
      <SectionTitle id="auto-prev" icon={Wand2}>What Kairo has planned</SectionTitle>
      <div className="grid gap-3 md:grid-cols-2">
        {blocks.map((b) => {
          const { items } = planForBlock(data, b, b.start)
          return (
            <div key={b.id} className="rounded-xl bg-surface-2 p-3">
              <p className="mb-1.5 text-[12.5px] font-medium text-muted">{b.label} · {formatClock(b.start, fmt)} – {formatClock(b.end, fmt)}</p>
              {items.filter((i) => i.type !== 'break').map((i) => (
                <p key={i.key} className="flex items-center gap-2 py-0.5 text-[13.5px] text-ink">
                  <SubjectDot color={subjectById(data, i.subjectId)?.color ?? 'var(--muted)'} />
                  <span className="truncate">{i.title}</span>
                  <span className="ml-auto shrink-0 text-[12px] text-muted">{Math.round((i.end - i.start) / 60000)}m</span>
                </p>
              ))}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
