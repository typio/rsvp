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
