import { Colors } from '@/colors'
import { Selection } from '@/components/Schedule'
import tinycolor from 'tinycolor2'

const opacity = (o: number) =>
  Math.round(o * 255)
    .toString(16)
    .padStart(2, '0')

const LANES = true as boolean // as boolean: keeps both branches live for tsc

export const slotPaint = (
  isDraftRoom: boolean,
  isSelected: boolean,
  isDragSelected: boolean,
  selection: Selection,
  othersValue: number[],
  othersCount: number,
  presentOthersIndices: number[],
  hoveringUser: null | number,
  pendingAdd: number[] = [],
  pendingRemove: number[] = []
): {
  fill: string
  lanes: (string | null)[] | null
  youBand: string | null
} => {
  let fill = Colors.bgColor
  let lanes = null
  let youBand: string | null = null

  // draft paints just me unless the demo cast is present
  if (
    isDraftRoom &&
    presentOthersIndices.length === 0 &&
    othersValue.length === 0
  ) {
    if (isSelected || (isDragSelected && selection.additive)) {
      fill = tinycolor(Colors.userColor)
        .setAlpha(isDragSelected && !selection.additive ? 0.3 : 1)
        .toRgbString()
    }

    return { fill, lanes, youBand }
  }

  // membership, not count: stale absent cells must not block gold
  const cellSelectedByAll =
    presentOthersIndices.length > 0 &&
    presentOthersIndices.every(i => othersValue.includes(i)) &&
    ((isDragSelected && selection.additive) ||
      (isSelected && !(isDragSelected && !selection.additive)))

  const lanesMode = othersCount <= 5 && LANES

  if (hoveringUser === 0 && isSelected) fill = Colors.userColor
  else if (hoveringUser && othersValue?.includes(hoveringUser - 1)) {
    fill = lanesMode
      ? Colors.othersColors[(hoveringUser ?? 0) - 1]
      : Colors.userColor
  } else if (cellSelectedByAll) fill = Colors.allColor
  else if (lanesMode)
    lanes = [
      isSelected || (isDragSelected && selection.additive)
        ? Colors.userColor +
          ((isDragSelected && !selection.additive) ||
          (hoveringUser !== null && hoveringUser > 0)
            ? opacity(1 / 3)
            : '')
        : null,
      ...presentOthersIndices.map(otherI => {
        const committed = othersValue?.includes(otherI)
        const adding = pendingAdd.includes(otherI)
        if (!committed && !adding) return null
        const dim =
          pendingRemove.includes(otherI) ||
          (hoveringUser !== null && hoveringUser - 1 !== otherI)
        return Colors.othersColors[otherI] + opacity(dim ? 0.3 : 1)
      })
    ]
  else {
    // fill counts others only; me = the band. hovered member isn't here → dim
    const liveOthers =
      othersValue.length + pendingAdd.length - pendingRemove.length
    const level = liveOthers / othersCount
    fill =
      Colors.userColor + opacity(hoveringUser !== null ? level * 0.35 : level)
    youBand =
      isDragSelected && !selection.additive
        ? Colors.userColor + opacity(0.3)
        : isSelected || isDragSelected
          ? Colors.userColor
          : null
  }

  return { fill, lanes, youBand }
}
