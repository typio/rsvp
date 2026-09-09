import { ScheduleData } from '@/types'

export type FakeSpec = {
  n: number
  absent: number
  fill: number
  seed: number
  owner: boolean | null
  tz: string | null
  offline: boolean
}

const NAMES =
  'Ana Bo Cy Dee ElliotManning Fay Gus Hal JefferyHinton JosephKeller Kip Lu Mo Nia Oz Pia'.split(
    ' '
  )
const EXCUSES = [
  "I'm not available during these times.",
  'I no longer plan on attending this.',
  'out of town that week',
  ''
]

export const parseFake = (url: string): FakeSpec | null => {
  const q = new URL(url).searchParams
  const n = Math.min(NAMES.length, Number(q.get('fake')))
  if (!n) return null
  return {
    n,
    absent: q.has('absent') ? Number(q.get('absent')) : Math.floor(n / 4),
    fill: q.has('fill') ? Number(q.get('fill')) : 0.5,
    seed: Number(q.get('seed') ?? 1),
    owner: q.has('owner') ? q.get('owner') !== '0' : null,
    tz: q.get('tz'),
    offline: q.get('offline') === '1'
  }
}

const rng = (seed: number) => {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

// deterministic: re-applied on every ws update
export const withFake = (data: ScheduleData, f: FakeSpec): ScheduleData => {
  const rand = rng(f.seed * 7919 + f.n)
  const days = data.dates.dates.length
  const slots =
    data.userSchedule[0]?.length ?? data.othersSchedule[0]?.length ?? 0
  const names = Array.from({ length: f.n }, (_, i) => NAMES[i])
  const grids = names.map(() => {
    const g = Array.from({ length: days }, () =>
      Array<boolean>(slots).fill(false)
    )
    const target = f.fill * days * slots
    let painted = 0
    for (let guard = 0; painted < target && guard < 400; guard++) {
      const d = Math.floor(rand() * days)
      const len = 1 + Math.floor(rand() * Math.max(1, slots / 2))
      const t0 = Math.floor(rand() * Math.max(1, slots - len + 1))
      for (let t = t0; t < Math.min(slots, t0 + len); t++)
        if (!g[d][t]) {
          g[d][t] = true
          painted++
        }
    }
    return g
  })
  return {
    ...data,
    others: names,
    othersSchedule: Array.from({ length: days }, (_, d) =>
      Array.from({ length: slots }, (_, t) =>
        names.flatMap((_, i) => (grids[i][d][t] ? [i] : []))
      )
    ),
    absentReasons: [
      data.absentReasons[0] ?? null,
      ...names.map((_, i) =>
        i >= f.n - f.absent ? EXCUSES[i % EXCUSES.length] : null
      )
    ],
    timezone: f.tz ?? data.timezone
  }
}
