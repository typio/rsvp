import {
  ScheduleSelectionContextType,
  useScheduleSelection
} from '@/hooks/useScheduleSelection'
import { ScheduleData } from '@/types'
import type { Selection } from '@/components/Schedule'
import { createContext, useContext } from 'react'

type ScheduleContextType = {
  isDraftRoom: boolean
  data: ScheduleData
  editSchedule: (newData: ScheduleData) => void
  hoveringUser: number | null
  setHoveredSlotUsers: (users: boolean[] | null) => void
} & ScheduleSelectionContextType

const ScheduleContext = createContext<ScheduleContextType | null>(null)

export const useScheduleContext = (): ScheduleContextType => {
  const context = useContext(ScheduleContext)
  if (context === null) {
    throw new Error('useScheduleContext must be used within a ScheduleProvider')
  }
  return context
}

export const ScheduleProvider = ({
  children,
  isDraftRoom,
  initialData,
  editSchedule,
  hoveringUser,
  setHoveredSlotUsers,
  onDragChange
}: {
  children: React.JSX.Element
  isDraftRoom: boolean
  initialData: ScheduleData
  editSchedule: (newData: ScheduleData) => void
  hoveringUser: number | null
  setHoveredSlotUsers: (arg0: any) => void
  onDragChange?: (drag: Selection | null) => void
}) => {
  const selectionProps = useScheduleSelection(
    initialData,
    editSchedule,
    setHoveredSlotUsers,
    isDraftRoom,
    onDragChange
  )

  return (
    <ScheduleContext.Provider
      value={{
        ...selectionProps,
        isDraftRoom,
        hoveringUser,
        setHoveredSlotUsers,
        data: initialData,
        editSchedule
      }}
    >
      {children}
    </ScheduleContext.Provider>
  )
}
