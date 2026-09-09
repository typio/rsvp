import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { ReadyState } from 'react-use-websocket'
import { useWebSocketContext } from '@/contexts/WebSocketContext'
import { Colors } from '@/colors'
import type { Selection, SelectionPoint } from '@/components/Schedule'
import type { Participant, XY } from './types'
import type { CursorView } from './PresenceCursors'
import * as geo from './geometry'

const SEND_MS = 50
const STALE_MS = 6000
const FOLLOW = 0.13

type Remote = {
  cell: SelectionPoint | null
  drag: Selection | null
  dragging: boolean
  seen: number
}

export const useLivePresence = (
  others: string[],
  wrapRef: RefObject<HTMLDivElement>,
  enabled: boolean,
  ownDrag: Selection | null
) => {
  const ownDragRef = useRef(ownDrag)
  ownDragRef.current = ownDrag
  const { sendMessage, addMessageHandler, removeMessageHandler, readyState } =
    useWebSocketContext()

  const remotes = useRef<Map<number, Remote>>(new Map())
  const rests = useRef<Map<number, XY>>(new Map())
  const [, setVersion] = useState(0)

  useEffect(() => {
    if (!enabled) return
    const remoteMap = remotes.current
    const restMap = rests.current
    addMessageHandler(
      'presence',
      (payload: {
        othersIndex: number
        data: {
          cell?: SelectionPoint | null
          drag?: Selection | null
          dragging?: boolean
        }
      }) => {
        const i = payload.othersIndex
        const prev = remoteMap.get(i)
        const cell = payload.data?.cell ?? null
        const drag = payload.data?.drag ?? null
        const dragging = !!payload.data?.dragging
        remoteMap.set(i, { cell, drag, dragging, seen: performance.now() })
        if (cell) restMap.delete(i)
        else if (!restMap.has(i)) restMap.set(i, geo.restPx(wrapRef.current, i))
        if (
          !prev ||
          prev.dragging !== dragging ||
          JSON.stringify(prev.drag) !== JSON.stringify(drag)
        )
          setVersion(v => v + 1)
      }
    )
    return () => {
      removeMessageHandler('presence')
      remoteMap.clear()
      restMap.clear()
    }
  }, [enabled, addMessageHandler, removeMessageHandler, wrapRef])

  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => {
      const now = performance.now()
      let changed = false
      remotes.current.forEach((r, i) => {
        if (now - r.seen > STALE_MS) {
          remotes.current.delete(i)
          rests.current.delete(i)
          changed = true
        }
      })
      if (changed) setVersion(v => v + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [enabled])

  useEffect(() => {
    if (!enabled || readyState !== ReadyState.OPEN) return
    const wrap = wrapRef.current
    if (!wrap) return

    let cell: SelectionPoint | null = null
    let dragging = false
    let lastSentAt = 0
    let lastKey = ''
    let timer: number | undefined

    const flush = () => {
      timer = undefined
      const drag = ownDragRef.current
      const key = `${cell?.dateIndex},${cell?.timeIndex},${dragging},${JSON.stringify(drag?.range)},${drag?.additive}`
      if (key === lastKey) return
      lastKey = key
      lastSentAt = performance.now()
      sendMessage(
        JSON.stringify({
          message_type: 'presence',
          payload: { cell, drag, dragging }
        })
      )
    }
    const queue = () => {
      if (timer !== undefined) return
      const wait = Math.max(0, SEND_MS - (performance.now() - lastSentAt))
      timer = window.setTimeout(flush, wait)
    }
    const cellFrom = (e: PointerEvent): SelectionPoint | null => {
      const attr = (e.target as Element)
        .closest?.('[data-cell]')
        ?.getAttribute('data-cell')
      if (!attr) return null
      const [d, t] = attr.split('-').map(Number)
      return Number.isNaN(d) || Number.isNaN(t)
        ? null
        : { dateIndex: d, timeIndex: t }
    }
    const move = (e: PointerEvent) => {
      cell = cellFrom(e)
      queue()
    }
    const down = (e: PointerEvent) => {
      dragging = true
      cell = cellFrom(e)
      queue()
    }
    const up = () => {
      dragging = false
      queue()
    }
    const leave = () => {
      cell = null
      dragging = false
      queue()
    }
    wrap.addEventListener('pointermove', move)
    wrap.addEventListener('pointerdown', down)
    wrap.addEventListener('pointerleave', leave)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      if (timer !== undefined) clearTimeout(timer)
      wrap.removeEventListener('pointermove', move)
      wrap.removeEventListener('pointerdown', down)
      wrap.removeEventListener('pointerleave', leave)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [enabled, readyState, sendMessage, wrapRef])

  const targetOf = (key: number): XY | null => {
    const r = remotes.current.get(key)
    if (!r) return null
    if (r.cell) return geo.cellPx(wrapRef.current, r.cell)
    return rests.current.get(key) ?? null
  }

  const cursors: CursorView[] = !enabled
    ? []
    : Array.from(remotes.current.entries()).map(([i, r]) => ({
        key: i,
        name: others[i]?.length ? others[i] : `User ${i + 1}`,
        color: Colors.othersColors[i % Colors.othersColors.length],
        dragging: r.dragging,
        visible: true,
        follow: FOLLOW
      }))

  const participants: Participant[] = !enabled
    ? []
    : Array.from(remotes.current.entries()).map(([i, r]) => ({
        id: i,
        name: others[i]?.length ? others[i] : `User ${i + 1}`,
        colorIndex: i,
        drag: r.drag
      }))

  return { cursors, targetOf, participants }
}
