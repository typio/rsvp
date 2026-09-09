import { faEraser } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button } from './ui/button'
import { ScheduleData } from '@/types'
import { API_URL, SITE_URL, h12To24 } from '@/utils'
import { Slider } from '@/components/ui/slider'
import { NavigateFunction } from 'react-router-dom'
import {
  checkIsDragSelected,
  formatTime,
  resolveTimeRange,
  timeSpan
} from '@/utils/schedule'

import {
  ScheduleProvider,
  useScheduleContext
} from '@/contexts/ScheduleContext'
import { DAYS_OF_WEEK, DaySelectMode } from './DateSelect'
import { addDays, isSameDay } from 'date-fns'
import { toast } from 'sonner'
import { slotPaint } from '@/utils/slotPaint'
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group'
import { Label } from './ui/label'
import type { Participant } from '@/presence/types'

const TIME_COL_WIDTH = 44
const HEADER_HEIGHT = 64
const BASE_CELL_HEIGHT = 20
export const STRIPE_PX = 10
export const STRIPE_GAP_PX = 1
export const STRIPE_GAP = 'rgb(255 255 255 / 0.4)'
export const YOU_STRIPE_GAP_PX = 20

export const youStripe = (color: string, base = '0px') => {
  const at = (px: number) => `calc(${base} + ${px}px)`
  return `repeating-linear-gradient(45deg, ${color} ${at(0)} ${at(STRIPE_PX)}, transparent ${at(STRIPE_PX)} ${at(STRIPE_PX + YOU_STRIPE_GAP_PX)})`
}

export const stripeStops = (colors: string[], base = '0px') =>
  colors
    .map((c, i) => {
      const at = (px: number) => `calc(${base} + ${px}px)`
      const from = i * STRIPE_PX
      const to = (i + 1) * STRIPE_PX
      return `${c} ${at(from)} ${at(to - STRIPE_GAP_PX)}, ${STRIPE_GAP} ${at(to - STRIPE_GAP_PX)} ${at(to)}`
    })
    .join(', ')
const SCROLL_PAD = 16
const SNAP_IDLE_MS = 80
const SNAP_TWEEN_MS = 150
const CELL_HEIGHT_FOR_SLOT = (slotLength: number) =>
  Math.max(BASE_CELL_HEIGHT, BASE_CELL_HEIGHT * (slotLength / 30))

export type SelectionPoint = {
  dateIndex: number
  timeIndex: number
}

export type SelectionRange = {
  from: SelectionPoint
  to: SelectionPoint
}

export type Selection = {
  range: SelectionRange | null
  additive: boolean
}

export const createRoom = (
  scheduleData: ScheduleData,
  navigate: NavigateFunction
): boolean => {
  if (scheduleData.dates.dates.length === 0) {
    toast.error("You haven't picked any days!", {
      description: 'How would that work?',
      action: {
        label: 'Good point.',
        onClick: () => {}
      }
    })
    return false
  }

  const fromHour =
    h12To24(
      Number(scheduleData.timeRange.from.hour),
      scheduleData.timeRange.from.isAM
    ) || 0
  const toHour =
    h12To24(
      Number(scheduleData.timeRange.to.hour),
      scheduleData.timeRange.to.isAM
    ) || 0
  // full grid: the draft sim can leave userSchedule []
  const slots = timeSpan(
    fromHour,
    toHour,
    scheduleData.slotLength
  ).slotsPerColumn
  const schedule = scheduleData.dates.dates.map((_, d) =>
    Array.from(
      { length: slots },
      (_, t) => scheduleData.userSchedule?.[d]?.[t] ?? false
    )
  )

  let req = JSON.stringify({
    event_name: scheduleData.eventName,
    schedule_type: scheduleData.dates.mode,
    dates: scheduleData.dates.dates,
    time_range: { from_hour: fromHour, to_hour: toHour },
    slot_length: scheduleData.slotLength,
    schedule,
    timezone: scheduleData.timezone
  })

  fetch(`${API_URL}/api/rooms`, {
    method: 'POST',
    body: req,
    credentials: 'include'
  })
    .then(res => {
      if (res.status === 200) {
        res.json().then(resJSON => {
          if (typeof gtag === 'function') {
            gtag('event', 'conversion', {
              send_to: 'G-8H3Q20DJJ4/CREATE_ROOM'
            })
          }
          const shareURL = `${SITE_URL}/${resJSON.room_uid}`
          navigator.clipboard.writeText(shareURL)
          toast.success(shareURL, {
            description: 'Link copied to clipboard.',
            position: 'top-right'
          })

          localStorage.removeItem('storedDraftRoomState')
          window.scrollTo(0, 0) // Room instance survives the route swap
          navigate(`/${resJSON.room_uid}`)
        })
      } else {
        throw new Error(
          res.status === 429
            ? 'Too many rooms at once. Give it a minute.'
            : `Error ${res.status}: ${res.statusText}`
        )
      }
    })
    .catch((e: TypeError) =>
      toast.error('Error creating room.', {
        description: e.message,
        cancel: {
          label: 'Dismiss',
          onClick: () => {}
        }
      })
    )
  return false
}

type TimeCalculations = {
  timeDifference: number
  slotsPerHour: number
  slotsPerColumn: number
  hoursPerColumn: number
  fromHour24: number
  toHour24: number
  hasTzOffset: boolean
  hasDstMismatch: boolean
}

const Schedule = ({
  isDraftRoom,
  data,
  editSchedule,
  hoveringUser,
  setHoveredSlotUsers,
  roster,
  bottomContent,
  controls = true,
  participants = [],
  className = '',
  onDragChange
}: {
  isDraftRoom: boolean
  data: ScheduleData
  editSchedule: (newSchedule: ScheduleData) => void
  hoveringUser: number | null
  setHoveredSlotUsers: (arg0: any) => void
  roster?: ReactNode
  bottomContent?: ReactNode
  controls?: boolean
  className?: string
  participants?: Participant[]
  onDragChange?: (drag: Selection | null) => void
}) => {
  const { fromHour24, toHour24, hasTzOffset, hasDstMismatch } =
    resolveTimeRange(data)

  const { timeDifference, hoursPerColumn, slotsPerHour, slotsPerColumn } =
    timeSpan(fromHour24, toHour24, data.slotLength)

  return (
    <ScheduleProvider
      isDraftRoom={isDraftRoom}
      initialData={data}
      editSchedule={editSchedule}
      hoveringUser={hoveringUser}
      setHoveredSlotUsers={setHoveredSlotUsers}
      onDragChange={onDragChange}
    >
      <ScheduleContent
        roster={roster}
        bottomContent={bottomContent}
        controls={controls}
        participants={participants}
        className={className}
        time={{
          timeDifference,
          slotsPerHour,
          slotsPerColumn,
          hoursPerColumn,
          fromHour24,
          toHour24,
          hasTzOffset,
          hasDstMismatch
        }}
      />
    </ScheduleProvider>
  )
}

const ScheduleContent = ({
  time,
  roster,
  bottomContent,
  controls,
  participants,
  className = ''
}: {
  time: TimeCalculations
  roster?: ReactNode
  bottomContent?: ReactNode
  controls?: boolean
  participants: Participant[]
  className?: string
}) => {
  const {
    isDraftRoom,
    data,
    editSchedule,
    currentSelection,
    isMouseDown,
    handleMouseMoveSchedule,
    setHoveredSlotUsers,
    toggleCell,
    setKeyboardRange,
    commitKeyboardRange
  } = useScheduleContext()

  // one tab stop, roving cell. shift+arrows = range, commits on shift up
  const [focusCell, setFocusCell] = useState<SelectionPoint | null>(null)
  const [gridFocused, setGridFocused] = useState(false)
  const anchor = useRef<SelectionPoint | null>(null)
  const onGridKeyDown = (e: React.KeyboardEvent) => {
    const days = data.dates.dates.length
    const slots = time.slotsPerColumn
    if (!focusCell || days === 0 || slots === 0) return
    const { dateIndex: d, timeIndex: t } = focusCell
    let nd = d
    let nt = t
    switch (e.key) {
      case 'ArrowRight':
        nd = Math.min(d + 1, days - 1)
        break
      case 'ArrowLeft':
        nd = Math.max(d - 1, 0)
        break
      case 'ArrowDown':
        nt = Math.min(t + 1, slots - 1)
        break
      case 'ArrowUp':
        nt = Math.max(t - 1, 0)
        break
      case 'Home':
        nt = 0
        break
      case 'End':
        nt = slots - 1
        break
      case ' ':
      case 'Enter':
        e.preventDefault()
        toggleCell(d, t)
        return
      case 'Escape':
        anchor.current = null
        setKeyboardRange(null, currentSelection.additive)
        return
      default:
        return
    }
    e.preventDefault()
    const next = { dateIndex: nd, timeIndex: nt }
    setFocusCell(next)
    if (e.shiftKey) {
      anchor.current ??= focusCell
      const a = anchor.current
      setKeyboardRange(
        { from: a, to: next },
        !data.userSchedule[a.dateIndex]?.[a.timeIndex]
      )
    } else if (anchor.current) {
      anchor.current = null
      setKeyboardRange(null, currentSelection.additive)
    }
    document
      .getElementById(`cell-${nd}-${nt}`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
  const onGridKeyUp = (e: React.KeyboardEvent) => {
    if (e.key !== 'Shift' || !anchor.current) return
    anchor.current = null
    commitKeyboardRange()
  }

  useEffect(() => {
    // a no-op edit would register every viewer as a participant
    const slots = time.slotsPerColumn ?? 0
    const shaped =
      data.userSchedule.length === data.dates.dates.length &&
      data.userSchedule.every(day => day.length === slots)
    if (shaped) return
    editSchedule({
      ...data,
      userSchedule: data.dates.dates.map((_, dayIndex) =>
        Array.from({ length: slots }).map(
          (_, timeIndex) => data.userSchedule?.[dayIndex]?.[timeIndex] ?? false
        )
      )
    })
  }, [data.dates, time.slotsPerColumn])

  const scrollRef = useRef<HTMLDivElement>(null)
  const rosterRef = useRef<HTMLDivElement>(null)
  const sliderRef = useRef<HTMLDivElement>(null)

  const [scrollSpace, setScrollSpace] = useState(0)
  const [sliderValue, setSliderValue] = useState(0)

  const dragRef = useRef(false)
  dragRef.current = isMouseDown
  const sliderHeld = useRef(false)
  const snapTimer = useRef(0)
  const tween = useRef(0)
  const tweenScroll = (el: HTMLElement, to: number) => {
    cancelAnimationFrame(tween.current)
    const from = el.scrollLeft
    const t0 = performance.now()
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / SNAP_TWEEN_MS)
      el.scrollLeft = from + (to - from) * (1 - (1 - k) ** 3)
      if (k < 1) tween.current = requestAnimationFrame(step)
    }
    tween.current = requestAnimationFrame(step)
  }
  const snapToColumn = () => {
    const el = scrollRef.current
    if (!el || dragRef.current || sliderHeld.current) return
    if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 1) return
    const edge = el.getBoundingClientRect().left + SCROLL_PAD
    let best: number | null = null
    el.querySelectorAll('[data-slot-column]').forEach(c => {
      const d = c.getBoundingClientRect().left - edge
      if (best === null || Math.abs(d) < Math.abs(best)) best = d
    })
    if (best !== null && Math.abs(best) > 1)
      tweenScroll(el, el.scrollLeft + best)
  }
  const queueSnap = () => {
    window.clearTimeout(snapTimer.current)
    snapTimer.current = window.setTimeout(snapToColumn, SNAP_IDLE_MS)
  }
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !('onscrollend' in el)) return
    el.addEventListener('scrollend', snapToColumn)
    return () => el.removeEventListener('scrollend', snapToColumn)
  }, [])

  useEffect(() => {
    const calcScrollSpace = () => {
      const el = scrollRef.current
      setScrollSpace(el ? el.scrollWidth - el.clientWidth : 0)
    }
    calcScrollSpace()
    window.addEventListener('resize', calcScrollSpace)
    return () => window.removeEventListener('resize', calcScrollSpace)
  }, [data.dates])

  // shared stripe phase: cancels each cell's position (read all, then write)
  useLayoutEffect(() => {
    const root = scrollRef.current
    if (!root) return
    const align = () => {
      const o = root.getBoundingClientRect()
      const els = Array.from(
        root.querySelectorAll<HTMLElement>('[data-stripes]')
      )
      const rects = els.map(el => el.getBoundingClientRect())
      // time column grows with its labels: measure the first slot column
      const col = root.querySelector('[data-slot-column]')
      const colLeft = col ? col.getBoundingClientRect().left + root.scrollLeft : null
      const flush = [rosterRef.current, sliderRef.current].map(el =>
        el && colLeft !== null ? colLeft - el.getBoundingClientRect().left : null
      )
      els.forEach((el, i) => {
        const r = rects[i]
        const x = r.left - o.left + root.scrollLeft
        const y = r.top - o.top
        el.style.setProperty(
          '--stripe-phase',
          `${(y - x + r.height) / Math.SQRT2}px`
        )
      })
      ;[rosterRef.current, sliderRef.current].forEach((el, i) => {
        if (el && flush[i] !== null) el.style.paddingLeft = `${flush[i]}px`
      })
    }
    align()
    const ro = new ResizeObserver(align)
    ro.observe(root)
    return () => ro.disconnect()
  }, [data.dates, time.slotsPerColumn, data.slotLength])

  return (
    <div
      className={`flex flex-col p-4 bg-card shadow-2xl shadow-black rounded-lg select-none ${className}`}
    >
      {controls && (
        <h2
          id="schedule-title"
          data-grid-title
          className="font-display text-2xl font-bold text-foreground text-center my-2"
        >
          Shared Schedule
          {!isDraftRoom && (
            <span className="font-sans text-base font-medium text-muted-foreground">
              &emsp;{data.others.length + 1}&ensp;
              {data.others.length === 0 ? 'person' : 'people'}
            </span>
          )}
        </h2>
      )}

      <div className="flex flex-col pb-2">
        <div className="flex flex-row ">
          <div
            className="flex flex-col justify-between font-sans text-sm text-right"
            style={{
              minWidth: time.timeDifference > 0 ? TIME_COL_WIDTH : 0,
              minHeight:
                (time.timeDifference / 60) *
                CELL_HEIGHT_FOR_SLOT(data.slotLength),
              marginTop: HEADER_HEIGHT
            }}
          >
            {time.timeDifference > 0 &&
              (() => {
                const isOvernight =
                  time.fromHour24 > time.toHour24 ||
                  (time.fromHour24 === time.toHour24 && time.fromHour24 !== 0)
                const midnightHourIndex = isOvernight
                  ? 24 - time.fromHour24
                  : -1
                return Array.from({
                  length: time.timeDifference / 60 + 1
                }).map((_, i) => {
                  const totalMinutes = i * 60
                  const hours = Math.floor(totalMinutes / 60)
                  const minutes = totalMinutes % 60
                  const currentHour = (time.fromHour24 + hours) % 24

                  return (
                    <div key={`timeLabel-${i}`}>
                      {isOvernight && i === midnightHourIndex && (
                        <div className="h-4" />
                      )}
                      <div
                        style={{ height: 0, lineHeight: 0 }}
                        className="font-medium"
                      >
                        {formatTime(currentHour, minutes)}
                      </div>
                    </div>
                  )
                })
              })()}
          </div>

          <div className="relative w-full">
            <div
              style={{ width: SCROLL_PAD }}
              className="absolute z-10 h-full bg-linear-to-r from-card via-20% via-card to-transparent"
            />
            <div
              style={{
                width: SCROLL_PAD,
                opacity: scrollSpace > 0 && sliderValue < 99 ? 1 : 0
              }}
              className="absolute right-0 z-10 h-full bg-linear-to-l from-card via-20% via-card to-transparent pointer-events-none transition-opacity"
            />

            <div
              style={{
                paddingLeft: SCROLL_PAD,
                scrollbarWidth: 'none'
              }}
              data-grid-scroll
              className="flex flex-row flex-1 w-full grow overflow-x-scroll focus-visible:outline-none"
              id="slot-parent"
              ref={scrollRef}
              role="grid"
              tabIndex={0}
              aria-labelledby="schedule-title"
              aria-activedescendant={
                gridFocused && focusCell
                  ? `cell-${focusCell.dateIndex}-${focusCell.timeIndex}`
                  : undefined
              }
              // ring for keyboard only; a click also focuses this box
              onFocus={e => {
                setGridFocused(e.currentTarget.matches(':focus-visible'))
                setFocusCell(c => c ?? { dateIndex: 0, timeIndex: 0 })
              }}
              onBlur={() => {
                setGridFocused(false)
                anchor.current = null
                setKeyboardRange(null, currentSelection.additive)
              }}
              onKeyDown={e => {
                setGridFocused(true)
                onGridKeyDown(e)
              }}
              onKeyUp={onGridKeyUp}
              onScroll={e => {
                const scrollValue = e.currentTarget.scrollLeft
                setSliderValue((scrollValue / scrollSpace) * 100)
                if (!('onscrollend' in e.currentTarget)) queueSnap()
              }}
              onPointerDown={e => {
                cancelAnimationFrame(tween.current)
                setGridFocused(false)
                const target = e.target as Element
                target.releasePointerCapture(e.pointerId)
              }}
              onPointerMove={e => {
                handleMouseMoveSchedule(e)
              }}
              onPointerLeave={() => setHoveredSlotUsers(null)}
            >
              {data.dates.dates.map((date, dateIndex) => {
                const thisDate: Date | undefined =
                  data.dates.mode === DaySelectMode.Dates
                    ? new Date(date as string)
                    : undefined
                const thisDayOfWeek: number | undefined =
                  data.dates.mode === DaySelectMode.Dates
                    ? undefined
                    : (date as number)

                let leftIsAdj
                let rightIsAdj

                if (data.dates.mode === DaySelectMode.Dates) {
                  const today = new Date(data.dates.dates[dateIndex])

                  if (dateIndex === 0) leftIsAdj = true
                  else {
                    const leftDate = new Date(data.dates.dates[dateIndex - 1])
                    const yesterday = addDays(today, -1)
                    leftIsAdj = isSameDay(leftDate, yesterday)
                  }

                  if (dateIndex === data.dates.dates.length - 1)
                    rightIsAdj = true
                  else {
                    const rightDate = new Date(data.dates.dates[dateIndex + 1])
                    const tomorrow = addDays(today, 1)
                    rightIsAdj = isSameDay(rightDate, tomorrow)
                  }
                } else {
                  leftIsAdj =
                    dateIndex === 0
                      ? true
                      : date === data.dates.dates[dateIndex - 1] + 1
                  rightIsAdj =
                    dateIndex === data.dates.dates.length - 1
                      ? true
                      : date === data.dates.dates[dateIndex + 1] - 1
                }

                return (
                  <DayColumn
                    key={`day-column-${dateIndex}`}
                    isDraftRoom={isDraftRoom}
                    currentSelection={currentSelection}
                    participants={participants}
                    dateIndex={dateIndex}
                    dayUser={data?.userSchedule[dateIndex] ?? []}
                    dayOthers={data.othersSchedule?.at(dateIndex) ?? []}
                    userCount={data.others.length + 1}
                    presentOthersIndices={data.absentReasons
                      .slice(1)
                      .flatMap((r, i) => (r === null ? [i] : []))}
                    hoursPerColumn={time.hoursPerColumn}
                    slotsPerHour={time.slotsPerHour}
                    leftIsAdj={leftIsAdj}
                    rightIsAdj={rightIsAdj}
                    mode={data.dates.mode}
                    date={thisDate}
                    prevDate={
                      dateIndex > 0 && data.dates.mode === DaySelectMode.Dates
                        ? new Date(data.dates.dates[dateIndex - 1] as string)
                        : undefined
                    }
                    isFirstColumn={dateIndex === 0}
                    dayN={thisDayOfWeek}
                    slotLength={data.slotLength}
                    fromHour24={time.fromHour24}
                    toHour24={time.toHour24}
                    focusTime={
                      gridFocused && focusCell?.dateIndex === dateIndex
                        ? focusCell.timeIndex
                        : null
                    }
                  />
                )
              })}
            </div>
          </div>
        </div>

        {scrollSpace > 0 && (
          <div
            ref={sliderRef}
            style={{
              paddingLeft: TIME_COL_WIDTH + SCROLL_PAD,
              marginTop: 32
            }}
            onPointerDown={() => {
              cancelAnimationFrame(tween.current)
              sliderHeld.current = true
            }}
          >
            <Slider
              className="flex w-full"
              min={0}
              max={100}
              step={1}
              onValueCommit={() => {
                sliderHeld.current = false
                snapToColumn()
              }}
              onValueChange={([scrollValue]) => {
                setSliderValue(scrollValue)
                if (scrollRef.current === null) return
                const scrollEl: HTMLDivElement = scrollRef.current
                scrollEl.scrollTo((scrollValue / 100) * scrollSpace, 0)
              }}
              value={[sliderValue]}
            />
          </div>
        )}
      </div>
      {roster && (
        <div ref={rosterRef} className="mt-4">
          {roster}
        </div>
      )}
      {time.hasTzOffset && (
        <div className="text-xs mb-6 text-muted-foreground text-center mt-4">
          Times shown in your timezone (
          {Intl.DateTimeFormat().resolvedOptions().timeZone})
          {time.hasDstMismatch && (
            <div className="text-destructive mt-2">
              A daylight saving transition falls within these dates,
              <br /> some days may be off by 1 hour.
            </div>
          )}
        </div>
      )}
      <div className="mt-auto flex flex-row justify-between items-end gap-4">
        <div className="flex flex-row items-center gap-3 mt-6">
          {bottomContent}
        </div>
        {controls &&
          (time.timeDifference > 0 ? (
            <ScheduleControls isDraftRoom={isDraftRoom} />
          ) : (
            <div className="flex flex-row justify-center mt-4">
              No time selected.
            </div>
          ))}
      </div>
    </div>
  )
}

type DayColumnProps = {
  isDraftRoom: boolean
  currentSelection: Selection
  participants: Participant[]
  dateIndex: number
  dayUser: boolean[]
  dayOthers: number[][]
  userCount: number
  presentOthersIndices: number[]
  hoursPerColumn: number
  slotsPerHour: number
  leftIsAdj: boolean
  rightIsAdj: boolean
  mode: DaySelectMode
  date: Date | undefined
  prevDate: Date | undefined
  isFirstColumn: boolean
  dayN: number | undefined
  slotLength: number
  fromHour24: number
  toHour24: number
  focusTime: number | null
}

const clockLabel = (mins: number) => {
  const h = Math.floor(mins / 60) % 24
  const m = mins % 60
  return `${h % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''} ${h < 12 ? 'AM' : 'PM'}`
}

const DayColumn = ({
  isDraftRoom,
  currentSelection,
  participants,
  dateIndex,
  dayUser,
  dayOthers,
  userCount,
  presentOthersIndices,
  hoursPerColumn,
  slotsPerHour,
  leftIsAdj,
  rightIsAdj,
  mode,
  date,
  prevDate,
  isFirstColumn,
  dayN,
  slotLength,
  fromHour24,
  toHour24,
  focusTime
}: DayColumnProps) => {
  const isOvernight =
    fromHour24 > toHour24 || (fromHour24 === toHour24 && fromHour24 !== 0)
  const midnightSlotIndex = isOvernight ? (24 - fromHour24) * slotsPerHour : -1
  const dayLabel =
    mode === DaySelectMode.Dates && date
      ? date.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        })
      : dayN !== undefined
        ? DAYS_OF_WEEK.full[dayN]
        : ''
  return (
    <div className={`flex flex-col w-full`} style={{ minWidth: 64 }}>
      <div
        className={`flex flex-col justify-center  ${!rightIsAdj && 'mr-1'} ${!leftIsAdj && 'ml-1'}`}
      >
        <div
          className="flex grow flex-col justify-center items-center text-sm"
          style={{ height: HEADER_HEIGHT }}
        >
          <ColumnHeader
            mode={mode}
            date={date}
            prevDate={prevDate}
            isFirstColumn={isFirstColumn}
            dayN={dayN}
          />
        </div>
        {(() => {
          const renderHourGroup = (hourIndex: number) => {
            const startIdx = hourIndex * slotsPerHour
            return (
              <div className="flex flex-col" key={hourIndex}>
                {Array.from({ length: slotsPerHour }).map((_, j) => {
                  const idx = startIdx + j
                  if (idx >= dayUser.length) return null
                  const committed = dayOthers?.at(idx) ?? []
                  const pendingAdd: number[] = []
                  const pendingRemove: number[] = []
                  for (const p of participants) {
                    if (!p.drag || !checkIsDragSelected(p.drag, dateIndex, idx))
                      continue
                    if (p.drag.additive && !committed.includes(p.id))
                      pendingAdd.push(p.id)
                    else if (!p.drag.additive && committed.includes(p.id))
                      pendingRemove.push(p.id)
                  }
                  return (
                    <Slot
                      key={idx}
                      isDraftRoom={isDraftRoom}
                      dateIndex={dateIndex}
                      timeIndex={idx}
                      isSelected={dayUser[idx]}
                      isDragSelected={checkIsDragSelected(
                        currentSelection,
                        dateIndex,
                        idx
                      )}
                      othersValue={committed}
                      pendingAdd={pendingAdd}
                      pendingRemove={pendingRemove}
                      userCount={userCount}
                      presentOthersIndices={presentOthersIndices}
                      slotLength={slotLength}
                      isFocused={focusTime === idx}
                      label={`${dayLabel}, ${clockLabel(fromHour24 * 60 + idx * slotLength)}`}
                    />
                  )
                })}
              </div>
            )
          }

          if (isOvernight && midnightSlotIndex > 0) {
            const midnightHourIndex = midnightSlotIndex / slotsPerHour
            const beforeHours = Array.from({ length: midnightHourIndex }).map(
              (_, i) => renderHourGroup(i)
            )
            const afterHours = Array.from({
              length: hoursPerColumn - midnightHourIndex
            }).map((_, i) => renderHourGroup(midnightHourIndex + i))
            return (
              <div
                role="row"
                aria-label={dayLabel}
                className="flex flex-col gap-y-4"
                style={{ touchAction: 'none' }}
                data-slot-column
              >
                <div className="flex flex-col">
                  {beforeHours}
                </div>
                <div className="flex flex-col">
                  {afterHours}
                </div>
              </div>
            )
          }

          return (
            <div
              role="row"
              aria-label={dayLabel}
              data-slot-column
              style={{ touchAction: 'none' }}
              className="flex flex-col"
            >
              {Array.from({ length: hoursPerColumn }).map((_, i) =>
                renderHourGroup(i)
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )
}

const ColumnHeader = ({
  mode,
  date,
  prevDate,
  isFirstColumn,
  dayN
}: Pick<
  DayColumnProps,
  'mode' | 'date' | 'prevDate' | 'isFirstColumn' | 'dayN'
>) => {
  if (mode === DaySelectMode.Dates && date) {
    const showMonth =
      isFirstColumn || (prevDate && date.getMonth() !== prevDate.getMonth())
    return (
      <>
        <div className="flex flex-row items-center sm:text-base font-medium gap-2">
          {showMonth && (
            <div className="">
              {date.toLocaleString('en-US', { month: 'short' })}
            </div>
          )}
          {date.getDate()}
        </div>
        <div className="opacity-30 uppercase font-sans tracking-widest font-semibold">
          {date.toLocaleString('en-US', { weekday: 'short' })}
        </div>
      </>
    )
  } else if (mode === DaySelectMode.DaysOfWeek && dayN !== undefined) {
    return <>{DAYS_OF_WEEK.three_letter_abbrv[dayN]}</>
  }
  return null
}

const Slot = ({
  isDraftRoom,
  dateIndex,
  timeIndex,
  isSelected,
  isDragSelected,
  othersValue,
  pendingAdd,
  pendingRemove,
  userCount,
  presentOthersIndices,
  slotLength,
  isFocused,
  label
}: {
  isDraftRoom: boolean
  dateIndex: number
  timeIndex: number
  isSelected: boolean
  isDragSelected: boolean
  othersValue: number[]
  pendingAdd: number[]
  pendingRemove: number[]
  userCount: number
  presentOthersIndices: number[]
  slotLength: number
  isFocused: boolean
  label: string
}) => {
  const { handleMouseDownSlot, hoveringUser, currentSelection } =
    useScheduleContext()

  const present = othersValue.filter(i => presentOthersIndices.includes(i))
  const free = present.length + (isSelected ? 1 : 0)
  const spoken = isDraftRoom
    ? `${label}. ${isSelected ? 'Selected' : 'Not selected'}`
    : `${label}. ${free} of ${presentOthersIndices.length + 1} free${isSelected ? ', including me' : ''}`

  const { fill, lanes, youBand } = slotPaint(
    isDraftRoom,
    isSelected,
    isDragSelected,
    currentSelection,
    othersValue,
    userCount - 1,
    presentOthersIndices,
    hoveringUser,
    pendingAdd,
    pendingRemove
  )

  const cellHeight = CELL_HEIGHT_FOR_SLOT(slotLength)

  return (
    <div
      role="gridcell"
      id={`cell-${dateIndex}-${timeIndex}`}
      aria-selected={isSelected}
      aria-label={spoken}
      className="flex grow w-full justify-center items-center"
      // lifted so the ring paints over neighbours
      style={{
        height: cellHeight,
        ...(isFocused ? { position: 'relative', zIndex: 1 } : {})
      }}
      data-cell={`${dateIndex}-${timeIndex}`}
      onPointerDown={() => {
        handleMouseDownSlot(dateIndex, timeIndex, isSelected)
      }}
    >
      <div className={`relative w-full h-full px-px py-[0.5px]`}>
        {isFocused && (
          // white: gold means everyone
          <div
            aria-hidden
            className="absolute pointer-events-none z-10"
            style={{
              inset: -4,
              border: '2px solid var(--color-foreground)',
              borderRadius: 4
            }}
          />
        )}
        <div
          data-stripes // phase set here: both layers share it
          className={`relative w-full h-full bg-background overflow-hidden`}
        >
          <div
            className="absolute w-full h-full"
            style={
              lanes === null
                ? { backgroundColor: fill }
                : (() => {
                    const present = lanes.filter((c): c is string => c !== null)
                    if (present.length === 0)
                      return { backgroundColor: 'transparent' }
                    if (present.length === 1)
                      return { backgroundColor: present[0] }
                    const stops = stripeStops(
                      present,
                      'var(--stripe-phase, 0px)'
                    )
                    return {
                      backgroundImage: `repeating-linear-gradient(45deg, ${stops})`
                    }
                  })()
            }
          />
          {youBand && (
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: youStripe(youBand, 'var(--stripe-phase, 0px)')
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

const ScheduleControls = ({ isDraftRoom }: { isDraftRoom: boolean }) => {
  const { data, editSchedule } = useScheduleContext()

  return (
    <div className="flex flex-row justify-end items-end gap-4">
      {isDraftRoom && (
        <div className="flex flex-col mr-auto gap-y-2">
          <Label
            htmlFor="slot-length"
            className={`mt-4 ml-2 text-sm font-medium text-muted-foreground ${isDraftRoom ? 'cursor-none' : ''}`}
          >
            Time Slot Length
          </Label>
          <ToggleGroup
            id="slot-length"
            type="single"
            onValueChange={e => {
              editSchedule({
                ...data,
                userSchedule: [...data.userSchedule].map(day =>
                  day.map(_ => false)
                ),
                slotLength: Math.max(15, Math.min(60, Number(e)))
              })
            }}
            value={String(data.slotLength)}
            className={`${isDraftRoom ? '*:cursor-none' : ''}`}
          >
            <ToggleGroupItem value={'15'} className="w-14">
              15m
            </ToggleGroupItem>
            <ToggleGroupItem value={'20'} className="w-14">
              20m
            </ToggleGroupItem>
            <ToggleGroupItem value={'30'} className="w-14">
              30m
            </ToggleGroupItem>
            <ToggleGroupItem value={'60'} className="w-14">
              1h
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      )}

      <Button
        onClick={() => {
          editSchedule({
            ...data,
            userSchedule: [...data.userSchedule].map(day => day.map(_ => false))
          })
        }}
        variant={'destructive'}
        className={`gap-x-2 items-center ${isDraftRoom ? 'cursor-none' : ''}`}
      >
        <FontAwesomeIcon icon={faEraser} />
        Clear
      </Button>
    </div>
  )
}
export default Schedule
