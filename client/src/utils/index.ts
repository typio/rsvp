import { Colors } from '@/colors'
import { H12Time, H24TimeRange } from '@/types'
import { useEffect, useState } from 'react'
import tinycolor from 'tinycolor2'

export const SITE_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:5173'
    : 'https://cmon.rsvp'

export const API_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3632'
    : 'https://api.cmon.rsvp'

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

export const debounce = (func: (...args: any[]) => any, wait: number) => {
  let timeout: NodeJS.Timeout
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

export const getOtherUserColor = (
  n: number,
  totalUsers: number,
  firstColor: tinycolor.Instance
) => {
  if (totalUsers <= Colors.othersColors.length) {
    return tinycolor(Colors.othersColors[n])
  } else {
    return firstColor.spin((n / totalUsers) * 360)
  }
}
