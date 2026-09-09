import { useEffect, useRef, useState } from 'react'
import { Colors } from '@/colors'
import type { XY } from './types'
import type { CursorView } from './PresenceCursors'

const YOU = -1

export const useOwnCursor = (enabled: boolean) => {
  const pos = useRef<XY | null>(null)
  const [visible, setVisible] = useState(false)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!enabled) return
    const move = (e: PointerEvent) => {
      pos.current = { x: e.clientX, y: e.clientY }
      setVisible(true)
    }
    const down = (e: PointerEvent) => {
      pos.current = { x: e.clientX, y: e.clientY }
      setDragging(true)
    }
    const up = () => setDragging(false)
    const out = (e: PointerEvent) => {
      if (!e.relatedTarget) setVisible(false) // left the window
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointerup', up)
    document.addEventListener('pointerout', out)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
      document.removeEventListener('pointerout', out)
      setVisible(false)
      setDragging(false)
    }
  }, [enabled])

  const cursors: CursorView[] = enabled
    ? [
        {
          key: YOU,
          name: '',
          color: Colors.userColor,
          dragging,
          visible,
          follow: 1
        }
      ]
    : []

  const targetOf = () => pos.current

  return { cursors, targetOf }
}
