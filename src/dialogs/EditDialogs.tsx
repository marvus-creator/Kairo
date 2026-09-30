import { BookMarked, Check, NotebookPen, Play, Trash2, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import type { Exam, ExamKind, NoteRefType, Priority, Slot, Task, TaskKind } from '../domain/types'
import { methodFor, STUDY_MODES } from '../engine/modes'
import { examPhase, lastStudiedAt, subjectById } from '../engine/priority'
import { RATING_LABEL } from '../engine/srs'
import { addDays, dateKey, daysBetween, formatDuration, formatShortDate, relativeDay } from '../engine/time'
import { useData } from '../hooks/useApp'
import { useStartSession } from '../hooks/useSession'
import { appNow } from '../store/clock'
import { useStore } from '../store/store'
import { toast, useUI, type Dialog } from '../store/ui'
import { Modal } from '../ui/Dialog'
import { Button, Chip, cx, Field, Input, Segmented, Select, SubjectBadge, Switch, Textarea } from '../ui/primitives'

const today = () => dateKey(new Date(appNow()))

export function TaskDialog({ dialog }: { dialog: Extract<Dialog, { kind: 'task' }> }) {
  const data = useData()
  const close = useUI((s) => s.close)
  const { addTask, updateTask, deleteTask } = useStore()
  const existing = data.tasks.find((t) => t.id === dialog.taskId)
  const [t, setT] = useState<Partial<Task>>(
    existing ?? {
      kind: dialog.preset?.kind ?? (dialog.preset?.projectId ? 'project' : 'assignment'),
      title: '',
      subjectId: dialog.preset?.subjectId,
      projectId: dialog.preset?.projectId,
      due: dateKey(addDays(new Date(appNow()), 2)),
      priority: 'medium',
      estMin: 45,
      notes: '',
      slot: 'any',
    },
  )
  const [confirmDup, setConfirmDup] = useState(false)
  const set = (p: Partial<Task>) => setT((x) => ({ ...x, ...p }))
  const dup = !existing && data.tasks.find((x) => x.status !== 'done' && x.title.trim().toLowerCase() === (t.title ?? '').trim().toLowerCase() && (x.subjectId ?? '') === (t.subjectId ?? ''))

  const save = () => {
    if (!t.title?.trim()) {
      toast({ title: 'Give the task a title', tone: 'warn' })
      return
    }
    if (dup && !confirmDup) {
      setConfirmDup(true)
      return
    }
    const payload = {
      kind: (t.kind ?? 'assignment') as TaskKind,
      title: t.title.trim(),
      subjectId: t.kind === 'project' ? undefined : t.subjectId || undefined,
      topicName: t.topicName?.trim() || undefined,
      projectId: t.kind === 'project' ? t.projectId || data.projects[0]?.id : undefined,
      due: t.due || undefined,
      dueTime: t.dueTime || undefined,
      priority: (t.priority ?? 'medium') as Priority,
      estMin: Math.max(5, Number(t.estMin) || 30),
      difficulty: t.difficulty,
      notes: t.notes ?? '',
      slot: (t.slot ?? 'any') as Slot,
    }
    if (existing) updateTask(existing.id, payload)
    else addTask(payload)
    toast({ title: existing ? 'Task updated' : 'Task added', body: payload.due ? `Due ${relativeDay(payload.due, today()).toLowerCase()}` : undefined, tone: 'success' })
    close()
  }

  const isProject = t.kind === 'project'
  return (
    <Modal
      title={existing ? 'Edit task' : 'New task'}
      onClose={close}
      footer={
        <>
          {existing && <Button variant="danger" icon={Trash2} className="mr-auto" onClick={() => { deleteTask(existing.id); toast({ title: 'Task deleted' }); close() }}>Delete</Button>}
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button variant="primary" icon={Check} onClick={save}>{confirmDup ? 'Add anyway' : existing ? 'Save' : 'Add task'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Segmented label="Task type" value={(t.kind === 'catch-up' ? 'study' : t.kind) ?? 'assignment'} onChange={(k) => set({ kind: k })} options={[{ value: 'assignment', label: 'Assignment' }, { value: 'study', label: 'Study plan' }, { value: 'project', label: 'Personal project' }]} />
        <Field label="Title">{(id) => <Input id={id} data-autofocus placeholder={isProject ? 'e.g. Build notification system' : t.kind === 'study' ? 'e.g. Practice traversal problems' : 'e.g. Normalization assignment'} value={t.title ?? ''} onChange={(e) => { set({ title: e.target.value }); setConfirmDup(false) }} />}</Field>
        {dup && (
          <p className="flex items-center gap-2 rounded-xl bg-[color-mix(in_oklab,var(--warn)_10%,transparent)] px-3 py-2 text-[13px] text-warn"><TriangleAlert className="size-4" aria-hidden />A task with this name already exists{dup.due ? ` (due ${formatShortDate(dup.due)})` : ''}.</p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {isProject ? (
            <Field label="Project">
              {(id) => (
                <Select id={id} value={t.projectId ?? data.projects[0]?.id ?? ''} onChange={(e) => set({ projectId: e.target.value })}>
                  {data.projects.length === 0 && <option value="">Create a project first</option>}
                  {data.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              )}
            </Field>
          ) : (
            <Field label="Subject">
              {(id) => (
                <Select id={id} value={t.subjectId ?? ''} onChange={(e) => set({ subjectId: e.target.value || undefined })}>
                  <option value="">None</option>
                  {data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              )}
            </Field>
          )}
          {!isProject && <Field label="Topic (optional)">{(id) => <Input id={id} value={t.topicName ?? ''} placeholder="e.g. Binary trees" onChange={(e) => set({ topicName: e.target.value })} />}</Field>}
          <Field label="Due date">{(id) => <Input id={id} type="date" value={t.due ?? ''} onChange={(e) => set({ due: e.target.value || undefined })} />}</Field>
          <Field label="Due time (optional)">{(id) => <Input id={id} type="time" value={t.dueTime ?? ''} onChange={(e) => set({ dueTime: e.target.value || undefined })} />}</Field>
          <Field label="Estimated time (minutes)">{(id) => <Input id={id} type="number" min={5} step={5} value={t.estMin ?? 30} onChange={(e) => set({ estMin: Number(e.target.value) })} />}</Field>
          <Field label="Priority">
            {(id) => (
              <Select id={id} value={t.priority} onChange={(e) => set({ priority: e.target.value as Priority })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
            )}
          </Field>
          <Field label="Difficulty">
            {(id) => (
              <Select id={id} value={t.difficulty ?? ''} onChange={(e) => set({ difficulty: (e.target.value || undefined) as Task['difficulty'] })}>
                <option value="">Not set</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </Select>
            )}
          </Field>
          <Field label="Best time to do it">
            {(id) => (
              <Select id={id} value={t.slot ?? 'any'} onChange={(e) => set({ slot: e.target.value as Slot })}>
                <option value="any">Whenever it fits</option>
                <option value="office">Office Hours</option>
                <option value="weekend">Weekend</option>
              </Select>
            )}
          </Field>
          {existing && (
            <Field label="Status">
              {(id) => (
                <Select id={id} value={t.status} onChange={(e) => set({ status: e.target.value as Task['status'] })}>
                  <option value="todo">To do</option>
                  <option value="doing">In progress</option>
                  <option value="done">Done</option>
                </Select>
              )}
            </Field>
          )}
        </div>
        <Field label="Notes">{(id) => <Textarea id={id} value={t.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />}</Field>
      </div>
    </Modal>
  )
}

export function ExamDialog({ dialog }: { dialog: Extract<Dialog, { kind: 'exam' }> }) {
  const data = useData()
  const close = useUI((s) => s.close)
  const { addExam, updateExam, deleteExam } = useStore()
  const existing = data.exams.find((e) => e.id === dialog.examId)
  const [e, setE] = useState<Partial<Exam>>(existing ?? { kind: 'test', subjectId: data.subjects.find((s) => s.academic)?.id, title: '', date: dateKey(addDays(new Date(appNow()), 7)), importance: 2, notes: '' })
  const set = (p: Partial<Exam>) => setE((x) => ({ ...x, ...p }))
  const days = e.date ? daysBetween(today(), e.date) : null
  const phase = days !== null ? examPhase(days) : null
  const save = () => {
    if (!e.subjectId || !e.date) {
      toast({ title: 'Pick a subject and date', tone: 'warn' })
      return
    }
    const payload = { kind: (e.kind ?? 'test') as ExamKind, subjectId: e.subjectId, title: e.title?.trim() || subjectById(data, e.subjectId)?.name || 'Exam', date: e.date, time: e.time || undefined, importance: (e.importance ?? 2) as 1 | 2 | 3, notes: e.notes ?? '' }
    if (existing) updateExam(existing.id, payload)
    else addExam(payload)
    toast({ title: existing ? 'Updated' : `${payload.kind[0].toUpperCase() + payload.kind.slice(1)} added`, body: 'Preparation will ramp up automatically as the date gets closer.', tone: 'success' })
    close()
  }
  return (
    <Modal
      title={existing ? 'Edit test or exam' : 'New test or exam'}
      onClose={close}
      footer={
        <>
          {existing && <Button variant="danger" icon={Trash2} className="mr-auto" onClick={() => { deleteExam(existing.id); close() }}>Delete</Button>}
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button variant="primary" icon={Check} onClick={save}>{existing ? 'Save' : 'Add'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Segmented label="Kind" value={e.kind ?? 'test'} onChange={(k) => set({ kind: k })} options={[{ value: 'quiz', label: 'Quiz' }, { value: 'test', label: 'Test' }, { value: 'exam', label: 'Exam' }]} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Subject">
            {(id) => (
              <Select id={id} value={e.subjectId ?? ''} onChange={(ev) => set({ subjectId: ev.target.value })}>
                {data.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Topics covered">{(id) => <Input id={id} data-autofocus placeholder="e.g. Integration techniques" value={e.title ?? ''} onChange={(ev) => set({ title: ev.target.value })} />}</Field>
          <Field label="Date">{(id) => <Input id={id} type="date" value={e.date ?? ''} onChange={(ev) => set({ date: ev.target.value })} />}</Field>
          <Field label="Time (optional)">{(id) => <Input id={id} type="time" value={e.time ?? ''} onChange={(ev) => set({ time: ev.target.value || undefined })} />}</Field>
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-ink-2">Importance</p>
          <Segmented label="Importance" value={String(e.importance ?? 2) as '1' | '2' | '3'} onChange={(v) => set({ importance: Number(v) as 1 | 2 | 3 })} options={[{ value: '1', label: 'Low' }, { value: '2', label: 'Normal' }, { value: '3', label: 'High stakes' }]} />
        </div>
        {phase && <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-[13.5px] text-ink-2">In {days} day{days === 1 ? '' : 's'}: Kairo will schedule <span className="font-semibold text-ink">{phase.label.toLowerCase()}</span> (~{formatDuration(phase.minutes)} sessions), stepping up as it approaches. No all-nighters.</p>}
        <Field label="Notes">{(id) => <Textarea id={id} value={e.notes ?? ''} onChange={(ev) => set({ notes: ev.target.value })} />}</Field>
      </div>
    </Modal>
  )
}

export function NoteDialog({ dialog }: { dialog: Extract<Dialog, { kind: 'note' }> }) {
  const data = useData()
  const close = useUI((s) => s.close)
  const addNote = useStore((s) => s.addNote)
  const [text, setText] = useState('')
  const [ref, setRef] = useState<{ type: NoteRefType; id?: string }>(dialog.ref ?? { type: 'general' })
  const value = ref.type === 'general' ? 'general' : `${ref.type}:${ref.id}`
  return (
    <Modal
      title="Quick note"
      onClose={close}
      footer={
        <>
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button variant="primary" icon={NotebookPen} disabled={!text.trim()} onClick={() => { addNote(text, ref); toast({ title: 'Note saved', tone: 'success' }); close() }}>Save note</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Note">{(id) => <Textarea id={id} data-autofocus maxLength={1000} className="min-h-28" placeholder="Something to remember…" value={text} onChange={(e) => setText(e.target.value)} />}</Field>
        <Field label="Attach to">
          {(id) => (
            <Select id={id} value={value} onChange={(e) => { const [type, rid] = e.target.value.split(':'); setRef(type === 'general' ? { type: 'general' } : { type: type as NoteRefType, id: rid }) }}>
              <option value="general">Nothing — general note</option>
              <optgroup label="Subjects">{data.subjects.map((s) => <option key={s.id} value={`subject:${s.id}`}>{s.name}</option>)}</optgroup>
              {data.topics.length > 0 && <optgroup label="Topics">{data.topics.map((t) => <option key={t.id} value={`topic:${t.id}`}>{t.name} · {subjectById(data, t.subjectId)?.short}</option>)}</optgroup>}
              {data.tasks.some((t) => t.status !== 'done') && <optgroup label="Tasks">{data.tasks.filter((t) => t.status !== 'done').map((t) => <option key={t.id} value={`task:${t.id}`}>{t.title}</option>)}</optgroup>}
              {data.exams.length > 0 && <optgroup label="Exams">{data.exams.map((x) => <option key={x.id} value={`exam:${x.id}`}>{subjectById(data, x.subjectId)?.short} — {x.title}</option>)}</optgroup>}
            </Select>
          )}
        </Field>
      </div>
    </Modal>
  )
}

export function ProjectDialog({ dialog }: { dialog: Extract<Dialog, { kind: 'project' }> }) {
  const data = useData()
  const close = useUI((s) => s.close)
  const { addProject, updateProject, deleteProject } = useStore()
  const existing = data.projects.find((p) => p.id === dialog.projectId)
  const [name, setName] = useState(existing?.name ?? '')
  const [goal, setGoal] = useState(existing?.goal ?? '')
  const colors = ['#1d3b33', '#1d4ed8', '#7e22ce', '#b91c1c', '#c2410c', '#047857', '#0e7490', '#a21caf']
  const [color, setColor] = useState(existing?.color ?? colors[1])
  return (
    <Modal
      title={existing ? 'Edit project' : 'New personal project'}
      subtitle="Personal projects get time when school work is under control — mostly Office Hours and weekends."
      onClose={close}
      footer={
        <>
          {existing && <Button variant="danger" icon={Trash2} className="mr-auto" onClick={() => { deleteProject(existing.id); close() }}>Delete</Button>}
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button variant="primary" icon={Check} disabled={!name.trim()} onClick={() => { if (existing) updateProject(existing.id, { name: name.trim(), goal, color }); else addProject({ name: name.trim(), goal, color }); toast({ title: existing ? 'Project updated' : 'Project added', tone: 'success' }); close() }}>Save</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Project name">{(id) => <Input id={id} data-autofocus placeholder="e.g. Portfolio website" value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Goal">{(id) => <Input id={id} placeholder="What does done look like?" value={goal} onChange={(e) => setGoal(e.target.value)} />}</Field>
        <div className="flex gap-2" role="radiogroup" aria-label="Colour">
          {colors.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={`Colour ${c}`} onClick={() => setColor(c)} className={cx('size-8 rounded-full ring-offset-2 ring-offset-surface', color === c && 'ring-2 ring-ink')} style={{ background: c }} />
          ))}
        </div>
      </div>
    </Modal>
  )
}

export function SubjectDialog({ subjectId }: { subjectId: string }) {
  const data = useData()
  const close = useUI((s) => s.close)
  const open = useUI((s) => s.open)
  const start = useStartSession()
  const { updateSubject, deleteTopic, addTopic } = useStore()
  const subject = subjectById(data, subjectId)
  const [newTopic, setNewTopic] = useState('')
  if (!subject) return null
  const teacher = data.teachers.find((t) => t.id === subject.teacherId)?.name
  const topics = data.topics.filter((t) => t.subjectId === subjectId)
  const sessions = data.sessions.filter((s) => s.subjectId === subjectId && s.status === 'completed').sort((a, b) => b.startedAt - a.startedAt)
  const tasks = data.tasks.filter((t) => t.subjectId === subjectId && t.status !== 'done')
  const exams = data.exams.filter((e) => e.subjectId === subjectId && e.date >= today())
  const notes = data.notes.filter((n) => (n.ref.type === 'subject' && n.ref.id === subjectId) || (n.ref.type === 'topic' && topics.some((t) => t.id === n.ref.id)) || (n.ref.type === 'session' && sessions.some((s) => s.id === n.ref.id)))
  const last = lastStudiedAt(data, subjectId)
  const total = sessions.reduce((n, s) => n + s.focusMin, 0)
  const mode = STUDY_MODES[subject.category]
  const periods = data.school.periods.filter((p) => p.subjectId === subjectId).length

  return (
    <Modal title={subject.name} subtitle={[teacher, `${periods} periods a week`].filter(Boolean).join(' · ')} onClose={close} wide footer={<><Button variant="ghost" icon={NotebookPen} onClick={() => open({ kind: 'note', ref: { type: 'subject', id: subjectId } })}>Add note</Button><Button variant="now" icon={Play} onClick={() => start({ title: `Study ${subject.short}`, subjectId, type: 'practice', minutes: 30, method: methodFor(subject.category, 'practice') })}>Study now</Button></>}>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <SubjectBadge subject={subject} size="lg" />
          <div className="grid flex-1 grid-cols-3 gap-2 text-center">
            <div><p className="tabular text-[17px] font-semibold text-ink">{formatDuration(total)}</p><p className="text-[11.5px] text-muted">studied</p></div>
            <div><p className="tabular text-[17px] font-semibold text-ink">{sessions.length}</p><p className="text-[11.5px] text-muted">sessions</p></div>
            <div><p className="text-[17px] font-semibold text-ink">{last ? relativeDay(dateKey(new Date(last)), today()) : '—'}</p><p className="text-[11.5px] text-muted">last studied</p></div>
          </div>
        </div>
        {subject.academic && <Switch checked={subject.weak} onChange={(v) => updateSubject(subjectId, { weak: v })} label="This is a weak subject for me" description="Weak subjects get more practice time and earlier reviews." />}
        <div>
          <p className="mb-2 text-[12px] font-semibold tracking-[0.08em] text-muted uppercase">How to study it</p>
          <div className="flex flex-wrap gap-1.5">{mode.methods.map((m) => <Chip key={m}>{m}</Chip>)}</div>
        </div>
        <div>
          <p className="mb-2 text-[12px] font-semibold tracking-[0.08em] text-muted uppercase">Topics & reviews</p>
          {topics.length === 0 && <p className="text-[13.5px] text-muted">No topics yet. They’re created when you name a topic after a session, or add one here.</p>}
          <ul className="flex flex-col gap-1">
            {topics.map((t) => (
              <li key={t.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-surface-2">
                <BookMarked className="size-4 text-muted" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{t.name}</span>
                {t.lastRating && <Chip>{RATING_LABEL[t.lastRating]}</Chip>}
                {t.srs ? <span className={cx('text-[12px]', t.srs.due <= today() ? 'font-semibold text-now' : 'text-muted')}>{t.srs.due <= today() ? 'Review due' : `Review ${relativeDay(t.srs.due, today()).toLowerCase()}`}</span> : <span className="text-[12px] text-muted">Not reviewed</span>}
                <button type="button" aria-label={`Delete topic ${t.name}`} className="rounded-lg p-1 text-muted hover:text-bad" onClick={() => deleteTopic(t.id)}><Trash2 className="size-3.5" /></button>
              </li>
            ))}
          </ul>
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (newTopic.trim()) { addTopic(subjectId, newTopic); setNewTopic('') } }}>
            <Input className="h-9" placeholder="Add a topic" aria-label="New topic" value={newTopic} onChange={(e) => setNewTopic(e.target.value)} />
            <Button size="sm" type="submit" className="h-9">Add</Button>
          </form>
        </div>
        {(tasks.length > 0 || exams.length > 0) && (
          <div>
            <p className="mb-2 text-[12px] font-semibold tracking-[0.08em] text-muted uppercase">Coming up</p>
            {exams.map((e) => <p key={e.id} className="py-0.5 text-[13.5px] text-now">{e.kind[0].toUpperCase() + e.kind.slice(1)} · {e.title} · {relativeDay(e.date, today())}</p>)}
            {tasks.map((t) => <p key={t.id} className="py-0.5 text-[13.5px] text-ink">{t.title}{t.due && <span className="text-muted"> · due {relativeDay(t.due, today()).toLowerCase()}</span>}</p>)}
          </div>
        )}
        {sessions.length > 0 && (
          <div>
            <p className="mb-2 text-[12px] font-semibold tracking-[0.08em] text-muted uppercase">Study history</p>
            {sessions.slice(0, 6).map((s) => <p key={s.id} className="py-0.5 text-[13.5px] text-ink-2">{formatShortDate(dateKey(new Date(s.startedAt)))} · {s.title} · {formatDuration(s.focusMin)}{s.feeling && <span className="text-muted"> · {s.feeling}</span>}</p>)}
          </div>
        )}
        {notes.length > 0 && (
          <div>
            <p className="mb-2 text-[12px] font-semibold tracking-[0.08em] text-muted uppercase">Notes</p>
            {notes.slice(0, 8).map((n) => <p key={n.id} className="mb-1 rounded-xl bg-surface-2 px-3 py-2 text-[13.5px] text-ink">{n.text}</p>)}
          </div>
        )}
        <Field label="Subject notes">{(id) => <Textarea id={id} value={subject.notes} placeholder="Anything about this subject: teacher expectations, resources…" onChange={(e) => updateSubject(subjectId, { notes: e.target.value })} />}</Field>
      </div>
    </Modal>
  )
}

export function ShortcutsDialog() {
  const close = useUI((s) => s.close)
  const rows: [string, string][] = [
    ['S', 'Start a study session'],
    ['N', 'New task'],
    ['E', 'New test or exam'],
    ['Q', 'Quick note'],
    ['Space', 'Pause / resume timer'],
    ['F', 'Focus mode'],
    ['H', 'Today'],
    ['M', 'My Day'],
    ['T', 'Timetable'],
    ['P', 'Tasks & exams'],
    ['I', 'Insights'],
    ['?', 'This list'],
  ]
  return (
    <Modal title="Keyboard shortcuts" onClose={close}>
      <ul className="flex flex-col divide-y divide-line">
        {rows.map(([k, label]) => (
          <li key={k} className="flex items-center justify-between py-2.5 text-[14px] text-ink">
            {label}
            <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-line bg-surface-2 px-1.5 text-[12px] font-semibold text-ink-2">{k}</kbd>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
