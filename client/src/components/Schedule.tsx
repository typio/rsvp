import { faEraser } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useEffect, useRef, useState } from 'react'
import { Button } from './ui/button'
import { ScheduleData } from '@/types'
import { API_URL, SITE_URL, getOtherUserColor, h12To24 } from '@/utils'
import tinycolor from 'tinycolor2'
import { Slider } from '@/components/ui/slider'
import { NavigateFunction } from 'react-router-dom'
import {
  checkIsDragSelected,
  convertTo24Hour,
  formatTime
} from '@/utils/schedule'

import {
  ScheduleProvider,
  useScheduleContext
} from '@/contexts/ScheduleContext'
import { Colors } from '@/colors'
import { DAYS_OF_WEEK, DaySelectMode } from './DateSelect'
import { addDays, isSameDay } from 'date-fns'
import { toast } from 'sonner'

const TIME_COL_WIDTH = 44
const HEADER_HEIGHT = 64
const BASE_CELL_HEIGHT = 20
const CELL_HEIGHT_FOR_SLOT = (slotLength: number) => Math.max(BASE_CELL_HEIGHT, BASE_CELL_HEIGHT * (slotLength / 30))

type SelectionPoint = {
  dateIndex: number
  timeIndex: number
}

type SelectionRange = {
  from: SelectionPoint
  to: SelectionPoint
}

export type Selection = {
  range: SelectionRange | null
  additive: boolean
}

export const shareRoom = (
  scheduleData: ScheduleData,
  navigate: NavigateFunction
): boolean => {
  if (scheduleData.dates.dates.length === 0) {
    toast.error("You haven't picked any days!", {
      description: "How would that work?",
      action: {
        label: 'Good point.',
        onClick: () => { }
      }
    })
    return false
  }

  let req = JSON.stringify({
    event_name: scheduleData.eventName,
    schedule_type: scheduleData.dates.mode,
    dates: scheduleData.dates.dates,
    time_range: {
      from_hour:
        h12To24(
          Number(scheduleData.timeRange.from.hour),
          scheduleData.timeRange.from.isAM
        ) || 0,
      to_hour:
        h12To24(
          Number(scheduleData.timeRange.to.hour),
          scheduleData.timeRange.to.isAM
        ) || 0
    },
    slot_length: scheduleData.slotLength,
    schedule: scheduleData.userSchedule,
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
          const shareURL = `${SITE_URL}/${resJSON.room_uid}`
          navigator.clipboard.writeText(shareURL)
          toast.success(shareURL, {
            description: 'Link copied to clipboard.',
            position: 'top-right'
          })
          navigate(`/${resJSON.room_uid}`)
        })
      } else {
        throw new Error(`Error ${res.status}: ${res.statusText}`)
      }
    })
    .catch((e: TypeError) =>
      toast.error('Error creating room.', {
        description: e.message,
        cancel: {
          label: 'Dismiss',
          onClick: () => { }
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
  isCreate,
  data,
  editSchedule,
  hoveringUser,
  setHoveredSlotUsers
}: {
  isCreate: boolean
  data: ScheduleData
  editSchedule: (newSchedule: ScheduleData) => void
  hoveringUser: number | null
  setHoveredSlotUsers: (arg0: any) => void
}) => {
  // Room's original hours (owner's timezone)
  const roomFromHour24 = convertTo24Hour(
    data.timeRange.from.hour,
    data.timeRange.from.isAM
  )
  const roomToHour24 = convertTo24Hour(
    data.timeRange.to.hour,
    data.timeRange.to.isAM
  )

  // Timezone offset
  const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const roomTz = data.timezone
  const hasTzOffset = !!(roomTz && roomTz !== viewerTz)

  const getOffsetForDate = (date: Date) => {
    const roomTime = new Date(date.toLocaleString('en-US', { timeZone: roomTz }))
    const viewerTime = new Date(date.toLocaleString('en-US', { timeZone: viewerTz }))
    return Math.round((viewerTime.getTime() - roomTime.getTime()) / 3600000)
  }

  const tzOffsetHours = (() => {
    if (!hasTzOffset) return 0
    return getOffsetForDate(new Date())
  })()

  // Check if DST transition causes offset to vary across schedule dates
  const hasDstMismatch = hasTzOffset && data.dates.dates.length > 1 && (() => {
    const offsets = data.dates.dates.map(d => getOffsetForDate(new Date(d as string)))
    return offsets.some(o => o !== offsets[0])
  })()

  const fromHour24 = ((roomFromHour24 + tzOffsetHours) % 24 + 24) % 24
  const toHour24 = ((roomToHour24 + tzOffsetHours) % 24 + 24) % 24

  const timeDifference =
    fromHour24 === toHour24
      ? 24 * 60
      : fromHour24 < toHour24
        ? (toHour24 - fromHour24) * 60
        : (24 - fromHour24 + toHour24) * 60

  const hoursPerColumn = timeDifference / 60
  const slotsPerHour = 60 / data.slotLength
  const slotsPerColumn = hoursPerColumn * slotsPerHour

  return (
    <ScheduleProvider
      isCreate={isCreate}
      initialData={data}
      editSchedule={editSchedule}
      hoveringUser={hoveringUser}
      setHoveredSlotUsers={setHoveredSlotUsers}
      slotsPerColumn={slotsPerColumn}
    >
      <ScheduleContent
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

const ScheduleContent = ({ time }: { time: TimeCalculations }) => {
  const {
    isCreate,
    data,
    editSchedule,
    currentSelection,
    handleMouseMoveSchedule
  } = useScheduleContext()

  useEffect(() => {
    const newData = {
      ...data,
      userSchedule: data.dates.dates.map((_, dayIndex) =>
        Array.from({ length: time.slotsPerColumn ?? 0 }).map(
          (_, timeIndex) => data.userSchedule?.[dayIndex]?.[timeIndex] ?? false
        )
      )
    }
    editSchedule(newData)
  }, [data.dates, time.slotsPerColumn])

  const scrollRef = useRef<HTMLDivElement>(null)

  const [scrollSpace, setScrollSpace] = useState(0)
  const [sliderValue, setSliderValue] = useState(0)

  useEffect(() => {
    const calcScrollSpace = () => {
      setScrollSpace(
        (scrollRef.current?.scrollWidth ?? 0) -
        (scrollRef.current?.getBoundingClientRect().width ?? 0)
      )
    }
    calcScrollSpace()
    window.addEventListener('resize', calcScrollSpace)
    return () => window.removeEventListener('resize', calcScrollSpace)
  }, [data.dates])

  return (
    <div className="flex flex-col p-4 bg-card shadow-xl rounded-lg select-none">
      <h2 className="text-foreground text-center text-base my-2">
        {isCreate ? 'Your Available Times' : 'Group Availabilities'}
      </h2>

      <div className="flex flex-col pb-2">
        <div className="flex flex-row ">
          <div
            className="flex flex-col justify-between font-sans text-sm text-right"
            style={{
              minWidth: time.timeDifference > 0 ? TIME_COL_WIDTH : 0,
              minHeight: (time.timeDifference / 60) * CELL_HEIGHT_FOR_SLOT(data.slotLength),
              marginTop: HEADER_HEIGHT
            }}
          >
            {time.timeDifference > 0 && (() => {
              const isOvernight = time.fromHour24 > time.toHour24 || (time.fromHour24 === time.toHour24 && time.fromHour24 !== 0)
              const midnightHourIndex = isOvernight ? 24 - time.fromHour24 : -1
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
                    <div style={{ height: 0, lineHeight: 0 }} className="font-medium ">
                      {formatTime(currentHour, minutes)}
                    </div>
                  </div>
                )
              })
            })()}
          </div>

          <div className="relative w-full">
            <div
              style={{
                width: 16
              }}
              className="absolute z-10 h-full bg-gradient-to-r from-card via-20% via-card to-transparent"
            />

            <div
              style={{
                paddingLeft: 16,
                touchAction: 'none',
                scrollbarWidth: 'none'
              }}
              className="flex flex-row flex-1 w-full flex-grow gap-x-1 overflow-x-scroll"
              id="slot-parent"
              ref={scrollRef}
              onScroll={e => {
                const scrollValue = e.currentTarget.scrollLeft
                setSliderValue((scrollValue / scrollSpace) * 100)
              }}
              onPointerDown={e => {
                const target = e.target as Element
                target.releasePointerCapture(e.pointerId)
              }}
              onPointerMove={e => {
                handleMouseMoveSchedule(e)
              }}
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
                    isCreate={isCreate}
                    currentSelection={currentSelection}
                    dateIndex={dateIndex}
                    dayUser={data?.userSchedule[dateIndex] ?? []}
                    dayOthers={data.othersSchedule?.at(dateIndex) ?? []}
                    userCount={data.others.length + 1}
                    hoursPerColumn={time.hoursPerColumn}
                    slotsPerHour={time.slotsPerHour}
                    leftIsAdj={leftIsAdj}
                    rightIsAdj={rightIsAdj}
                    mode={data.dates.mode}
                    date={thisDate}
                    prevDate={dateIndex > 0 && data.dates.mode === DaySelectMode.Dates ? new Date(data.dates.dates[dateIndex - 1] as string) : undefined}
                    isFirstColumn={dateIndex === 0}
                    dayN={thisDayOfWeek}
                    slotLength={data.slotLength}
                    fromHour24={time.fromHour24}
                    toHour24={time.toHour24}
                  />
                )
              })}
            </div>
          </div>
        </div>

        {scrollSpace > 0 && (
          <div
            style={{
              paddingLeft: TIME_COL_WIDTH + 16,
              marginTop: 24,
              marginBottom: 16
            }}
          >
            <Slider
              className="flex w-full"
              min={0}
              max={100}
              step={1}
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
      {time.hasTzOffset && (
        <div className="text-xs mb-6 text-muted-foreground text-center mt-4">
          Times shown in your timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone})
          {time.hasDstMismatch && (
            <div className="text-destructive mt-2">
              A daylight saving transition falls within these dates,<br /> some days may be off by 1 hour.
            </div>
          )}
        </div>
      )}
      {time.timeDifference > 0 ? (
        <ScheduleControls />
      ) : (
        <div className="flex flex-row justify-center mt-4">
          No time selected.
        </div>
      )}
    </div>
  )
}

type DayColumnProps = {
  isCreate: boolean
  currentSelection: Selection
  dateIndex: number
  dayUser: boolean[]
  dayOthers: number[][]
  userCount: number
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
}

const DayColumn = ({
  isCreate,
  currentSelection,
  dateIndex,
  dayUser,
  dayOthers,
  userCount,
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
  toHour24
}: DayColumnProps) => {
  const isOvernight = fromHour24 > toHour24 || (fromHour24 === toHour24 && fromHour24 !== 0)
  const midnightSlotIndex = isOvernight ? (24 - fromHour24) * slotsPerHour : -1
  return (
    <div className={`flex flex-col min-w-14 w-full`}>
      <div
        className={`flex flex-col justify-center  ${!rightIsAdj && 'mr-1'} ${!leftIsAdj && 'ml-1'}`}
      >
        <div
          className="flex flex-grow flex-col justify-center items-center text-sm"
          style={{ height: HEADER_HEIGHT }}
        >
          <ColumnHeader mode={mode} date={date} prevDate={prevDate} isFirstColumn={isFirstColumn} dayN={dayN} />
        </div>
        {(() => {
          const renderHourGroup = (hourIndex: number) => {
            const startIdx = hourIndex * slotsPerHour
            return (
              <div className="flex flex-col" key={hourIndex}>
                {Array.from({ length: slotsPerHour }).map((_, j) => {
                  const idx = startIdx + j
                  if (idx >= dayUser.length) return null
                  return (
                    <Slot
                      key={idx}
                      isCreate={isCreate}
                      dateIndex={dateIndex}
                      timeIndex={idx}
                      isSelected={dayUser[idx]}
                      isDragSelected={checkIsDragSelected(currentSelection, dateIndex, idx)}
                      othersValue={dayOthers?.at(idx) ?? []}
                      userCount={userCount}
                      slotLength={slotLength}
                    />
                  )
                })}
              </div>
            )
          }

          if (isOvernight && midnightSlotIndex > 0) {
            const midnightHourIndex = midnightSlotIndex / slotsPerHour
            const beforeHours = Array.from({ length: midnightHourIndex }).map((_, i) => renderHourGroup(i))
            const afterHours = Array.from({ length: hoursPerColumn - midnightHourIndex }).map((_, i) => renderHourGroup(midnightHourIndex + i))
            return (
              <div className="flex flex-col gap-y-4" id="slot-column">
                <div className="flex flex-col rounded-2xl overflow-hidden gap-y-0.5 cursor-pointer">
                  {beforeHours}
                </div>
                <div className="flex flex-col rounded-2xl overflow-hidden gap-y-0.5 cursor-pointer">
                  {afterHours}
                </div>
              </div>
            )
          }

          return (
            <div id="slot-column" className="flex flex-col rounded-2xl overflow-hidden gap-y-0.5 cursor-pointer">
              {Array.from({ length: hoursPerColumn }).map((_, i) => renderHourGroup(i))}
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
}: Pick<DayColumnProps, 'mode' | 'date' | 'prevDate' | 'isFirstColumn' | 'dayN'>) => {
  if (mode === DaySelectMode.Dates && date) {
    const showMonth = isFirstColumn || (prevDate && date.getMonth() !== prevDate.getMonth())
    return (
      <>
        <div className='flex flex-row items-center sm:text-base font-medium gap-2'>
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
  isCreate,
  dateIndex,
  timeIndex,
  isSelected,
  isDragSelected,
  othersValue,
  userCount,
  slotLength,
}: {
  isCreate: boolean
  dateIndex: number
  timeIndex: number
  isSelected: boolean
  isDragSelected: boolean
  othersValue: number[] | null
  userCount: number
  slotLength: number
}) => {
  const {
    calculateCreateSlotColor,
    calculateJoinSlotColor,
    handleMouseDownSlot,
    hoveringUser
  } = useScheduleContext()

  let slotColor, alpha, showOthers

  if (isCreate) {
    ; ({ slotColor, alpha } = calculateCreateSlotColor(
      isSelected,
      isDragSelected
    ))
  } else {
    ; ({
      res: { slotColor, alpha },
      showOthers
    } = calculateJoinSlotColor(isSelected, isDragSelected, othersValue ?? []))
  }

  return (
    <div
      className="schedule-slot flex flex-grow w-full justify-center items-center"
      style={{ height: CELL_HEIGHT_FOR_SLOT(slotLength) }}
      onPointerDown={() => {
        handleMouseDownSlot(dateIndex, timeIndex, isSelected)
      }}
    >
      <div className={`relative w-full h-full bg-background overflow-hidden`}>
        <div
          className="absolute w-full h-full"
          style={{
            opacity: alpha,
            background: slotColor?.toHexString()
          }}
        />
        {!isCreate && hoveringUser === null && showOthers && othersValue && othersValue.length > 0 && (
          <div
            className="absolute z-10 w-full h-full"
            style={{
              background: othersValue.length === 1
                ? getOtherUserColor(othersValue[0], userCount - 1, tinycolor(Colors.othersColors[0])).toHexString()
                : `linear-gradient(to right, ${othersValue
                  .map((v, i) => {
                    const color = getOtherUserColor(v, userCount - 1, tinycolor(Colors.othersColors[0])).toHexString()
                    const start = (i / othersValue.length) * 100
                    const end = ((i + 1) / othersValue.length) * 100
                    return `${color} ${start}% ${end}%`
                  })
                  .join(', ')})`
            }}
          />
        )}
      </div>
    </div>
  )
}

const ScheduleControls = () => {
  const { data, editSchedule } = useScheduleContext()

  return (
    <div className="flex flex-row justify-end gap-4">
      <Button
        onClick={() => {
          editSchedule({
            ...data,
            userSchedule: [...data.userSchedule].map(day => day.map(_ => false))
          })
        }}
        variant={'destructive'}
        className="gap-x-2 items-center"
      >
        <FontAwesomeIcon icon={faEraser} />
        Clear
      </Button>
    </div>
  )
}
export default Schedule
