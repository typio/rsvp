import { describe, expect, test } from 'bun:test'
import { bestTimes, windowLabel } from '@/utils/bestTimes'
import type { ScheduleData } from '@/types'

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

// 9am–1pm @60 → 4 slots/day
const room = (over: Partial<ScheduleData>): ScheduleData => ({
  eventName: 'x',
  userName: '',
  timezone: tz,
  slotLength: 60,
  dates: { mode: 0, dates: ['Sat Sep 12 2026', 'Sun Sep 13 2026'] },
  timeRange: { from: { hour: '9', isAM: true }, to: { hour: '1', isAM: false } },
  others: ['Ana', 'Bo', 'Cy'],
  absentReasons: [null, null, null, null],
  userSchedule: [[false, false, false, false], [false, false, false, false]],
  othersSchedule: [[[], [], [], []], [[], [], [], []]],
  ...over
})

describe('bestTimes', () => {
  test('ranks by headcount, merges adjacent slots with the same attendees', () => {
    const w = bestTimes(
      room({
        userSchedule: [[true, true, false, true], [false, true, true, true]],
        othersSchedule: [
          [[0, 1, 2], [0, 1], [1], [0]],
          [[], [0, 1], [0, 1], [0]]
        ],
        absentReasons: [null, null, null, 'busy']
      })
    )
    expect(w.map(x => [x.dateIndex, x.fromSlot, x.toSlot, x.count])).toEqual([
      [0, 0, 2, 3],
      [1, 1, 3, 3],
      [0, 3, 4, 2]
    ])
    expect(w[2].missing).toEqual(['Bo'])
    expect(w[0].withYou).toBe(true)
  })

  test('always includes one window with me when the top three exclude me', () => {
    const w = bestTimes(
      room({
        dates: { mode: 0, dates: ['Sat Sep 12 2026'] },
        userSchedule: [[false, false, false, true]],
        othersSchedule: [[[0, 1, 2], [0, 1], [1, 2], [0]]]
      })
    )
    expect(w.map(x => x.withYou)).toEqual([false, false, true])
    expect(w[2].missing).toEqual(['Bo', 'Cy'])
  })

  test('is empty until two people are present', () => {
    expect(
      bestTimes(room({ others: [], absentReasons: [null], othersSchedule: [[[], [], [], []], [[], [], [], []]] }))
    ).toEqual([])
  })

  test('names unnamed members by index', () => {
    const w = bestTimes(
      room({
        others: ['', 'Bo', ''],
        userSchedule: [[true, false, false, false], [false, false, false, false]],
        othersSchedule: [[[1], [], [], []], [[], [], [], []]]
      })
    )
    expect(w[0].missing).toEqual(['User 1', 'User 3'])
  })

  test('labels windows in clock time with one period when shared', () => {
    const d = room({})
    expect(windowLabel(d, { dateIndex: 0, fromSlot: 0, toSlot: 2, count: 2, total: 4, missing: [], withYou: true })).toBe('9 – 11 AM')
    expect(windowLabel(d, { dateIndex: 0, fromSlot: 2, toSlot: 4, count: 2, total: 4, missing: [], withYou: true })).toBe('11 AM – 1 PM')
  })
})
