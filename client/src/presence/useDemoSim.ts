import { useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { ScheduleData } from '@/types'
import { SelectionPoint } from '@/components/Schedule'
import { timeSpan, convertTo24Hour } from '@/utils/schedule'
import type { Participant, XY } from '@/presence/types'
import { CursorView } from '@/presence/PresenceCursors'
import {
  ACTORS,
  applyCue,
  buildCycle,
  CAST,
  emptyStage,
  emptyUser,
  YOU
} from './demoScript'
import type { Cue, Stage } from './demoScript'
import { Colors } from '@/colors'
import * as geo from './geometry'

type Aim = { rest: XY } | { cell: SelectionPoint }

const RESTART_AFTER_MS = 3000
const BORROW_IDLE_MS = 200
const ARRIVE_PX = 3
const RETURN_TIMEOUT_MS = 1500
const FOLLOW = 0.13
const YOU_FOLLOW = 0.08
const TAKEN_OVER_FOLLOW = 1

export const useDemoSim = (
  data: ScheduleData,
  editSchedule: (newData: ScheduleData) => void,
  wrapRef: RefObject<HTMLDivElement>,
  enabled: boolean
) => {
  const days = data.dates.dates.length
  const slots = timeSpan(
    convertTo24Hour(data.timeRange.from.hour, data.timeRange.from.isAM),
    convertTo24Hour(data.timeRange.to.hour, data.timeRange.to.isAM),
    data.slotLength
  ).slotsPerColumn
  const valid = useMemo(() => days >= 1 && slots >= 1, [days, slots])

  const [stage, setStage] = useState<Stage>(() => emptyStage(days, slots))
  const [meta, setMeta] = useState<Record<number, { dragging: boolean }>>({})
  const [takenOver, setTakenOver] = useState(false)
  const [youInside, setYouInside] = useState(false)
  const [scrolledAway, setScrolledAway] = useState(false)

  // bots: wrap coords. the me hand: viewport coords (body portal)
  const aim = useRef<Map<number, Aim>>(new Map())
  const takenOverPointer = useRef<XY | null>(null)
  const hoverPointer = useRef<XY | null>(null)
  const lastClient = useRef<XY | null>(null)
  const lastRealMove = useRef(0)
  const returning = useRef(false)
  const borrowed = useRef(false)
  const [isBorrowed, setIsBorrowed] = useState(false)
  const returnTimer = useRef(0)
  const returnDeadline = useRef(0)
  const positions = useRef<Map<number, XY>>(new Map())
  const pressed = useRef(false)
  const setBorrowed = (v: boolean) => {
    if (!v) {
      clearInterval(returnTimer.current)
      clearTimeout(returnDeadline.current)
      returning.current = false
    }
    borrowed.current = v
    setIsBorrowed(v)
  }
  const stopRef = useRef<() => void>(() => {})
  const lastActivity = useRef(0)
  const dataRef = useRef(data)
  dataRef.current = data

  const setActorMeta = (actor: number, patch: Partial<{ dragging: boolean }>) =>
    setMeta(m => {
      const prev = m[actor] ?? { dragging: false }
      return { ...m, [actor]: { ...prev, ...patch } }
    })

  const actorColor = (a: number) =>
    a === YOU ? Colors.userColor : Colors.othersColors[a]

  const restPx = (actor: number): XY =>
    geo.restPx(wrapRef.current, actor, actor === YOU)

  const cellPx = (cell: SelectionPoint): XY | null =>
    geo.cellPx(wrapRef.current, cell)

  const offscreenEntry = (actor: number): XY =>
    geo.offscreenEntry(wrapRef.current, actor, actor === YOU)

  const targetOf = (key: number): XY | null => {
    const a = aim.current.get(key)
    if (!a) return offscreenEntry(key)
    return 'rest' in a ? a.rest : cellPx(a.cell)
  }

  const toViewport = (p: XY | null): XY | null => {
    const r = wrapRef.current?.getBoundingClientRect()
    return p && r ? { x: p.x + r.left, y: p.y + r.top } : p
  }

  const youTarget = (): XY | null => {
    if (takenOver) return takenOverPointer.current
    if (hoverPointer.current && (!borrowed.current || returning.current))
      return hoverPointer.current
    return toViewport(targetOf(YOU))
  }

  useEffect(() => {
    if (enabled) return
    setTakenOver(false)
    setYouInside(false)
    takenOverPointer.current = null
  }, [enabled])

  useEffect(() => {
    if (!enabled || takenOver || !valid) return

    setStage(emptyStage(days, slots))
    setMeta({})
    aim.current.clear()
    setBorrowed(false)

    const apply = (cue: Cue) => {
      const { actor, kind } = cue
      if (actor === YOU && hoverPointer.current) {
        // hand is on the pointer: skip rest legs, borrow on the first cell aim, return after
        if (!borrowed.current) {
          if (kind !== 'aim' || cue.rest) return
          if (pressed.current) return
          if (performance.now() - lastRealMove.current < BORROW_IDLE_MS) return
          setBorrowed(true)
        } else if (kind === 'aim' && cue.rest) {
          returning.current = true
          clearInterval(returnTimer.current)
          clearTimeout(returnDeadline.current)
          returnTimer.current = window.setInterval(() => {
            const p = positions.current.get(YOU)
            const t = hoverPointer.current
            if (!p || !t) return
            if (Math.hypot(p.x - t.x, p.y - t.y) < ARRIVE_PX) setBorrowed(false)
          }, 30)
          returnDeadline.current = window.setTimeout(
            () => setBorrowed(false),
            RETURN_TIMEOUT_MS
          )
          return
        }
      }
      if (kind === 'aim') {
        aim.current.set(
          actor,
          cue.rest ? { rest: restPx(actor) } : { cell: cue.cell! }
        )
        setActorMeta(actor, { dragging: false })
        return
      }
      if (kind === 'press') {
        aim.current.set(actor, { cell: cue.gesture!.range!.to })
        setActorMeta(actor, { dragging: true })
      } else if (kind === 'extend') {
        aim.current.set(actor, { cell: cue.cell! })
      } else {
        setActorMeta(actor, { dragging: false })
      }
      setStage(s => applyCue(s, cue))
    }

    const planDays = () => geo.visibleDays(wrapRef.current, days)

    const reduce = window.matchMedia?.(
      '(prefers-reduced-motion: reduce)'
    ).matches
    if (reduce) {
      const { build } = buildCycle(planDays(), slots)
      setStage(build.reduce(applyCue, emptyStage(days, slots)))
      return
    }

    let cyc = buildCycle(planDays(), slots)
    let phase = 1
    let raf = 0
    let start = performance.now()
    let idx = 0
    let paused = false
    let pausedAt = 0
    let stopped = false

    const tick = (now: number) => {
      if (stopped) return
      const seq = phase > 0 ? cyc.build : cyc.teardown
      const dur = phase > 0 ? cyc.buildTotal : cyc.teardownTotal
      const elapsed = now - start
      while (idx < seq.length && seq[idx].at <= elapsed) apply(seq[idx++])
      if (elapsed >= dur) {
        if (phase > 0)
          phase = -1
        else {
          cyc = buildCycle(planDays(), slots)
          phase = 1
          setStage(emptyStage(days, slots))
        }
        start = now
        idx = 0
      }
      raf = requestAnimationFrame(tick)
    }

    // pause: out of view, panned, or a popover is open
    let inView = true
    let scrolled = false
    let modal = false
    const sync = () => {
      if (stopped) return
      const run = inView && !scrolled && !modal
      if (run && paused) {
        paused = false
        start += performance.now() - pausedAt
        raf = requestAnimationFrame(tick)
      } else if (!run && !paused) {
        paused = true
        pausedAt = performance.now()
        cancelAnimationFrame(raf)
      }
    }
    const io = new IntersectionObserver(
      ([e]) => {
        inView = e.isIntersecting
        sync()
      },
      { threshold: 0.15 }
    )
    if (wrapRef.current) io.observe(wrapRef.current)
    const sc = wrapRef.current?.querySelector('[data-grid-scroll]')
    const onScroll = () => {
      scrolled = (sc?.scrollLeft ?? 0) > 1
      setScrolledAway(scrolled)
      sync()
    }
    sc?.addEventListener('scroll', onScroll, { passive: true })
    // radix popper wrapper in body = a popover is open
    const mo = new MutationObserver(() => {
      modal = !!document.querySelector('[data-radix-popper-content-wrapper]')
      sync()
    })
    mo.observe(document.body, { childList: true })

    stopRef.current = () => {
      stopped = true
      cancelAnimationFrame(raf)
      io.disconnect()
      mo.disconnect()
      sc?.removeEventListener('scroll', onScroll)
    }

    raf = requestAnimationFrame(tick)
    onScroll()
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      clearTimeout(returnTimer.current)
      io.disconnect()
      mo.disconnect()
      sc?.removeEventListener('scroll', onScroll)
    }
  }, [valid, days, slots, takenOver, enabled])

  const takeOver = (at?: XY) => {
    if (takenOver) return
    stopRef.current()
    lastActivity.current = performance.now()
    setStage(s => ({ ...s, drags: s.drags.map(() => null) }))
    if (at) {
      takenOverPointer.current = at
      setYouInside(true)
    }
    setTakenOver(true)
    editSchedule({
      ...data,
      others: [],
      absentReasons: [null],
      othersSchedule: [],
      userSchedule: emptyUser(days, slots)
    })
  }

  // viewport coords: page scroll needs no correction
  useEffect(() => {
    if (!enabled || takenOver) return
    const clear = () => {
      hoverPointer.current = null
      lastClient.current = null
      setYouInside(false)
    }
    const move = (e: PointerEvent) => {
      lastClient.current = { x: e.clientX, y: e.clientY }
      hoverPointer.current = lastClient.current
      lastRealMove.current = performance.now()
      if (borrowed.current) {
        setBorrowed(false)
        setActorMeta(YOU, { dragging: false })
      }
      setYouInside(true)
    }
    const out = (e: PointerEvent) => {
      if (!e.relatedTarget) clear() // left the window
    }
    const down = () => {
      pressed.current = true
      if (borrowed.current) {
        setBorrowed(false)
        setActorMeta(YOU, { dragging: false })
      }
    }
    const end = (e: PointerEvent) => {
      pressed.current = false
      if (e.pointerType !== 'mouse') clear() // touch: no hover after lift
    }
    window.addEventListener('pointermove', move)
    document.addEventListener('pointerout', out)
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.removeEventListener('pointermove', move)
      document.removeEventListener('pointerout', out)
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      hoverPointer.current = null
      pressed.current = false
    }
  }, [takenOver, enabled])

  useEffect(() => {
    if (!enabled || !takenOver) return
    const up = () => setActorMeta(YOU, { dragging: false })
    const move = (e: PointerEvent) => {
      lastActivity.current = performance.now()
      lastClient.current = { x: e.clientX, y: e.clientY }
      takenOverPointer.current = lastClient.current
      setYouInside(true)
    }
    const out = (e: PointerEvent) => {
      if (!e.relatedTarget) setYouInside(false) // left the window
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointermove', move)
    document.addEventListener('pointerout', out)
    return () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointermove', move)
      document.removeEventListener('pointerout', out)
    }
  }, [takenOver, enabled])

  // enabled gate matters: would resurrect the bots in a real room
  useEffect(() => {
    if (!enabled || !takenOver) return
    const id = setInterval(() => {
      const u = dataRef.current.userSchedule
      const empty = !u?.some(col => col?.some(Boolean))
      if (
        empty &&
        performance.now() - lastActivity.current > RESTART_AFTER_MS
      ) {
        setTakenOver(false)
        setYouInside(false)
        takenOverPointer.current = null
      }
    }, 1000)
    return () => clearInterval(id)
  }, [takenOver, enabled])

  const onPointerDown = (e: React.PointerEvent) => {
    if (!enabled) return
    const at = { x: e.clientX, y: e.clientY }
    if (!takenOver) {
      const onSlot = (e.target as Element).closest?.('[data-cell]')
      if (onSlot) takeOver(at)
      return
    }
    takenOverPointer.current = at
    setActorMeta(YOU, { dragging: true })
  }

  const participants: Participant[] =
    !enabled || takenOver
      ? []
      : ACTORS.map(a => ({
          id: a,
          name: CAST[a],
          colorIndex: a,
          drag: stage.drags[a]
        }))

  const shown: ScheduleData = useMemo(
    () =>
      !enabled || takenOver
        ? data
        : {
            ...data,
            others: CAST,
            absentReasons: Array(CAST.length + 1).fill(null),
            othersSchedule: stage.othersSchedule,
            userSchedule: stage.userSchedule
          },
    [enabled, takenOver, data, stage]
  )

  const cursors: CursorView[] =
    !enabled || takenOver
      ? []
      : ACTORS.map(key => ({
          key,
          name: CAST[key],
          color: actorColor(key),
          dragging: meta[key]?.dragging ?? false,
          visible: !scrolledAway,
          follow: FOLLOW
        }))

  const youCursor: CursorView[] = !enabled
    ? []
    : [
        {
          key: YOU,
          name: 'Me',
          color: Colors.userColor,
          dragging: meta[YOU]?.dragging ?? false,
          visible: youInside || (!takenOver && !scrolledAway),
          follow:
            takenOver || (youInside && !isBorrowed)
              ? TAKEN_OVER_FOLLOW
              : YOU_FOLLOW
        }
      ]

  return {
    shown,
    participants,
    cursors,
    targetOf,
    youCursor,
    youTarget,
    onPointerDown,
    editSchedule: !enabled
      ? editSchedule
      : (nd: ScheduleData) =>
          nd.slotLength !== data.slotLength
            ? editSchedule({
                ...data,
                slotLength: nd.slotLength,
                userSchedule: []
              })
            : takenOver
              ? editSchedule(nd)
              : setStage(s => ({ ...s, userSchedule: nd.userSchedule })),
    takenOver,
    positions,
    cursorHidden: youInside
  }
}
