import { useEffect, useState } from 'react'
import { H12Time, H24TimeRange } from './types'

export const h12To24 = (hour: number, isAM: boolean) => hour + (isAM ? 0 : 12)
export const h24To12 = (hour: number): H12Time => {
  return { hour: '' + (hour > 12 ? hour - 12 : hour), isAM: hour < 12 }
}

export const h24ToTimeRange = (timeRange: H24TimeRange) => {
  return {
    from: h24To12(timeRange.from_hour),
    to: h24To12(timeRange.to_hour)
  }
}

export const useDebounce = (value: any, delay: number): any => {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}
