import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { useUI } from '../store/ui'
import { cx } from './primitives'

export function Toasts() {
  const toasts = useUI((s) => s.toasts)
  const dismiss = useUI((s) => s.dismiss)
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3 sm:top-auto sm:right-5 sm:bottom-5 sm:left-auto sm:items-end">
      {toasts.map((t) => {
        const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'warn' ? TriangleAlert : Info
        return (
          <div key={t.id} role="status" className="rise pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-line bg-surface p-3.5 pr-2 shadow-[var(--shadow-lg)]">
            <Icon className={cx('mt-0.5 size-[18px] shrink-0', t.tone === 'success' ? 'text-good' : t.tone === 'warn' ? 'text-warn' : 'text-now')} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{t.title}</p>
              {t.body && <p className="mt-0.5 text-[13px] text-muted">{t.body}</p>}
            </div>
            {t.action && (
              <button
                type="button"
                className="shrink-0 rounded-lg px-2.5 py-1 text-[13px] font-semibold text-now hover:bg-surface-2"
                onClick={() => {
                  t.action!.run()
                  dismiss(t.id)
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" aria-label="Dismiss" className="shrink-0 rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-ink" onClick={() => dismiss(t.id)}>
              <X className="size-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
