import { SelectedDates } from './components/DateSelect'

export type H24TimeRange = {
  from_hour: number
  to_hour: number
}

export type H12Time = {
  hour: string
  isAM: boolean
}

export type H12TimeRange = {
  from: H12Time
  to: H12Time
}

export type ScheduleData = {
  eventName: string
  userName: string
  dates: SelectedDates
  slotLength: number
  timeRange: H12TimeRange
  userSchedule: boolean[][]
  othersSchedule: number[][][]
  others: string[]
  absentReasons: (string | null)[]
}
