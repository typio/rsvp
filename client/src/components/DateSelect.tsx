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
  Dates = 'Dates',
  DaysOfWeek = 'DaysOfWeek'
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
              'justify-start text-left font-normal gap-x-2 text-white',
              isInactive && 'text-muted-foreground'
            )}
          >
            <div className="flex flex-row gap-4 items-center">
              {mode === DaySelectMode.Dates ? (
                <>
                  <FontAwesomeIcon icon={faCalendarDays} />
                  Select Dates
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faCalendarWeek} />
                  Select Days of Week
                </>
              )}
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={`w-auto ${showError ? 'border-destructive' : ''}`}
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
      className="flex flex-row justify-center"
      onMouseUp={() => {
        setIsSelecting(null)
      }}
    >
      {DAYS_OF_WEEK.three_letter_abbrv.map((day, _i) => {
        const i = _i as WeekDayNumber

        const isSelected =
          dates.mode === DaySelectMode.DaysOfWeek
            ? dates.dates.includes(i)
            : false

        return (
          <div
            key={i}
            className={`h-36 w-16  px-0.5 select-none`}
            onMouseDown={() => {
              setIsSelecting(!isSelected)
              handleDaySelect(i, !isSelected)
            }}
            onMouseEnter={() => {
              if (isSelecting !== null) handleDaySelect(i, isSelecting)
            }}
          >
            <div
              className={`h-full w-full flex items-center justify-center ${isSelected ? 'bg-secondary' : 'bg-background text-muted-foreground'} rounded-lg font-medium text-sm`}
            >
              {day}
            </div>
          </div>
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
  const [currentDate, setCurrentDate] = useState(new Date())
  // const [selectedDates, setSelectedDates] = useState<Date[]>([])

  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current)
      }
    }
  }, [])

  // null when not selecting, boolean shows if selection is additive or not
  const [isSelecting, setIsSelecting] = useState<null | boolean>(null)

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay()
  }

  const handleDateClick = (date: Date, additive: boolean | null) => {
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

      // Clear any existing timeout
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current)
      } else {
        toast.error('You must become a Pro member to select 2+ weeks!', {
          description: 'Pro subscriptions are not available.',
          action: {
            label: 'Ok, sorry.',
            onClick: () => {}
          }
        })
      }

      // Set new timeout and store the reference
      errorTimeoutRef.current = setTimeout(() => {
        setShowError(false)
        errorTimeoutRef.current = null
      }, 500)

      newDates = prev
    }

    setDates({ mode: DaySelectMode.Dates, dates: newDates })
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
      days.push(<div key={`empty-${i}`} className="w-10 h-10" />)
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

      days.push(
        <div
          key={day}
          className={`w-10 h-10 flex justify-center items-center select-none text-sm font-medium
          ${isSameDay(date, new Date()) ? 'text-primary' : ''} 
          ${isSelected ? `bg-secondary ${roundedCorners} z-10` : ' bg-background text-muted-foreground hover:text-white '}
          ${day === 1 ? 'rounded-tl-md' : ''}
          ${day === daysInMonth ? 'rounded-br-md' : ''}
          ${day === firstSat ? 'rounded-tr-md' : ''}
          ${day === lastSun ? 'rounded-bl-md' : ''}
          ${day === firstSun ? 'rounded-tl-md' : ''}
          ${day === lastSat ? 'rounded-br-md' : ''}
          cursor-pointer`}
          onMouseDown={() => {
            setIsSelecting(!isSelected)
            handleDateClick(date, !isSelected)
          }}
          onMouseEnter={() => {
            if (isSelecting !== null) {
              handleDateClick(date, isSelecting)
            }
          }}
        >
          {day}
        </div>
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
      className={`flex flex-col ${showError ? 'wiggle' : ''}`}
      onMouseUp={() => setIsSelecting(null)}
    >
      <div className="flex flex-row justify-between items-center mb-4">
        <Button variant="ghost" onClick={() => changeMonth(-1)}>
          <FontAwesomeIcon icon={faArrowLeft} />
        </Button>
        <span className="text-sm">
          {currentDate.toLocaleString('default', {
            month: 'long',
            year: 'numeric'
          })}
        </span>
        <Button variant="ghost" onClick={() => changeMonth(1)}>
          <FontAwesomeIcon icon={faArrowRight} />
        </Button>
      </div>
      <div className="grid grid-cols-7 ">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
          <div
            key={day}
            className="w-10 h-10 flex items-center justify-center text-muted-foreground text-sm font-medium"
          >
            {day}
          </div>
        ))}
        {renderCalendar()}
      </div>
    </div>
  )
}
