import { BookMarked, Brain, History, Play, Plus, Sparkles } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { windowNow } from '../dialogs/SessionDialogs'
import { SESSION_TYPE_LABEL } from '../engine/modes'
import { intentFromCandidate } from '../engine/plan'
import { lastStudiedAt, rankCandidates, subjectById } from '../engine/priority'
import { dueTopics } from '../engine/srs'
import { dateKey, formatClock, formatDuration, relativeDay } from '../engine/time'
import { useData, useNowView } from '../hooks/useApp'
import { useStartSession } from '../hooks/useSession'
import { useNow } from '../store/clock'
import { useStore } from '../store/store'
import { useUI } from '../store/ui'
import { Button, Card, Chip, Empty, SectionTitle, SubjectBadge, SubjectDot } from '../ui/primitives'
import { TimerPanel } from './study/TimerPanel'

export function Study() {
  const data = useData()
  const now = useNow('minute')
  const timer = useStore((s) => s.timer)
  const open = useUI((s) => s.open)
  const start = useStartSession()
  const { view } = useNowView()
  const [params, setParams] = useSearchParams()
  const today = dateKey(now)
  const ranked = useMemo(() => rankCandidates(data, { now, window: windowNow(data, now), overloaded: data.overloaded.includes(today), fmt: data.preferences.timeFormat }).candidates.slice(0, 5), [data, now, today])
  const reviews = dueTopics(data.topics, today)
  const recent = [...data.sessions].filter((s) => s.status === 'completed').sort((a, b) => b.startedAt - a.startedAt).slice(0, 8)

  useEffect(() => {
    if (params.get('start') === 'recommended' && !timer) {
      const intent = view.intent ?? (ranked[0] ? intentFromCandidate(ranked[0]) : undefined)
      open({ kind: 'start', intent })
      params.delete('start')
      setParams(params, { replace: true })
    }
  }, [params, setParams, timer, view.intent, ranked, open])

  return (
    <div className="flex flex-col gap-5">
      <header className="rise flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[30px] leading-tight text-ink sm:text-[36px]">Study</h1>
          <p className="mt-1 text-[15px] text-ink-2">{timer ? 'Stay with it. Kairo will tell you when time is up.' : 'Pick the recommended session, or choose your own.'}</p>
        </div>
        {!timer && <Button variant="now" size="lg" icon={Play} onClick={() => open({ kind: 'start', intent: view.intent ?? undefined })} aria-keyshortcuts="S">Start study</Button>}
      </header>

      {timer && <TimerPanel />}

      {!timer && (
        <Card className="rise p-5" aria-labelledby="rec-title">
          <SectionTitle id="rec-title" icon={Sparkles}>Recommended for you now</SectionTitle>
          {ranked.length === 0 ? (
            <Empty icon={Sparkles} title="You’re on top of everything" body="No deadlines, reviews or prep waiting. Read ahead or rest." />
          ) : (
            <ul className="flex flex-col gap-2">
              {ranked.map((c, idx) => {
                const subject = subjectById(data, c.subjectId)
                return (
                  <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-line p-3 transition-colors hover:bg-surface-2">
                    <SubjectBadge subject={subject} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-[15px] font-semibold text-ink">
                        {c.title}
                        {idx === 0 && <Chip tone="now">Best now</Chip>}
                      </p>
                      <p className="truncate text-[13px] text-muted">{c.reason} · {c.detail}</p>
                    </div>
                    <span className="hidden shrink-0 text-[13px] text-muted sm:block">{formatDuration(c.minutes)}</span>
                    <Button size="sm" variant={idx === 0 ? 'now' : 'secondary'} icon={Play} onClick={() => start(intentFromCandidate(c))} aria-label={`Start ${c.title}`}>Start</Button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-5" aria-labelledby="rev-title">
          <SectionTitle id="rev-title" icon={Brain}>Reviews due</SectionTitle>
          {reviews.length === 0 ? (
            <Empty icon={Brain} title="No reviews due" body="Rate a topic after a session and Kairo schedules the next review for you." />
          ) : (
            <ul className="flex flex-col gap-1">
              {reviews.map((t) => {
                const s = subjectById(data, t.subjectId)
                return (
                  <li key={t.id}>
                    <button type="button" onClick={() => start({ title: `Review ${t.name}`, subjectId: t.subjectId, topicId: t.id, topicName: t.name, type: 'recall', minutes: 15 })} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-2">
                      <SubjectDot color={s?.color ?? 'var(--muted)'} />
                      <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{t.name}</span>
                      <span className="text-[12px] text-muted">{s?.short} · {relativeDay(t.srs!.due, today).toLowerCase()}</span>
                      <Play className="size-3.5 text-now" aria-hidden />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card className="p-5" aria-labelledby="recent-title">
          <SectionTitle id="recent-title" icon={History}>Recent sessions</SectionTitle>
          {recent.length === 0 ? (
            <Empty icon={History} title="No sessions yet" body="Your first session is the hardest. Start with 15 minutes." action={<Button variant="primary" icon={Play} onClick={() => open({ kind: 'start' })}>Start one</Button>} />
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {recent.map((s) => {
                const subject = subjectById(data, s.subjectId)
                return (
                  <li key={s.id} className="flex items-center gap-3 py-2.5">
                    <SubjectDot color={subject?.color ?? 'var(--muted)'} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-ink">{s.title}</p>
                      <p className="truncate text-[12.5px] text-muted">
                        {relativeDay(dateKey(new Date(s.startedAt)), today)} {formatClock(s.startedAt, data.preferences.timeFormat)} · {SESSION_TYPE_LABEL[s.type]}{s.topicName ? ` · ${s.topicName}` : ''}
                      </p>
                      {s.note && <p className="mt-0.5 truncate text-[12.5px] text-ink-2 italic">“{s.note}”</p>}
                    </div>
                    <div className="text-right">
                      <p className="tabular text-[14px] font-semibold text-ink">{formatDuration(s.focusMin)}</p>
                      {s.feeling && <p className="text-[11.5px] text-muted capitalize">{s.feeling}</p>}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      <section aria-labelledby="subjects-title">
        <SectionTitle id="subjects-title" icon={BookMarked} action={<Button size="sm" variant="ghost" icon={Plus} onClick={() => open({ kind: 'note' })}>Quick note</Button>}>Subjects</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.subjects.map((s) => {
            const last = lastStudiedAt(data, s.id)
            const due = data.topics.filter((t) => t.subjectId === s.id && t.srs && t.srs.due <= today).length
            const teacher = data.teachers.find((t) => t.id === s.teacherId)?.name
            return (
              <button key={s.id} type="button" onClick={() => open({ kind: 'subject', subjectId: s.id })} className="card flex items-center gap-3 p-3.5 text-left transition-transform hover:-translate-y-0.5">
                <SubjectBadge subject={s} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-semibold text-ink">{s.name}</p>
                  <p className="truncate text-[12.5px] text-muted">{[teacher, last ? `studied ${relativeDay(dateKey(new Date(last)), today).toLowerCase()}` : s.academic ? 'not studied yet' : null].filter(Boolean).join(' · ')}</p>
                </div>
                {s.weak && <Chip tone="warn">Weak</Chip>}
                {due > 0 && <Chip tone="now">{due} due</Chip>}
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
