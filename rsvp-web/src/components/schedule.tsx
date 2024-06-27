import tinycolor from 'tinycolor2'

import { faEraser } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useEffect, useMemo, useState } from 'react'
import { Button } from './ui/button'
import { ScheduleData } from '@/types'

const TIME_COL_WIDTH = 64
const HEADER_HEIGHT = 64
const CELL_HEIGHT = 20

enum Place {
  MIDDLE,
  FIRST,
  LAST,
  ONLY
}

type SlotPlace = {
  micro: Place
  macro: Place.FIRST | Place.LAST | Place.MIDDLE
}

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

const Schedule = ({
  data,
  setData,
  isCreate,
  hoveringUser,
  setSlotUsers,
  othersColors
}: {
  data: ScheduleData
  setData: React.Dispatch<ScheduleData>
  isCreate: boolean
  hoveringUser: null | number
  setSlotUsers: React.Dispatch<null | boolean[]>
  othersColors: string[]
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
    toHour24 === 0 && fromHour24 === 0
      ? 24 * 60
      : fromHour24 <= toHour24
        ? (toHour24 - fromHour24) * 60
        : toHour24 === 0
          ? (toHour24 + 24 - fromHour24) * 60
          : 0

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

  const getColors = useMemo(() => {
    const bgColorString = window
      .getComputedStyle(document.documentElement)
      .getPropertyValue('--background')
    const userColorString = window
      .getComputedStyle(document.documentElement)
      .getPropertyValue('--secondary')
    const allColorString = window
      .getComputedStyle(document.documentElement)
      .getPropertyValue('--primary')
    return { bgColorString, userColorString, allColorString }
  }, [])

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
      <div className="basis-1  flex flex-col flex-grow min-w-14 justify-center">
        {Array.from({ length: nHours })?.map((_, i) => {
          return (
            <div className="flex flex-col" key={i}>
              {Array.from({ length: nSlots })?.map((_, j) => {
                let idx = nSlots * i + j
                let place: SlotPlace = { micro: 0, macro: 0 }
                if (nSlots === 1) place.micro = Place.ONLY
                else if (j === 0) place.micro = Place.FIRST
                else if (j === nSlots - 1) place.micro = Place.LAST
                else place.micro = Place.MIDDLE

                if (idx === 0) place.macro = Place.FIRST
                else if (idx === nSlots * nHours - 1) place.macro = Place.LAST

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
    place: SlotPlace
  }) => {
    const { bgColorString, userColorString, allColorString } = getColors
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
      )
        isCurrentlySelected = true
    }

    const bgColor = tinycolor('hsl ' + bgColorString)
    const userColor = tinycolor('hsl ' + userColorString)
    const allColor = tinycolor('hsl ' + allColorString)
    let slotColor: tinycolor.Instance
    let alpha = 1

    const cellSelectedByAll =
      ((isCurrentlySelected && currentSelection.additive) || isCellSelected) &&
      othersValue?.length === data.others.length

    const cellSelectedByHoveringUser =
      hoveringUser && othersValue?.includes(hoveringUser - 1)

    if (!isCreate) {
      alpha = hoveringUser === null ? 1 : 0.3

      if (cellSelectedByHoveringUser && hoveringUser >= 1)
        slotColor = tinycolor(othersColors[hoveringUser - 1])
      else if (cellSelectedByAll) slotColor = allColor
      else if (isCurrentlySelected || isCellSelected) slotColor = userColor
      // } else if (
      //   (isCellSelected || isCurrentlySelected) &&
      //   othersValue?.length > 0
      // ) {
      //   slotColor = userColor
      //   secondColor = otherColor
      //     .setAlpha(othersValue.length / data.others.length)
      //     .toHex8String()
      // } else if (isCellSelected || isCurrentlySelected) {
      //   slotColor = userColor
      // } else if (othersValue?.length > 0) {
      //   slotColor = otherColor
      //   slotColor.setAlpha(othersValue.length / data.others.length)
      else slotColor = bgColor

      if (cellSelectedByHoveringUser || (hoveringUser === 0 && isCellSelected))
        alpha = 1
    } else {
      if (isCellSelected || isCurrentlySelected) {
        slotColor = tinycolor(userColor)
      } else {
        slotColor = bgColor
      }
    }

    if (isCurrentlySelected)
      if (currentSelection.additive) {
      } //slotColor.lighten(12)
      else slotColor.setAlpha(0.3)

    if (!isCellSelected && isCurrentlySelected && !currentSelection.additive)
      slotColor = bgColor

    let slotColorString = slotColor.toHex8String()

    timeDifference / 60

    return (
      <div
        key={`time-cell-${dateIndex}-${timeIndex}`}
        className={`schedule-slot flex flex-grow w-full justify-center items-center 
          ${place.micro === Place.FIRST ? 'pt-0' : place.micro === Place.LAST ? 'pb-0.5' : place.micro === Place.ONLY ? 'pb-0.5' : ''}
        `}
        style={{
          height: CELL_HEIGHT
        }}
        data-user-value={JSON.stringify(userValue)}
        data-others-value={JSON.stringify(othersValue)}
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
        onMouseOver={() => {
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

          // if (othersCount > 0 || isCellSelected) {
          //   let slotUsers = Array.from({ length: data.others.length + 1 }).map(
          //     _ => false
          //   )
          //   if (isCellSelected) slotUsers[0] = true
          //   othersValue.forEach(otherId => (slotUsers[otherId + 1] = true))
          //   setSlotUsers(slotUsers)
          // } else setSlotUsers(null)
        }}
        onMouseUp={() => {
          setIsMouseDown(false)
        }}
      >
        <div
          className="w-full h-full mx-0.5 bg-background overflow-hidden"
          style={(() => {
            switch (place.macro) {
              case Place.FIRST:
                return {
                  borderTopLeftRadius: 6,
                  borderTopRightRadius: 6
                }
              case Place.LAST:
                return {
                  borderBottomLeftRadius: 6,
                  borderBottomRightRadius: 6
                }
            }
          })()}
        >
          <div
            className="w-full h-full flex flex-row justify-center items-center gap-x-2"
            style={{
              opacity: alpha,
              background: slotColorString
            }}
          >
            {!cellSelectedByAll &&
              !cellSelectedByHoveringUser &&
              othersValue.map((v, i) => {
                return (
                  <div
                    key={i}
                    style={{
                      width: CELL_HEIGHT / 3,
                      height: CELL_HEIGHT / 3,
                      backgroundColor: othersColors[v],
                      borderRadius: 100
                    }}
                  ></div>
                )
              })}
          </div>
        </div>
      </div>
    )
  }

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isMouseDown) {
      setSlotUsers(null)
      return
    }

    const slot = document.querySelector('.schedule-slot')
    if (!slot) return

    const slot_width = slot.getBoundingClientRect().width

    const slotParent = document.getElementById('slot-parent')
    if (!slotParent) return

    const rect = slotParent.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      setSlotUsers(null)
      return
    }

    const dateIndex = Math.floor(x / slot_width)
    const timeIndex = Math.floor(y / CELL_HEIGHT)

    if (
      dateIndex < 0 ||
      dateIndex >= data.dates.length ||
      timeIndex < 0 ||
      timeIndex >= data.userSchedule[0].length
    ) {
      setSlotUsers(null)
      return
    }

    const userValue = data.userSchedule[dateIndex][timeIndex]
    const othersValue = data.othersSchedule[dateIndex][timeIndex]

    if (othersValue.length > 0 || userValue) {
      let slotUsers = Array.from({ length: data.others.length + 1 }).map(
        _ => false
      )
      if (userValue) slotUsers[0] = true
      othersValue.forEach((otherId: number) => (slotUsers[otherId + 1] = true))
      setSlotUsers(slotUsers)
    } else {
      setSlotUsers(null)
    }
  }

  return (
    <div
      className="flex flex-col p-6 bg-card shadow-xl rounded-lg select-none"
      id="schedule-card"
      onMouseMove={handleMouseMove}
    >
      <div className="flex flex-col pb-2 overflow-x-scroll">
        <div className="flex flex-row " style={{ marginLeft: TIME_COL_WIDTH }}>
          {data.dates.map((date, i) => (
            <div
              key={i}
              className="flex flex-grow flex-col justify-center items-center text-sm"
              style={{ height: HEADER_HEIGHT }}
            >
              <div className="font-sans">
                {date.toLocaleString('en-US', {
                  month: 'numeric',
                  day: 'numeric'
                })}
              </div>
              <div className="opacity-30 uppercase font-time tracking-widest font-semibold">
                {date.toLocaleString('en-US', {
                  weekday: 'short'
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-row">
          <div
            className="flex flex-col justify-between font-time text-sm text-right"
            style={{
              width: TIME_COL_WIDTH,
              paddingRight: 12
            }}
          >
            {timeDifference > 0 &&
              Array.from({
                length: timeDifference / 60 + 1
              }).map((_, i) => {
                const totalMinutes = i * 60
                const hours = Math.floor(totalMinutes / 60)
                const minutes = totalMinutes % 60
                const currentHour = (fromHour24 + hours) % 24

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

          <div className="flex flex-row flex-1 " id="slot-parent">
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
        </div>
      </div>
      {timeDifference > 0 ? (
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
      ) : (
        <div className="flex flex-row justify-center mt-4">
          No time selected.
        </div>
      )}
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
