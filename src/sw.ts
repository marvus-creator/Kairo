import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

type Manifest = Array<{ url: string; revision: string | null }>
const sw = self as unknown as ServiceWorkerGlobalScope

precacheAndRoute((self as unknown as { __WB_MANIFEST: Manifest }).__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

sw.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void sw.skipWaiting()
})

interface QueuedEvent {
  id: string
  title: string
  body: string
  url: string
  at: number
}

async function readJSON<T>(key: string): Promise<T | null> {
  const cache = await caches.open('kairo-notify')
  const res = await cache.match(key)
  if (!res) return null
  try {
    return (await res.json()) as T
  } catch {
    return null
  }
}

async function writeJSON(key: string, value: unknown) {
  const cache = await caches.open('kairo-notify')
  await cache.put(key, new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } }))
}

async function flushQueue() {
  const queue = await readJSON<{ writtenAt: number; events: QueuedEvent[] }>('/__kairo/queue')
  if (!queue) return
  const shown = (await readJSON<Record<string, number>>('/__kairo/shown')) ?? {}
  const now = Date.now()
  const clients = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true })
  if (clients.some((c) => (c as WindowClient).visibilityState === 'visible')) return
  const due = queue.events.filter((e) => e.at <= now && e.at > now - 90 * 60_000 && !shown[e.id])
  for (const e of due.slice(-3)) {
    await sw.registration.showNotification(e.title, { body: e.body, tag: e.id, icon: '/icons/icon-192.png', badge: '/icons/badge-96.png', data: { url: e.url } })
    shown[e.id] = now
  }
  for (const [k, v] of Object.entries(shown)) if (v < now - 3 * 86_400_000) delete shown[k]
  await writeJSON('/__kairo/shown', shown)
}

sw.addEventListener('periodicsync', (event: Event) => {
  const e = event as ExtendableEvent & { tag?: string }
  if (e.tag === 'kairo-reminders') e.waitUntil(flushQueue())
})

sw.addEventListener('push', (event) => {
  const payload = (() => {
    try {
      return event.data?.json() as { title?: string; body?: string; url?: string } | undefined
    } catch {
      return { title: 'Kairo', body: event.data?.text() }
    }
  })()
  event.waitUntil(
    sw.registration.showNotification(payload?.title ?? 'Kairo', { body: payload?.body ?? '', icon: '/icons/icon-192.png', data: { url: payload?.url ?? '/' } }),
  )
})

sw.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data?.url as string) ?? '/'
  event.waitUntil(
    (async () => {
      const all = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const c of all) {
        const w = c as WindowClient
        if (new URL(w.url).origin === sw.location.origin) {
          await w.focus()
          if ('navigate' in w) await w.navigate(url).catch(() => undefined)
          return
        }
      }
      await sw.clients.openWindow(url)
    })(),
  )
})
