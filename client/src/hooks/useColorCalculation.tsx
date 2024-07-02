import { Colors } from '@/colors'
import { Selection } from '@/components/Schedule'
import { useMemo } from 'react'
import tinycolor from 'tinycolor2'

export type SlotColorResult = {
  slotColor: null | tinycolor.Instance
  alpha: number
}

export type ColorCalculationContextType = {
  slotColors: {
    bgColorString: string
    userColorString: string
    allColorString: string
  }
  calculateCreateSlotColor: (
    isSelected: boolean,
    isDragSelected: boolean
  ) => SlotColorResult
  calculateJoinSlotColor: (
    isSelected: boolean,
    isDragSelected: boolean,
    othersValue: number[]
  ) => { res: SlotColorResult; showOthers: boolean }
}

export const useColorCalculation = (
  currentSelection: Selection,
  hoveringUser: number | null,
  others: string[]
): ColorCalculationContextType => {
  const slotColors = useMemo(() => {
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

  const calculateCreateSlotColor = (
    isSelected: boolean,
    isDragSelected: boolean
  ): SlotColorResult => {
    let slotColor = null
    let alpha = 1

    const { userColorString } = slotColors

    if (isSelected || (isDragSelected && currentSelection.additive)) {
      slotColor = tinycolor('hsl ' + userColorString)
      if (isDragSelected && !currentSelection.additive) alpha = 0.3
    }

    return { slotColor, alpha }
  }

  const calculateJoinSlotColor = (
    isSelected: boolean,
    isDragSelected: boolean,
    othersValue: number[]
  ): { res: SlotColorResult; showOthers: boolean } => {
    let slotColor = null
    let alpha = 1

    const { userColorString, allColorString } = slotColors

    let cellSelectedByAll =
      others.length > 0 &&
      othersValue.length === others.length &&
      ((isDragSelected && currentSelection.additive) || isSelected)

    alpha = hoveringUser === null ? 1 : 0.3

    const cellSelectedByHoveringUser =
      hoveringUser && othersValue?.includes(hoveringUser - 1)

    if (cellSelectedByHoveringUser && hoveringUser >= 1)
      slotColor = tinycolor(Colors.othersColors[hoveringUser - 1])
    else if (cellSelectedByAll) slotColor = tinycolor('hsl ' + allColorString)
    else if (isSelected || (isDragSelected && currentSelection.additive))
      slotColor = tinycolor('hsl ' + userColorString)

    if (cellSelectedByHoveringUser || (hoveringUser === 0 && isSelected))
      alpha = 1

    if (isDragSelected && !currentSelection.additive) alpha = 0.3

    return {
      res: { slotColor, alpha },
      showOthers: !cellSelectedByAll && !cellSelectedByHoveringUser
    }
  }

  return { slotColors, calculateCreateSlotColor, calculateJoinSlotColor }
}
