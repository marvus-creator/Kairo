import { eventsBetween, isAllowed, type NotifEvent } from '../engine/notifications'
import { DAY, MINUTE } from '../engine/time'
import { appNow } from '../store/clock'
import { getData, useStore } from '../store/store'
import { toast } from '../store/ui'

export type PermissionState = 'unsupported' | 'default' | 'granted' | 'denied'

export function notificationSupport(): { supported: boolean; permission: PermissionState; installed: boolean; ios: boolean } {
  const supported = typeof window !== 'undefined' && 'Notification' in window
  const installed = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)
  const ios = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)
  return { supported, permission: supported ? (Notification.permission as PermissionState) : 'unsupported', installed: !!installed, ios }
}

export async function requestPermission(): Promise<PermissionState> {
  if (!('Notification' in window)) return 'unsupported'
  try {
    const res = await Notification.requestPermission()
    if (res === 'granted') {
      useStore.getState().updateNotifications({ enabled: true })
      void registerPeriodicSync()
    }
    return res as PermissionState
  } catch {
    return Notification.permission as PermissionState
  }
}

export async function showSystem(title: string, body: string, opts: { tag?: string; url?: string } = {}): Promise<boolean> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false
  const options: NotificationOptions & { renotify?: boolean } = {
    body,
    tag: opts.tag,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    data: { url: opts.url ?? '/' },
  }
  try {
    if ('serviceWorker' in navigator) {
      const reg = await Promise.race([
        navigator.serviceWorker.getRegistration(),
        new Promise<undefined>((r) => setTimeout(() => r(undefined), 1500)),
      ])
      if (reg) {
        await reg.showNotification(title, options)
        return true
      }
    }
    new Notification(title, options)
    return true
  } catch {
    return false
  }
}

export async function deliver(ev: Pick<NotifEvent, 'id' | 'title' | 'body' | 'url' | 'category'>, force = false) {
  const visible = document.visibilityState === 'visible'
  let shown = false
  if (!visible || force) shown = await showSystem(ev.title, ev.body, { tag: ev.id, url: ev.url })
  if (visible && !force) toast({ title: ev.title, body: ev.body })
  return shown
}

const WINDOW = 5 * MINUTE
let lastCheck = 0
let lastQueueWrite = 0

export function checkNotifications() {
  const data = getData()
  const now = appNow()
  const from = Math.max(lastCheck || now - WINDOW, now - WINDOW)
  lastCheck = now
  if (!data.profile.onboarded) return
  const events = eventsBetween(data, new Date(from), new Date(now + 1))
  for (const ev of events) {
    if (data.notifLog[ev.id]) continue
    if (!isAllowed(data.notifications, ev)) continue
    useStore.getState().markNotified(ev.id)
    void deliver(ev)
  }
  if (now - lastQueueWrite > 10 * MINUTE) {
    lastQueueWrite = now
    void writeQueue()
  }
}

export async function writeQueue() {
  if (!('caches' in window)) return
  try {
    const data = getData()
    const now = appNow()
    const events = eventsBetween(data, new Date(now), new Date(now + DAY))
      .filter((e) => !e.conditional && isAllowed(data.notifications, e))
      .map(({ id, title, body, url, at }) => ({ id, title, body, url, at }))
    const cache = await caches.open('kairo-notify')
    await cache.put('/__kairo/queue', new Response(JSON.stringify({ writtenAt: now, events }), { headers: { 'content-type': 'application/json' } }))
  } catch {
    void 0
  }
}

export async function registerPeriodicSync() {
  try {
    const reg = await navigator.serviceWorker?.ready
    const ps = (reg as ServiceWorkerRegistration & { periodicSync?: { register: (tag: string, o: { minInterval: number }) => Promise<void> } })?.periodicSync
    if (!ps) return false
    const status = await navigator.permissions.query({ name: 'periodic-background-sync' as PermissionName })
    if (status.state !== 'granted') return false
    await ps.register('kairo-reminders', { minInterval: 60 * MINUTE })
    return true
  } catch {
    return false
  }
}

let started = false
export function startNotifier() {
  if (started) return
  started = true
  setTimeout(checkNotifications, 3000)
  setInterval(checkNotifications, 20_000)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void writeQueue()
  })
}
