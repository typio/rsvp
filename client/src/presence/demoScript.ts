import type {
  Selection,
  SelectionPoint,
  SelectionRange
} from '@/components/Schedule'

export const CAST = ['Anne', 'Buck', 'Chuck', 'Dee']
export const ACTORS = [0, 1, 2, 3]
export const YOU = -1

// ms
const START_DELAY = 400
const ACTOR_STAGGER = 900
const APPROACH_MS = 560
const YOU_APPROACH_MS = 1150
const SWEEP_MS = 85
const PRESS_HOLD = 150
const RELEASE_HOLD = 180
const GESTURE_GAP = 150
const YOU_HEAD_START = 500
const END_HOLD = 1400

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v))
const ri = (lo: number, hi: number) =>
  lo + Math.floor(Math.random() * (hi - lo + 1))

const emptyOthers = (days: number, slots: number): number[][][] =>
  Array.from({ length: days }, () =>
    Array.from({ length: slots }, () => [] as number[])
  )
export const emptyUser = (days: number, slots: number): boolean[][] =>
  Array.from({ length: days }, () => Array.from({ length: slots }, () => false))

export const rectCells = (g: Selection): SelectionPoint[] => {
  if (!g.range) return []
  const [d0, d1] = [g.range.from.dateIndex, g.range.to.dateIndex].sort(
    (a, b) => a - b
  )
  const [t0, t1] = [g.range.from.timeIndex, g.range.to.timeIndex].sort(
    (a, b) => a - b
  )
  const cells: SelectionPoint[] = []
  for (let d = d0; d <= d1; d++)
    for (let t = t0; t <= t1; t++) cells.push({ dateIndex: d, timeIndex: t })
  return cells
}

const sweepPath = (
  from: SelectionPoint,
  to: SelectionPoint
): SelectionPoint[] => {
  const dd = to.dateIndex - from.dateIndex
  const dt = to.timeIndex - from.timeIndex
  const steps = Math.max(Math.abs(dd), Math.abs(dt))
  if (steps === 0) return [from]
  return Array.from({ length: steps + 1 }, (_, i) => {
    const f = i / steps
    return {
      dateIndex: from.dateIndex + Math.round(dd * f),
      timeIndex: from.timeIndex + Math.round(dt * f)
    }
  })
}

const bboxOf = (gestures: Selection[]): SelectionRange => {
  let d0 = Infinity
  let d1 = -Infinity
  let t0 = Infinity
  let t1 = -Infinity
  for (const g of gestures) {
    if (!g.additive || !g.range) continue
    for (const p of [g.range.from, g.range.to]) {
      d0 = Math.min(d0, p.dateIndex)
      d1 = Math.max(d1, p.dateIndex)
      t0 = Math.min(t0, p.timeIndex)
      t1 = Math.max(t1, p.timeIndex)
    }
  }
  return {
    from: { dateIndex: d0, timeIndex: t0 },
    to: { dateIndex: d1, timeIndex: t1 }
  }
}

const fillRect = (
  u: boolean[][],
  from: SelectionPoint,
  to: SelectionPoint,
  v: boolean
): boolean[][] => {
  const [d0, d1] = [from.dateIndex, to.dateIndex].sort((a, b) => a - b)
  const [t0, t1] = [from.timeIndex, to.timeIndex].sort((a, b) => a - b)
  return u.map((col, d) =>
    d < d0 || d > d1 ? col : col.map((x, t) => (t < t0 || t > t1 ? x : v))
  )
}

type Rect = { d0: number; d1: number; r0: number; r1: number }
const toSel = (r: Rect, additive: boolean): Selection => ({
  range: {
    from: { dateIndex: r.d0, timeIndex: r.r0 },
    to: { dateIndex: r.d1, timeIndex: r.r1 }
  },
  additive
})
const rUnion = (a: Rect, b: Rect): Rect => ({
  d0: Math.min(a.d0, b.d0),
  d1: Math.max(a.d1, b.d1),
  r0: Math.min(a.r0, b.r0),
  r1: Math.max(a.r1, b.r1)
})
const rOverlap = (a: Rect, b: Rect) =>
  a.d0 <= b.d1 && a.d1 >= b.d0 && a.r0 <= b.r1 && a.r1 >= b.r0
const rContains = (a: Rect, b: Rect) =>
  a.d0 <= b.d0 && a.d1 >= b.d1 && a.r0 <= b.r0 && a.r1 >= b.r1
const degenerate = (r: Rect) => r.d0 > r.d1 || r.r0 > r.r1

// every anchor contains gold and no trim touches it: gold is guaranteed
export const buildGestures = (days: number, slots: number) => {
  const cd = (v: number) => clamp(v, 0, days - 1)
  const cr = (v: number) => clamp(v, 0, slots - 1)

  const gd0 = ri(0, days - 1)
  const gr0 = ri(0, Math.max(0, slots - 2))
  const gold: Rect = {
    d0: gd0,
    d1: cd(gd0 + ri(0, 1)),
    r0: gr0,
    r1: cr(gr0 + 1)
  }

  // outside bbox: an additive press always lands on an empty cell
  const limb = (b: Rect): Rect => {
    switch (ri(0, 3)) {
      case 0: // up
        return {
          d0: cd(b.d0 + ri(0, 1)),
          d1: cd(b.d1 - ri(0, 1)),
          r0: cr(b.r0 - ri(1, 3)),
          r1: cr(b.r0 - 1)
        }
      case 1: // down
        return {
          d0: cd(b.d0 + ri(0, 1)),
          d1: cd(b.d1 - ri(0, 1)),
          r0: cr(b.r1 + 1),
          r1: cr(b.r1 + ri(1, 3))
        }
      case 2: // left
        return {
          d0: cd(b.d0 - ri(1, 2)),
          d1: cd(b.d0 - 1),
          r0: cr(b.r0 + ri(0, 1)),
          r1: cr(b.r1 - ri(0, 1))
        }
      default: // right
        return {
          d0: cd(b.d1 + 1),
          d1: cd(b.d1 + ri(1, 2)),
          r0: cr(b.r0 + ri(0, 1)),
          r1: cr(b.r1 - ri(0, 1))
        }
    }
  }

  // inside b: a subtractive press always lands on a selected cell
  const cornerBite = (b: Rect): Rect => {
    const left = Math.random() < 0.5
    const top = Math.random() < 0.5
    const w = ri(0, Math.min(1, b.d1 - b.d0))
    const h = ri(0, Math.min(2, b.r1 - b.r0))
    return {
      d0: left ? b.d0 : b.d1 - w,
      d1: left ? b.d0 + w : b.d1,
      r0: top ? b.r0 : b.r1 - h,
      r1: top ? b.r0 + h : b.r1
    }
  }

  const actorGestures = (): Selection[] => {
    const gs: Selection[] = []
    const anchor: Rect = {
      d0: cd(gold.d0 - ri(0, 2)),
      d1: cd(gold.d1 + ri(0, 2)),
      r0: cr(gold.r0 - ri(0, 3)),
      r1: cr(gold.r1 + ri(0, 3))
    }
    let bbox = anchor
    gs.push(toSel(anchor, true))
    for (let i = ri(1, 2); i > 0; i--) {
      const L = limb(bbox)
      if (degenerate(L) || rContains(bbox, L)) continue
      gs.push(toSel(L, true))
      bbox = rUnion(bbox, L)
    }
    for (let i = ri(0, 1); i > 0; i--) {
      const T = cornerBite(anchor)
      if (degenerate(T) || rOverlap(T, gold)) continue
      gs.push(toSel(T, false))
    }
    return gs
  }

  const plans = ACTORS.map(a => {
    const gestures = actorGestures()
    return { actor: a, gestures, bbox: bboxOf(gestures) }
  })
  const youGestures = [
    toSel(
      {
        d0: cd(gold.d0 - ri(0, 1)),
        d1: cd(gold.d1 + ri(0, 1)),
        r0: cr(gold.r0 - 1),
        r1: cr(gold.r1 + 1)
      },
      true
    )
  ]
  return { plans, you: { gestures: youGestures, bbox: bboxOf(youGestures) } }
}

export type Cue = {
  at: number
  actor: number
  kind: 'aim' | 'press' | 'extend' | 'commit'
  cell?: SelectionPoint
  from?: SelectionPoint
  rest?: boolean
  gesture?: Selection
  additive?: boolean
}

const actorCues = (actor: number, gestures: Selection[], start: number) => {
  const approach = actor === YOU ? YOU_APPROACH_MS : APPROACH_MS
  const cues: Cue[] = []
  let clk = start
  cues.push({ at: clk, actor, kind: 'aim', rest: true })
  clk += PRESS_HOLD
  for (const g of gestures) {
    if (!g.range) continue
    const { from, to } = g.range
    const additive = g.additive
    const path = sweepPath(from, to)
    cues.push({ at: clk, actor, kind: 'aim', cell: from })
    clk += approach
    cues.push({
      at: clk,
      actor,
      kind: 'press',
      gesture: { range: { from, to: from }, additive },
      additive
    })
    clk += PRESS_HOLD
    path.forEach((cell, i) =>
      cues.push({
        at: clk + i * SWEEP_MS,
        actor,
        kind: 'extend',
        cell,
        from,
        additive
      })
    )
    clk += path.length * SWEEP_MS
    cues.push({
      at: clk,
      actor,
      kind: 'commit',
      gesture: { range: { from, to }, additive }
    })
    clk += RELEASE_HOLD + GESTURE_GAP
  }
  cues.push({ at: clk, actor, kind: 'aim', rest: true })
  clk += approach
  return { cues, end: clk }
}

export const buildCycle = (days: number, slots: number) => {
  const { plans, you } = buildGestures(days, slots)

  const build: Cue[] = []
  let maxEnd = 0
  plans.forEach(({ actor, gestures }, i) => {
    const r = actorCues(actor, gestures, START_DELAY + i * ACTOR_STAGGER)
    build.push(...r.cues)
    maxEnd = Math.max(maxEnd, r.end)
  })
  const yb = actorCues(YOU, you.gestures, maxEnd + GESTURE_GAP)
  build.push(...yb.cues)
  const buildTotal = yb.end + END_HOLD

  const wipe = (bbox: SelectionRange): Selection => ({
    range: bbox,
    additive: false
  })
  const teardown: Cue[] = []
  let tdEnd = 0
  for (const { actor, bbox } of plans) {
    const r = actorCues(actor, [wipe(bbox)], YOU_HEAD_START)
    teardown.push(...r.cues)
    tdEnd = Math.max(tdEnd, r.end)
  }
  const yt = actorCues(YOU, [wipe(you.bbox)], 0)
  teardown.push(...yt.cues)
  tdEnd = Math.max(tdEnd, yt.end)

  build.sort((a, b) => a.at - b.at)
  teardown.sort((a, b) => a.at - b.at)
  return { build, buildTotal, teardown, teardownTotal: tdEnd + END_HOLD * 0.4 }
}

const applyGesture = (o: number[][][], g: Selection, actor: number) => {
  if (!g.range) return o
  const [d0, d1] = [g.range.from.dateIndex, g.range.to.dateIndex].sort(
    (a, b) => a - b
  )
  const [t0, t1] = [g.range.from.timeIndex, g.range.to.timeIndex].sort(
    (a, b) => a - b
  )
  const add = g.additive
  return o.map((col, ci) =>
    ci < d0 || ci > d1
      ? col
      : col.map((arr, ti) => {
          if (ti < t0 || ti > t1) return arr
          if (add) return arr.includes(actor) ? arr : [...arr, actor]
          const i = arr.lastIndexOf(actor)
          if (i < 0) return arr
          const n = arr.slice()
          n.splice(i, 1)
          return n
        })
  )
}

// applyCue is the only transition: rAF playback and the reduced-motion fold share it
export type Stage = {
  othersSchedule: number[][][]
  userSchedule: boolean[][]
  drags: (Selection | null)[]
}

export const emptyStage = (days: number, slots: number): Stage => ({
  othersSchedule: emptyOthers(days, slots),
  userSchedule: emptyUser(days, slots),
  drags: ACTORS.map(() => null)
})

export const applyCue = (s: Stage, cue: Cue): Stage => {
  const { actor, kind } = cue
  if (kind === 'press')
    return actor === YOU
      ? s
      : { ...s, drags: s.drags.map((d, i) => (i === actor ? cue.gesture! : d)) }
  if (kind === 'extend')
    return actor === YOU
      ? {
          ...s,
          userSchedule: fillRect(
            s.userSchedule,
            cue.from!,
            cue.cell!,
            cue.additive!
          )
        }
      : {
          ...s,
          drags: s.drags.map((d, i) =>
            i === actor && d?.range
              ? { ...d, range: { ...d.range, to: cue.cell! } }
              : d
          )
        }
  if (kind === 'commit')
    return actor === YOU
      ? s
      : {
          ...s,
          othersSchedule: applyGesture(s.othersSchedule, cue.gesture!, actor),
          drags: s.drags.map((d, i) => (i === actor ? null : d))
        }
  return s // aim: cursor only
}
