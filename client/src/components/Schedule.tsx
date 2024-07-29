import { faClone, faEraser } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { memo, useEffect } from 'react'
import { Button } from './ui/button'
import { ScheduleData } from '@/types'
import { h12To24 } from '@/utils'
import { NavigateFunction, useNavigate } from 'react-router-dom'
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

const TIME_COL_WIDTH = 64
const HEADER_HEIGHT = 64
const CELL_HEIGHT = 20

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
    schedule: scheduleData.userSchedule
  })
  fetch('http://localhost:3632/api/rooms', {
    method: 'POST',
    body: req,
    credentials: 'include'
  })
    .then(res => {
      if (res.status === 200) {
        res.json().then(resJSON => {
          navigate(`/${resJSON.room_uid}`)
          return true
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
  const fromHour24 = convertTo24Hour(
    data.timeRange.from.hour,
    data.timeRange.from.isAM
  )
  const toHour24 = convertTo24Hour(
    data.timeRange.to.hour,
    data.timeRange.to.isAM
  )

  const timeDifference =
    toHour24 === 0 && fromHour24 === 0
      ? 24 * 60
      : fromHour24 <= toHour24
        ? (toHour24 - fromHour24) * 60
        : toHour24 === 0
          ? (toHour24 + 24 - fromHour24) * 60
          : 0

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
          toHour24
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

  useEffect(() => {
    console.log('Schedule Content render')
  }, [])

  return (
    <div
      className="flex flex-col p-6 bg-card shadow-xl rounded-lg select-none"
      id="schedule-card"
      onMouseMove={e => {
        handleMouseMoveSchedule(e)
      }}
    >
      <div className="flex flex-col pb-2 overflow-x-scroll">
        <div
          className="flex flex-row"
          style={{ marginLeft: TIME_COL_WIDTH }}
        ></div>
        <div className="flex flex-row ">
          <div
            className="flex flex-col justify-between font-time text-sm text-right "
            style={{
              width: time.timeDifference > 0 ? TIME_COL_WIDTH : 0,
              paddingRight: 12,
              minHeight: (time.timeDifference / 60) * CELL_HEIGHT,
              marginTop: HEADER_HEIGHT
            }}
          >
            {time.timeDifference > 0 &&
              Array.from({
                length: time.timeDifference / 60 + 1
              }).map((_, i) => {
                const totalMinutes = i * 60
                const hours = Math.floor(totalMinutes / 60)
                const minutes = totalMinutes % 60
                const currentHour = (time.fromHour24 + hours) % 24

                return (
                  <div
                    key={`timeLabel-${i}`}
                    style={{
                      height: 0,
                      lineHeight: 0
                    }}
                  >
                    {formatTime(currentHour, minutes)}
                  </div>
                )
              })}
          </div>

          <div
            className="flex flex-row flex-1 basis-1 gap-x-1 overflow-x-scroll "
            id="slot-parent"
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

                if (dateIndex === data.dates.dates.length - 1) rightIsAdj = true
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
                  hoursPerColumn={time.hoursPerColumn}
                  slotsPerHour={time.slotsPerHour}
                  leftIsAdj={leftIsAdj}
                  rightIsAdj={rightIsAdj}
                  mode={data.dates.mode}
                  date={thisDate}
                  dayN={thisDayOfWeek}
                />
              )
            })}
          </div>
        </div>
      </div>
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
  hoursPerColumn: number
  slotsPerHour: number
  leftIsAdj: boolean
  rightIsAdj: boolean
  mode: DaySelectMode
  date: Date | undefined
  dayN: number | undefined
}

const DayColumn = ({
  isCreate,
  currentSelection,
  dateIndex,
  dayUser,
  dayOthers,
  hoursPerColumn,
  slotsPerHour,
  leftIsAdj,
  rightIsAdj,
  mode,
  date,
  dayN
}: DayColumnProps) => {
  return (
    <div className={`basis-1 flex flex-col flex-grow min-w-14 justify-center`}>
      <div
        className={`flex flex-col justify-center  ${!rightIsAdj && 'mr-1'} ${!leftIsAdj && 'ml-1'}`}
      >
        <div
          className="flex flex-grow flex-col justify-center items-center text-sm"
          style={{ height: HEADER_HEIGHT }}
        >
          <ColumnHeader mode={mode} date={date} dayN={dayN} />
        </div>
        <div
          id="slot-column"
          className="flex flex-col rounded-2xl overflow-hidden gap-y-0.5 cursor-pointer "
        >
          {Array.from({ length: hoursPerColumn })?.map((_, i) => {
            return (
              <div className="flex flex-col" key={i}>
                {Array.from({ length: slotsPerHour })?.map((_, j) => {
                  let idx = slotsPerHour * i + j
                  if (idx >= dayUser.length) return

                  const timeIndex = idx
                  const isSelected = dayUser[idx]

                  const isDragSelected = checkIsDragSelected(
                    currentSelection,
                    dateIndex,
                    timeIndex
                  )

                  return (
                    <Slot
                      key={timeIndex}
                      isCreate={isCreate}
                      dateIndex={dateIndex}
                      timeIndex={timeIndex}
                      isSelected={isSelected}
                      isDragSelected={isDragSelected}
                      othersValue={dayOthers?.at(timeIndex) ?? []}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const ColumnHeader = ({
  mode,
  date,
  dayN
}: Pick<DayColumnProps, 'mode' | 'date' | 'dayN'>) => {
  if (mode === DaySelectMode.Dates && date) {
    return (
      <>
        <div className="font-sans">
          {date.toLocaleString('en-US', { month: 'numeric', day: 'numeric' })}
        </div>
        <div className="opacity-30 uppercase font-time tracking-widest font-semibold">
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
  othersValue
}: {
  isCreate: boolean
  dateIndex: number
  timeIndex: number
  isSelected: boolean
  isDragSelected: boolean
  othersValue: number[] | null
}) => {
  const {
    calculateCreateSlotColor,
    calculateJoinSlotColor,
    handleMouseDownSlot,
    hoveringUser
  } = useScheduleContext()

  let slotColor, alpha, showOthers

  if (isCreate) {
    ;({ slotColor, alpha } = calculateCreateSlotColor(
      isSelected,
      isDragSelected
    ))
  } else {
    ;({
      res: { slotColor, alpha },
      showOthers
    } = calculateJoinSlotColor(isSelected, isDragSelected, othersValue ?? []))
  }

  return (
    <div
      className="schedule-slot flex flex-grow w-full justify-center items-center"
      style={{ height: CELL_HEIGHT }}
      onMouseDown={() => {
        handleMouseDownSlot(dateIndex, timeIndex, isSelected)
      }}
    >
      <div className={`relative w-full h-full bg-background overflow-hidden `}>
        <div
          className="absolute w-full h-full"
          style={{
            opacity: alpha,
            background: slotColor?.toHexString()
          }}
        />
        <div className="absolute z-10 w-full h-full flex-1 flex-grow flex flex-row justify-around items-center ">
          {!isCreate &&
            hoveringUser === null &&
            showOthers &&
            othersValue?.map((v: number, i: number) => (
              <div
                key={i}
                style={{
                  width: CELL_HEIGHT / 3,
                  height: CELL_HEIGHT / 3,
                  backgroundColor: Colors.othersColors[v],
                  borderRadius: 100
                }}
              />
            ))}
        </div>
      </div>
    </div>
  )
}

const ScheduleControls = () => {
  const { data, editSchedule, isCreate } = useScheduleContext()
  const navigate = useNavigate()

  return (
    <div className="flex flex-row justify-between pt-7 gap-4">
      <div className="flex flex-row gap-4">
        {!isCreate && false && (
          <Button
            onClick={() => {
              if (shareRoom(data, navigate)) toast.success('Created new room.')
            }}
          >
            <FontAwesomeIcon icon={faClone} />
            Clone
          </Button>
        )}
      </div>
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
