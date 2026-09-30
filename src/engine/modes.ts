import type { SessionType, SubjectCategory } from '../domain/types'

export interface StudyMode {
  methods: string[]
  prep: string
  review: string
  practice: string
  recall: string
  deep: string
}

export const STUDY_MODES: Record<SubjectCategory, StudyMode> = {
  programming: {
    methods: ['Coding exercises', 'Algorithms', 'Debugging', 'Complexity analysis', 'Implementation'],
    prep: 'Skim the next concept, then write one small program that uses it',
    review: 'Re-type today’s class code from memory and fix what breaks',
    practice: 'Solve 2–3 problems without looking at solutions first',
    recall: 'Explain the idea out loud, then trace one example by hand',
    deep: 'Implement it from scratch, then analyse its time and space complexity',
  },
  math: {
    methods: ['Worked problems', 'Formula recall', 'Error analysis', 'Timed practice'],
    prep: 'Read the next section and redo its first worked example',
    review: 'Redo one problem from today’s class without notes',
    practice: 'Timed set of 4–5 problems, then check every mistake',
    recall: 'Write every formula from memory, then check',
    deep: 'Mixed problem set, then write an error log for what went wrong',
  },
  science: {
    methods: ['Concepts', 'Formula recall', 'Numerical problems', 'Problem solving'],
    prep: 'Preview the concept and list the formulas it needs',
    review: 'Summarise today’s lesson in 5 lines, then one numerical',
    practice: 'Work 3 numerical problems showing units at every step',
    recall: 'Formula sheet from memory, then one concept question',
    deep: 'Derive the key result, then solve problems of rising difficulty',
  },
  networking: {
    methods: ['Concepts', 'Diagrams', 'Configuration scenarios', 'Questions'],
    prep: 'Preview the topic and sketch the diagram it is built around',
    review: 'Redraw today’s topology or packet flow from memory',
    practice: 'Work a configuration or subnetting scenario end to end',
    recall: 'Answer 5 quick questions, then check your notes',
    deep: 'Design a small network and justify every choice',
  },
  database: {
    methods: ['SQL', 'Database design', 'Queries', 'Theory', 'Practical exercises'],
    prep: 'Preview the concept and write one query that uses it',
    review: 'Rewrite today’s queries from memory and run them',
    practice: 'Write 5 queries of rising difficulty against a real schema',
    recall: 'Define the key terms, then normalise one small table',
    deep: 'Design a schema for a real app, normalise it, query it',
  },
  systems: {
    methods: ['Technical concepts', 'Architecture', 'Practical implementation', 'Debugging'],
    prep: 'Preview the concept and sketch the architecture diagram',
    review: 'Explain today’s concept and where it runs on the hardware',
    practice: 'Walk through a small implementation and predict its behaviour',
    recall: 'Draw the block diagram and label each part from memory',
    deep: 'Build or simulate a small piece and debug it',
  },
  engineering: {
    methods: ['Concepts', 'Case studies', 'System design', 'Documentation'],
    prep: 'Read ahead and write three questions you want answered',
    review: 'Turn today’s notes into a one-page summary',
    practice: 'Apply the method to a small case study',
    recall: 'List the key concepts and one example of each',
    deep: 'Design a small system and document the decisions',
  },
  web3: {
    methods: ['Concepts', 'Smart contracts', 'Architecture', 'Hands-on'],
    prep: 'Preview the concept and note where it fits in the stack',
    review: 'Explain today’s concept in plain words, then one example',
    practice: 'Read or write a small contract and trace what it does',
    recall: 'Define the key terms without notes',
    deep: 'Build a tiny working example end to end',
  },
  language: {
    methods: ['Reading', 'Vocabulary', 'Writing', 'Recall', 'Practice questions'],
    prep: 'Read the next text and pick out new vocabulary',
    review: 'Rewrite today’s key points in your own words',
    practice: 'Write a short paragraph, then correct it',
    recall: 'Vocabulary recall both directions',
    deep: 'Read, summarise, then write a structured response',
  },
  business: {
    methods: ['Concepts', 'Case studies', 'Idea development'],
    prep: 'Read ahead and connect it to a real business you know',
    review: 'Summarise today’s lesson with one real-world example',
    practice: 'Apply the framework to your own idea',
    recall: 'List the key terms and explain each in one line',
    deep: 'Develop one section of a business plan',
  },
  design: {
    methods: ['Modelling practice', 'Tool techniques', 'Projects'],
    prep: 'Watch or read the technique for the next class',
    review: 'Recreate today’s model or technique from scratch',
    practice: 'Model a small object using today’s techniques',
    recall: 'List the tools and shortcuts used today',
    deep: 'Work on your model project for a solid block',
  },
  civic: {
    methods: ['Reading', 'Concepts', 'Discussion points'],
    prep: 'Read ahead and note two discussion points',
    review: 'Summarise today’s lesson in five lines',
    practice: 'Answer past-style questions briefly',
    recall: 'Key terms and dates from memory',
    deep: 'Write a structured answer to a likely question',
  },
  activity: {
    methods: ['Participation'],
    prep: 'Nothing to prepare — show up and take part',
    review: 'Note anything worth remembering',
    practice: 'Nothing to practise',
    recall: 'Nothing to recall',
    deep: 'Nothing needed',
  },
}

export function methodFor(category: SubjectCategory | undefined, type: SessionType): string {
  const mode = STUDY_MODES[category ?? 'engineering']
  switch (type) {
    case 'prep':
      return mode.prep
    case 'review':
      return mode.review
    case 'practice':
      return mode.practice
    case 'recall':
      return mode.recall
    case 'deep':
    case 'catch-up':
      return mode.deep
    case 'exam-prep':
      return mode.practice
    default:
      return mode.practice
  }
}

export const SESSION_TYPE_LABEL: Record<SessionType, string> = {
  prep: 'Tomorrow prep',
  review: 'Same-day review',
  practice: 'Practice',
  assignment: 'Assignment',
  recall: 'Active recall',
  project: 'Project work',
  deep: 'Deep work',
  'exam-prep': 'Exam prep',
  'catch-up': 'Catch-up',
}
