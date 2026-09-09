import { Selection, SelectionRange } from '@/components/Schedule'
import { ScheduleData } from '@/types'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

const EDGE_ZONE = 28
const EDGE_SPEED = 10
const EDGE_PAD = 16

export type ScheduleSelectionContextType = {
  currentSelection: Selection
  isMouseDown: boolean
  handleMouseDownSlot: (
    dateIndex: number,
    timeIndex: number,
    isSelected: boolean
  ) => void
  handleMouseMoveSchedule: (event: React.MouseEvent<HTMLDivElement>) => void
  applySelection: (selection: Selection) => void
  toggleCell: (dateIndex: number, timeIndex: number) => void
  setKeyboardRange: (range: SelectionRange | null, additive: boolean) => void
  commitKeyboardRange: () => void
}

export const useScheduleSelection = (
  initialData: ScheduleData,
  editSchedule: (newSchedule: ScheduleData) => void,
  setHoveredSlotUsers: (arg0: boolean[] | null) => void,
  isDraftRoom: boolean,
  onDragChange?: (drag: Selection | null) => void
): ScheduleSelectionContextType => {
  const [currentSelection, setCurrentSelection] = useState<Selection>({
    range: null,
    additive: true
  })

  useEffect(() => {
    onDragChange?.(currentSelection.range ? currentSelection : null)
  }, [currentSelection])

  const [isMouseDown, setIsMouseDown] = useState(false)

  useEffect(() => {
    const handleMouseUp = () => {
      setIsMouseDown(false)
      isMouseDownRef.current = false
      cancelAnimationFrame(edgeRaf.current)
      edgeRaf.current = 0
      applySelection(currentSelection)
      setCurrentSelection({
        range: null,
        additive: currentSelection.additive
      })
    }

    document.addEventListener('pointerup', handleMouseUp)
    document.addEventListener('pointercancel', handleMouseUp)
    return () => {
      document.removeEventListener('pointerup', handleMouseUp)
      document.removeEventListener('pointercancel', handleMouseUp)
    }
  }, [currentSelection])

  const isMouseDownRef = useRef(false)
  isMouseDownRef.current = isMouseDown
  const pointer = useRef<{ x: number; y: number; el: HTMLDivElement } | null>(
    null
  )
  const edgeRaf = useRef(0)

  const updateFromPointer = (
    scheduleEl: HTMLDivElement,
    clientX: number,
    clientY: number
  ) => {
    const cellAttr = document
      .elementFromPoint(clientX, clientY)
      ?.closest('[data-cell]')
      ?.getAttribute('data-cell')
    if (
      !cellAttr ||
      !scheduleEl.contains(document.elementFromPoint(clientX, clientY))
    ) {
      setHoveredSlotUsers(null)
      return
    }
    const [dateIndex, timeIndex] = cellAttr.split('-').map(Number)

    if (
      !isDraftRoom &&
      (dateIndex < 0 ||
        dateIndex >= initialData.dates.dates.length ||
        timeIndex < 0 ||
        timeIndex >= initialData.userSchedule[0].length)
    ) {
      setHoveredSlotUsers(null)
      return
    }

    if (isMouseDownRef.current) {
      setCurrentSelection(prev => ({
        range: {
          from: prev.range?.from ?? { dateIndex, timeIndex },
          to: { dateIndex, timeIndex }
        },
        additive: prev.additive
      }))

      return
    }

    if (!isDraftRoom) {
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

  const edgeTick = () => {
    const p = pointer.current
    if (!p || !isMouseDownRef.current) {
      edgeRaf.current = 0
      return
    }
    const r = p.el.getBoundingClientRect()
    const inner = r.left + EDGE_PAD
    const dx =
      p.x > r.right - EDGE_ZONE
        ? ((p.x - (r.right - EDGE_ZONE)) / EDGE_ZONE) * EDGE_SPEED
        : p.x < inner + EDGE_ZONE
          ? -((inner + EDGE_ZONE - p.x) / EDGE_ZONE) * EDGE_SPEED
          : 0
    if (dx) {
      p.el.scrollLeft += dx
      updateFromPointer(p.el, p.x, p.y)
    }
    edgeRaf.current = requestAnimationFrame(edgeTick)
  }

  const handleMouseMoveSchedule = (event: React.MouseEvent<HTMLDivElement>) => {
    const el = event.currentTarget
    pointer.current = { x: event.clientX, y: event.clientY, el }
    updateFromPointer(el, event.clientX, event.clientY)
    if (isMouseDownRef.current && !edgeRaf.current)
      edgeRaf.current = requestAnimationFrame(edgeTick)
  }

  const handleMouseDownSlot = (
    dateIndex: number,
    timeIndex: number,
    isSelected: boolean
  ) => {
    if (!canEdit()) return

    setIsMouseDown(true)
    isMouseDownRef.current = true
    setCurrentSelection({
      range: {
        from: { dateIndex, timeIndex },
        to: { dateIndex, timeIndex }
      },
      additive: !isSelected
    })
  }

  const canEdit = () => {
    if (initialData.absentReasons[0] === null) return true
    toast.error("You can't select times while marked absent.", {
      description:
        'To select times, please unselect the "I can\'t make it." button.'
    })
    return false
  }

  const toggleCell = (dateIndex: number, timeIndex: number) => {
    if (!canEdit()) return
    const cell = { dateIndex, timeIndex }
    applySelection({
      range: { from: cell, to: cell },
      additive: !initialData.userSchedule[dateIndex]?.[timeIndex]
    })
  }
  const setKeyboardRange = (range: SelectionRange | null, additive: boolean) =>
    setCurrentSelection({ range, additive })
  const commitKeyboardRange = () => {
    if (currentSelection.range && canEdit()) applySelection(currentSelection)
    setCurrentSelection({ range: null, additive: currentSelection.additive })
  }

  const applySelection = (selection: Selection) => {
    if (selection.range == null) return

    let newSchedule = initialData.userSchedule.map(row => [...row])

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
    applySelection,
    toggleCell,
    setKeyboardRange,
    commitKeyboardRange
  }
}
