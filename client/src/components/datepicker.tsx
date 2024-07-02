'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { toast } from 'sonner'
import { isSameDay, set } from 'date-fns'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCalendar } from '@fortawesome/free-solid-svg-icons'
import { useEffect, useState } from 'react'

export const DatePickerMultiple = ({
  dates,
  setDates,
  className
}: {
  dates: Date[] | undefined
  setDates: (...args: any) => any
  className?: string
}) => {
  const trySetDates = (newDates: Date[] | undefined, nD: Date) => {
    newDates
    if (!(dates ?? []).some(day => isSameDay(day, nD))) {
      if ((dates ?? []).length >= 14)
        toast.error('You must become a Pro member to select 2+ weeks!', {
          description: 'Pro subscriptions are not available.',
          action: {
            label: 'Ok, sorry.',
            onClick: () => {}
          }
        })
      else
        setDates(
          [...(dates ?? []), nD].sort((a, b) => a.getTime() - b.getTime())
        )
    } else {
      setDates(dates?.filter(day => !isSameDay(day, nD)) || [])
    }
  }

  const [mouseDown, setMouseDown] = useState(false)

  window.addEventListener('mousedown', () => setMouseDown(true))
  window.addEventListener('mouseup', () => setMouseDown(false))

  return (
    <div className={cn('grid gap-2', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={'outline'}
            className={cn(
              'justify-start text-left font-normal gap-x-2 text-white',
              (dates ?? []).length === 0 && 'text-muted-foreground'
            )}
          >
            <FontAwesomeIcon icon={faCalendar} />
            Select Days
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            disabled={{ before: new Date() }}
            mode="multiple"
            selected={dates}
            // NOTE: This dragging setup is buggy, I really need an OnDayMouseDown to do this
            onSelect={trySetDates}
            onDayMouseEnter={e => {
              if (mouseDown) {
                trySetDates(dates, e)
              }
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
