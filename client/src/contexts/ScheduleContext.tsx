import {
  ColorCalculationContextType,
  useColorCalculation
} from '@/hooks/useColorCalculation'
import {
  ScheduleSelectionContextType,
  useScheduleSelection
} from '@/hooks/useScheduleSelection'
import { ScheduleData } from '@/types'
import { createContext, useContext } from 'react'

type ScheduleContextType = {
  isCreate: boolean
  data: ScheduleData
  editSchedule: (newData: ScheduleData) => void
  hoveringUser: number | null
} & ScheduleSelectionContextType &
  ColorCalculationContextType

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
  isCreate,
  initialData,
  editSchedule,
  hoveringUser,
  setHoveredSlotUsers,
  slotsPerColumn
}: {
  children: React.JSX.Element
  isCreate: boolean
  initialData: ScheduleData
  editSchedule: (newData: ScheduleData) => void
  hoveringUser: number | null
  setHoveredSlotUsers: (arg0: any) => void
  slotsPerColumn: number
}) => {
  const selectionProps = useScheduleSelection(
    initialData,
    editSchedule,
    setHoveredSlotUsers,
    isCreate,
    slotsPerColumn
  )
  const colorProps = useColorCalculation(
    selectionProps.currentSelection,
    hoveringUser,
    initialData?.others
  )

  return (
    <ScheduleContext.Provider
      value={{
        ...selectionProps,
        ...colorProps,
        isCreate,
        hoveringUser,
        data: initialData,
        editSchedule
      }}
    >
      {children}
    </ScheduleContext.Provider>
  )
}
