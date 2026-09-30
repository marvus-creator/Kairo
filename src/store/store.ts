import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { DATA_VERSION, defaultData, sampleData, uid } from '../data/seed'
import type {
  AppData,
  DayPlan,
  MyBlock,
  Exam,
  Feeling,
  MissedResolution,
  Note,
  NoteRefType,
  PlanItem,
  Preferences,
  Profile,
  Project,
  RoutineBlock,
  SchoolPeriod,
  SrsRating,
  StartIntent,
  StudySession,
  Subject,
  Task,
  TimerMode,
  NotificationPrefs,
  School,
} from '../domain/types'
import { buildCatchUps, trimCatchUps, type MissedInfo } from '../engine/missed'
import { review } from '../engine/srs'
import { advancePomodoro, pauseTimer, resumeTimer, startTimer, timerView, type PhaseChange } from '../engine/timer'
import { dateKey, DAY, parseKey } from '../engine/time'
import { autoPlanAsMyBlocks } from '../engine/myday'
import { appNow, realNow } from './clock'
import { parseBackup, sanitize } from './sanitize'

export const STORAGE_KEY = 'kairo:data'
export const CORRUPT_KEY = 'kairo:corrupt-backup'

export const storageIssues: { corrupt: boolean; unavailable: boolean } = { corrupt: false, unavailable: false }

const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      const raw = localStorage.getItem(name)
      if (raw === null) return null
      try {
        JSON.parse(raw)
        return raw
      } catch {
        storageIssues.corrupt = true
        try {
          localStorage.setItem(CORRUPT_KEY, raw)
        } catch {
          void 0
        }
        return null
      }
    } catch {
      storageIssues.unavailable = true
      return null
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value)
    } catch {
      storageIssues.unavailable = true
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name)
    } catch {
      void 0
    }
  },
}

export interface FinishInput {
  feeling?: Feeling
  rating?: SrsRating
  note?: string
  topicName?: string
  markTaskDone?: boolean
}

export interface OnboardingInput {
  name: string
  routine: RoutineBlock[]
  sleepTargetMin: number
  weeklyGoalMin: number
  weakSubjects: string[]
  includeSamples: boolean
}

interface Actions {
  completeOnboarding: (i: OnboardingInput) => void
  updateProfile: (p: Partial<Profile>) => void
  updatePreferences: (p: Partial<Preferences>) => void
  updateNotifications: (p: Partial<NotificationPrefs>) => void
  updateSchool: (p: Partial<School>) => void
  updatePeriod: (id: string, p: Partial<SchoolPeriod>) => void
  addPeriod: (p: Omit<SchoolPeriod, 'id'>) => void
  removePeriod: (id: string) => void
  resetTimetable: () => void
  toggleDayOff: (key: string) => void
  updateRoutine: (id: string, p: Partial<RoutineBlock>) => void
  setRoutine: (r: RoutineBlock[]) => void
  updateSubject: (id: string, p: Partial<Subject>) => void
  addSubject: (s: Omit<Subject, 'id'>) => string
  addTeacher: (name: string) => string
  addTopic: (subjectId: string, name: string) => string
  ensureTopic: (subjectId: string, name: string) => string
  rateTopic: (topicId: string, rating: SrsRating) => void
  deleteTopic: (id: string) => void
  addTask: (t: Omit<Task, 'id' | 'createdAt' | 'spentMin' | 'status'> & Partial<Pick<Task, 'status'>>) => string
  updateTask: (id: string, p: Partial<Task>) => void
  deleteTask: (id: string) => void
  addExam: (e: Omit<Exam, 'id' | 'createdAt'>) => string
  updateExam: (id: string, p: Partial<Exam>) => void
  deleteExam: (id: string) => void
  addProject: (p: Omit<Project, 'id' | 'createdAt'>) => string
  updateProject: (id: string, p: Partial<Project>) => void
  deleteProject: (id: string) => void
  addNote: (text: string, ref: { type: NoteRefType; id?: string }) => void
  deleteNote: (id: string) => void
  startSession: (intent: StartIntent, mode?: TimerMode) => void
  pauseSession: () => void
  resumeSession: () => void
  tickTimer: () => PhaseChange[]
  markTimerFinishedNotified: () => void
  finishSession: (input: FinishInput) => StudySession | null
  cancelSession: () => void
  setDayMode: (day: string, mode: DayPlan['mode']) => void
  saveMyBlock: (day: string, block: MyBlock) => void
  removeMyBlock: (day: string, id: string) => void
  copyAutoPlan: (day: string) => number
  resetDay: (day: string) => void
  savePlan: (key: string, items: PlanItem[]) => void
  clearPlan: (key: string) => void
  resolveMissed: (info: MissedInfo, action: MissedResolution) => number
  toggleDoneForDay: (key: string) => void
  toggleOverloaded: (key: string) => void
  markNotified: (id: string) => void
  exportJSON: () => string
  importJSON: (text: string) => { ok: boolean; error?: string }
  removeSamples: () => void
  loadSamples: () => void
  resetAll: () => void
  housekeeping: () => number
}

export type Store = AppData & Actions

const pickData = (s: Store): AppData => ({
  version: s.version,
  profile: s.profile,
  preferences: s.preferences,
  notifications: s.notifications,
  school: s.school,
  routine: s.routine,
  teachers: s.teachers,
  subjects: s.subjects,
  topics: s.topics,
  tasks: s.tasks,
  exams: s.exams,
  projects: s.projects,
  sessions: s.sessions,
  notes: s.notes,
  timer: s.timer,
  plans: s.plans,
  dayPlans: s.dayPlans,
  missed: s.missed,
  doneForDay: s.doneForDay,
  overloaded: s.overloaded,
  notifLog: s.notifLog,
})

const withoutDay = (plans: Record<string, PlanItem[]>, day: string) => Object.fromEntries(Object.entries(plans).filter(([k]) => !k.startsWith(day)))

const toggle = (list: string[], key: string) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key])

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...defaultData(new Date(appNow())),

      completeOnboarding: (i) =>
        set((s) => {
          const now = new Date(appNow())
          const samples = i.includeSamples ? sampleData(now) : { tasks: [], exams: [], projects: [], topics: [] }
          return {
            profile: { ...s.profile, name: i.name.trim() || 'Student', onboarded: true, createdAt: +now },
            routine: i.routine,
            preferences: { ...s.preferences, sleepTargetMin: i.sleepTargetMin, weeklyGoalMin: i.weeklyGoalMin },
            subjects: s.subjects.map((x) => ({ ...x, weak: i.weakSubjects.includes(x.id) })),
            tasks: [...s.tasks, ...samples.tasks],
            exams: [...s.exams, ...samples.exams],
            projects: [...s.projects, ...samples.projects],
            topics: [...s.topics, ...samples.topics],
          }
        }),

      updateProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),
      updatePreferences: (p) => set((s) => ({ preferences: { ...s.preferences, ...p } })),
      updateNotifications: (p) => set((s) => ({ notifications: { ...s.notifications, ...p } })),
      updateSchool: (p) => set((s) => ({ school: { ...s.school, ...p }, plans: {} })),
      updatePeriod: (id, p) => set((s) => ({ school: { ...s.school, periods: s.school.periods.map((x) => (x.id === id ? { ...x, ...p } : x)) }, plans: {} })),
      addPeriod: (p) => set((s) => ({ school: { ...s.school, periods: [...s.school.periods, { ...p, id: `p-${uid()}` }] }, plans: {} })),
      removePeriod: (id) => set((s) => ({ school: { ...s.school, periods: s.school.periods.filter((x) => x.id !== id) }, plans: {} })),
      resetTimetable: () => set((s) => ({ school: { ...s.school, periods: defaultData().school.periods }, plans: {} })),
      toggleDayOff: (key) => set((s) => ({ school: { ...s.school, daysOff: toggle(s.school.daysOff, key) }, plans: {} })),
      updateRoutine: (id, p) => set((s) => ({ routine: s.routine.map((r) => (r.id === id ? { ...r, ...p } : r)), plans: {} })),
      setRoutine: (r) => set({ routine: r, plans: {} }),

      updateSubject: (id, p) => set((s) => ({ subjects: s.subjects.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
      addSubject: (sub) => {
        const id = `sub-${uid()}`
        set((s) => ({ subjects: [...s.subjects, { ...sub, id }] }))
        return id
      },
      addTeacher: (name) => {
        const existing = get().teachers.find((t) => t.name.toLowerCase() === name.trim().toLowerCase())
        if (existing) return existing.id
        const id = `t-${uid()}`
        set((s) => ({ teachers: [...s.teachers, { id, name: name.trim() }] }))
        return id
      },

      addTopic: (subjectId, name) => {
        const id = uid()
        set((s) => ({ topics: [...s.topics, { id, subjectId, name: name.trim(), createdAt: appNow(), srs: null }] }))
        return id
      },
      ensureTopic: (subjectId, name) => {
        const clean = name.trim()
        const found = get().topics.find((t) => t.subjectId === subjectId && t.name.toLowerCase() === clean.toLowerCase())
        return found ? found.id : get().addTopic(subjectId, clean)
      },
      rateTopic: (topicId, rating) =>
        set((s) => ({
          topics: s.topics.map((t) =>
            t.id === topicId ? { ...t, srs: review(t.srs, rating, dateKey(new Date(appNow()))), lastRating: rating, lastStudiedAt: appNow() } : t,
          ),
        })),
      deleteTopic: (id) => set((s) => ({ topics: s.topics.filter((t) => t.id !== id) })),

      addTask: (t) => {
        const id = uid()
        set((s) => ({ tasks: [...s.tasks, { status: 'todo', ...t, id, spentMin: 0, createdAt: appNow() }] }))
        return id
      },
      updateTask: (id, p) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...p, completedAt: p.status === 'done' ? appNow() : p.status ? undefined : t.completedAt } : t)),
        })),
      deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      addExam: (e) => {
        const id = uid()
        set((s) => ({ exams: [...s.exams, { ...e, id, createdAt: appNow() }] }))
        return id
      },
      updateExam: (id, p) => set((s) => ({ exams: s.exams.map((e) => (e.id === id ? { ...e, ...p } : e)) })),
      deleteExam: (id) => set((s) => ({ exams: s.exams.filter((e) => e.id !== id) })),

      addProject: (p) => {
        const id = uid()
        set((s) => ({ projects: [...s.projects, { ...p, id, createdAt: appNow() }] }))
        return id
      },
      updateProject: (id, p) => set((s) => ({ projects: s.projects.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
      deleteProject: (id) => set((s) => ({ projects: s.projects.filter((x) => x.id !== id), tasks: s.tasks.filter((t) => t.projectId !== id) })),

      addNote: (text, ref) => {
        const clean = text.trim()
        if (!clean) return
        set((s) => ({ notes: [{ id: uid(), text: clean, createdAt: appNow(), ref } as Note, ...s.notes] }))
      },
      deleteNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

      startSession: (intent, mode) => {
        const m = mode ?? get().preferences.defaultMode
        set((s) => ({
          timer: startTimer(intent, m, appNow(), realNow()),
          tasks: intent.taskId ? s.tasks.map((t) => (t.id === intent.taskId && t.status === 'todo' ? { ...t, status: 'doing' } : t)) : s.tasks,
        }))
      },
      pauseSession: () => set((s) => (s.timer ? { timer: pauseTimer(s.timer, realNow()) } : {})),
      resumeSession: () => set((s) => (s.timer ? { timer: resumeTimer(s.timer, realNow()) } : {})),
      tickTimer: () => {
        const t = get().timer
        if (!t || t.mode !== 'pomodoro') return []
        const { timer, changes } = advancePomodoro(t, realNow(), get().preferences)
        if (changes.length) set({ timer })
        return changes
      },
      markTimerFinishedNotified: () => set((s) => (s.timer ? { timer: { ...s.timer, finishedNotified: true } } : {})),

      finishSession: (input) => {
        const s = get()
        const t = s.timer
        if (!t) return null
        const view = timerView(t, realNow(), s.preferences)
        const focusMin = Math.max(1, Math.round(view.focusMs / 60_000))
        const intent = t.intent
        let topicId = intent.topicId
        const topicName = (input.topicName ?? intent.topicName ?? '').trim()
        if (!topicId && topicName && intent.subjectId) topicId = s.ensureTopic(intent.subjectId, topicName)
        const session: StudySession = {
          id: uid(),
          subjectId: intent.subjectId,
          projectId: intent.projectId,
          topicId,
          topicName: topicName || undefined,
          taskId: intent.taskId,
          examId: intent.examId,
          title: intent.title,
          type: intent.type,
          mode: t.mode,
          startedAt: t.startedAt,
          endedAt: appNow(),
          focusMin,
          plannedMin: t.plannedMin,
          status: 'completed',
          feeling: input.feeling,
          note: input.note?.trim() || undefined,
          planKey: intent.planKey,
        }
        if (topicId && input.rating) get().rateTopic(topicId, input.rating)
        else if (topicId) set((st) => ({ topics: st.topics.map((x) => (x.id === topicId ? { ...x, lastStudiedAt: appNow() } : x)) }))
        set((st) => ({
          timer: null,
          sessions: [...st.sessions, session],
          tasks: st.tasks.map((x) =>
            x.id === intent.taskId
              ? { ...x, spentMin: x.spentMin + focusMin, status: input.markTaskDone ? 'done' : 'doing', completedAt: input.markTaskDone ? appNow() : undefined }
              : x,
          ),
          notes: session.note ? [{ id: uid(), text: session.note, createdAt: appNow(), ref: { type: 'session', id: session.id } }, ...st.notes] : st.notes,
        }))
        return session
      },
      cancelSession: () =>
        set((s) => {
          const t = s.timer
          if (!t) return {}
          const view = timerView(t, realNow(), s.preferences)
          const focusMin = Math.round(view.focusMs / 60_000)
          if (focusMin < 1) return { timer: null }
          const cancelled: StudySession = {
            id: uid(),
            subjectId: t.intent.subjectId,
            projectId: t.intent.projectId,
            taskId: t.intent.taskId,
            title: t.intent.title,
            type: t.intent.type,
            mode: t.mode,
            startedAt: t.startedAt,
            endedAt: appNow(),
            focusMin,
            plannedMin: t.plannedMin,
            status: 'cancelled',
            planKey: t.intent.planKey,
          }
          return { timer: null, sessions: [...s.sessions, cancelled] }
        }),

      setDayMode: (day, mode) =>
        set((s) => ({
          dayPlans: { ...s.dayPlans, [day]: { ...(s.dayPlans[day] ?? { blocks: [] }), mode, updatedAt: appNow() } },
          plans: withoutDay(s.plans, day),
        })),
      saveMyBlock: (day, block) =>
        set((s) => {
          const current = s.dayPlans[day] ?? { mode: 'auto' as const, blocks: [], updatedAt: 0 }
          const exists = current.blocks.some((b) => b.id === block.id)
          const blocks = exists ? current.blocks.map((b) => (b.id === block.id ? block : b)) : [...current.blocks, block]
          return { dayPlans: { ...s.dayPlans, [day]: { ...current, blocks, updatedAt: appNow() } }, plans: withoutDay(s.plans, day) }
        }),
      removeMyBlock: (day, id) =>
        set((s) => {
          const current = s.dayPlans[day]
          if (!current) return {}
          return { dayPlans: { ...s.dayPlans, [day]: { ...current, blocks: current.blocks.filter((b) => b.id !== id), updatedAt: appNow() } }, plans: withoutDay(s.plans, day) }
        }),
      copyAutoPlan: (day) => {
        const s = get()
        const copied = autoPlanAsMyBlocks(pickData(s), parseKey(day), uid)
        const activities = (s.dayPlans[day]?.blocks ?? []).filter((b) => b.kind === 'activity')
        set({ dayPlans: { ...s.dayPlans, [day]: { mode: 'mine', blocks: [...activities, ...copied], updatedAt: appNow() } }, plans: withoutDay(s.plans, day) })
        return copied.length
      },
      resetDay: (day) =>
        set((s) => {
          const dayPlans = { ...s.dayPlans }
          delete dayPlans[day]
          return { dayPlans, plans: withoutDay(s.plans, day) }
        }),

      savePlan: (key, items) => set((s) => ({ plans: { ...s.plans, [key]: items } })),
      clearPlan: (key) =>
        set((s) => {
          const plans = { ...s.plans }
          delete plans[key]
          return { plans }
        }),

      resolveMissed: (info, action) => {
        const now = new Date(appNow())
        const created = buildCatchUps(pickData(get()), info, action, now, uid)
        const { tasks, dropped } = trimCatchUps([...get().tasks, ...created], now)
        set((s) => ({ tasks, missed: { ...s.missed, [info.block.id]: action } }))
        return dropped
      },

      toggleDoneForDay: (key) => set((s) => ({ doneForDay: toggle(s.doneForDay, key) })),
      toggleOverloaded: (key) =>
        set((s) => {
          const plans = Object.fromEntries(Object.entries(s.plans).filter(([k]) => !k.startsWith(key)))
          return { overloaded: toggle(s.overloaded, key), plans }
        }),

      markNotified: (id) => set((s) => ({ notifLog: { ...s.notifLog, [id]: appNow() } })),

      exportJSON: () =>
        JSON.stringify({ app: 'kairo', version: DATA_VERSION, exportedAt: new Date().toISOString(), data: pickData(get()) }, null, 2),
      importJSON: (text) => {
        const res = parseBackup(text)
        if (!res.ok) return { ok: false, error: res.error }
        set({ ...res.data, profile: { ...res.data.profile, onboarded: true } })
        return { ok: true }
      },
      removeSamples: () =>
        set((s) => ({
          tasks: s.tasks.filter((t) => !t.sample),
          exams: s.exams.filter((e) => !e.sample),
          projects: s.projects.filter((p) => !p.sample),
          topics: s.topics.filter((t) => !t.sample),
          plans: {},
        })),
      loadSamples: () =>
        set((s) => {
          const sm = sampleData(new Date(appNow()))
          return { tasks: [...s.tasks, ...sm.tasks], exams: [...s.exams, ...sm.exams], projects: [...s.projects, ...sm.projects], topics: [...s.topics, ...sm.topics], plans: {} }
        }),
      resetAll: () => set({ ...defaultData(new Date(appNow())) }),

      housekeeping: () => {
        const now = appNow()
        const s = get()
        const cutoff = dateKey(new Date(now - 3 * DAY))
        const plans = Object.fromEntries(Object.entries(s.plans).filter(([k]) => k.slice(0, 10) >= cutoff))
        const notifLog = Object.fromEntries(Object.entries(s.notifLog).filter(([, at]) => at > now - 3 * DAY))
        const missedCut = dateKey(new Date(now - 30 * DAY))
        const missed = Object.fromEntries(Object.entries(s.missed).filter(([k]) => k.slice(0, 10) >= missedCut))
        const { tasks, dropped } = trimCatchUps(s.tasks, new Date(now))
        const recentKey = dateKey(new Date(now - 14 * DAY))
        const dayPlans = Object.fromEntries(Object.entries(s.dayPlans).filter(([k]) => k >= recentKey))
        set({
          plans,
          dayPlans,
          notifLog,
          missed,
          tasks,
          doneForDay: s.doneForDay.filter((k) => k >= recentKey),
          overloaded: s.overloaded.filter((k) => k >= recentKey),
        })
        return dropped
      },
    }),
    {
      name: STORAGE_KEY,
      version: DATA_VERSION,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => pickData(s as Store),
      migrate: (persisted) => sanitize(persisted) as unknown as Store,
      merge: (persisted, current) => ({ ...current, ...sanitize(persisted) }),
    },
  ),
)

export function getData(): AppData {
  return pickData(useStore.getState())
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) void useStore.persist.rehydrate()
  })
}
