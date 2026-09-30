# Kairo — your academic day, decided

Kairo is a personal academic operating system. Open it and within five seconds you know **where you are, what time it is, what you should be doing right now, what comes next, and what to prepare for tomorrow**. It is driven by a real school timetable, the live clock, and your workload — not a static planner.

> *Kairos* (Greek): the right, opportune moment. The logo is a progress ring with a coral "now" dot.

## Run it

```bash
pnpm install
pnpm dev          # http://localhost:5190  (or double-click start.bat)
pnpm test         # 50 scheduling-engine tests (Vitest)
pnpm build        # production build + service worker in dist/
pnpm verify       # builds must exist; drives headless Chrome through 42 end-to-end checks
```

No environment variables, no server, no account. Node 22+.

## Stack and why

| Choice | Reason |
|---|---|
| **Vite + React 19 + TypeScript** | Everything runs on the device; a server framework (Next.js) would add infrastructure with no benefit. |
| **Tailwind CSS v4** with CSS-variable design tokens | One token set, real light and dark themes. |
| **Zustand + versioned localStorage persistence** | Local-first, instant, offline. Data is validated and migrated on every load. |
| **vite-plugin-pwa (injectManifest) + Workbox** | Installable, offline, custom service worker for notifications. |
| **Vitest + puppeteer-core** | Engine unit tests + real-browser scenario tests. |

## Architecture

```
src/
  domain/types.ts        data model (AppData): profile, school, routine, subjects, teachers, topics,
                         tasks, exams, projects, sessions, notes, day plans, preferences, notifications
  data/timetable.ts      YOUR timetable (PE ↔ Career Guidance swap applied) — real data, not decoration
  data/seed.ts           defaults, routine, clearly-flagged sample data
  engine/                PURE functions, no I/O, clock injected — all judgement lives here
    time.ts              date/time primitives (local time, DST-safe)
    schedule.ts          timetable + routine + your own blocks → a gap-free timeline; getNow()
    priority.ts          candidate scoring (deadline, tomorrow relevance, weakness, SRS, exams…)
    plan.ts              packs ranked candidates into a study block (breaks, recall slot)
    recommend.ts         the NOW view, headline, daily + tomorrow briefing, weekend plan, sleep
    myday.ts             "plan it myself": copy Kairo's plan, validate your blocks
    missed.ts            missed-session detection + capped catch-up rescheduling
    srs.ts               lightweight spaced repetition (SM-2 style)
    stats.ts             streaks, consistency, balance, insights, week overview
    timer.ts             timer math derived from timestamps (refresh-proof), Pomodoro phases
    notifications.ts     which reminders are due in a time window; quiet hours / DND / categories
  store/                 persisted store (all writes), sanitizer/migrations, simulated clock, UI state
  lib/notify.ts          permission flow, delivery, background queue for the service worker
  sw.ts                  service worker: precache, offline, notification clicks, periodic sync
  pages/ dialogs/ ui/    the interface
```

The UI never computes schedules itself — every screen calls the engine, so the dashboard, notifications, missed-session logic and statistics always agree.

**Multi-student ready:** the timetable, routine, subjects and preferences are data. Another student changes them in Settings (or imports a backup) — no code changes. Adding cloud sync later means persisting `AppData` somewhere other than localStorage.

## Main features

- **NOW card** — current class with teacher and progress, or the exact study item for this minute, with *Start session*. Adapts to devotion, breaks, lunch, Office Hours, commute, home, evening study, wind-down and sleep.
- **Contextual headline** — "You're in Embedded System Software." / "Tomorrow is Thursday. You have DSA, Java, Physics II and Career." / "Week complete. Weekend review plan ready." / "Your week starts tomorrow. Prepare Embedded, Web3 and Soft. Eng."
- **Day ribbon** — the whole day as a strip with a live now-marker.
- **Recommendation engine** — assignments due tomorrow beat everything; tomorrow's classes come next (a subject counts as prepared only if studied *after* its last class); exams ramp from light review (14 days) to focused practice (7) to high priority (3) to short final recall (1); weak subjects, overdue spaced reviews and neglected subjects fill the rest; personal projects wait for Office Hours and weekends.
- **Office Hours intelligence** — a 60-minute plan (e.g. finish the Database assignment, then a review) with *Start* or *Choose another*.
- **Morning recall, evening study, weekend mode** — each block gets its own plan; weekends keep real free time.
- **My Day (plan it yourself)** — per day, choose *Kairo plans for me* or *I'll plan it myself*. Add your own study blocks (a subject, a task, or "Kairo picks") and activities (football, family, rest). *Start from Kairo's plan* copies the automatic plan so you can edit it. Your blocks override the routine, never school, and everything (NOW card, reminders, missed-session logic, stats) follows them.
- **Timer** — countdown, stopwatch, Pomodoro (focus / short / long break), pause/resume, focus mode, completion screen (Great / Okay / Difficult + topic rating + one-line note). Survives refreshes and browser restarts.
- **Spaced repetition** — rating a topic (Review again / Hard / Good / Easy) schedules its next review automatically.
- **Tasks, exams, personal projects, notes** — lightweight, with urgency grouping and duplicate warnings.
- **Missed sessions** — *Reschedule / Add to Office Hours / Add to weekend / Skip*. At most 4 open catch-ups; older ones drop so the backlog can never become impossible.
- **I'm overloaded** — essentials only (due-tomorrow work, one prep, a 20-minute recall). **I'm done for today** — quiet rest.
- **Insights** — today/week/month, weekly goal ring, streak, consistency score, 14-day chart, study balance, neglected subjects, milestones, plain-language insights.
- **Sleep is visible** — the plan never schedules into sleep; a card shows tonight's planned sleep against your target.

## Your timetable

Loaded from `src/data/timetable.ts`. Edit it in the app: **Settings → School timetable** (per day: times, kind, subject, teacher; *Restore original* resets it). Add holidays under **Days off** — those days switch to weekend mode. Change your usual routine (wake, commute, evening study, bedtime) in **Settings → Daily routine & sleep**; change a single day in **My Day**.

## Notifications — how they work, honestly

1. Enable in onboarding or **Settings → Notifications** (the browser asks for permission).
2. While Kairo is open — or in a background tab, or installed and running — a scheduler checks every 20 seconds and fires reminders through the service worker (`registration.showNotification`). If the app is visible, you get an in-app toast instead.
3. Categories (Classes, Study blocks, Assignments, Tests, Daily plan, Missed sessions), lead time, quiet hours (default 23:00–03:30) and Do-not-disturb are all respected. Timer alerts you started always come through.

**Limitations (browser platform, not bugs):**
- A web app **cannot schedule an exact-time notification while completely closed.** The API that allowed it (Notification Triggers) was abandoned by browsers. Reliable closed-app reminders need Web Push from a server — Kairo has no server by design. The service worker already handles `push` events, so adding a push server later is straightforward.
- As a best effort, Kairo writes the next 24 hours of reminders to a cache and registers **Periodic Background Sync** (Chrome/Edge on Android and desktop, installed PWAs only). The browser decides how often that runs (often every few hours), so treat it as a bonus, not a guarantee.
- **iPhone/iPad:** notifications only work after *Share → Add to Home Screen* (iOS 16.4+), and only while the app is active or recently backgrounded.
- If permission is denied, everything still works; reminders appear inside the app.

## Install as an app (PWA)

Build and serve it (`pnpm build && pnpm preview`, or deploy `dist/` to any static host with HTTPS).
- **Chrome/Edge desktop:** install icon in the address bar.
- **Android:** menu → *Install app*.
- **iPhone:** Share → *Add to Home Screen*.

It works offline after the first load. Updates show a *Reload* prompt.

## Your data

- Stored in this browser's localStorage (`kairo:data`), saved on every change. It survives refreshes, restarts and offline use.
- Every load runs a **sanitizer + migration**: missing fields get defaults, invalid dates and times are dropped, duplicates are removed. If the stored JSON is corrupt, Kairo starts fresh, keeps the damaged copy under `kairo:corrupt-backup`, and tells you.
- **Settings → Data:** export or import a JSON backup (validated before import), remove sample data, or reset.
- Browser storage is per-device and can be wiped by clearing site data — **export a backup regularly.**
- Changing time zone: Kairo follows the device clock and tells you when the zone changed.

## Time simulation (for testing)

**Settings → Developer**, or add `?sim=wed-21:00` (or an ISO time like `?sim=2026-10-05T08:15`) to the URL. Simulated time keeps ticking and a banner shows it; *Use real time* exits.

## Verified scenarios

`pnpm test` (engine) and `pnpm verify` (real Chrome, desktop and 390px mobile, light and dark) cover:

| Scenario | Result |
|---|---|
| Mon 8:20 AM | NOW = Embedded System Software (Willy, 1h 20m left); next Web3 |
| Tue 4:25 PM | Office Hours → the Database assignment first |
| Wed 8:55 PM | "Tomorrow is Thursday…"; prepare DSA, Java, Physics (Career Guidance needs no prep) |
| Thu 3:45 PM | Career Guidance |
| Fri 5:30 PM | "Week complete"; Saturday + Sunday plan with deep work and free time |
| Sun 8:30 PM | "Your week starts tomorrow. Prepare Embedded, Web3 and Soft. Eng." |
| Refresh mid-session | Timer continues from the right time; pause stays paused |
| Notifications denied | Explained in Settings; the app is fully usable |
| Missed session | Detected, with recovery options; catch-ups capped |
| Assignment due tomorrow | Takes the first evening slot |

## Possible next steps (non-critical)

- Web Push server for guaranteed closed-app reminders.
- Optional cloud sync / accounts for multi-device and classmates.
- Timetable import from a photo or CSV for other students.
- Per-subject credit weighting for exam seasons.
