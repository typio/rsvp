import { describe, expect, test } from 'bun:test'
import { slotPaint } from '@/utils/slotPaint'
import { Colors } from '@/colors'

const idle = { range: null, additive: true }
const adding = { range: { from: { dateIndex: 0, timeIndex: 0 }, to: { dateIndex: 0, timeIndex: 0 } }, additive: true }
const removing = { ...adding, additive: false }
const ids = (n: number) => Array.from({ length: n }, (_, i) => i)

const paint = (
  o: Partial<{
    selected: boolean
    drag: boolean
    selection: typeof idle
    cell: number[]
    count: number
    present: number[]
    hovering: number | null
  }> = {}
) =>
  slotPaint(
    false,
    o.selected ?? false,
    o.drag ?? false,
    o.selection ?? idle,
    o.cell ?? [],
    o.count ?? 3,
    o.present ?? ids(o.count ?? 3),
    o.hovering ?? null
  )

describe('slotPaint · everyone (gold)', () => {
  test('needs me plus every present member', () => {
    expect(paint({ selected: true, cell: [0, 1, 2] }).fill).toBe(Colors.allColor)
    expect(paint({ selected: false, cell: [0, 1, 2] }).fill).not.toBe(Colors.allColor)
    expect(paint({ selected: true, cell: [0, 1] }).fill).not.toBe(Colors.allColor)
  })
  test('ignores absent members, including their stale cells', () => {
    expect(paint({ selected: true, cell: [0, 1, 2], present: [0, 1] }).fill).toBe(Colors.allColor)
    expect(paint({ selected: true, cell: [0, 1], present: [0, 1] }).fill).toBe(Colors.allColor)
  })
})

describe('slotPaint · lanes (≤5 others)', () => {
  test('my lane is first, others follow in index order, missing lanes are null', () => {
    const { lanes } = paint({ selected: true, cell: [2], count: 3 })
    expect(lanes).toEqual([Colors.userColor, null, null, Colors.othersColors[2] + 'ff'])
  })
  test('hovering a name: their cells go solid in their color, other cells dim', () => {
    const hit = paint({ selected: true, cell: [0, 1], count: 3, hovering: 2 })
    expect(hit.lanes).toBeNull()
    expect(hit.fill).toBe(Colors.othersColors[1])
    const miss = paint({ selected: true, cell: [0], count: 3, hovering: 2 })
    expect(miss.lanes?.[0]).not.toBe(Colors.userColor)
    expect(miss.lanes?.[1]).toBe(Colors.othersColors[0] + '4d')
  })
})

describe('slotPaint · density (>5 others)', () => {
  test('fill counts others only; my band carries me', () => {
    const a = paint({ selected: false, cell: [0, 1], count: 8, present: ids(8) })
    const b = paint({ selected: true, cell: [0, 1], count: 8, present: ids(8) })
    expect(a.fill).toBe(b.fill)
    expect(a.youBand).toBeNull()
    expect(b.youBand).toBe(Colors.userColor)
  })
  test('band states: adding stays solid, removing goes faint', () => {
    expect(paint({ drag: true, selection: adding, count: 8, present: ids(8) }).youBand).toBe(Colors.userColor)
    expect(paint({ selected: true, drag: true, selection: removing, count: 8, present: ids(8) }).youBand).not.toBe(Colors.userColor)
  })
  test('hovering a name dims cells without them and lifts cells with them', () => {
    const without = paint({ cell: [0], count: 8, present: ids(8), hovering: 3 })
    const with_ = paint({ cell: [2], count: 8, present: ids(8), hovering: 3 })
    expect(with_.fill).toBe(Colors.userColor)
    expect(without.fill.endsWith('ff')).toBe(false)
  })
})
