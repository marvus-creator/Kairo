import { Check, Circle, CircleDot, FolderKanban, GraduationCap, ListChecks, Pencil, Play, Plus } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import type { Task } from '../domain/types'
import { examPhase, subjectById, taskDueAt } from '../engine/priority'
import { dateKey, daysBetween, formatShortDate, relativeDay } from '../engine/time'
import { useData } from '../hooks/useApp'
import { useStartSession } from '../hooks/useSession'
import { useNow } from '../store/clock'
import { useStore } from '../store/store'
import { toast, useUI } from '../store/ui'
import { Button, Card, Chip, cx, Empty, SampleTag, Segmented, SubjectDot } from '../ui/primitives'

type Tab = 'tasks' | 'exams' | 'projects'

export function Plan() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'tasks'
  const open = useUI((s) => s.open)
  const setTab = (t: Tab) => setParams(t === 'tasks' ? {} : { tab: t }, { replace: true })
  return (
    <div className="flex flex-col gap-5">
      <header className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[30px] leading-tight text-ink sm:text-[36px]">Tasks & exams</h1>
          <p className="mt-1 text-[15px] text-ink-2">Everything here feeds the recommendations. Add it once — Kairo decides when.</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => open(tab === 'exams' ? { kind: 'exam' } : tab === 'projects' ? { kind: 'project' } : { kind: 'task' })}>
          {tab === 'exams' ? 'Add test' : tab === 'projects' ? 'New project' : 'Add task'}
        </Button>
      </header>
      <Segmented label="Section" value={tab} onChange={setTab} options={[{ value: 'tasks', label: 'Tasks', icon: ListChecks }, { value: 'exams', label: 'Tests & exams', icon: GraduationCap }, { value: 'projects', label: 'Personal projects', icon: FolderKanban }]} />
      {tab === 'tasks' && <Tasks />}
      {tab === 'exams' && <Exams />}
      {tab === 'projects' && <Projects />}
    </div>
  )
}

function TaskRow({ task }: { task: Task }) {
  const data = useData()
  const now = useNow('minute')
  const update = useStore((s) => s.updateTask)
  const open = useUI((s) => s.open)
  const start = useStartSession()
  const subject = subjectById(data, task.subjectId)
  const project = data.projects.find((p) => p.id === task.projectId)
  const due = taskDueAt(task)
  const overdue = task.status !== 'done' && due && due < now
  const hrs = due ? (+due - +now) / 3_600_000 : null
  const urgency = task.status === 'done' ? null : overdue ? 'bad' : hrs !== null && hrs < 30 ? 'warn' : null
  const next = task.status === 'todo' ? 'doing' : task.status === 'doing' ? 'done' : 'todo'
  const StatusIcon = task.status === 'done' ? Check : task.status === 'doing' ? CircleDot : Circle
  return (
    <li className={cx('flex items-center gap-3 rounded-2xl border border-line bg-surface p-3', task.status === 'done' && 'opacity-60')}>
      <button
        type="button"
        aria-label={`Mark ${task.title} as ${next === 'doing' ? 'in progress' : next}`}
        onClick={() => {
          update(task.id, { status: next })
          if (next === 'done') toast({ title: 'Done', body: task.title, tone: 'success', action: { label: 'Undo', run: () => update(task.id, { status: task.status }) } })
        }}
        className={cx('flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors', task.status === 'done' ? 'border-transparent bg-good text-white' : task.status === 'doing' ? 'border-now text-now' : 'border-line text-muted hover:border-ink')}
      >
        <StatusIcon className="size-4" strokeWidth={2.4} />
      </button>
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => open({ kind: 'task', taskId: task.id })}>
        <p className={cx('flex items-center gap-2 text-[14.5px] font-medium text-ink', task.status === 'done' && 'line-through')}>
          <span className="truncate">{task.title}</span>
          {task.sample && <SampleTag />}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 text-[12.5px] text-muted">
          {(subject || project) && <span className="inline-flex items-center gap-1"><SubjectDot color={subject?.color ?? project?.color ?? 'var(--muted)'} />{subject?.short ?? project?.name}</span>}
          {task.kind === 'catch-up' && <span>Catch-up</span>}
          {task.kind === 'study' && <span>Study plan</span>}
          <span>{task.estMin - task.spentMin > 0 ? `${task.estMin - task.spentMin} min left` : `${task.spentMin} min done`}</span>
          {task.priority === 'high' && <span className="font-semibold text-now">High priority</span>}
        </p>
      </button>
      {task.due && <Chip tone={urgency === 'bad' ? 'bad' : urgency === 'warn' ? 'warn' : 'default'}>{overdue ? 'Overdue' : relativeDay(task.due, dateKey(now))}{task.dueTime ? ` ${task.dueTime}` : ''}</Chip>}
      {task.status !== 'done' && (
        <button type="button" aria-label={`Start working on ${task.title}`} className="hidden size-8 items-center justify-center rounded-xl text-now hover:bg-surface-2 sm:flex" onClick={() => start({ title: task.title, subjectId: task.subjectId, topicName: task.topicName, taskId: task.id, projectId: task.projectId, type: task.kind === 'assignment' ? 'assignment' : task.kind === 'project' ? 'project' : 'practice', minutes: Math.min(50, Math.max(15, task.estMin - task.spentMin)) })}>
          <Play className="size-4" />
        </button>
      )}
    </li>
  )
}

function Tasks() {
  const data = useData()
  const now = useNow('minute')
  const open = useUI((s) => s.open)
  const today = dateKey(now)
  const tasks = data.tasks.filter((t) => t.kind !== 'project')
  const active = tasks.filter((t) => t.status !== 'done')
  const groups: { label: string; items: Task[] }[] = [
    { label: 'Overdue', items: active.filter((t) => { const d = taskDueAt(t); return d !== null && d < now }) },
    { label: 'Today', items: active.filter((t) => t.due === today && !(taskDueAt(t)! < now)) },
    { label: 'Tomorrow', items: active.filter((t) => t.due && daysBetween(today, t.due) === 1) },
    { label: 'This week', items: active.filter((t) => t.due && daysBetween(today, t.due) > 1 && daysBetween(today, t.due) <= 7) },
    { label: 'Later', items: active.filter((t) => t.due && daysBetween(today, t.due) > 7) },
    { label: 'No date', items: active.filter((t) => !t.due) },
    { label: 'Done', items: tasks.filter((t) => t.status === 'done').sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)).slice(0, 10) },
  ]
  if (tasks.length === 0) return <Card><Empty icon={ListChecks} title="No tasks yet" body="Add assignments and study plans. Kairo will fit them into your study blocks." action={<Button variant="primary" icon={Plus} onClick={() => open({ kind: 'task' })}>Add your first task</Button>} /></Card>
  return (
    <div className="flex flex-col gap-5">
      {groups.filter((g) => g.items.length).map((g) => (
        <section key={g.label} aria-label={g.label}>
          <h2 className={cx('mb-2 text-[13px] font-semibold tracking-[0.08em] uppercase', g.label === 'Overdue' ? 'text-bad' : 'text-muted')}>{g.label} · {g.items.length}</h2>
          <ul className="flex flex-col gap-2">{g.items.sort((a, b) => (a.due ?? '9').localeCompare(b.due ?? '9')).map((t) => <TaskRow key={t.id} task={t} />)}</ul>
        </section>
      ))}
    </div>
  )
}

function Exams() {
  const data = useData()
  const now = useNow('minute')
  const open = useUI((s) => s.open)
  const today = dateKey(now)
  const upcoming = [...data.exams].filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  const past = data.exams.filter((e) => e.date < today)
  if (!data.exams.length) return <Card><Empty icon={GraduationCap} title="No tests scheduled" body="Add quizzes, tests and exams. Preparation ramps up automatically: light review 2 weeks out, final recall the day before." action={<Button variant="primary" icon={Plus} onClick={() => open({ kind: 'exam' })}>Add a test</Button>} /></Card>
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {upcoming.map((e) => {
        const s = subjectById(data, e.subjectId)
        const days = daysBetween(today, e.date)
        const phase = examPhase(days)
        return (
          <button key={e.id} type="button" onClick={() => open({ kind: 'exam', examId: e.id })} className="card flex items-center gap-4 p-4 text-left transition-transform hover:-translate-y-0.5">
            <div className="flex w-16 shrink-0 flex-col items-center rounded-2xl py-2" style={{ background: `color-mix(in oklab, ${s?.color ?? '#888'} 14%, transparent)` }}>
              <span className="tabular font-display text-[28px] leading-none text-ink">{days}</span>
              <span className="text-[11px] font-medium text-muted">{days === 1 ? 'day' : 'days'}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-[15px] font-semibold text-ink"><span className="truncate">{s?.name}</span>{e.sample && <SampleTag />}</p>
              <p className="truncate text-[13px] text-muted">{e.kind[0].toUpperCase() + e.kind.slice(1)} · {e.title} · {formatShortDate(e.date)}</p>
              <p className="mt-1 flex items-center gap-2">
                {phase ? <Chip tone={days <= 3 ? 'now' : 'default'}>{phase.label}</Chip> : <Chip>Not yet — more than 2 weeks away</Chip>}
                {e.importance === 3 && <Chip tone="warn">High stakes</Chip>}
              </p>
            </div>
            <Pencil className="size-4 shrink-0 text-muted" aria-hidden />
          </button>
        )
      })}
      {past.length > 0 && <p className="text-[13px] text-muted md:col-span-2">{past.length} past test{past.length > 1 ? 's' : ''} kept in your history.</p>}
    </div>
  )
}

function Projects() {
  const data = useData()
  const open = useUI((s) => s.open)
  if (!data.projects.length) return <Card><Empty icon={FolderKanban} title="No personal projects" body="Side projects get Office Hours and weekend time — never at the expense of tomorrow’s classes." action={<Button variant="primary" icon={Plus} onClick={() => open({ kind: 'project' })}>New project</Button>} /></Card>
  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-2xl bg-surface-2 px-4 py-3 text-[13.5px] text-ink-2">Academic work stays first. Project tasks appear in your plan mostly during Office Hours and weekends, and drop back whenever something urgent is due.</p>
      {data.projects.map((p) => {
        const tasks = data.tasks.filter((t) => t.projectId === p.id)
        const done = tasks.filter((t) => t.status === 'done').length
        return (
          <Card key={p.id} className="p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="size-3 rounded-full" style={{ background: p.color }} aria-hidden />
                <div>
                  <p className="flex items-center gap-2 text-[16px] font-semibold text-ink">{p.name}{p.sample && <SampleTag />}</p>
                  {p.goal && <p className="text-[13px] text-muted">{p.goal}</p>}
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" icon={Pencil} onClick={() => open({ kind: 'project', projectId: p.id })}>Edit</Button>
                <Button size="sm" icon={Plus} onClick={() => open({ kind: 'task', preset: { projectId: p.id, kind: 'project' } })}>Task</Button>
              </div>
            </div>
            {tasks.length > 0 ? (
              <>
                <p className="mb-2 text-[12.5px] text-muted">{done} of {tasks.length} done</p>
                <ul className="flex flex-col gap-2">{tasks.map((t) => <TaskRow key={t.id} task={t} />)}</ul>
              </>
            ) : (
              <p className="text-[13.5px] text-muted">No tasks yet.</p>
            )}
          </Card>
        )
      })}
    </div>
  )
}
