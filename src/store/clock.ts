import { useSyncExternalStore } from 'react'

const SIM_KEY = 'kairo:sim'

interface Sim {
  base: number
  setAt: number
}

let sim: Sim | null = readSim()
const listeners = new Set<() => void>()
let tick = 0
let timer: ReturnType<typeof setInterval> | null = null

function readSim(): Sim | null {
  try {
    const raw = localStorage.getItem(SIM_KEY)
    if (!raw) return null
    const v = JSON.parse(raw)
    return Number.isFinite(v?.base) && Number.isFinite(v?.setAt) ? v : null
  } catch {
    return null
  }
}

export function appNow(): number {
  return sim ? sim.base + (Date.now() - sim.setAt) : Date.now()
}

export function realNow(): number {
  return Date.now()
}

export function isSimulating(): boolean {
  return sim !== null
}

export function setSimulation(at: Date | null) {
  sim = at ? { base: +at, setAt: Date.now() } : null
  try {
    if (sim) localStorage.setItem(SIM_KEY, JSON.stringify(sim))
    else localStorage.removeItem(SIM_KEY)
  } catch {
    void 0
  }
  emit()
}

function emit() {
  tick++
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  if (!timer) timer = setInterval(emit, 1000)
  return () => {
    listeners.delete(l)
    if (!listeners.size && timer) {
      clearInterval(timer)
      timer = null
    }
  }
}

export function useTick(): number {
  return useSyncExternalStore(subscribe, () => tick)
}

export function useNow(granularity: 'second' | 'minute' = 'second'): Date {
  useTick()
  const t = appNow()
  const rounded = granularity === 'minute' ? Math.floor(t / 60_000) * 60_000 : Math.floor(t / 1000) * 1000
  return memoDate(rounded)
}

const cache = new Map<number, Date>()
function memoDate(t: number): Date {
  let d = cache.get(t)
  if (!d) {
    if (cache.size > 8) cache.clear()
    d = new Date(t)
    cache.set(t, d)
  }
  return d
}

const WEEKDAY: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }

export function parseSimParam(v: string, reference = new Date()): Date | null {
  const iso = new Date(v)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v) && !Number.isNaN(+iso)) return iso
  const m = /^(sun|mon|tue|wed|thu|fri|sat)[a-z]*[-_ ]?(\d{1,2}):?(\d{2})$/i.exec(v.trim())
  if (!m) return null
  const target = WEEKDAY[m[1].toLowerCase()]
  const d = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate())
  const diff = (target - d.getDay() + 7) % 7
  d.setDate(d.getDate() + diff)
  d.setHours(Number(m[2]), Number(m[3]), 0, 0)
  return d
}

export function applySimFromUrl() {
  try {
    const url = new URL(window.location.href)
    const v = url.searchParams.get('sim')
    if (v === null) return
    if (v === 'off' || v === '') setSimulation(null)
    else {
      const d = parseSimParam(v)
      if (d) setSimulation(d)
    }
    url.searchParams.delete('sim')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  } catch {
    void 0
  }
}
