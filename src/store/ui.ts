import { create } from 'zustand'
import type { StartIntent } from '../domain/types'

export interface Toast {
  id: number
  title: string
  body?: string
  tone?: 'default' | 'success' | 'warn'
  action?: { label: string; run: () => void }
}

export type Dialog =
  | { kind: 'task'; taskId?: string; preset?: { projectId?: string; subjectId?: string; kind?: 'assignment' | 'study' | 'project' } }
  | { kind: 'exam'; examId?: string }
  | { kind: 'note'; ref?: { type: 'subject' | 'topic' | 'task' | 'exam' | 'general'; id?: string } }
  | { kind: 'start'; intent?: StartIntent }
  | { kind: 'project'; projectId?: string }
  | { kind: 'complete' }
  | { kind: 'shortcuts' }
  | { kind: 'subject'; subjectId: string }

interface UI {
  toasts: Toast[]
  dialog: Dialog | null
  focus: boolean
  toast: (t: Omit<Toast, 'id'>) => void
  dismiss: (id: number) => void
  open: (d: Dialog) => void
  close: () => void
  setFocus: (v: boolean) => void
}

let nextId = 1

export const useUI = create<UI>()((set) => ({
  toasts: [],
  dialog: null,
  focus: false,
  toast: (t) => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), t.action ? 7000 : 4500)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  open: (dialog) => set({ dialog }),
  close: () => set({ dialog: null }),
  setFocus: (focus) => set({ focus }),
}))

export const toast = (t: Omit<Toast, 'id'>) => useUI.getState().toast(t)
