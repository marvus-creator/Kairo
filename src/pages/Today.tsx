import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { formatClock, formatLongDate, greeting } from '../engine/time'
import { useNowView } from '../hooks/useApp'
import { useNow } from '../store/clock'
import { Briefing, MissedCard, MomentumStrip, NextCard, QuickActions, SleepCard, TimetablePreview, TodayPlanCard, TomorrowCard, WeekendCard } from './today/Cards'
import { DayRibbon } from './today/DayRibbon'
import { NowCard } from './today/NowCard'

function BigClock({ fmt }: { fmt: '12h' | '24h' }) {
  const now = useNow()
  const [time, suffix] = formatClock(now, fmt).split(' ')
  return (
    <p className="tabular font-display text-[40px] leading-none font-medium text-ink sm:text-[52px]" aria-live="off">
      {time}
      {suffix && <span className="ml-1.5 align-top font-sans text-[15px] font-semibold text-muted">{suffix}</span>}
    </p>
  )
}

export function Today() {
  const { view, now, data } = useNowView()
  const [params] = useSearchParams()
  const eveningish = now.getHours() >= 15 || now.getHours() < 3
  useEffect(() => {
    if (params.get('view') === 'tomorrow') setTimeout(() => document.getElementById('tomorrow')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
  }, [params])

  return (
    <div className="flex flex-col gap-5">
      <header className="rise flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-muted">{formatLongDate(now)}</p>
            <h1 className="mt-1 font-display text-[26px] leading-tight text-ink sm:text-[32px]">
              {greeting(now)}, <span className="italic">{data.profile.name}</span>
            </h1>
          </div>
          <BigClock fmt={data.preferences.timeFormat} />
        </div>
        <p className="font-display text-[17px] text-ink-2 italic sm:text-[19px]">{view.headline}</p>
        <Briefing data={data} now={now} />
        <DayRibbon blocks={view.state.today} now={now} data={data} />
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-5">
          <NowCard view={view} now={now} data={data} />
          <MissedCard data={data} now={now} />
          <NextCard view={view} now={now} data={data} />
          <QuickActions />
          {eveningish ? <TomorrowCard data={data} now={now} /> : <TodayPlanCard view={view} now={now} data={data} />}
          <WeekendCard data={data} now={now} />
          <TimetablePreview data={data} now={now} />
        </div>
        <aside className="flex min-w-0 flex-col gap-5" aria-label="Today at a glance">
          <MomentumStrip data={data} now={now} />
          {eveningish ? <TodayPlanCard view={view} now={now} data={data} /> : <TomorrowCard data={data} now={now} />}
          <SleepCard data={data} now={now} />
        </aside>
      </div>
    </div>
  )
}
