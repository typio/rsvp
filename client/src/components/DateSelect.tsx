import {
  faArrowLeft,
  faArrowRight,
  faCalendarDays,
  faCalendarWeek
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { useEffect, useRef, useState } from 'react'
import {
  isSameDay,
  isSaturday,
  isSunday,
  lastDayOfMonth,
  nextSaturday,
  nextSunday,
  previousSaturday,
  previousSunday
} from 'date-fns'
import { toast } from 'sonner'

export enum DaySelectMode {
  Dates = 0,
  DaysOfWeek = 1
}

export type WeekDayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7
export type SelectedDates =
  | {
      mode: DaySelectMode.Dates
      dates: string[]
    }
  | {
      mode: DaySelectMode.DaysOfWeek
      dates: WeekDayNumber[]
    }

export const DAYS_OF_WEEK = {
  three_letter_abbrv: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  two_letter_abbrv: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
  full: [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday'
  ]
}

export const DateSelect = ({
  mode,
  dates,
  setDates,
  className
}: {
  mode: DaySelectMode
  dates: SelectedDates
  setDates: React.Dispatch<SelectedDates>
  className?: string
}) => {
  const [showError, setShowError] = useState(false)

  let isInactive = true

  if (dates.mode !== mode) isInactive = true
  else isInactive = dates.dates.length === 0

  return (
    <div className={cn(className, '')}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={'outline'}
            className={cn(
              'justify-start text-left font-normal gap-x-2 text-foreground',
              isInactive && 'text-muted-foreground'
            )}
          >
            <div className="flex flex-row gap-4 items-center">
              {mode === DaySelectMode.Dates ? (
                <>
                  <FontAwesomeIcon icon={faCalendarDays} />
                  Dates
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faCalendarWeek} />
                  Days of Week
                </>
              )}
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={`border-2 z-30 ${mode === DaySelectMode.DaysOfWeek ? 'max-w-105 w-[calc(100vw-2rem)]' : 'w-[calc(100vw-2rem)] max-w-[calc(50px*7+2rem)]'} ${showError ? 'border-destructive' : ''}`}
        >
          {mode === DaySelectMode.DaysOfWeek ? (
            <DaysOfWeekCalendar dates={dates} setDates={setDates} />
          ) : (
            <DatesCalendar
              dates={dates}
              setDates={setDates}
              showError={showError}
              setShowError={setShowError}
            />
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

const DaysOfWeekCalendar = ({
  dates,
  setDates
}: {
  dates: SelectedDates
  setDates: React.Dispatch<SelectedDates>
}) => {
  const [isSelecting, setIsSelecting] = useState<null | boolean>(null)

  useEffect(() => {
    const handleMouseUp = () => setIsSelecting(null)
    window.addEventListener('pointerup', handleMouseUp)
    window.addEventListener('pointercancel', handleMouseUp)
    return () => {
      window.removeEventListener('pointerup', handleMouseUp)
      window.removeEventListener('pointercancel', handleMouseUp)
    }
  }, [])

  const handleDaySelect = (day: WeekDayNumber, additive: boolean) => {
    let newDates =
      dates.mode === DaySelectMode.DaysOfWeek ? dates.dates.slice() : []

    const isSelected = newDates.includes(day)

    if (!additive && isSelected) newDates = newDates.filter(d => d !== day)
    else if (additive && !isSelected) newDates = [...newDates, day]

    setDates({ mode: DaySelectMode.DaysOfWeek, dates: newDates.sort() })
  }

  return (
    <div
      className="grid grid-cols-7 gap-1.5 w-full"
      style={{ touchAction: 'none' }}
    >
      {DAYS_OF_WEEK.three_letter_abbrv.map((day, _i) => {
        const i = _i as WeekDayNumber

        const isSelected =
          dates.mode === DaySelectMode.DaysOfWeek
            ? dates.dates.includes(i)
            : false

        return (
          <button
            type="button"
            key={i}
            aria-pressed={isSelected}
            aria-label={DAYS_OF_WEEK.full[_i]}
            className="select-none h-28 w-full"
            onPointerDown={e => {
              ;(e.target as Element).releasePointerCapture(e.pointerId)
              setIsSelecting(!isSelected)
              handleDaySelect(i, !isSelected)
            }}
            onPointerEnter={() => {
              if (isSelecting !== null) handleDaySelect(i, isSelecting)
            }}
            onKeyDown={e => {
              if (e.key !== ' ' && e.key !== 'Enter') return
              e.preventDefault()
              handleDaySelect(i, !isSelected)
            }}
          >
            <div
              className={`h-full w-full flex items-center justify-center rounded-lg font-medium text-sm duration-200 border-2 ${
                isSelected
                  ? 'bg-secondary/80 border-secondary text-white shadow-lg'
                  : 'bg-white/5 border-white/5 text-white/70'
              }`}
            >
              {day}
            </div>
          </button>
        )
      })}
    </div>
  )
}

const DatesCalendar = ({
  dates,
  setDates,
  showError,
  setShowError
}: {
  dates: SelectedDates
  setDates: React.Dispatch<SelectedDates>
  showError: boolean
  setShowError: React.Dispatch<boolean>
}) => {
  const maxSelectableDate = new Date()
  maxSelectableDate.setMonth(maxSelectableDate.getMonth() + 6)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [currentDate, setCurrentDate] = useState(new Date())

  const monthStart = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1
  )
  const monthEnd = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  )
  const selected =
    dates.mode === DaySelectMode.Dates ? dates.dates.map(d => new Date(d)) : []
  const before = selected.filter(d => d < monthStart).length
  const after = selected.filter(d => d > monthEnd).length
  const hint = (n: number) => `+${n} ${n === 1 ? 'day' : 'days'}`
  const atFirstMonth =
    monthStart <= new Date(today.getFullYear(), today.getMonth(), 1)

  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current)
      }
    }
  }, [])

  const [isSelecting, setIsSelecting] = useState<null | boolean>(null) // null: idle, bool: additive

  useEffect(() => {
    const handleMouseUp = () => setIsSelecting(null)

    window.addEventListener('pointerup', handleMouseUp)
    window.addEventListener('pointercancel', handleMouseUp)
    return () => {
      window.removeEventListener('pointerup', handleMouseUp)
      window.removeEventListener('pointercancel', handleMouseUp)
    }
  }, [])

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay()
  }

  const handleDateClick = (date: Date, additive: boolean | null) => {
    if (additive && date > maxSelectableDate) {
      toast.error("Can't select dates more than 6 months out")
      return
    }

    const dateString = date.toDateString()
    const isSelected =
      dates.mode === DaySelectMode.Dates &&
      dates.dates.some(d => d === dateString)

    let prev = dates.mode === DaySelectMode.Dates ? dates.dates : []
    let newDates: string[]

    if (!additive && isSelected) newDates = prev.filter(d => d !== dateString)
    else if (additive && !isSelected) newDates = [...prev, date.toDateString()]
    else newDates = prev

    if (newDates.length > 14) {
      setShowError(true)

      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current)
      else {
        toast.error('Selecting 2+ weeks requires Pro tier!', {
          description: 'Pro subscriptions are not available.',
          action: {
            label: 'Ok.',
            onClick: () => {}
          }
        })
      }

      errorTimeoutRef.current = setTimeout(() => {
        setShowError(false)
        errorTimeoutRef.current = null
      }, 500)

      newDates = prev
    }

    setDates({
      mode: DaySelectMode.Dates,
      dates: newDates.sort(
        (a, b) => new Date(a).getTime() - new Date(b).getTime()
      )
    })
  }

  const renderCalendar = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const daysInMonth = getDaysInMonth(year, month)
    const firstDayOfMonth = getFirstDayOfMonth(year, month)
    const days = []

    const isDateSelected = (date: Date) =>
      dates.mode === DaySelectMode.Dates &&
      dates.dates.some(d => d === date.toDateString())

    const getRoundedCorners = (date: Date) => {
      if (!isDateSelected(date)) return ''

      const prevDate = new Date(date)
      prevDate.setDate(date.getDate() - 1)
      const nextDate = new Date(date)
      nextDate.setDate(date.getDate() + 1)
      const aboveDate = new Date(date)
      aboveDate.setDate(date.getDate() - 7)
      const belowDate = new Date(date)
      belowDate.setDate(date.getDate() + 7)

      const roundTop = !isDateSelected(aboveDate)
      const roundBottom = !isDateSelected(belowDate)
      const roundLeft = date.getDay() === 0 || !isDateSelected(prevDate)
      const roundRight = date.getDay() === 6 || !isDateSelected(nextDate)

      let roundedCorners = ''
      if (roundTop && roundLeft) roundedCorners += 'rounded-tl-md '
      if (roundTop && roundRight) roundedCorners += 'rounded-tr-md '
      if (roundBottom && roundLeft) roundedCorners += 'rounded-bl-md '
      if (roundBottom && roundRight) roundedCorners += 'rounded-br-md '

      return roundedCorners.trim()
    }

    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="aspect-square" />)
    }

    const firstDateOfMonth = new Date(year, month, 1)
    const lastDateOfMonth = lastDayOfMonth(firstDateOfMonth)

    const firstSat = isSaturday(firstDateOfMonth)
      ? 1
      : nextSaturday(firstDateOfMonth).getDate()
    const lastSun = isSunday(lastDateOfMonth)
      ? lastDateOfMonth.getDate()
      : previousSunday(lastDateOfMonth).getDate()

    const firstSun = isSunday(firstDateOfMonth)
      ? null
      : nextSunday(firstDateOfMonth).getDate()
    const lastSat = isSaturday(lastDateOfMonth)
      ? null
      : previousSaturday(lastDateOfMonth).getDate()

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      const isSelected = isDateSelected(date)
      const roundedCorners = getRoundedCorners(date)
      const disabled = date > maxSelectableDate || date < today

      days.push(
        <button
          type="button"
          key={day}
          disabled={disabled}
          aria-pressed={isSelected}
          aria-label={date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
          })}
          onKeyDown={e => {
            if (e.key !== ' ' && e.key !== 'Enter') return
            e.preventDefault()
            handleDateClick(date, !isSelected)
          }}
          className={`aspect-square flex justify-center items-center select-none text-sm sm:text-base font-medium
          ${isSameDay(date, new Date()) ? 'text-primary' : ''}
          ${isSelected ? `bg-secondary ${roundedCorners} z-10` : ' bg-background text-muted-foreground active:text-muted-foreground xl:active:text-white '}
          ${day === 1 ? 'rounded-tl-md' : ''}
          ${day === daysInMonth ? 'rounded-br-md' : ''}
          ${day === firstSat ? 'rounded-tr-md' : ''}
          ${day === lastSun ? 'rounded-bl-md' : ''}
          ${day === firstSun ? 'rounded-tl-md' : ''}
          ${day === lastSat ? 'rounded-br-md' : ''}
          ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
          onPointerDown={e => {
            if (disabled) return
            const target = e.target as Element
            target.releasePointerCapture(e.pointerId)
            setIsSelecting(!isSelected)
            handleDateClick(date, !isSelected)
          }}
          onPointerEnter={() => {
            if (disabled) return
            if (isSelecting !== null) {
              handleDateClick(date, isSelecting)
            }
          }}
        >
          {day}
        </button>
      )
    }
    return days
  }

  const changeMonth = (increment: number) => {
    setCurrentDate(
      prev => new Date(prev.getFullYear(), prev.getMonth() + increment, 1)
    )
  }

  return (
    <div
      className={`z-30 flex flex-col ${showError ? 'wiggle' : ''}`}
      style={{ touchAction: 'none' }}
    >
      <div className="flex flex-row justify-between items-start mb-4">
        <div className="flex flex-col gap-y-2">
          <Button
            variant="ghost"
            className={`w-12.5 h-11 ${atFirstMonth ? 'opacity-30' : ''}`}
            disabled={atFirstMonth}
            aria-label="Previous month"
            onClick={() => changeMonth(-1)}
          >
            <FontAwesomeIcon icon={faArrowLeft} />
          </Button>
          <span
            className={`text-xs text-muted-foreground text-center ${before === 0 ? 'invisible' : ''}`}
          >
            {hint(before)}
          </span>
        </div>
        <div className="h-11 flex items-center">
          <span className="text-sm sm:text-base ">
            {currentDate.toLocaleString('default', {
              month: 'long',
              year: 'numeric'
            })}
          </span>
        </div>
        <div className="flex flex-col gap-y-2">
          <Button
            variant="ghost"
            className="w-12.5 h-11"
            aria-label="Next month"
            onClick={() => changeMonth(1)}
          >
            <FontAwesomeIcon icon={faArrowRight} />
          </Button>
          <span
            className={`text-xs text-muted-foreground text-center ${after === 0 ? 'invisible' : ''}`}
          >
            {hint(after)}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-7">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
          <div
            key={day}
            className="aspect-square flex items-center justify-center text-muted-foreground text-sm font-medium"
          >
            {day}
          </div>
        ))}
        {renderCalendar()}
      </div>
    </div>
  )
}
