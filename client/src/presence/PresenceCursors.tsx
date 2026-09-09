import { useEffect, useRef } from 'react'
import tinycolor from 'tinycolor2'
import { Colors } from '@/colors'
import type { XY } from '@/presence/types'

const TIP_X = 7
const TIP_Y = 5

export type CursorView = {
  key: number
  name: string
  color: string
  dragging: boolean
  visible: boolean
  follow: number
}

const labelText = (color: string) =>
  tinycolor
    .mostReadable(color, ['#ffffff', Colors.bgColor], {
      includeFallbackColors: true
    })
    .toHexString()

const PresenceCursors = ({
  cursors,
  targetOf,
  positions
}: {
  cursors: CursorView[]
  targetOf: (key: number) => XY | null
  positions?: React.MutableRefObject<Map<number, XY>>
}) => {
  const els = useRef<Map<number, HTMLDivElement>>(new Map())
  const own = useRef<Map<number, XY>>(new Map())
  const cur = positions ?? own
  // refs so the rAF effect runs once
  const cursorsRef = useRef(cursors)
  const targetRef = useRef(targetOf)
  cursorsRef.current = cursors
  targetRef.current = targetOf

  useEffect(() => {
    let raf = 0
    const tick = () => {
      for (const c of cursorsRef.current) {
        const t = targetRef.current(c.key)
        if (!t) continue
        let p = cur.current.get(c.key)
        if (!p) {
          p = { ...t }
          cur.current.set(c.key, p)
        }
        p.x += (t.x - p.x) * c.follow
        p.y += (t.y - p.y) * c.follow
        const el = els.current.get(c.key)
        if (el)
          el.style.transform = `translate(${p.x - TIP_X}px, ${p.y - TIP_Y}px)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none z-20">
      {cursors.map(c => {
        // first paint at the live target, not 0,0
        const start = cur.current.get(c.key) ??
          targetOf(c.key) ?? { x: 0, y: 0 }
        return (
          <div
            key={c.key}
            ref={el => {
              if (el) els.current.set(c.key, el)
              else els.current.delete(c.key)
            }}
            className="transition-opacity duration-75 absolute top-0 left-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.55)]"
            style={{
              transform: `translate(${start.x - TIP_X}px, ${start.y - TIP_Y}px)`,
              opacity: c.visible ? 1 : 0
            }}
          >
            <svg
              viewBox="0 0 62.46 50.16"
              width="36"
              height="36"
              fill={c.color}
              stroke={tinycolor(c.color).darken(25).toHexString()}
              xmlns="http://www.w3.org/2000/svg"
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <g
                className="transition-transform duration-150 ease-[cubic-bezier(0.34,1.6,0.64,1)]"
                style={{
                  transform: c.dragging ? 'scale(0.8)' : 'scale(1)',
                  transformOrigin: '32% 14%'
                }}
              >
                <path d="M42.88,15.94l-5.16-5.16s-2.3-2.08-4.25,0c-2.15,2.29-1.97,4.45-1.29,5.12l3.9,3.9-5.23-5.23s-2.94-2.08-4.61.16c-1.96,2.61-1.66,4.09-.92,4.83l3.95,3.93s-1.77-1.77-3.95-3.93c-3.28-3.27-7.46-7.45-7.85-7.86-.64-.69-2.75-2.75-5.5-.37s-.52,5.46-.52,5.46l14.33,14.33s.9.78.57,1.45-.82.91-1.18.75l-6.56-2.94s-2.21-.5-3.48,1.54c-.83,1.34-.29,2.9.57,3.64l13.33,8.83,13.07,4.5s5.24,1.25,9.25-1.59,8.89-9.36,8.89-9.36c0,0,1.95-2.73.93-8-.98-2.87-3.18-7.96-4.24-10.14-.31-.64-1.05-1.44-1.55-1.94l-10.71-10.74s-2.61-2.18-4.56-.27-1.62,4.69-1.39,4.92" />
              </g>
              {c.dragging && (
                <g stroke="#f1f2f3">
                  <line x1="14.94" y1="1" x2="14.94" y2="6.2" />
                  <line x1="21.13" y1="8.7" x2="24.75" y2="5.09" />
                  <line x1="8.85" y1="8.78" x2="4.97" y2="4.91" />
                  <line x1="6.39" y1="14.83" x2="1" y2="14.83" />
                  <line x1="8.81" y1="20.96" x2="4.98" y2="24.79" />
                </g>
              )}
            </svg>

            {c.name && (
              <span
                className="absolute left-11 top-3 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold shadow-sm transition-transform duration-200 ease-out origin-left"
                style={{
                  background: c.color,
                  color: labelText(c.color)
                }}
              >
                {c.name}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default PresenceCursors
