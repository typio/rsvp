import { ScheduleData } from '@/types'

export const checkIsDragSelected = (
  currentSelection: any,
  dateIndex: number,
  timeIndex: number
): boolean => {
  if (currentSelection.range != null) {
    const [lesserDI, greaterDI] = [
      currentSelection.range.from.dateIndex,
      currentSelection.range.to.dateIndex
    ].sort((a, b) => a - b)

    const [lesserTI, greaterTI] = [
      currentSelection.range.from.timeIndex,
      currentSelection.range.to.timeIndex
    ].sort((a, b) => a - b)

    return (
      dateIndex >= lesserDI &&
      dateIndex <= greaterDI &&
      timeIndex >= lesserTI &&
      timeIndex <= greaterTI
    )
  } else return false
}

export const timeSpan = (
  fromHour24: number,
  toHour24: number,
  slotLength: number
) => {
  const timeDifference =
    fromHour24 === toHour24
      ? 24 * 60
      : fromHour24 < toHour24
        ? (toHour24 - fromHour24) * 60
        : (24 - fromHour24 + toHour24) * 60

  const hoursPerColumn = timeDifference / 60
  const slotsPerHour = 60 / slotLength
  const slotsPerColumn = hoursPerColumn * slotsPerHour

  return { timeDifference, hoursPerColumn, slotsPerHour, slotsPerColumn }
}

export const convertTo24Hour = (hour: string, isAM: boolean) => {
  let hourNum = parseInt(hour)
  if (isAM && hourNum === 12) return 0
  if (!isAM && hourNum !== 12) return hourNum + 12
  return hourNum
}

export const formatTime = (h: number, min: number) => {
  if (h === 0 && min === 0) {
    return '12 AM'
  }
  const period = h < 12 ? 'AM' : 'PM'
  const displayHour = h % 12 || 12

  return `${displayHour} ${period}`
}

export const resolveTimeRange = (data: ScheduleData) => {
  const roomFromHour24 = convertTo24Hour(
    data.timeRange.from.hour,
    data.timeRange.from.isAM
  )
  const roomToHour24 = convertTo24Hour(
    data.timeRange.to.hour,
    data.timeRange.to.isAM
  )
  const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const roomTz = data.timezone
  const hasTzOffset = !!(roomTz && roomTz !== viewerTz)
  const getOffsetForDate = (date: Date) => {
    const roomTime = new Date(
      date.toLocaleString('en-US', { timeZone: roomTz })
    )
    const viewerTime = new Date(
      date.toLocaleString('en-US', { timeZone: viewerTz })
    )
    return Math.round((viewerTime.getTime() - roomTime.getTime()) / 3600000)
  }
  const tzOffsetHours = hasTzOffset ? getOffsetForDate(new Date()) : 0
  const hasDstMismatch =
    hasTzOffset &&
    data.dates.dates.length > 1 &&
    (() => {
      const offsets = data.dates.dates.map(d =>
        getOffsetForDate(new Date(d as string))
      )
      return offsets.some(o => o !== offsets[0])
    })()
  return {
    fromHour24: (((roomFromHour24 + tzOffsetHours) % 24) + 24) % 24,
    toHour24: (((roomToHour24 + tzOffsetHours) % 24) + 24) % 24,
    hasTzOffset,
    hasDstMismatch
  }
}
