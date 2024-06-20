import tinycolor from 'tinycolor2'

import { faEraser } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useEffect, useState } from 'react'
import { Button } from './ui/button'
import { ScheduleData } from '@/types'
import { Colors } from '@/colors'

const HEADER_HEIGHT = 64
const CELL_HEIGHT = 16

const Schedule = ({
  data,
  setData,
  isCreate,
  hoveringUser
}: {
  data: ScheduleData
  setData: React.Dispatch<ScheduleData>
  isCreate: boolean
  hoveringUser: null | number
}) => {
  const timeDifference =
    (Number(data.timeRange.to.hour) +
      (data.timeRange.to.isAM ? 0 : 12) -
      (Number(data.timeRange.from.hour) +
        (data.timeRange.from.isAM ? 0 : 12))) *
    60

  const timeSlots = timeDifference / data.slotLength

  useEffect(() => {
    setData({
      ...data,
      userSchedule: data.dates.map((_, dayIndex) =>
        Array.from({ length: timeSlots }).map(
          (_, timeIndex) => data.userSchedule?.[dayIndex]?.[timeIndex] ?? false
        )
      )
    })
  }, [data.dates, data.timeRange, data.slotLength])

  type SelectionPoint = {
    dateIndex: number
    timeIndex: number
  }

  type SelectionRange = {
    from: SelectionPoint
    to: SelectionPoint
  }

  type Selection = {
    range: SelectionRange | null
    additive: boolean
  }

  const [currentSelection, setCurrentSelection] = useState<Selection>({
    range: null,
    additive: true
  })

  const [isMouseDown, setIsMouseDown] = useState(false)

  useEffect(() => {
    const handleMouseUp = () => {
      setIsMouseDown(false)
      applySelection(currentSelection)
      setCurrentSelection({
        range: null,
        additive: currentSelection.additive
      })
    }

    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [currentSelection])

  const applySelection = (selection: Selection) => {
    if (selection.range == null) return

    let newSchedule = [...data.userSchedule]

    const [lesserDI, greaterDI] = [
      selection.range.from.dateIndex,
      selection.range.to.dateIndex
    ].sort((a, b) => a - b)

    const [lesserTI, greaterTI] = [
      selection.range.from.timeIndex,
      selection.range.to.timeIndex
    ].sort((a, b) => a - b)

    for (let dI = lesserDI; dI <= greaterDI; dI++) {
      for (let tI = lesserTI; tI <= greaterTI; tI++) {
        newSchedule[dI][tI] = selection.additive
      }
    }

    setData({ ...data, userSchedule: newSchedule })
  }

  const DayColumn = ({
    date,
    dateIndex,
    dayUser,
    dayOthers
  }: {
    date: Date
    dateIndex: number
    dayUser: boolean[]
    dayOthers: number[][]
  }) => {
    return (
      <div className="flex flex-grow">
        <div className="flex flex-col flex-grow">
          <div
            className="flex flex-grow flex-col justify-center items-center"
            style={{ height: HEADER_HEIGHT }}
          >
            <div>
              {date.toLocaleString('en-US', {
                month: 'numeric',
                day: 'numeric'
              })}
            </div>
            <div className="opacity-30 uppercase font-semibold text-xs">
              {date.toLocaleString('en-US', {
                weekday: 'short'
              })}
            </div>
          </div>
          {dayUser?.map((value, timeIndex) => (
            <Slot
              key={timeIndex}
              userValue={value}
              othersValue={dayOthers[timeIndex]}
              timeIndex={timeIndex}
              dateIndex={dateIndex}
            />
          ))}
        </div>
      </div>
    )
  }

  const Slot = ({
    userValue,
    othersValue,
    timeIndex,
    dateIndex
  }: {
    userValue: boolean
    othersValue: number[]
    timeIndex: number
    dateIndex: number
  }) => {
    let isCellSelected = userValue
    let isCurrentlySelected = false

    if (currentSelection.range != null) {
      const [lesserDI, greaterDI] = [
        currentSelection.range.from.dateIndex,
        currentSelection.range.to.dateIndex
      ].sort((a, b) => a - b)

      const [lesserTI, greaterTI] = [
        currentSelection.range.from.timeIndex,
        currentSelection.range.to.timeIndex
      ].sort((a, b) => a - b)

      if (
        dateIndex >= lesserDI &&
        dateIndex <= greaterDI &&
        timeIndex >= lesserTI &&
        timeIndex <= greaterTI
      ) {
        isCurrentlySelected = true
      }
    }

    const userColor = tinycolor(`hsl(${Colors.dark.primary})`)
    const otherColor = tinycolor(`hsl(${Colors.dark.secondary})`)

    let bg_color: tinycolor.Instance
    let alpha = hoveringUser === null ? 1 : 0.5

    if ((isCurrentlySelected || isCellSelected) && othersValue?.length > 0) {
      bg_color = tinycolor
        .mix(userColor, otherColor, 60)
        .darken(10)
        .saturate(100)
    } else if (isCellSelected || isCurrentlySelected) {
      bg_color = userColor
    } else if (othersValue?.length > 0) {
      bg_color = otherColor
    } else {
      bg_color = tinycolor(`hsl(${Colors.dark.background})`)
    }

    if (isCurrentlySelected) bg_color.lighten(15)

    if (
      (hoveringUser !== null && othersValue.includes(hoveringUser - 1)) ||
      (hoveringUser === 0 && isCellSelected)
    )
      alpha = 1

    let bg_color_string = bg_color.toHex8String()

    return (
      <div
        key={`time-cell-${dateIndex}-${timeIndex}`}
        className={`flex flex-grow w-full p-[2px] justify-center items-center ${isCellSelected ? 'hover:*:bg-accent' : 'hover:*:bg-accent '}`}
        style={{ height: CELL_HEIGHT }}
        onMouseDown={() => {
          setIsMouseDown(true)
          setCurrentSelection({
            range: {
              from: { dateIndex, timeIndex },
              to: { dateIndex, timeIndex }
            },
            additive: !isCellSelected
          })
        }}
        onMouseEnter={() => {
          if (isMouseDown) {
            setCurrentSelection({
              range: {
                from: currentSelection.range?.from ?? {
                  dateIndex,
                  timeIndex
                },
                to: { dateIndex, timeIndex }
              },
              additive: currentSelection.additive
            })
          }
        }}
        onMouseUp={() => {
          setIsMouseDown(false)
        }}
      >
        <div
          className={`rounded w-full h-full text-xs`}
          style={{ backgroundColor: bg_color_string, opacity: alpha }}
        ></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col p-6 bg-card rounded-lg select-none">
        <div className="flex flex-row overflow-x-scroll pb-4">
          <div
            className="flex flex-col justify-between font-[courier] font-medium text-sm text-right opacity-30"
            style={{
              marginTop: HEADER_HEIGHT
            }}
          >
            {Array.from({ length: timeSlots + 1 }).map((_, i) => (
              <div
                key={`timeLabel-${i}`}
                className="mx-2 "
                style={{
                  height: 0,
                  lineHeight: 0,
                  backgroundColor: 'red',
                  overflow: 'visible'
                }}
              >
                {`${(
                  Math.floor((i * data.slotLength) / 60) +
                  Number(data.timeRange.from.hour)
                ).toString()}:${((i * data.slotLength) % 60).toString().padStart(2, '0')}`}
              </div>
            ))}
          </div>

          {data.dates.map((date, dateIndex) => (
            <DayColumn
              key={`day-column-${dateIndex}`}
              date={date}
              dateIndex={dateIndex}
              dayUser={data.userSchedule[dateIndex]}
              dayOthers={data.othersSchedule?.at(dateIndex) ?? []}
            />
          ))}
        </div>
        <div className="flex flex-row justify-end pt-2">
          <Button
            onClick={() =>
              setData({
                ...data,
                userSchedule: [...data.userSchedule].map(day =>
                  day.map(_ => false)
                )
              })
            }
          >
            <FontAwesomeIcon icon={faEraser} />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default Schedule
