import { useEffect, useState } from 'react'

import { addDays, startOfDay } from 'date-fns'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faShare } from '@fortawesome/free-solid-svg-icons'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import Schedule from '.././components/schedule'
import { h12To24, h24ToTimeRange } from '@/utils'

const storedCreateState = ((storedStr: string | null) =>
  typeof storedStr === 'string' ? JSON.parse(storedStr) : null)(
  localStorage.getItem('storedCreateState')
)

const Join = () => {
  const [slotLength, setSlotLength] = useState(
    storedCreateState?.slotLength ?? 30
  )

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

  const [userSchedule, setUserSchedule] = useState<boolean[][]>(
    storedCreateState?.schedule ?? []
  )

  const [othersSchedule, setOthersSchedule] = useState<string[][][]>(
    storedCreateState?.schedule ?? []
  )

  const getRoom = () => {
    fetch(
      `http://localhost:3632/api/rooms/${window.location.pathname.slice(1)}`,
      {
        method: 'GET',
        credentials: 'include'
      }
    ).then(res => {
      res.json().then(resJSON => {
        console.log(resJSON)
        setTimeRange(h24ToTimeRange(resJSON.time_range))
        setDates(resJSON.dates.map((d: string) => new Date(d)))
        setSlotLength(resJSON.slot_length)
        setUserSchedule(resJSON.user_schedule)
      })
    })
  }

  useEffect(() => {
    getRoom()
  }, [])

  useEffect(() => {
    console.log(userSchedule)

    let req = JSON.stringify({
      dates: dates,
      time_range: {
        from_hour:
          h12To24(Number(timeRange.from.hour), timeRange.from.isAM) || 0,
        to_hour: h12To24(Number(timeRange.to.hour), timeRange.to.isAM) || 0
      },
      slot_length: slotLength,
      user_schedule: userSchedule
    })
    fetch('http://localhost:3632/api/rooms', {
      method: 'POST',
      body: req,
      credentials: 'include'
    }).then(res => {
      res.json().then(resJSON => {
        console.log(resJSON)
      })
    })
  }, [userSchedule])

  const shareRoom = () => {
    alert(window.location)
  }

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

        <div>
          <div className="flex flex-row gap-x-2 items-center">
            You <div className="w-3 h-3 rounded bg-red-500" />
          </div>
        </div>

        {dates.length > 0 && (
          <Schedule
            dates={dates}
            timeRange={timeRange}
            slotLength={slotLength}
            isCreate={false}
            userSchedule={userSchedule}
            setUserSchedule={setUserSchedule}
            othersSchedule={othersSchedule}
            setOthersSchedule={setOthersSchedule}
          />
        )}
      </div>
    </main>
  )
}

export default Join
