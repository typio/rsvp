import type { SelectionPoint } from '@/components/Schedule'
import type { XY } from './types'

export const REST_BANDS = [0.12, 0.4, 0.6, 0.88]

const LABEL_REACH = 74
const TITLE_GAP = 6
const TITLE_STAGGER = 28
const TIP_PAD = 8

export const cellPx = (
  wrap: HTMLElement | null,
  cell: SelectionPoint
): XY | null => {
  const el = wrap?.querySelector(
    `[data-cell="${cell.dateIndex}-${cell.timeIndex}"]`
  )
  if (!wrap || !el) return null
  const w = wrap.getBoundingClientRect()
  const r = el.getBoundingClientRect()
  return { x: r.left - w.left + r.width / 2, y: r.top - w.top + r.height / 2 }
}

const titlePx = (wrap: HTMLElement, slot: number): XY | null => {
  const t = wrap.querySelector('[data-grid-title]')
  if (!t) return null
  const w = wrap.getBoundingClientRect()
  const r = t.getBoundingClientRect()
  const onLeft = slot % 2 === 0
  const row = Math.floor(slot / 2)
  return {
    x: onLeft
      ? Math.max(
          TIP_PAD,
          r.left - w.left - TITLE_GAP - LABEL_REACH + (row === 0 ? 80 : 30)
        )
      : Math.min(
          w.width - LABEL_REACH,
          r.right - w.left + TITLE_GAP + TIP_PAD - (row === 0 ? 40 : 80)
        ),
    y: r.top - w.top + r.height / 2 - (1 - row) * TITLE_STAGGER
  }
}

export const visibleDays = (wrap: HTMLElement | null, days: number): number => {
  const sc = wrap?.querySelector('[data-grid-scroll]')
  if (!sc) return days
  const s = sc.getBoundingClientRect()
  const n = Array.from(sc.querySelectorAll('[data-slot-column]')).filter(
    c => c.getBoundingClientRect().right - s.left + sc.scrollLeft <= s.width + 1
  ).length
  return Math.max(1, Math.min(days, n))
}

export const restPx = (
  wrap: HTMLElement | null,
  slot: number,
  isYou = false
): XY => {
  const r = wrap?.getBoundingClientRect()
  const left = r?.left ?? 0
  const top = r?.top ?? 0
  const width = r?.width ?? 0
  const height = r?.height ?? 0
  const vw = window.innerWidth
  if (isYou)
    return {
      x: vw - left + 80 + Math.random() * 70,
      y: -top - 80 - Math.random() * 70
    }
  const band = REST_BANDS[slot % REST_BANDS.length]
  const onLeft = slot % 2 === 0
  const y = (band + (Math.random() - 0.5) * 0.22) * height
  const gutter = onLeft ? left : vw - (left + width)
  if (gutter < 110)
    return (
      (wrap && titlePx(wrap, slot)) ?? {
        x: onLeft ? -left - 60 : vw - left + 60,
        y
      }
    )
  const frac = 0.3 + Math.random() * 0.45
  return { x: onLeft ? -gutter * frac : width + gutter * frac, y }
}

export const offscreenEntry = (
  wrap: HTMLElement | null,
  slot: number,
  isYou = false
): XY => {
  const r = wrap?.getBoundingClientRect()
  const left = r?.left ?? 0
  const height = r?.height ?? 0
  if (isYou) return { x: window.innerWidth - left + 120, y: -200 }
  return {
    x: slot % 2 === 0 ? -180 : window.innerWidth - left + 120,
    y: REST_BANDS[slot % REST_BANDS.length] * height
  }
}
