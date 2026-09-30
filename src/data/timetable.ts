import type { PeriodKind, SchoolPeriod, Subject, Teacher, Weekday } from '../domain/types'

export const TEACHERS: Teacher[] = [
  { id: 't-willy', name: 'Willy' },
  { id: 't-emmanuel', name: 'Emmanuel' },
  { id: 't-tr-emmanuel', name: 'Tr. Emmanuel' },
  { id: 't-felix', name: 'Felix' },
  { id: 't-eric', name: 'Eric' },
  { id: 't-dieudonne', name: 'Dieudonne' },
  { id: 't-christine', name: 'Christine' },
  { id: 't-faustin', name: 'Faustin' },
  { id: 't-jean-bosco', name: 'Jean Bosco' },
  { id: 't-jean-de-dieu', name: 'Jean De Dieu' },
  { id: 't-all-staff', name: 'All Staff' },
]

export const SUBJECTS: Subject[] = [
  { id: 'ess', name: 'Embedded System Software', short: 'Embedded', teacherId: 't-willy', color: '#0f766e', icon: 'cpu', category: 'systems', academic: true, weak: false, notes: '' },
  { id: 'net', name: 'Advanced Networking', short: 'Networking', teacherId: 't-felix', color: '#0369a1', icon: 'network', category: 'networking', academic: true, weak: false, notes: '' },
  { id: 'dsa', name: 'Data Structures (DSA)', short: 'DSA', teacherId: 't-eric', color: '#7e22ce', icon: 'binary', category: 'programming', academic: true, weak: false, notes: '' },
  { id: 'se', name: 'Software Engineering', short: 'Soft. Eng.', teacherId: 't-felix', color: '#1d4ed8', icon: 'workflow', category: 'engineering', academic: true, weak: false, notes: '' },
  { id: 'pbl', name: 'Project Based Learning', short: 'PBL', teacherId: 't-eric', color: '#c2410c', icon: 'kanban', category: 'engineering', academic: true, weak: false, notes: '' },
  { id: 'web3', name: 'Web3', short: 'Web3', teacherId: 't-emmanuel', color: '#6d28d9', icon: 'blocks', category: 'web3', academic: true, weak: false, notes: '' },
  { id: 'db', name: 'Advanced Database', short: 'Database', teacherId: 't-eric', color: '#0e7490', icon: 'database', category: 'database', academic: true, weak: false, notes: '' },
  { id: 'kin', name: 'Kinyarwanda', short: 'Kinyarwanda', teacherId: 't-dieudonne', color: '#a16207', icon: 'languages', category: 'language', academic: true, weak: false, notes: '' },
  { id: 'java', name: 'Java', short: 'Java', teacherId: 't-faustin', color: '#b91c1c', icon: 'coffee', category: 'programming', academic: true, weak: false, notes: '' },
  { id: 'ent', name: 'Entrepreneurship', short: 'Entrepreneurship', teacherId: 't-christine', color: '#a15c07', icon: 'briefcase', category: 'business', academic: true, weak: false, notes: '' },
  { id: 'eng', name: 'Advanced English', short: 'English', teacherId: 't-christine', color: '#be185d', icon: 'book-open', category: 'language', academic: true, weak: false, notes: '' },
  { id: 'math', name: 'Applied Math II', short: 'Math II', teacherId: 't-jean-bosco', color: '#047857', icon: 'sigma', category: 'math', academic: true, weak: false, notes: '' },
  { id: 'phys', name: 'Applied Physics II', short: 'Physics II', teacherId: 't-jean-de-dieu', color: '#be123c', icon: 'atom', category: 'science', academic: true, weak: false, notes: '' },
  { id: '3d', name: 'Development of 3D Models', short: '3D Models', teacherId: 't-willy', color: '#a21caf', icon: 'box', category: 'design', academic: true, weak: false, notes: '' },
  { id: 'cit', name: 'Citizenship', short: 'Citizenship', teacherId: 't-dieudonne', color: '#4338ca', icon: 'landmark', category: 'civic', academic: true, weak: false, notes: '' },
  { id: 'career', name: 'Career Guidance', short: 'Career', color: '#57534e', icon: 'compass', category: 'activity', academic: false, weak: false, notes: '' },
  { id: 'pe', name: 'Physical Education', short: 'PE', teacherId: 't-tr-emmanuel', color: '#4d7c0f', icon: 'dumbbell', category: 'activity', academic: false, weak: false, notes: '' },
]

const SLOTS: Array<[string, string]> = [
  ['08:00', '08:50'],
  ['08:50', '09:40'],
  ['09:40', '10:00'],
  ['10:00', '10:50'],
  ['10:50', '11:40'],
  ['11:40', '12:30'],
  ['12:30', '13:30'],
  ['13:30', '14:20'],
  ['14:20', '15:10'],
  ['15:10', '15:30'],
  ['15:30', '16:20'],
  ['16:20', '17:20'],
]

type Cell = [PeriodKind, string?, string?, string?]

const BREAK: Cell = ['break', undefined, undefined, 'Short Break']
const LUNCH: Cell = ['lunch', undefined, undefined, 'Lunch Break']
const OFFICE: Cell = ['office-hours', undefined, undefined, 'Office Hours']

const WEEK: Record<1 | 2 | 3 | 4 | 5, Cell[]> = {
  1: [
    ['class', 'ess', 't-willy'],
    ['class', 'ess', 't-willy'],
    BREAK,
    ['class', 'web3', 't-emmanuel'],
    ['class', 'web3', 't-emmanuel'],
    ['self-study', undefined, undefined, 'Supervised Self-Study'],
    LUNCH,
    ['class', 'se', 't-felix'],
    ['class', 'se', 't-felix'],
    BREAK,
    ['class', 'pe', 't-tr-emmanuel'],
    OFFICE,
  ],
  2: [
    ['class', 'ess', 't-willy'],
    ['class', 'pbl', 't-eric'],
    BREAK,
    ['class', 'db', 't-eric'],
    ['class', 'db', 't-eric'],
    ['class', 'kin', 't-dieudonne'],
    LUNCH,
    ['class', 'eng', 't-christine'],
    ['class', 'eng', 't-christine'],
    BREAK,
    ['class', 'cit', 't-dieudonne'],
    OFFICE,
  ],
  3: [
    ['class', 'net', 't-felix'],
    ['class', 'net', 't-felix'],
    BREAK,
    ['class', 'java', 't-faustin'],
    ['class', 'java', 't-faustin'],
    ['class', 'ent', 't-christine'],
    LUNCH,
    ['class', 'dsa', 't-eric'],
    ['class', 'dsa', 't-eric'],
    BREAK,
    ['class', 'math', 't-jean-bosco'],
    OFFICE,
  ],
  4: [
    ['class', 'dsa', 't-eric'],
    ['class', 'dsa', 't-eric'],
    BREAK,
    ['class', 'java', 't-faustin'],
    ['class', 'java', 't-faustin'],
    ['class', 'java', 't-faustin'],
    LUNCH,
    ['class', 'phys', 't-jean-de-dieu'],
    ['class', 'phys', 't-jean-de-dieu'],
    BREAK,
    ['class', 'career'],
    OFFICE,
  ],
  5: [
    ['class', 'se', 't-felix'],
    ['class', 'net', 't-felix'],
    BREAK,
    ['class', 'math', 't-jean-bosco'],
    ['class', 'math', 't-jean-bosco'],
    ['clubs', undefined, 't-all-staff', 'Student Led Clubs'],
    LUNCH,
    ['class', '3d', 't-willy'],
    ['class', '3d', 't-willy'],
    BREAK,
    ['class', 'phys', 't-jean-de-dieu'],
    OFFICE,
  ],
}

export function buildPeriods(): SchoolPeriod[] {
  const out: SchoolPeriod[] = []
  for (const [dayStr, cells] of Object.entries(WEEK)) {
    const weekday = Number(dayStr) as Weekday
    cells.forEach(([kind, subjectId, teacherId, label], i) => {
      const [start, end] = SLOTS[i]
      out.push({ id: `p${weekday}-${i}`, weekday, start, end, kind, subjectId, teacherId, label })
    })
  }
  return out
}
