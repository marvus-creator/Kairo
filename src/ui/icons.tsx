import {
  Atom,
  Binary,
  Blocks,
  BookOpen,
  Box,
  Briefcase,
  Coffee,
  Compass,
  Cpu,
  Database,
  Dumbbell,
  FolderKanban,
  Kanban,
  Landmark,
  Languages,
  Network,
  Sigma,
  Workflow,
  GraduationCap,
  type LucideIcon,
} from 'lucide-react'

export const SUBJECT_ICONS: Record<string, LucideIcon> = {
  atom: Atom,
  binary: Binary,
  blocks: Blocks,
  'book-open': BookOpen,
  box: Box,
  briefcase: Briefcase,
  coffee: Coffee,
  compass: Compass,
  cpu: Cpu,
  database: Database,
  dumbbell: Dumbbell,
  folder: FolderKanban,
  kanban: Kanban,
  landmark: Landmark,
  languages: Languages,
  network: Network,
  sigma: Sigma,
  workflow: Workflow,
  cap: GraduationCap,
}

export function subjectIcon(name?: string): LucideIcon {
  return (name && SUBJECT_ICONS[name]) || GraduationCap
}

export function KairoMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="var(--brand)" />
      <circle cx="32" cy="32" r="17" fill="none" stroke="var(--brand-ink)" strokeWidth="5" opacity="0.28" />
      <path d="M44.02 44.02 A17 17 0 1 1 44.02 19.98" fill="none" stroke="var(--brand-ink)" strokeWidth="5" strokeLinecap="round" />
      <circle cx="44.02" cy="19.98" r="5.2" fill="var(--now)" />
    </svg>
  )
}
