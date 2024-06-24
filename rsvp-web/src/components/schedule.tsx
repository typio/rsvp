import tinycolor from 'tinycolor2'

import { faEraser } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useEffect, useState } from 'react'
import { Button } from './ui/button'
import { ScheduleData } from '@/types'

const HEADER_HEIGHT = 64
const CELL_HEIGHT = 24

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
  const convertTo24Hour = (hour: string, isAM: boolean) => {
    let hourNum = parseInt(hour)
    if (isAM && hourNum === 12) return 0
    if (!isAM && hourNum !== 12) return hourNum + 12
    return hourNum
  }

  const fromHour24 = convertTo24Hour(
    data.timeRange.from.hour,
    data.timeRange.from.isAM
  )
  const toHour24 = convertTo24Hour(
    data.timeRange.to.hour,
    data.timeRange.to.isAM
  )

  const timeDifference =
    toHour24 >= fromHour24
      ? (toHour24 - fromHour24) * 60
      : (toHour24 + 24 - fromHour24) * 60

  const timeSlots = timeDifference / data.slotLength

  useEffect(() => {
    setData(p => ({
      ...p,
      userSchedule: p.dates.map((_, dayIndex) =>
        Array.from({ length: timeSlots ?? 0 }).map(
          (_, timeIndex) => p.userSchedule?.[dayIndex]?.[timeIndex] ?? false
        )
      )
    }))
  }, [data.dates, timeSlots, setData])

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

  const bgColorString = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue('--background')
  const primaryColorString = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue('--primary')
  const secondaryColorString = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue('--secondary')

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
    let nHours = timeDifference / 60
    let nSlots = 60 / data.slotLength

    return (
      <div className="flex flex-col flex-grow">
        <div
          className="flex flex-grow flex-col justify-center items-center"
          style={{ height: HEADER_HEIGHT }}
        >
          <div className="font-sans">
            {date.toLocaleString('en-US', {
              month: 'numeric',
              day: 'numeric'
            })}
          </div>
          <div className="opacity-30 uppercase font-time tracking-widest font-semibold text-xs">
            {date.toLocaleString('en-US', {
              weekday: 'short'
            })}
          </div>
        </div>
        {Array.from({ length: nHours })?.map((_, i) => {
          return (
            <div className="flex flex-col" key={i}>
              {Array.from({ length: nSlots })?.map((_, j) => {
                let idx = nSlots * i + j
                let place: 'first' | 'middle' | 'last' | 'only'
                if (nSlots === 1) place = 'only'
                else if (j === 0) place = 'first'
                else if (j === nSlots - 1) place = 'last'
                else place = 'middle'
                return (
                  <Slot
                    key={idx}
                    userValue={dayUser?.at(idx)}
                    othersValue={dayOthers?.at(idx)}
                    timeIndex={idx}
                    dateIndex={dateIndex}
                    place={place}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
    )
  }

  const Slot = ({
    userValue,
    othersValue,
    timeIndex,
    dateIndex,
    place
  }: {
    userValue: boolean
    othersValue: number[]
    timeIndex: number
    dateIndex: number
    place: 'first' | 'middle' | 'last' | 'only'
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

    const bgColor = tinycolor('hsl ' + bgColorString)
    const userColor = tinycolor('hsl ' + primaryColorString)
    const otherColor = tinycolor('hsl ' + secondaryColorString)
    let slotColor: tinycolor.Instance
    let alpha = 1

    if (!isCreate) {
      alpha = hoveringUser === null ? 1 : 0.5

      if ((isCurrentlySelected || isCellSelected) && othersValue?.length > 0) {
        slotColor = tinycolor
          .mix(userColor, otherColor, 60)
          .darken(10)
          .saturate(100)
      } else if (isCellSelected || isCurrentlySelected) {
        slotColor = userColor
      } else if (othersValue?.length > 0) {
        slotColor = otherColor
      } else {
        slotColor = bgColor
      }

      if (
        (hoveringUser !== null && othersValue?.includes(hoveringUser - 1)) ||
        (hoveringUser === 0 && isCellSelected)
      )
        alpha = 1
    } else {
      if (isCellSelected || isCurrentlySelected) {
        slotColor = tinycolor(userColor)
      } else {
        slotColor = bgColor
      }
    }

    if (isCurrentlySelected)
      if (currentSelection.additive) slotColor.lighten(12)
      else slotColor.setAlpha(0.5)

    if (!isCellSelected && isCurrentlySelected && !currentSelection.additive)
      slotColor = bgColor

    let slotColorString = slotColor.toHex8String()

    return (
      <div
        key={`time-cell-${dateIndex}-${timeIndex}`}
        className={`flex flex-grow w-full justify-center items-center 
          px-1
          ${place === 'first' ? 'pt-1 pb-0.5' : place === 'last' ? 'pb-1 pt-0.5' : place === 'only' ? 'py-1' : 'py-0.5'}
        `}
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
          className={`w-full h-full bg-background overflow-hidden ${place === 'first' ? 'rounded-t' : place === 'last' ? 'rounded-b' : place === 'only' ? 'rounded' : ''}`}
        >
          <div
            className="w-full h-full"
            style={{ backgroundColor: slotColorString, opacity: alpha }}
          />
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col p-6 bg-card shadow-xl  rounded-lg select-none max-w-lg mx-auto">
        <div className="flex flex-row justify-center mb-4">
          <div
            className="flex flex-col justify-between font-time text-sm text-right "
            style={{
              marginTop: HEADER_HEIGHT
            }}
          >
            {Array.from({
              length: timeDifference / 60 + 1
            }).map((_, i) => {
              const totalMinutes = i * 60
              const hours = Math.floor(totalMinutes / 60)
              const minutes = totalMinutes % 60
              const currentHour = (fromHour24 + hours) % 24

              return (
                <div
                  key={`timeLabel-${i}`}
                  className="mx-2"
                  style={{
                    height: 0,
                    lineHeight: 0,
                    backgroundColor: 'red',
                    overflow: 'visible'
                  }}
                >
                  {formatTime(currentHour, minutes)}
                </div>
              )
            })}
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
            onClick={() => {
              setData({
                ...data,
                userSchedule: [...data.userSchedule].map(day =>
                  day.map(_ => false)
                )
              })
            }}
            variant={'destructive'}
            className="gap-x-2 items-center"
          >
            <FontAwesomeIcon icon={faEraser} />
            Clear
          </Button>
        </div>
      </div>
    </div>
  )
}

const formatTime = (h: number, min: number) => {
  if (h === 0 && min === 0) {
    return '12 AM'
  }
  const period = h < 12 ? 'AM' : 'PM'
  const displayHour = h % 12 || 12

  return `${displayHour} ${period}`
}

export default Schedule
