// monte-carlo invariants for the demo generator + reducer
// run: bun scripts/verifyDemoScript.ts
import {
  ACTORS,
  applyCue,
  buildCycle,
  buildGestures,
  emptyStage,
  rectCells,
  YOU
} from '../src/presence/demoScript'

const SIZES: [number, number][] = [
  [7, 16],
  [2, 4],
  [1, 8],
  [10, 24],
  [1, 2],
  [3, 3]
]
const RUNS = 500

let checks = 0
const fails: string[] = []
const ok = (cond: boolean, label: string) => {
  checks++
  if (!cond && fails.length < 20) fails.push(label)
}

for (const [days, slots] of SIZES) {
  for (let run = 0; run < RUNS; run++) {
    const tag = `${days}x${slots} run ${run}`
    const { plans, you } = buildGestures(days, slots)
    const all = [...plans, { actor: YOU, gestures: you.gestures }]

    // per-actor replay: in-bounds + the press rule (additive on empty,
    // subtractive on selected) + each actor's final own-grid
    const finals: boolean[][][] = []
    for (const { actor, gestures } of all) {
      const grid: boolean[][] = Array.from({ length: days }, () =>
        Array(slots).fill(false)
      )
      for (const g of gestures) {
        if (!g.range) continue
        const cells = rectCells(g)
        ok(
          cells.every(
            c =>
              c.dateIndex >= 0 &&
              c.dateIndex < days &&
              c.timeIndex >= 0 &&
              c.timeIndex < slots
          ),
          `${tag}: in-bounds (actor ${actor})`
        )
        const press = grid[g.range.from.dateIndex]?.[g.range.from.timeIndex]
        ok(
          g.additive ? !press : !!press,
          `${tag}: bad press (actor ${actor}, additive=${g.additive})`
        )
        for (const c of cells) grid[c.dateIndex][c.timeIndex] = !!g.additive
      }
      finals.push(grid)
    }

    // gold: >=2 cells where every actor (incl you) ends selected
    let overlap = 0
    for (let d = 0; d < days; d++)
      for (let t = 0; t < slots; t++) if (finals.every(g => g[d][t])) overlap++
    ok(overlap >= 2, `${tag}: gold-forms (overlap=${overlap})`)

    // reducer: folding build reaches committed gold, teardown fold empties
    const { build, teardown } = buildCycle(days, slots)
    const built = build.reduce(applyCue, emptyStage(days, slots))
    let gold = 0
    for (let d = 0; d < days; d++)
      for (let t = 0; t < slots; t++)
        if (
          built.othersSchedule[d][t].length === ACTORS.length &&
          built.userSchedule[d][t]
        )
          gold++
    ok(gold >= 2, `${tag}: fold-gold (cells=${gold})`)
    ok(
      built.drags.every(x => x === null),
      `${tag}: drags remain after build`
    )

    const torn = teardown.reduce(applyCue, built)
    ok(
      torn.othersSchedule.every(col => col.every(c => c.length === 0)) &&
        torn.userSchedule.every(col => col.every(v => !v)),
      `${tag}: teardown leaves residue`
    )
  }
}

console.log(`${checks} checks (${SIZES.length} sizes x ${RUNS} runs)`)
if (fails.length) {
  for (const f of fails) console.log(`FAIL ${f}`)
  process.exit(1)
}
console.log('all invariants hold')
