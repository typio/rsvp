import { describe, expect, test } from 'bun:test'
import { parseFake, withFake } from '@/utils/devFake'
import type { ScheduleData } from '@/types'

const base: ScheduleData = {
  eventName: 'x',
  userName: '',
  timezone: 'UTC',
  slotLength: 30,
  dates: { mode: 0, dates: Array.from({ length: 7 }, (_, i) => `d${i}`) },
  timeRange: { from: { hour: '9', isAM: true }, to: { hour: '5', isAM: false } },
  others: [],
  absentReasons: [null],
  othersSchedule: [],
  userSchedule: Array.from({ length: 7 }, () => Array(16).fill(false))
}
const fake = (q: string) => withFake(base, parseFake(`http://x/?${q}`)!)

describe('devFake', () => {
  test('parses the url options', () => {
    expect(parseFake('http://x/')).toBeNull()
    expect(parseFake('http://x/?fake=6&absent=2&fill=0.8&seed=3&owner=0&tz=Europe/Berlin&offline=1')).toEqual({
      n: 6, absent: 2, fill: 0.8, seed: 3, owner: false, tz: 'Europe/Berlin', offline: true
    })
    expect(parseFake('http://x/?fake=99')!.n).toBe(16)
  })

  test('is deterministic per seed and differs across seeds', () => {
    expect(fake('fake=6')).toEqual(fake('fake=6'))
    expect(fake('fake=6&seed=2')).not.toEqual(fake('fake=6'))
  })

  test('shapes the room: n members, absent tail, grid dims, my slot preserved', () => {
    const d = fake('fake=8&absent=3')
    expect(d.others).toHaveLength(8)
    expect(d.absentReasons).toHaveLength(9)
    expect(d.absentReasons[0]).toBeNull()
    expect(d.absentReasons.slice(1).filter(r => r !== null)).toHaveLength(3)
    expect(d.othersSchedule).toHaveLength(7)
    expect(d.othersSchedule.every(day => day.length === 16)).toBe(true)
    expect(d.userSchedule).toBe(base.userSchedule)
  })

  test('fill=1 puts every member in every cell; fill=0 in none', () => {
    const full = fake('fake=5&absent=0&fill=1')
    expect(full.othersSchedule.every(day => day.every(cell => cell.length === 5))).toBe(true)
    const none = fake('fake=5&absent=0&fill=0')
    expect(none.othersSchedule.every(day => day.every(cell => cell.length === 0))).toBe(true)
  })
})
