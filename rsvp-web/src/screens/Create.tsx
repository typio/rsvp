import { useEffect, useState } from 'react'

import { addDays, startOfDay } from 'date-fns'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faShare } from '@fortawesome/free-solid-svg-icons'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { DatePickerMultiple } from '@/components/datepicker'

import Schedule from '.././components/schedule'
import { ToggleGroup, ToggleGroupItem } from '.././components/ui/toggle-group'
import { h12To24 } from '@/utils'
import { ScheduleData } from '@/types'

const storedCreateState = ((storedStr: string | null) =>
  typeof storedStr === 'string' ? JSON.parse(storedStr) : null)(
  localStorage.getItem('storedCreateState')
)

const CreateOptions = ({ scheduleData, setScheduleData, shareRoom }: any) => {
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

    setScheduleData({
      ...scheduleData,
      timeRange: {
        ...scheduleData.timeRange,
        [isFrom ? 'from' : 'to']: {
          hour: newHour.toString(),
          isAM: scheduleData.timeRange.from.isAM
        }
      }
    })
  }

  return (
    <div className="flex flex-col bg-card rounded-md p-4 gap-y-4">
      <div className="flex flex-row gap-x-4 ">
        <div className="flex flex-col gap-y-1 flex-1">
          <label className="text-sm font-medium text-muted-foreground">
            Event name
          </label>
          <Input
            value={scheduleData.event_name}
            onChange={e =>
              setScheduleData({
                ...scheduleData,
                event_name: e.target.value
              })
            }
          />
        </div>
        <Button onClick={shareRoom}>
          <FontAwesomeIcon icon={faShare} />
        </Button>
      </div>
      <DatePickerMultiple
        dates={scheduleData.dates}
        setDates={newDates => {
          setScheduleData({ ...scheduleData, dates: newDates })
        }}
      />
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
            value={scheduleData.timeRange.from.hour}
          />
          <Button
            onClick={() =>
              setScheduleData({
                ...scheduleData,
                timeRange: {
                  ...scheduleData.timeRange,
                  from: {
                    hour: scheduleData.timeRange.from.hour,
                    isAM: !scheduleData.timeRange.from.isAM
                  }
                }
              })
            }
          >
            {scheduleData.timeRange.from.isAM ? 'AM' : 'PM'}
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
            value={scheduleData.timeRange.to.hour}
          />
          <Button
            onClick={() =>
              setScheduleData({
                ...scheduleData,
                timeRange: {
                  ...scheduleData.timeRange,
                  from: {
                    hour: scheduleData.timeRange.from.hour,
                    isAM: !scheduleData.timeRange.from.isAM
                  }
                }
              })
            }
          >
            {scheduleData.timeRange.to.isAM ? 'AM' : 'PM'}
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
          onValueChange={e =>
            setScheduleData({ ...scheduleData, slotLength: Number(e) })
          }
          value={String(scheduleData.slotLength)}
        >
          <ToggleGroupItem value={'15'} className="w-20">
            15 min
          </ToggleGroupItem>
          <ToggleGroupItem value={'20'} className="w-20">
            20 min
          </ToggleGroupItem>
          <ToggleGroupItem value={'30'} className="w-20">
            30 min
          </ToggleGroupItem>
          <ToggleGroupItem value={'60'} className="w-20">
            1 hour
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  )
}

const Create = ({ setIsCreate }) => {
  const [scheduleData, setScheduleData] = useState<ScheduleData>({
    event_name: '',
    dates:
      storedCreateState?.dates.map((d: string) => new Date(d)) ??
      Array.from({ length: 7 }).map((_, i) =>
        addDays(startOfDay(new Date()), i)
      ),
    timeRange: storedCreateState?.timeRange ?? {
      from: { hour: '9', isAM: true },
      to: { hour: '5', isAM: false }
    },
    slotLength: storedCreateState?.slotLength ?? 30,
    userSchedule: storedCreateState?.userSchedule ?? [],
    othersSchedule: []
  })

  useEffect(() => {
    localStorage.setItem('storedCreateState', JSON.stringify(scheduleData))
  }, [
    scheduleData.event_name,
    scheduleData.dates,
    scheduleData.timeRange,
    scheduleData.slotLength,
    scheduleData.userSchedule
  ])

  const shareRoom = () => {
    let req = JSON.stringify({
      event_name: scheduleData.event_name,
      dates: scheduleData.dates,
      time_range: {
        from_hour:
          h12To24(
            Number(scheduleData.timeRange.from.hour),
            scheduleData.timeRange.from.isAM
          ) || 0,
        to_hour:
          h12To24(
            Number(scheduleData.timeRange.to.hour),
            scheduleData.timeRange.to.isAM
          ) || 0
      },
      slot_length: scheduleData.slotLength,
      schedule: scheduleData.userSchedule
    })
    fetch('http://localhost:3632/api/rooms', {
      method: 'POST',
      body: req,
      credentials: 'include'
    }).then(res => {
      res.json().then(resJSON => {
        console.log(resJSON)
        history.pushState({ page: 1 }, 'room', `/${resJSON.room_uid}`)
        setIsCreate(false)
      })
    })
  }

  return (
    <main className="gap-x-8">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col"></div>

        <CreateOptions
          scheduleData={scheduleData}
          setScheduleData={setScheduleData}
          shareRoom={shareRoom}
        />

        {scheduleData.dates.length > 0 && (
          <Schedule
            data={scheduleData}
            setData={setScheduleData}
            isCreate={true}
          />
        )}
      </div>
    </main>
  )
}

export default Create
