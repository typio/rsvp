import type { Selection } from '@/components/Schedule'

export type XY = { x: number; y: number }

export type Participant = {
  id: number
  name: string
  colorIndex: number
  drag: Selection | null
}
