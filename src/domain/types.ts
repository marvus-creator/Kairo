export type ID = string
export type HHMM = string
export type DateKey = string
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type SubjectCategory =
  | 'programming'
  | 'math'
  | 'science'
  | 'networking'
  | 'database'
  | 'systems'
  | 'engineering'
  | 'web3'
  | 'language'
  | 'business'
  | 'design'
  | 'civic'
  | 'activity'

export interface Teacher {
  id: ID
  name: string
}

export interface Subject {
  id: ID
  name: string
  short: string
  teacherId?: ID
  color: string
  icon: string
  category: SubjectCategory
  academic: boolean
  weak: boolean
  notes: string
}

export type PeriodKind = 'class' | 'break' | 'lunch' | 'office-hours' | 'self-study' | 'clubs'

export interface SchoolPeriod {
  id: ID
  weekday: Weekday
  start: HHMM
  end: HHMM
  kind: PeriodKind
  subjectId?: ID
  teacherId?: ID
  label?: string
}

export interface School {
  name: string
  arrival: HHMM
  devotion: { start: HHMM; end: HHMM } | null
  periods: SchoolPeriod[]
  daysOff: DateKey[]
}

export type RoutineKind =
  | 'sleep'
  | 'morning-study'
  | 'get-ready'
  | 'commute'
  | 'home'
  | 'evening-study'
  | 'weekend-study'
  | 'wind-down'
  | 'free'

export type RoutineWhen = 'school-day' | 'off-day' | 'before-school-day' | 'before-off-day' | 'every-day'

export interface RoutineBlock {
  id: ID
  kind: RoutineKind
  label: string
  start: HHMM
  end: HHMM
  when: RoutineWhen
  weekdays?: Weekday[]
}

export interface SrsState {
  due: DateKey
  interval: number
  ease: number
  reps: number
  lapses: number
}

export type SrsRating = 'again' | 'hard' | 'good' | 'easy'

export interface Topic {
  id: ID
  subjectId: ID
  name: string
  createdAt: number
  srs: SrsState | null
  lastStudiedAt?: number
  lastRating?: SrsRating
  sample?: boolean
}

export type TaskKind = 'assignment' | 'study' | 'project' | 'catch-up'
export type Priority = 'low' | 'medium' | 'high'
export type TaskStatus = 'todo' | 'doing' | 'done'
export type Slot = 'any' | 'office' | 'weekend'

export interface Task {
  id: ID
  kind: TaskKind
  title: string
  subjectId?: ID
  topicName?: string
  projectId?: ID
  due?: DateKey
  dueTime?: HHMM
  priority: Priority
  estMin: number
  spentMin: number
  difficulty?: 'easy' | 'medium' | 'hard'
  status: TaskStatus
  notes: string
  slot: Slot
  createdAt: number
  completedAt?: number
  sample?: boolean
}

export type ExamKind = 'quiz' | 'test' | 'exam'

export interface Exam {
  id: ID
  kind: ExamKind
  subjectId: ID
  title: string
  date: DateKey
  time?: HHMM
  importance: 1 | 2 | 3
  notes: string
  createdAt: number
  sample?: boolean
}

export interface Project {
  id: ID
  name: string
  goal: string
  color: string
  createdAt: number
  sample?: boolean
}

export type SessionType = 'prep' | 'review' | 'practice' | 'assignment' | 'recall' | 'project' | 'deep' | 'exam-prep' | 'catch-up'
export type TimerMode = 'countdown' | 'stopwatch' | 'pomodoro'
export type Feeling = 'great' | 'okay' | 'difficult'

export interface StudySession {
  id: ID
  subjectId?: ID
  projectId?: ID
  topicId?: ID
  topicName?: string
  taskId?: ID
  examId?: ID
  title: string
  type: SessionType
  mode: TimerMode
  startedAt: number
  endedAt: number
  focusMin: number
  plannedMin: number
  status: 'completed' | 'cancelled'
  feeling?: Feeling
  note?: string
  planKey?: string
}

export interface StartIntent {
  title: string
  subjectId?: ID
  topicId?: ID
  topicName?: string
  taskId?: ID
  examId?: ID
  projectId?: ID
  type: SessionType
  minutes: number
  method?: string
  planKey?: string
}

export type PomodoroPhase = 'focus' | 'short-break' | 'long-break'

export interface ActiveTimer {
  intent: StartIntent
  mode: TimerMode
  startedAt: number
  startedAtReal: number
  accumulatedMs: number
  runningSince: number | null
  plannedMin: number
  focusMs: number
  pomodoro?: {
    phase: PomodoroPhase
    cycle: number
    phaseStartedMs: number
  }
  finishedNotified?: boolean
}

export type NoteRefType = 'subject' | 'topic' | 'session' | 'task' | 'exam' | 'general'

export interface Note {
  id: ID
  text: string
  createdAt: number
  ref: { type: NoteRefType; id?: ID }
}

export type NotifCategory = 'class' | 'study' | 'assignment' | 'exam' | 'daily' | 'missed'

export interface NotificationPrefs {
  enabled: boolean
  categories: Record<NotifCategory, boolean>
  leadMin: number
  quiet: { enabled: boolean; start: HHMM; end: HHMM }
  dndUntil: number | null
}

export interface Preferences {
  theme: 'system' | 'light' | 'dark'
  timeFormat: '12h' | '24h'
  weekStart: 0 | 1
  weeklyGoalMin: number
  sleepTargetMin: number
  focusMin: number
  shortBreakMin: number
  longBreakMin: number
  cyclesBeforeLong: number
  defaultMode: TimerMode
  showDevTools: boolean
}

export interface Profile {
  name: string
  timezone: string
  onboarded: boolean
  createdAt: number
}

export interface PlanItem {
  key: string
  title: string
  detail: string
  reason: string
  type: SessionType | 'break'
  start: number
  end: number
  subjectId?: ID
  topicId?: ID
  topicName?: string
  taskId?: ID
  examId?: ID
  projectId?: ID
}

export type MissedResolution = 'rescheduled' | 'skipped' | 'office' | 'weekend'

export interface MyBlock {
  id: ID
  kind: 'study' | 'activity'
  start: HHMM
  end: HHMM
  title: string
  subjectId?: ID
  topicName?: string
  taskId?: ID
  type?: SessionType
}

export interface DayPlan {
  mode: 'auto' | 'mine'
  blocks: MyBlock[]
  updatedAt: number
}

export interface AppData {
  version: number
  profile: Profile
  preferences: Preferences
  notifications: NotificationPrefs
  school: School
  routine: RoutineBlock[]
  teachers: Teacher[]
  subjects: Subject[]
  topics: Topic[]
  tasks: Task[]
  exams: Exam[]
  projects: Project[]
  sessions: StudySession[]
  notes: Note[]
  timer: ActiveTimer | null
  plans: Record<string, PlanItem[]>
  dayPlans: Record<DateKey, DayPlan>
  missed: Record<string, MissedResolution>
  doneForDay: DateKey[]
  overloaded: DateKey[]
  notifLog: Record<string, number>
}
