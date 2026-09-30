import type { CSSProperties } from 'react'
import type { AppData } from '../../domain/types'
import type { Block, BlockKind } from '../../engine/schedule'
import { formatClock, startOfDay } from '../../engine/time'

const KIND_COLOR: Partial<Record<BlockKind, string>> = {
  sleep: 'color-mix(in oklab, var(--ink) 10%, transparent)',
  'wind-down': 'color-mix(in oklab, var(--ink) 16%, transparent)',
  'morning-study': 'var(--now)',
  'evening-study': 'var(--now)',
  'weekend-study': 'var(--now)',
  'my-study': 'var(--now)',
  'my-activity': 'color-mix(in oklab, var(--warn) 65%, transparent)',
  'office-hours': 'color-mix(in oklab, var(--now) 60%, var(--surface))',
  'self-study': 'color-mix(in oklab, var(--now) 60%, var(--surface))',
  'get-ready': 'color-mix(in oklab, var(--ink) 22%, transparent)',
  commute: 'color-mix(in oklab, var(--ink) 22%, transparent)',
  home: 'color-mix(in oklab, var(--ink) 18%, transparent)',
  devotion: 'color-mix(in oklab, var(--brand) 45%, var(--surface))',
  break: 'color-mix(in oklab, var(--ink) 12%, transparent)',
  lunch: 'color-mix(in oklab, var(--ink) 14%, transparent)',
  clubs: 'color-mix(in oklab, var(--brand) 50%, var(--surface))',
}

export function DayRibbon({ blocks, now, data }: { blocks: Block[]; now: Date; data: AppData }) {
  const dayStart = +startOfDay(now)
  const span = 24 * 3_600_000
  const fmt = data.preferences.timeFormat
  const pos = (t: number) => Math.min(100, Math.max(0, ((t - dayStart) / span) * 100))
  const nowPct = pos(+now)
  const ticks = [0, 6, 12, 18, 24]
  return (
    <div className="select-none" aria-label="Your day at a glance">
      <div className="relative h-9 overflow-hidden rounded-xl bg-surface-2">
        {blocks
          .filter((b) => b.kind !== 'free')
          .map((b) => {
            const subject = data.subjects.find((s) => s.id === b.subjectId)
            const color = b.kind === 'class' ? subject?.color ?? 'var(--brand)' : KIND_COLOR[b.kind] ?? 'transparent'
            const left = pos(+b.start)
            const width = pos(+b.end) - left
            const past = +b.end <= +now
            return (
              <div
                key={b.id}
                title={`${b.label} · ${formatClock(b.start, fmt)}–${formatClock(b.end, fmt)}`}
                className="absolute inset-y-1 rounded-[5px] transition-opacity"
                style={{ left: `calc(${left}% + 1px)`, width: `calc(${width}% - 2px)`, background: color, opacity: past ? 0.38 : 1 } as CSSProperties}
              />
            )
          })}
        <div className="absolute inset-y-0 z-10 w-[2px] bg-now" style={{ left: `${nowPct}%` }} aria-hidden>
          <span className="live-dot absolute -top-0.5 left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-now" />
        </div>
      </div>
      <div className="relative mt-1.5 h-4 text-[10.5px] font-medium text-muted tabular">
        {ticks.map((h) => (
          <span key={h} className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full" style={{ left: `${(h / 24) * 100}%` }}>
            {h === 24 ? '' : fmt === '24h' ? `${String(h).padStart(2, '0')}:00` : h === 0 ? '12 AM' : h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`}
          </span>
        ))}
      </div>
    </div>
  )
}
