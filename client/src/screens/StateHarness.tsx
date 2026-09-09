import Schedule from '@/components/Schedule'
import { DaySelectMode, WeekDayNumber } from '@/components/DateSelect'
import { ScheduleData } from '@/types'
import { h24ToTimeRange } from '@/utils'
import { timeSpan } from '@/utils/schedule'
import { addDays } from 'date-fns'
import { useState } from 'react'

type AvailFn = (day: number, slot: number) => boolean

type OtherMock = {
  name: string
  avail?: AvailFn
  absent?: string | null
}

const never: AvailFn = () => false
const always: AvailFn = () => true
const between =
  (a: number, b: number): AvailFn =>
  (_day, slot) =>
    slot >= a && slot < b
const onDay =
  (day: number, inner: AvailFn): AvailFn =>
  (d, s) =>
    d === day && inner(d, s)

const BASE_DATE = new Date(2026, 5, 15)

const mkRoom = (opts: {
  days?: number
  baseDate?: Date
  fromHour?: number
  toHour?: number
  slotLength?: number
  you?: AvailFn
  others?: OtherMock[]
  daysOfWeek?: WeekDayNumber[]
  timezone?: string
}): ScheduleData => {
  const slotLength = opts.slotLength ?? 30
  const fromHour = opts.fromHour ?? 9
  const toHour = opts.toHour ?? 17
  const { slotsPerColumn } = timeSpan(fromHour, toHour, slotLength)

  const dates: ScheduleData['dates'] = opts.daysOfWeek
    ? { mode: DaySelectMode.DaysOfWeek, dates: opts.daysOfWeek }
    : {
        mode: DaySelectMode.Dates,
        dates: Array.from({ length: opts.days ?? 3 }).map((_, i) =>
          addDays(opts.baseDate ?? BASE_DATE, i).toDateString()
        )
      }

  const others = opts.others ?? []
  const you = opts.you ?? never

  const grid = <T,>(fill: (day: number, slot: number) => T): T[][] =>
    Array.from({ length: dates.dates.length }).map((_, d) =>
      Array.from({ length: slotsPerColumn }).map((_, s) => fill(d, s))
    )

  return {
    eventName: 'Mock Event',
    userName: 'You',
    dates,
    slotLength,
    timeRange: h24ToTimeRange({ from_hour: fromHour, to_hour: toHour }),
    userSchedule: grid(you),
    othersSchedule: grid((d, s) =>
      others.flatMap((o, i) =>
        !o.absent && (o.avail ?? never)(d, s) ? [i] : []
      )
    ),
    others: others.map(o => o.name),
    absentReasons: [null, ...others.map(o => o.absent ?? null)],
    timezone: opts.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  }
}

const manyOthers = (n: number): OtherMock[] =>
  Array.from({ length: n }).map((_, i) => ({
    name: `User ${i + 1}`,
    avail: between(i * 2, i * 2 + 4)
  }))

type StateCase = {
  name: string
  expect: string
  data: ScheduleData
  hoveringUser?: number
  isDraftRoom?: boolean
}

const CASES: StateCase[] = [
  {
    name: 'solo',
    expect: 'Only your blue, no overlay anywhere.',
    data: mkRoom({ you: between(4, 10) })
  },
  {
    name: 'disjoint',
    expect: 'Your blue and Ana never touch; both fully visible.',
    data: mkRoom({
      you: between(0, 4),
      others: [{ name: 'Ana', avail: between(8, 12) }]
    })
  },
  {
    name: 'partial-overlap',
    expect:
      "BUG: slots 6-10 are you+Ana but not Ben, so no gold — your blue should stay visible there but Ana's color fully covers it. (With a single other, overlap = everyone = gold by design.)",
    data: mkRoom({
      you: between(4, 10),
      others: [
        { name: 'Ana', avail: between(6, 12) },
        { name: 'Ben', avail: between(0, 2) }
      ]
    })
  },
  {
    name: 'mixed-subsets',
    expect:
      'BUG: a person should keep a stable stripe position down a column — positions shift between slots.',
    data: mkRoom({
      you: between(2, 12),
      others: [
        { name: 'Ana', avail: between(0, 8) },
        { name: 'Ben', avail: between(4, 12) },
        { name: 'Cara', avail: onDay(1, always) }
      ]
    })
  },
  {
    name: 'gold',
    expect:
      'Slots 4-8 gold on every day (everyone overlaps). Factory canary — if not gold, the mocks are wrong.',
    data: mkRoom({
      you: between(4, 8),
      others: [
        { name: 'Ana', avail: between(4, 8) },
        { name: 'Ben', avail: between(4, 8) }
      ]
    })
  },
  {
    name: 'gold-with-absent',
    expect:
      'BUG: all present users overlap in 4-8, should be gold — shows stripes because absent Ben counts.',
    data: mkRoom({
      you: between(4, 8),
      others: [
        { name: 'Ana', avail: between(4, 8) },
        { name: 'Ben', avail: between(4, 8), absent: 'sick' }
      ]
    })
  },
  {
    name: 'eight-others',
    expect:
      'Stripe scaling: 8 users, stripes a few px wide, spin() hues collide.',
    data: mkRoom({ you: between(6, 10), others: manyOthers(8) })
  },
  {
    name: 'hover-other-offby1',
    hoveringUser: 3,
    expect:
      "BUG (>5 others): User 3's slots (4-8) highlight, but in a hue one spin-step off from their stripe color.",
    data: mkRoom({ others: manyOthers(7) })
  },
  {
    name: 'hover-you',
    hoveringUser: 0,
    expect: 'Your slots stay full blue; everything else dims to 30%.',
    data: mkRoom({
      you: between(4, 10),
      others: [{ name: 'Ana', avail: between(6, 12) }]
    })
  },
  {
    name: 'overnight',
    expect:
      'Split at midnight with a gap. BUG: drag/hover below the gap tracks the wrong slot (geometry ignores the gap).',
    data: mkRoom({ fromHour: 22, toHour: 2, you: between(2, 6) })
  },
  {
    name: 'overnight-full-24h',
    expect: 'from == to renders a full 24h column.',
    data: mkRoom({ fromHour: 9, toHour: 9, you: between(10, 20) })
  },
  {
    name: 'days-of-week',
    expect: 'Mon/Wed/Fri columns, availability only on Mon.',
    data: mkRoom({
      daysOfWeek: [1, 3, 5],
      you: onDay(0, between(2, 8)),
      others: [{ name: 'Ana', avail: onDay(2, between(2, 8)) }]
    })
  },
  {
    name: 'tz-offset',
    expect:
      'Room is Asia/Tokyo: hours shifted into your tz + notice below grid. (Inert if you are in Tokyo.)',
    data: mkRoom({
      timezone: 'Asia/Tokyo',
      you: between(4, 10),
      others: [{ name: 'Ana', avail: between(4, 10) }]
    })
  },
  {
    name: 'dst-mismatch',
    expect:
      'Room is America/New_York across the EU/US fall-back gap: red DST warning. Also exercises the scroll slider (10 cols).',
    data: mkRoom({
      timezone: 'America/New_York',
      baseDate: new Date(2026, 9, 23),
      days: 10,
      you: between(2, 6)
    })
  },
  {
    name: 'slot-15',
    expect: '15m precision: 32 rows, same overall height per hour.',
    data: mkRoom({ slotLength: 15, you: between(8, 20) })
  },
  {
    name: 'slot-60',
    expect: '1h precision: 8 tall rows.',
    data: mkRoom({ slotLength: 60, you: between(2, 5) })
  },
  {
    name: 'create-mode',
    isDraftRoom: true,
    expect:
      'Create grid: drag-add previews full blue, drag-remove dims existing to 30%.',
    data: mkRoom({ you: between(4, 10) })
  }
]

const noop = () => {}

const StateTile = ({ c }: { c: StateCase }) => {
  const [data, setData] = useState(c.data)

  return (
    <div data-case={c.name} className="flex flex-col gap-y-2">
      <div className="flex flex-col gap-y-0.5">
        <div className="flex flex-row items-baseline gap-x-3">
          <span className="font-medium">{c.name}</span>
          {c.hoveringUser !== undefined && (
            <span className="text-xs text-muted-foreground">
              hoveringUser: {c.hoveringUser}
            </span>
          )}
        </div>
        <span className="text-sm text-muted-foreground">{c.expect}</span>
      </div>
      <Schedule
        isDraftRoom={c.isDraftRoom ?? false}
        data={data}
        editSchedule={setData}
        hoveringUser={c.hoveringUser ?? null}
        setHoveredSlotUsers={noop}
      />
    </div>
  )
}

const StateHarness = () => (
  <main className="flex flex-col gap-y-12 w-full max-w-2xl mx-auto px-4 pb-16">
    <div className="flex flex-col gap-y-1">
      <h1 className="text-lg font-medium">Slot state harness</h1>
      <p className="text-sm text-muted-foreground">
        Every slot-grid state with pinned mock data. Tiles are interactive —
        drag to test selection previews.
      </p>
    </div>
    {CASES.map(c => (
      <StateTile key={c.name} c={c} />
    ))}
  </main>
)

export default StateHarness
