'use client'

import { Calendar as CalendarIcon } from 'lucide-react'

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

export const DatePickerMultiple = ({
  dates,
  setDates,
  className
}: {
  dates: Date[] | undefined
  setDates: React.Dispatch<React.SetStateAction<Date[]>>
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

  return (
    <div className={cn('grid gap-2', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={'outline'}
            className={cn(
              'w-[300px] justify-start text-left font-normal',
              (dates ?? []).length === 0 && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            Select Days
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="multiple"
            selected={dates}
            onSelect={trySetDates}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
