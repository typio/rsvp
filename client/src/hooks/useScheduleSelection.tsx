import { Selection } from '@/components/Schedule'
import { ScheduleData } from '@/types'
import { useEffect, useState } from 'react'

export type ScheduleSelectionContextType = {
  currentSelection: Selection
  isMouseDown: boolean
  handleMouseDownSlot: (
    dateIndex: number,
    timeIndex: number,
    isSelected: boolean
  ) => void
  handleMouseMoveSchedule: (event: React.MouseEvent<HTMLDivElement>) => void
  // handleMouseUpSchedule: (event: React.MouseEvent<HTMLDivElement>) => void
  applySelection: (selection: Selection) => void
}

export const useScheduleSelection = (
  initialData: ScheduleData,
  editSchedule: (newSchedule: ScheduleData) => void,
  setHoveredSlotUsers: (arg0: boolean[] | null) => void,
  isCreate: boolean,
  slotsPerColumn: number
): ScheduleSelectionContextType => {
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
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [currentSelection])

  const handleMouseMoveSchedule = (event: React.MouseEvent<HTMLDivElement>) => {
    const scheduleRect = document
      .getElementById('slot-parent')
      ?.getBoundingClientRect()
    if (!scheduleRect) return
    const x = event.clientX - scheduleRect.left
    const y = event.clientY - scheduleRect.top

    if (x < 0 || y < 0 || x > scheduleRect.width || y > scheduleRect.height) {
      setHoveredSlotUsers(null)
      return
    }

    const slotWidth = scheduleRect.width / initialData.dates.dates.length
    const slotHeight = scheduleRect.height / slotsPerColumn

    const dateIndex = Math.floor(x / slotWidth)
    const timeIndex = Math.floor(y / slotHeight)

    if (
      !isCreate &&
      (dateIndex < 0 ||
        dateIndex >= initialData.dates.dates.length ||
        timeIndex < 0 ||
        timeIndex >= initialData.userSchedule[0].length)
    ) {
      setHoveredSlotUsers(null)
      return
    }

    if (isMouseDown) {
      setCurrentSelection(prev => ({
        range: {
          from: prev.range?.from ?? { dateIndex, timeIndex },
          to: { dateIndex, timeIndex }
        },
        additive: prev.additive
      }))

      return
    }

    if (!isCreate) {
      const userValue = initialData.userSchedule[dateIndex][timeIndex]
      const othersValue = initialData.othersSchedule[dateIndex][timeIndex]
      if (othersValue.length > 0 || userValue) {
        let slotUsers = Array.from({
          length: initialData.others.length + 1
        }).map(_ => false)
        if (userValue) slotUsers[0] = true
        othersValue.forEach(
          (otherId: number) => (slotUsers[otherId + 1] = true)
        )
        setHoveredSlotUsers(slotUsers)
      } else {
        setHoveredSlotUsers(null)
      }
    }
  }

  const handleMouseDownSlot = (
    dateIndex: number,
    timeIndex: number,
    isSelected: boolean
  ) => {
    setIsMouseDown(true)
    setCurrentSelection({
      range: {
        from: { dateIndex, timeIndex },
        to: { dateIndex, timeIndex }
      },
      additive: !isSelected
    })
  }

  // const handleMouseUpSchedule = () => {
  //   setIsMouseDown(false)
  //
  //   applySelection(currentSelection)
  //   setCurrentSelection({
  //     range: null,
  //     additive: currentSelection.additive
  //   })
  // }

  const applySelection = (selection: Selection) => {
    if (selection.range == null) return

    let newSchedule = [...initialData.userSchedule]

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

    editSchedule({ ...initialData, userSchedule: newSchedule })
  }

  return {
    currentSelection,
    isMouseDown,
    handleMouseDownSlot,
    handleMouseMoveSchedule,
    // handleMouseUpSchedule,
    applySelection
  }
}
