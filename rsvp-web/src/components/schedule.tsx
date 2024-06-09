import { faEraser } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useEffect, useState } from 'react'
import { Button } from './ui/button'

const HEADER_HEIGHT = 44
const CELL_HEIGHT = 16

const Schedule = ({
  dates,
  timeRange,
  slotLength,
  userSchedule,
  othersSchedule,
  setUserSchedule,
  setOthersSchedule
}: {
  dates: Date[]
  timeRange: any
  slotLength: number
  isCreate: boolean
  userSchedule: boolean[][]
  setUserSchedule: React.Dispatch<boolean[][]>
  othersSchedule?: string[][][]
  setOthersSchedule?: React.Dispatch<string[][][]>
}) => {
  const timeDifference =
    (Number(timeRange.to.hour) +
      (timeRange.to.isAM ? 0 : 12) -
      (Number(timeRange.from.hour) + (timeRange.from.isAM ? 0 : 12))) *
    60

  const timeSlots = timeDifference / slotLength

  useEffect(() => {
    setUserSchedule(
      dates.map((_, dayIndex) =>
        Array.from({ length: timeSlots }).map(
          (_, timeIndex) => userSchedule?.[dayIndex]?.[timeIndex] ?? false
        )
      )
    )
  }, [dates, timeRange, slotLength])

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

    let newSchedule = [...userSchedule]

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

    setUserSchedule(newSchedule)
  }

  const DayColumn = ({
    date,
    dateIndex,
    day
  }: {
    date: Date
    dateIndex: number
    day: boolean[]
  }) => {
    return (
      <div className="flex flex-grow">
        <div className="flex flex-col flex-grow">
          <div
            className="flex flex-grow flex-col justify-center items-center "
            style={{ height: HEADER_HEIGHT }}
          >
            <div>
              {date.toLocaleString('en-US', {
                month: 'numeric',
                day: 'numeric'
              })}
            </div>
            <div>
              {date.toLocaleString('en-US', {
                weekday: 'short'
              })}
            </div>
          </div>
          {day?.map((valueAtTime, timeIndex) => (
            <Slot
              valueAtTime={valueAtTime}
              timeIndex={timeIndex}
              dateIndex={dateIndex}
            />
          ))}
        </div>
      </div>
    )
  }

  const Slot = ({
    valueAtTime,
    timeIndex,
    dateIndex
  }: {
    valueAtTime: any
    timeIndex: any
    dateIndex: any
  }) => {
    let isCellSelected = valueAtTime
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
          className={`rounded w-full h-full ${isCurrentlySelected ? 'bg-accent' : isCellSelected ? 'bg-secondary' : 'bg-background'}`}
        />
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col p-6 bg-border rounded-lg select-none">
        <div className="flex flex-row overflow-x-scroll pb-4">
          <div
            className="flex flex-col justify-between"
            style={{
              marginTop: HEADER_HEIGHT
            }}
          >
            {Array.from({ length: timeSlots + 1 }).map((_, i) => (
              <div
                key={`timeLabel-${i}`}
                className="text-sm text-right mx-2 text-muted-foreground"
                style={{
                  height: 0,
                  lineHeight: 0,
                  backgroundColor: 'red',
                  overflow: 'visible'
                }}
              >
                {`${(
                  Math.floor((i * slotLength) / 60) +
                  Number(timeRange.from.hour)
                )
                  .toString()
                  .padStart(
                    2,
                    '0'
                  )}:${((i * slotLength) % 60).toString().padStart(2, '0')}`}
              </div>
            ))}
          </div>

          {dates.map((date, dateIndex) => (
            <DayColumn
              key={`day-column-${dateIndex}`}
              date={date}
              dateIndex={dateIndex}
              day={userSchedule[dateIndex]}
            />
          ))}
        </div>
        <div className="flex flex-row justify-end pt-2">
          <Button
            onClick={() =>
              setUserSchedule([...userSchedule].map(day => day.map(_ => false)))
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
