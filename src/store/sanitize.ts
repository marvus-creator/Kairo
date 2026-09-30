import { z } from 'zod'
import { DATA_VERSION, defaultData } from '../data/seed'
import type { AppData } from '../domain/types'
import { isDateKey, isHHMM } from '../engine/time'

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const hasId = (v: unknown): v is { id: string } & Record<string, unknown> => isObj(v) && typeof v.id === 'string' && v.id.length > 0
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)

function mergeShallow<T extends object>(base: T, patch: unknown): T {
  if (!isObj(patch)) return base
  const out = { ...base } as Record<string, unknown>
  for (const [k, v] of Object.entries(patch)) {
    if (!(k in base)) continue
    const current = (base as Record<string, unknown>)[k]
    if (current === null || v === null) out[k] = v
    else if (typeof current === typeof v) out[k] = isObj(current) ? mergeShallow(current, v) : v
  }
  return out as T
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)))
}

export function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  const version = num(raw.version, 0)
  const out = { ...raw }
  if (version < 1) out.version = 1
  return out
}

export function sanitize(input: unknown, now = new Date()): AppData {
  const base = defaultData(now)
  if (!isObj(input)) return base
  const raw = migrate(input)
  const d: AppData = {
    ...base,
    version: DATA_VERSION,
    profile: mergeShallow(base.profile, raw.profile),
    preferences: mergeShallow(base.preferences, raw.preferences),
    notifications: mergeShallow(base.notifications, raw.notifications),
    school: mergeShallow(base.school, raw.school),
  }

  const arr = (k: keyof AppData) => (Array.isArray(raw[k]) ? (raw[k] as unknown[]).filter(hasId) : null)

  const periods = isObj(raw.school) && Array.isArray(raw.school.periods) ? raw.school.periods.filter(hasId) : null
  if (periods) {
    d.school.periods = uniqueById(
      periods.filter((p) => isHHMM(p.start) && isHHMM(p.end) && typeof p.weekday === 'number' && p.weekday >= 0 && p.weekday <= 6),
    ) as unknown as AppData['school']['periods']
  }
  if (isObj(raw.school) && Array.isArray(raw.school.daysOff)) d.school.daysOff = raw.school.daysOff.filter(isDateKey)
  if (d.school.devotion && (!isHHMM(d.school.devotion.start) || !isHHMM(d.school.devotion.end))) d.school.devotion = base.school.devotion

  const routine = arr('routine')
  if (routine) d.routine = uniqueById(routine.filter((r) => isHHMM(r.start) && isHHMM(r.end) && typeof r.kind === 'string')) as unknown as AppData['routine']

  const subjects = arr('subjects')
  if (subjects && subjects.length) {
    d.subjects = uniqueById(subjects.filter((s) => typeof s.name === 'string')).map((s) => ({
      ...base.subjects[0],
      notes: '',
      weak: false,
      academic: true,
      ...s,
    })) as unknown as AppData['subjects']
  }
  const teachers = arr('teachers')
  if (teachers) d.teachers = uniqueById(teachers.filter((t) => typeof t.name === 'string')) as unknown as AppData['teachers']

  const topics = arr('topics')
  if (topics) d.topics = uniqueById(topics.filter((t) => typeof t.name === 'string' && typeof t.subjectId === 'string')).map((t) => ({
    ...t,
    srs: isObj(t.srs) && isDateKey(t.srs.due) ? t.srs : null,
  })) as unknown as AppData['topics']

  const tasks = arr('tasks')
  if (tasks) d.tasks = uniqueById(tasks.filter((t) => typeof t.title === 'string')).map((t) => ({
    kind: 'assignment',
    priority: 'medium',
    estMin: 30,
    spentMin: 0,
    status: 'todo',
    notes: '',
    slot: 'any',
    createdAt: now.getTime(),
    ...t,
    due: isDateKey(t.due) ? t.due : undefined,
    dueTime: isHHMM(t.dueTime) ? t.dueTime : undefined,
  })) as unknown as AppData['tasks']

  const exams = arr('exams')
  if (exams) d.exams = uniqueById(exams.filter((e) => isDateKey(e.date) && typeof e.subjectId === 'string')).map((e) => ({
    kind: 'test',
    title: '',
    importance: 2,
    notes: '',
    createdAt: now.getTime(),
    ...e,
    time: isHHMM(e.time) ? e.time : undefined,
  })) as unknown as AppData['exams']

  const projects = arr('projects')
  if (projects) d.projects = uniqueById(projects.filter((p) => typeof p.name === 'string')) as unknown as AppData['projects']

  const sessions = arr('sessions')
  if (sessions) d.sessions = uniqueById(
    sessions.filter((s) => Number.isFinite(s.startedAt) && Number.isFinite(s.endedAt) && Number.isFinite(s.focusMin)),
  ) as unknown as AppData['sessions']

  const notes = arr('notes')
  if (notes) d.notes = uniqueById(notes.filter((n) => typeof n.text === 'string')).map((n) => ({
    ...n,
    ref: isObj(n.ref) && typeof n.ref.type === 'string' ? n.ref : { type: 'general' },
  })) as unknown as AppData['notes']

  if (isObj(raw.timer) && isObj(raw.timer.intent) && Number.isFinite(raw.timer.startedAt) && Number.isFinite(raw.timer.accumulatedMs)) {
    d.timer = raw.timer as unknown as AppData['timer']
  }
  if (isObj(raw.plans)) d.plans = raw.plans as AppData['plans']
  if (isObj(raw.dayPlans)) {
    for (const [k, v] of Object.entries(raw.dayPlans)) {
      if (!isDateKey(k) || !isObj(v) || !Array.isArray(v.blocks)) continue
      d.dayPlans[k] = {
        mode: v.mode === 'mine' ? 'mine' : 'auto',
        updatedAt: num(v.updatedAt, 0),
        blocks: v.blocks.filter(hasId).filter((b) => isHHMM(b.start) && isHHMM(b.end) && (b.kind === 'study' || b.kind === 'activity')) as unknown as AppData['dayPlans'][string]['blocks'],
      }
    }
  }
  if (isObj(raw.missed)) d.missed = raw.missed as AppData['missed']
  if (Array.isArray(raw.doneForDay)) d.doneForDay = raw.doneForDay.filter(isDateKey)
  if (Array.isArray(raw.overloaded)) d.overloaded = raw.overloaded.filter(isDateKey)
  if (isObj(raw.notifLog)) d.notifLog = raw.notifLog as AppData['notifLog']
  return d
}

export const BackupSchema = z.object({
  app: z.literal('kairo'),
  version: z.number().int().positive(),
  exportedAt: z.string(),
  data: z.object({
    profile: z.object({ name: z.string() }).passthrough(),
    school: z.object({ periods: z.array(z.object({ id: z.string() }).passthrough()) }).passthrough(),
    subjects: z.array(z.object({ id: z.string(), name: z.string() }).passthrough()),
    tasks: z.array(z.object({ id: z.string() }).passthrough()),
    sessions: z.array(z.object({ id: z.string() }).passthrough()),
  }).passthrough(),
})

export function parseBackup(text: string): { ok: true; data: AppData } | { ok: false; error: string } {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' }
  }
  const res = BackupSchema.safeParse(json)
  if (!res.success) return { ok: false, error: 'That file is not a Kairo backup.' }
  if (res.data.version > DATA_VERSION) return { ok: false, error: 'This backup is from a newer version of Kairo.' }
  return { ok: true, data: sanitize(res.data.data) }
}
