import type { DateKey, SrsRating, SrsState, Topic } from '../domain/types'
import { addDays, daysBetween, parseKey, dateKey } from './time'

const MAX_INTERVAL = 60

export function review(prev: SrsState | null, rating: SrsRating, today: DateKey): SrsState {
  const base: SrsState = prev ?? { due: today, interval: 0, ease: 2.5, reps: 0, lapses: 0 }
  let { interval, ease, reps, lapses } = base
  switch (rating) {
    case 'again':
      lapses += 1
      reps = 0
      interval = 1
      ease = Math.max(1.3, ease - 0.2)
      break
    case 'hard':
      interval = reps === 0 ? 1 : Math.max(interval + 1, Math.round(interval * 1.2))
      ease = Math.max(1.3, ease - 0.15)
      reps += 1
      break
    case 'good':
      interval = reps === 0 ? 2 : reps === 1 ? 5 : Math.round(interval * ease)
      reps += 1
      break
    case 'easy':
      interval = reps === 0 ? 4 : Math.round(Math.max(interval, 2) * ease * 1.3)
      ease = Math.min(3.2, ease + 0.15)
      reps += 1
      break
  }
  interval = Math.min(MAX_INTERVAL, Math.max(1, interval))
  return { due: dateKey(addDays(parseKey(today), interval)), interval, ease: Math.round(ease * 100) / 100, reps, lapses }
}

export function overdueDays(t: Topic, today: DateKey): number | null {
  if (!t.srs) return null
  return daysBetween(t.srs.due, today)
}

export function dueTopics(topics: Topic[], today: DateKey): Topic[] {
  return topics
    .filter((t) => t.srs && daysBetween(t.srs.due, today) >= 0)
    .sort((a, b) => (overdueDays(b, today) ?? 0) - (overdueDays(a, today) ?? 0))
}

export function isWeakTopic(t: Topic): boolean {
  return !!t.srs && (t.srs.lapses > 0 || t.srs.ease < 2.2 || t.lastRating === 'hard' || t.lastRating === 'again')
}

export const RATING_LABEL: Record<SrsRating, string> = {
  again: 'Review again',
  hard: 'Hard',
  good: 'Good',
  easy: 'Easy',
}
