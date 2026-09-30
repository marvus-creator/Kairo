import type { AppData, Exam, Project, RoutineBlock, Task, Topic } from '../domain/types'
import { addDays, dateKey } from '../engine/time'
import { SUBJECTS, TEACHERS, buildPeriods } from './timetable'

export const DATA_VERSION = 1

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID().slice(0, 12)
  return Math.random().toString(36).slice(2, 14)
}

export const DEFAULT_ROUTINE: RoutineBlock[] = [
  { id: 'r-sleep-school', kind: 'sleep', label: 'Sleep', start: '23:00', end: '03:30', when: 'before-school-day' },
  { id: 'r-sleep-off', kind: 'sleep', label: 'Sleep', start: '22:30', end: '07:00', when: 'before-off-day' },
  { id: 'r-morning', kind: 'morning-study', label: 'Morning recall', start: '03:45', end: '04:30', when: 'school-day' },
  { id: 'r-ready', kind: 'get-ready', label: 'Get ready & travel', start: '04:30', end: '07:30', when: 'school-day' },
  { id: 'r-commute', kind: 'commute', label: 'Heading home', start: '17:20', end: '20:00', when: 'school-day' },
  { id: 'r-home', kind: 'home', label: 'Home · eat & reset', start: '20:00', end: '21:00', when: 'school-day' },
  { id: 'r-evening', kind: 'evening-study', label: 'Evening study', start: '21:00', end: '22:50', when: 'before-school-day' },
  { id: 'r-wind', kind: 'wind-down', label: 'Wind down', start: '22:50', end: '23:00', when: 'before-school-day' },
  { id: 'r-wk-deep', kind: 'weekend-study', label: 'Deep revision', start: '09:00', end: '10:45', when: 'off-day' },
  { id: 'r-wk-practice', kind: 'weekend-study', label: 'Problem practice', start: '11:00', end: '12:00', when: 'off-day' },
  { id: 'r-wk-projects', kind: 'weekend-study', label: 'Assignments & projects', start: '15:00', end: '16:30', when: 'off-day' },
]

export function defaultData(now: Date = new Date()): AppData {
  return {
    version: DATA_VERSION,
    profile: {
      name: 'Malvyn',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      onboarded: false,
      createdAt: now.getTime(),
    },
    preferences: {
      theme: 'system',
      timeFormat: '12h',
      weekStart: 1,
      weeklyGoalMin: 600,
      sleepTargetMin: 450,
      focusMin: 25,
      shortBreakMin: 5,
      longBreakMin: 15,
      cyclesBeforeLong: 4,
      defaultMode: 'countdown',
      showDevTools: false,
    },
    notifications: {
      enabled: false,
      categories: { class: true, study: true, assignment: true, exam: true, daily: true, missed: true },
      leadMin: 10,
      quiet: { enabled: true, start: '23:00', end: '03:30' },
      dndUntil: null,
    },
    school: {
      name: 'My school',
      arrival: '07:30',
      devotion: { start: '07:30', end: '07:50' },
      periods: buildPeriods(),
      daysOff: [],
    },
    routine: DEFAULT_ROUTINE.map((r) => ({ ...r })),
    teachers: TEACHERS.map((t) => ({ ...t })),
    subjects: SUBJECTS.map((s) => ({ ...s })),
    topics: [],
    tasks: [],
    exams: [],
    projects: [],
    sessions: [],
    notes: [],
    timer: null,
    plans: {},
    dayPlans: {},
    missed: {},
    doneForDay: [],
    overloaded: [],
    notifLog: {},
  }
}

export function sampleData(now: Date): Pick<AppData, 'tasks' | 'exams' | 'projects' | 'topics'> {
  const t = now.getTime()
  const k = (n: number) => dateKey(addDays(now, n))
  const projectId = 'sample-project'
  const tasks: Task[] = [
    {
      id: uid(), kind: 'assignment', title: 'Normalization assignment (up to 3NF)', subjectId: 'db', due: k(2), dueTime: '08:00',
      priority: 'high', estMin: 60, spentMin: 0, difficulty: 'medium', status: 'todo', notes: 'Use the library schema from class.', slot: 'any', createdAt: t, sample: true,
    },
    {
      id: uid(), kind: 'study', title: 'Practice tree traversal problems', subjectId: 'dsa', topicName: 'Binary trees', due: k(4),
      priority: 'high', estMin: 45, spentMin: 0, difficulty: 'hard', status: 'todo', notes: 'Inorder, preorder, postorder — iterative and recursive.', slot: 'any', createdAt: t, sample: true,
    },
    {
      id: uid(), kind: 'project', title: 'Build notification system', projectId, estMin: 90, spentMin: 0,
      priority: 'medium', status: 'todo', notes: '', slot: 'weekend', createdAt: t, sample: true,
    },
  ]
  const exams: Exam[] = [
    { id: uid(), kind: 'quiz', subjectId: 'math', title: 'Integration techniques', date: k(8), importance: 2, notes: '', createdAt: t, sample: true },
  ]
  const projects: Project[] = [
    { id: projectId, name: 'Student productivity app', goal: 'Ship a study OS I actually use', color: '#1d3b33', createdAt: t, sample: true },
  ]
  const topic = (subjectId: string, name: string, dueIn: number | null, lapses = 0): Topic => ({
    id: uid(), subjectId, name, createdAt: t, sample: true,
    srs: dueIn === null ? null : { due: k(dueIn), interval: 3, ease: lapses ? 2.1 : 2.5, reps: 2, lapses },
    lastStudiedAt: dueIn === null ? undefined : t - 3 * 86400000,
  })
  const topics: Topic[] = [
    topic('dsa', 'Binary trees', 0),
    topic('java', 'Inheritance & polymorphism', -1),
    topic('math', 'Integration by parts', 2),
    topic('phys', 'Electric fields', 0, 1),
    topic('net', 'Subnetting', 3),
    topic('db', 'Normalization', null),
  ]
  return { tasks, exams, projects, topics }
}
