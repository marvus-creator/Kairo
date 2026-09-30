import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { StartIntent, TimerMode } from '../domain/types'
import { useStore } from '../store/store'
import { toast, useUI } from '../store/ui'

export function useStartSession() {
  const navigate = useNavigate()
  return useCallback(
    (intent: StartIntent, mode?: TimerMode) => {
      const s = useStore.getState()
      if (s.timer) {
        toast({ title: 'A session is already running', body: s.timer.intent.title, tone: 'warn', action: { label: 'Open', run: () => navigate('/study') } })
        navigate('/study')
        return
      }
      s.startSession(intent, mode)
      useUI.getState().close()
      navigate('/study')
    },
    [navigate],
  )
}
