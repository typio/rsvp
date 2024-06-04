import { useEffect, useState } from 'react'

import { addDays, startOfDay } from 'date-fns'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faShare } from '@fortawesome/free-solid-svg-icons'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { DatePickerMultiple } from '@/components/datepicker'

import Schedule from './components/schedule'
import { ToggleGroup, ToggleGroupItem } from './components/ui/toggle-group'

const storedCreateState = ((storedStr: string | null) =>
  typeof storedStr === 'string' ? JSON.parse(storedStr) : null)(
  localStorage.getItem('storedCreateState')
)

const CreateOptions = ({
  dates,
  setDates,
  timeRange,
  setTimeRange,
  slotLength,
  setSlotLength
}: any) => {
  const handeTimeInput = (e: any, isFrom: boolean) => {
    const newValue = Number(e.target.value)
    let newHour = 0

    if (isNaN(newValue) || newValue > 24) {
      return
    } else if (Number(newValue) == 24) {
      newHour = 12
    } else if (Number(newValue) > 12) {
      newHour = newValue % 12
    } else {
      newHour = newValue
    }

    setTimeRange({
      ...timeRange,
      [isFrom ? 'from' : 'to']: {
        hour: newHour.toString(),
        isAM: timeRange.from.isAM
      }
    })
  }
  return (
    <div>
      <DatePickerMultiple dates={dates} setDates={setDates} />
      <div className="flex flex-row gap-x-8">
        <div className="flex flex-row flex-1 gap-x-2">
          <Input
            placeholder="9"
            type="number"
            min={1}
            max={12}
            onChange={e => {
              handeTimeInput(e, true)
            }}
            value={timeRange.from.hour}
          />
          <Button
            onClick={() =>
              setTimeRange({
                ...timeRange,
                from: {
                  hour: timeRange.from.hour,
                  isAM: !timeRange.from.isAM
                }
              })
            }
          >
            {timeRange.from.isAM ? 'AM' : 'PM'}
          </Button>
        </div>
        <div className="flex flex-row flex-1 gap-x-2">
          <Input
            min={1}
            max={12}
            placeholder="5"
            onChange={e => {
              handeTimeInput(e, false)
            }}
            value={timeRange.to.hour}
          />
          <Button
            onClick={() =>
              setTimeRange({
                ...timeRange,
                to: {
                  hour: timeRange.to.hour,
                  isAM: !timeRange.to.isAM
                }
              })
            }
          >
            {timeRange.to.isAM ? 'AM' : 'PM'}
          </Button>
        </div>
      </div>
      <div className="flex flex-row items-center justify-between">
        <Label htmlFor="slot-length" className="min-w-24">
          {' '}
          Slot Length
        </Label>
        <ToggleGroup
          id="slot-length"
          type="single"
          onValueChange={e => setSlotLength(Number(e))}
          value={String(slotLength)}
        >
          <ToggleGroupItem value={'15'}>15 min</ToggleGroupItem>
          <ToggleGroupItem value={'20'}>20 min</ToggleGroupItem>
          <ToggleGroupItem value={'30'}>30 min</ToggleGroupItem>
          <ToggleGroupItem value={'60'}>1 hour</ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  )
}

const h12To24 = (hour: number, isAM: boolean) => hour + (isAM ? 0 : 12)
const h24To12 = (hour: number): { hour: string; isAM: boolean } => {
  return { hour: '' + (hour > 12 ? hour - 12 : hour), isAM: hour < 12 }
}

const h24ToTimeRange = (timeRange: { from_hour: number; to_hour: number }) => {
  return {
    from: h24To12(timeRange.from_hour),
    to: h24To12(timeRange.to_hour)
  }
}

const Create = () => {
  const isCreate = window.location.pathname === '/'

  const [dates, setDates] = useState<Date[]>(
    storedCreateState?.dates.map((d: string) => new Date(d)) ??
      Array.from({ length: 7 }).map((_, i) =>
        addDays(startOfDay(new Date()), i)
      )
  )

  const [timeRange, setTimeRange] = useState(
    storedCreateState?.timeRange ?? {
      from: { hour: '9', isAM: true },
      to: { hour: '5', isAM: false }
    }
  )

  const [slotLength, setSlotLength] = useState(
    storedCreateState?.slotLength ?? 30
  )

  const [schedule, setSchedule] = useState<boolean[][]>(
    storedCreateState?.schedule ?? []
  )

  useEffect(() => {
    if (isCreate)
      localStorage.setItem(
        'storedCreateState',
        JSON.stringify({ dates, timeRange, slotLength, schedule })
      )
  }, [dates, timeRange, slotLength, schedule])

  const shareRoom = () => {
    let req = JSON.stringify({
      dates: dates,
      time_range: {
        from_hour:
          h12To24(Number(timeRange.from.hour), timeRange.from.isAM) || 0,
        to_hour: h12To24(Number(timeRange.to.hour), timeRange.to.isAM) || 0
      },
      slot_length: slotLength,
      schedule: schedule
    })
    fetch('http://localhost:3632/api/rooms', {
      method: 'POST',
      body: req,
      credentials: 'include' // Add this line
    }).then(res => {
      res.json().then(resJSON => {
        console.log(resJSON)
        history.pushState({ page: 1 }, 'room', `/${resJSON.room_uid}`)
      })
    })
  }

  const getRoom = () => {
    fetch(
      `http://localhost:3632/api/rooms/${window.location.pathname.slice(1)}`,
      {
        method: 'GET'
      }
    ).then(res => {
      res.json().then(resJSON => {
        console.log(resJSON)
        setTimeRange(h24ToTimeRange(resJSON.time_range))
        console.log(h24ToTimeRange(resJSON.time_range))
        setDates(resJSON.dates.map((d: string) => new Date(d)))
        setSchedule(resJSON.schedule)
      })
    })
  }

  useEffect(() => {
    getRoom()
  }, [])

  return (
    <main className="gap-x-8">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col">
          <div className="flex flex-row gap-x-4 ">
            <Input placeholder="Event Name" />
            <Button onClick={shareRoom}>
              <FontAwesomeIcon icon={faShare} />
            </Button>
          </div>
        </div>

        {isCreate && (
          <CreateOptions
            dates={dates}
            setDates={setDates}
            timeRange={timeRange}
            setTimeRange={setTimeRange}
            slotLength={slotLength}
            setSlotLength={setSlotLength}
          />
        )}

        {!isCreate && (
          <div>
            <div className="flex flex-row gap-x-2 items-center">
              You <div className="w-3 h-3 rounded bg-red-500" />
            </div>
          </div>
        )}

        {dates.length > 0 && (
          <Schedule
            dates={dates}
            timeRange={timeRange}
            slotLength={slotLength}
            schedule={schedule}
            setSchedule={setSchedule}
          />
        )}
      </div>
    </main>
  )
}

export default Create
