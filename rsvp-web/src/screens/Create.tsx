import { useEffect, useState } from 'react'

import { addDays, startOfDay } from 'date-fns'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faShare,
  faSquareArrowUpRight,
  faSquareUpRight
} from '@fortawesome/free-solid-svg-icons'

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
  const [timeInputs, setTimeInputs] = useState({ from: '9', to: '5' })

  const handleTimeInput = (text: string, isFrom: boolean) => {
    setTimeInputs({ ...timeInputs, [isFrom ? 'from' : 'to']: text })

    let newValue = Number(text)

    if (isNaN(newValue) || newValue < 1 || newValue > 12) {
      return
    }

    setScheduleData({
      ...scheduleData,
      timeRange: {
        ...scheduleData.timeRange,
        [isFrom ? 'from' : 'to']: {
          ...scheduleData.timeRange.isAM,
          hour: newValue.toString()
        }
      }
    })
  }

  return (
    <div className="flex flex-col bg-card rounded-md p-4 gap-y-4 ">
      <div className="flex flex-row gap-x-4 items-end">
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
        <Button
          onClick={shareRoom}
          className="flex flex-row gap-x-2 items-center bg-muted text-primary hover:bg-primary hover:text-card"
        >
          <FontAwesomeIcon icon={faSquareUpRight} />
          Share
        </Button>
      </div>
      <DatePickerMultiple
        dates={scheduleData.dates}
        setDates={newDates => {
          setScheduleData({ ...scheduleData, dates: newDates })
        }}
      />
      <div className="flex flex-row justify-between">
        <div className="flex flex-row gap-x-4 mr-4">
          <div className="flex flex-row flex-1 gap-x-2">
            <Input
              className="w-16 text-center"
              onChange={e => {
                handleTimeInput(e.target.value, true)
              }}
              value={timeInputs.from}
            />
            <Button
              className="bg-muted text-accent hover:bg-accent hover:text-muted w-12 text-center font-time"
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
              onChange={e => {
                handleTimeInput(e.target.value, false)
              }}
              value={timeInputs.to}
              className="w-20 text-center"
            />
            <Button
              className="bg-muted text-accent hover:bg-accent hover:text-muted w-16 text-center font-time"
              onClick={() =>
                setScheduleData({
                  ...scheduleData,
                  timeRange: {
                    ...scheduleData.timeRange,
                    to: {
                      hour: scheduleData.timeRange.to.hour,
                      isAM: !scheduleData.timeRange.to.isAM
                    }
                  }
                })
              }
            >
              {scheduleData.timeRange.to.isAM ? 'AM' : 'PM'}
            </Button>
          </div>
        </div>
      </div>
      <div className="flex flex-row items-center ">
        <Label htmlFor="slot-length" className="mr-6">
          Granularity
        </Label>
        <ToggleGroup
          id="slot-length"
          type="single"
          onValueChange={e =>
            setScheduleData({
              ...scheduleData,
              slotLength: Math.max(15, Math.min(60, Number(e)))
            })
          }
          value={String(scheduleData.slotLength)}
          className="flex flex-row justify-between gap-x-2 max-w-80"
        >
          <ToggleGroupItem value={'15'} className="w-14">
            15m
          </ToggleGroupItem>
          <ToggleGroupItem value={'20'} className="w-14">
            20m
          </ToggleGroupItem>
          <ToggleGroupItem value={'30'} className="w-14">
            30m
          </ToggleGroupItem>
          <ToggleGroupItem value={'60'} className="w-14">
            1h
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
        history.pushState({ page: 1 }, 'room', `/${resJSON.room_uid}`)
        setIsCreate(false)
      })
    })
  }

  return (
    <main className="gap-x-8 w-full max-w-lg mx-auto">
      <div className="flex flex-col gap-4">
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
