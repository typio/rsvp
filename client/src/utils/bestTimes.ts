import { ScheduleData } from '@/types'
import { resolveTimeRange, timeSpan } from '@/utils/schedule'

export type TimeWindow = {
  dateIndex: number
  fromSlot: number
  toSlot: number // exclusive
  count: number
  total: number
  missing: string[]
  withYou: boolean
}

export const bestTimes = (data: ScheduleData, limit = 3): TimeWindow[] => {
  const present = data.absentReasons
    .slice(1)
    .flatMap((r, i) => (r === null ? [i] : []))
  const youPresent = data.absentReasons[0] === null
  const total = present.length + (youPresent ? 1 : 0)
  if (total < 2) return []
  const presentSet = new Set(present)
  const out: TimeWindow[] = []
  data.dates.dates.forEach((_, d) => {
    const slots = data.userSchedule[d]?.length ?? 0
    let run: { key: string; from: number; ids: number[] } | null = null
    const flush = (to: number) => {
      if (!run || run.ids.length < 2) return
      const ids = new Set(run.ids)
      const missing = [
        ...(youPresent && !ids.has(-1) ? ['me'] : []),
        ...present
          .filter(i => !ids.has(i))
          .map(i => data.others[i] || `User ${i + 1}`)
      ]
      out.push({
        dateIndex: d,
        fromSlot: run.from,
        toSlot: to,
        count: run.ids.length,
        total,
        missing,
        withYou: ids.has(-1)
      })
    }
    for (let t = 0; t < slots; t++) {
      const ids = [
        ...(youPresent && data.userSchedule[d][t] ? [-1] : []),
        ...(data.othersSchedule[d]?.[t] ?? []).filter(i => presentSet.has(i))
      ].sort((a, b) => a - b)
      const key = ids.join(',')
      if (run && run.key === key) continue
      flush(t)
      run = { key, from: t, ids }
    }
    flush(slots)
  })
  const ranked = out.sort(
    (a, b) =>
      b.count - a.count ||
      b.toSlot - b.fromSlot - (a.toSlot - a.fromSlot) ||
      a.dateIndex - b.dateIndex ||
      a.fromSlot - b.fromSlot
  )
  const top = ranked.slice(0, limit)
  // always one window with me
  if (youPresent && !top.some(w => w.withYou)) {
    const mine = ranked.find(w => w.withYou)
    if (mine) top.splice(Math.max(0, top.length - 1), 1, mine)
  }
  return top
}

const clock = (mins: number, withPeriod: boolean) => {
  const h = Math.floor(mins / 60) % 24
  const m = mins % 60
  const hh = h % 12 || 12
  const mm = m ? `:${String(m).padStart(2, '0')}` : ''
  return `${hh}${mm}${withPeriod ? (h < 12 ? ' AM' : ' PM') : ''}`
}

export const windowLabel = (data: ScheduleData, w: TimeWindow) => {
  const { fromHour24, toHour24 } = resolveTimeRange(data)
  const { slotsPerColumn } = timeSpan(fromHour24, toHour24, data.slotLength)
  const start = fromHour24 * 60 + w.fromSlot * data.slotLength
  const end =
    fromHour24 * 60 + Math.min(w.toSlot, slotsPerColumn) * data.slotLength
  const samePeriod = Math.floor(start / 60) % 24 < 12 === Math.floor(end / 60) % 24 < 12
  return `${clock(start, !samePeriod)} – ${clock(end, true)}`
}
