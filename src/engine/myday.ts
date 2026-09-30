import type { AppData, MyBlock } from '../domain/types'
import { planForBlock } from './plan'
import { AUTO_STUDY_KINDS, blocksForDay, type Block } from './schedule'
import { fromMin, minuteOfDay, toMin } from './time'

export function autoStudyBlocks(data: AppData, d: Date): Block[] {
  const auto = { ...data, dayPlans: {} }
  return blocksForDay(auto, d).filter((b) => AUTO_STUDY_KINDS.includes(b.kind) && b.start.getDate() === d.getDate() && b.end.getDate() === d.getDate())
}

export function autoPlanAsMyBlocks(data: AppData, d: Date, makeId: () => string): MyBlock[] {
  const auto = { ...data, dayPlans: {} }
  const out: MyBlock[] = []
  for (const b of autoStudyBlocks(data, d)) {
    const { items } = planForBlock(auto, b, b.start)
    for (const i of items) {
      if (i.type === 'break' || i.key.endsWith('#open')) continue
      out.push({
        id: makeId(),
        kind: 'study',
        start: fromMin(minuteOfDay(new Date(i.start))),
        end: fromMin(minuteOfDay(new Date(i.end))),
        title: i.title,
        subjectId: i.subjectId,
        topicName: i.topicName,
        taskId: i.taskId,
        type: i.type,
      })
    }
  }
  return out
}

export interface BlockIssue {
  id: string
  message: string
}

export function validateMyBlocks(data: AppData, d: Date, blocks: MyBlock[]): BlockIssue[] {
  const issues: BlockIssue[] = []
  const sorted = [...blocks].sort((a, b) => toMin(a.start) - toMin(b.start))
  const school = blocksForDay({ ...data, dayPlans: {} }, d).filter((b) => b.school && b.kind !== 'office-hours' && b.kind !== 'self-study')
  const sleep = blocksForDay({ ...data, dayPlans: {} }, d).filter((b) => b.kind === 'sleep')
  for (let i = 0; i < sorted.length; i++) {
    const b = sorted[i]
    const s = toMin(b.start)
    const e = toMin(b.end)
    if (e <= s) {
      issues.push({ id: b.id, message: 'Ends before it starts' })
      continue
    }
    if (i > 0 && toMin(sorted[i - 1].end) > s) issues.push({ id: b.id, message: `Overlaps “${sorted[i - 1].title || 'previous block'}”` })
    const clash = school.find((x) => minuteOfDay(x.start) < e && minuteOfDay(x.end) > s && x.start.getDate() === d.getDate())
    if (clash) issues.push({ id: b.id, message: `During school (${clash.label}) — school time wins` })
    const late = sleep.find((x) => x.start.getDate() === d.getDate() && minuteOfDay(x.start) < e)
    if (late && b.kind === 'study') issues.push({ id: b.id, message: 'Runs into your sleep time' })
  }
  return issues
}
