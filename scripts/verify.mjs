import puppeteer from 'puppeteer-core'
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 5191
const BASE = `http://localhost:${PORT}`
const SHOTS = resolve('verify-shots')
mkdirSync(SHOTS, { recursive: true })

const server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { shell: true, stdio: 'pipe' })
await new Promise((r) => {
  server.stdout.on('data', (d) => String(d).includes('localhost') && r())
  setTimeout(r, 8000)
})

const results = []
const errors = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
const context = await browser.createBrowserContext()
const page = await context.newPage()
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`))
await page.setViewport({ width: 1440, height: 960 })

const text = () => page.evaluate(() => document.body.innerText)
const has = (t, s) => t.toLowerCase().includes(s.toLowerCase())
const clickText = async (label, selector = 'button, a, [role=radio]') => {
  const ok = await page.evaluate(
    (label, selector) => {
      const el = [...document.querySelectorAll(selector)].find((e) => e.textContent?.trim().includes(label) && !e.disabled)
      if (el) el.click()
      return !!el
    },
    label,
    selector,
  )
  if (!ok) throw new Error(`No clickable element with text "${label}"`)
  await sleep(250)
}
const shot = async (name, mobile = false) => {
  if (mobile) await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await sleep(350)
  await page.screenshot({ path: resolve(SHOTS, `${name}${mobile ? '-mobile' : ''}.png`), fullPage: false })
  if (mobile) await page.setViewport({ width: 1440, height: 960 })
}
const sim = async (s, path = '/') => {
  await page.goto(`${BASE}${path}${path.includes('?') ? '&' : '?'}sim=${s}`, { waitUntil: 'networkidle0' })
  await sleep(700)
}
const nowTitle = () => page.$eval('#now-title', (e) => e.textContent?.trim()).catch(() => null)

try {
  const cdp = await browser.target().createCDPSession()
  await cdp.send('Browser.setPermission', { permission: { name: 'notifications' }, setting: 'denied', origin: BASE, browserContextId: context.id }).catch((e) => console.log('permission override failed', e.message))

  await page.goto(BASE, { waitUntil: 'networkidle0' })
  const rootHasContent = await page.$eval('#root', (e) => e.children.length > 0)
  check('App renders (root has content)', rootHasContent)
  check('First-run onboarding shows', has(await text(), 'Open it. Know what to do.'))
  await shot('00-onboarding')
  await shot('00-onboarding', true)
  await clickText('Continue')
  check('Onboarding shows sleep math', has(await text(), 'of sleep on school nights'))
  await shot('01-onboarding-day')
  await clickText('Continue')
  check('Onboarding preloads the real timetable', has(await text(), 'Your timetable is loaded'))
  await shot('02-onboarding-timetable')
  await clickText('Continue')
  await clickText('Data Structures (DSA)')
  await clickText('Continue')
  check('Notification denied handled in onboarding', has(await text(), 'blocked'))
  await clickText('Open my day')
  await sleep(600)
  check('Dashboard loads after onboarding', !!(await nowTitle()))

  await sim('mon-08:20')
  let t = await text()
  check('S1 Monday 8:20 → NOW is Embedded System Software', (await nowTitle()) === 'Embedded System Software', await nowTitle())
  check('S1 headline says you are in class', has(t, 'You’re in Embedded System Software.'))
  check('S1 next is Web3', has(t, 'Web3'))
  await shot('s1-mon-0820')
  await shot('s1-mon-0820', true)

  await sim('tue-16:25')
  t = await text()
  check('S2 Tuesday 4:25 → Office Hours', has(t, 'Office Hours'))
  check('S2 recommends the Database assignment', (await nowTitle())?.includes('Normalization') ?? false, await nowTitle())
  await shot('s2-tue-1625')

  await sim('wed-20:55')
  t = await text()
  check('S3 Wednesday 8:55 PM → headline names Thursday', has(t, 'Tomorrow is Thursday. You have DSA, Java, Physics II and Career.'))
  check('S3 prepare tonight lists DSA, Java, Physics', ['Data Structures (DSA)', 'Java', 'Applied Physics II'].every((s) => has(t, s)) && has(t, 'Prepare tonight'))
  await shot('s3-wed-2055')
  await shot('s3-wed-2055', true)

  await sim('thu-15:45')
  check('S4 Thursday 3:45 PM → Career Guidance', (await nowTitle()) === 'Career Guidance', await nowTitle())
  await sim('thu-15:45', '/timetable')
  t = await text()
  check('Timetable marks the current class', has(t, 'Now') && has(t, 'remaining'))
  await shot('tt-thu-1545')
  await shot('tt-thu-1545', true)

  await sim('fri-17:30')
  t = await text()
  check('S5 Friday 5:30 PM → week complete', has(t, 'Week complete. Weekend review plan ready.'))
  check('S5 weekend plan shows Saturday and Sunday', has(t, 'Weekend plan') && has(t, 'Saturday') && has(t, 'Sunday'))
  await shot('s5-fri-1730')

  await sim('sun-20:30')
  t = await text()
  check('S6 Sunday 8:30 PM → prepare Monday', has(t, 'Your week starts tomorrow. Prepare Embedded, Web3 and Soft. Eng.'))
  await shot('s6-sun-2030')

  await sim('wed-21:00')
  check('Evening study mode at 9 PM', has(await text(), 'Evening study'))
  await shot('evening-wed-2100')
  await clickText('Start session')
  await sleep(600)
  check('Starting a session opens the timer', has(await text(), 'Focusing'))
  await shot('timer-running')
  await sleep(3200)
  await page.reload({ waitUntil: 'networkidle0' })
  await sleep(800)
  const elapsed = await page.evaluate(() => {
    const el = [...document.querySelectorAll('p')].find((p) => p.nextElementSibling?.textContent === 'Elapsed')
    return el?.textContent ?? ''
  })
  const secs = elapsed.split(':').reduce((a, b) => a * 60 + Number(b), 0)
  check('S7 timer survives a refresh', secs >= 3 && has(await text(), 'Focusing'), `elapsed ${elapsed}`)
  await clickText('Pause')
  const pausedAt = await page.evaluate(() => [...document.querySelectorAll('p')].find((p) => p.nextElementSibling?.textContent === 'Elapsed')?.textContent)
  await sleep(1500)
  const pausedLater = await page.evaluate(() => [...document.querySelectorAll('p')].find((p) => p.nextElementSibling?.textContent === 'Elapsed')?.textContent)
  check('Pause stops the clock', pausedAt === pausedLater, `${pausedAt} vs ${pausedLater}`)
  await clickText('Resume')
  await clickText('Focus mode')
  check('Focus mode opens', !!(await page.$('[aria-label="Focus mode"][role="dialog"]')))
  await shot('focus-mode')
  await page.keyboard.press('Escape')
  await sleep(200)
  await clickText('End session')
  check('Completion asks how it went', has(await text(), 'How did this session go?'))
  await clickText('Great')
  await page.type('input[list="complete-topics"]', 'Generics')
  await clickText('Good', '[role=radio]')
  await shot('complete-dialog')
  await clickText('Complete session')
  await sleep(400)
  check('Session saved to history', has(await text(), 'Recent sessions') && has(await text(), 'Generics'))

  await sim('wed-21:00', '/settings')
  t = await text()
  check('S8 denied notifications: settings explains and app still works', has(t, 'blocked') && has(t, 'reminders appear inside the app'))

  await sim('thu-07:00')
  t = await text()
  check('S9 missed session detected with recovery options', has(t, 'Missed:') && has(t, 'Add to Office Hours'))
  await shot('s9-missed')
  await clickText('Add to Office Hours')
  await sleep(300)
  check('S9 missed session rescheduled calmly', has(await text(), 'Added to your next Office Hours'))

  await sim('wed-21:10')
  await page.keyboard.press('n')
  await sleep(300)
  await page.type('input[data-autofocus]', 'Software Engineering report')
  await page.select('[role=dialog] select', 'se').catch(() => undefined)
  const dateInput = await page.$('input[type=date]')
  await dateInput.click({ clickCount: 3 })
  await page.evaluate(() => {
    const el = document.querySelector('input[type=date]')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    const d = new Date()
    d.setDate(d.getDate() + 1)
    setter.call(el, d.toISOString().slice(0, 10))
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.evaluate(() => {
    const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'high'))
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
    setter.call(sel, 'high')
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await clickText('Add task', '[role=dialog] button')
  await sleep(300)
  await page.evaluate(() => document.querySelector('[aria-label="More options"]')?.click())
  await sleep(200)
  await clickText('Re-plan from now').catch(() => undefined)
  await sleep(500)
  check('S10 assignment due tomorrow takes priority tonight', (await nowTitle()) === 'Software Engineering report', await nowTitle())
  await shot('s10-assignment')

  await sim('wed-18:00', '/day')
  check('My Day page renders', has(await text(), 'Kairo plans for me'))
  await clickText('I’ll plan it myself')
  await page.evaluate(() => {
    const inputs = [...document.querySelectorAll('input[type=time]')]
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(inputs[0], '18:30')
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }))
    setter.call(inputs[1], '19:30')
    inputs[1].dispatchEvent(new Event('input', { bubbles: true }))
    const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'java'))
    const sset = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
    sset.call(sel, 'java')
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await sleep(200)
  await clickText('Add block')
  await sleep(300)
  t = await text()
  check('My Day: custom block appears on the timeline', has(t, 'Study Java') && has(t, 'YOU'))
  await shot('myday')
  await shot('myday', true)
  await sim('wed-18:40')
  check('My Day: NOW follows your own plan', has(await text(), 'Your plan') && (await nowTitle())?.includes('Java'), await nowTitle())

  for (const [path, name, must] of [['/study', 'study', 'Recommended for you now'], ['/plan', 'plan', 'Tasks & exams'], ['/insights', 'insights', 'Weekly goal'], ['/settings', 'settings', 'Developer']]) {
    await sim('wed-21:30', path)
    check(`${name} page renders`, has(await text(), must))
    await shot(name)
    await shot(name, true)
  }

  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
  await sim('wed-21:15')
  check('Dark mode applies', (await page.$eval('html', (e) => e.dataset.theme)) === 'dark')
  await shot('dark-today')
  await shot('dark-today', true)
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }])
  await sim('wed-21:15')
  check('Light mode applies', (await page.$eval('html', (e) => e.dataset.theme)) === 'light')
  await shot('light-today')
  await shot('light-today', true)
  await sim('thu-10:30', '/timetable')
  await shot('light-timetable')

  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  await sim('mon-08:20')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check('Mobile has no horizontal overflow', overflow <= 1, `${overflow}px`)

  const manifest = await page.evaluate(async () => (await fetch('/manifest.webmanifest')).json())
  check('PWA manifest has icons + standalone', manifest.display === 'standalone' && manifest.icons.length >= 3)
  const sw = await page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration()
    return !!r
  })
  check('Service worker registered', sw)
} catch (e) {
  check('Script completed', false, e.message)
  await page.screenshot({ path: resolve(SHOTS, 'error.png') })
} finally {
  const relevant = errors.filter((e) => !e.includes('favicon'))
  check('No console or page errors', relevant.length === 0, relevant.slice(0, 5).join(' | '))
  await browser.close()
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(server.pid), '/T', '/F'])
  else server.kill()
  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  process.exit(failed.length ? 1 : 0)
}
