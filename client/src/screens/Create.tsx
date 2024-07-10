import { useEffect, useState } from 'react'
import { NavigateFunction, useNavigate } from 'react-router-dom'

import { addDays, startOfDay } from 'date-fns'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSquareUpRight } from '@fortawesome/free-solid-svg-icons'

import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

import { ToggleGroup, ToggleGroupItem } from '.././components/ui/toggle-group'
import { ScheduleData } from '@/types'
import Schedule, { shareRoom } from '@/components/Schedule'
import { DateSelect, DaySelectMode } from '@/components/DateSelect'

const storedCreateState = ((storedStr: string | null) =>
  typeof storedStr === 'string' ? JSON.parse(storedStr) : null)(
  localStorage.getItem('storedCreateState')
)

const CreateOptions = ({
  scheduleData,
  setScheduleData,
  shareRoom
}: {
  scheduleData: ScheduleData
  setScheduleData: React.Dispatch<ScheduleData>
  shareRoom: (scheduleData: ScheduleData, navigate: NavigateFunction) => any
}) => {
  const navigate = useNavigate()

  const [timeInputs, setTimeInputs] = useState({
    from: scheduleData.timeRange.from.hour,
    to: scheduleData.timeRange.to.hour
  })

  const handleTimeInput = (text: string, isFrom: boolean) => {
    const pos = isFrom ? 'from' : 'to'
    setTimeInputs({ ...timeInputs, [pos]: text })

    let newValue = Number(text)

    if (isNaN(newValue) || newValue < 1 || newValue > 12) {
      return
    }

    setScheduleData({
      ...scheduleData,
      timeRange: {
        ...scheduleData.timeRange,
        [isFrom ? 'from' : 'to']: {
          hour: newValue.toString(),
          isAM: scheduleData.timeRange[pos].isAM
        }
      }
    })
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col bg-card shadow-xl rounded-md p-4 gap-y-6">
        <div className="flex flex-row gap-x-4 items-end">
          <div className="flex flex-col gap-y-1 flex-1">
            <label className="text-sm ml-2 font-medium text-muted-foreground">
              Event name
            </label>
            <Input
              value={scheduleData.eventName}
              onChange={e =>
                setScheduleData({
                  ...scheduleData,
                  eventName: e.target.value
                })
              }
            />
          </div>
          <Button
            onClick={() => shareRoom(scheduleData, navigate)}
            className="flex flex-row gap-x-2 items-center bg-muted text-primary hover:bg-primary hover:text-card"
          >
            <FontAwesomeIcon icon={faSquareUpRight} />
            Share
          </Button>
        </div>
        <div className="flex flex-row flex-wrap justify-around gap-4 items-center">
          <div className="flex flex-row gap-4 items-center">
            <DateSelect
              mode={DaySelectMode.Dates}
              dates={scheduleData.dates}
              setDates={newDates => {
                setScheduleData({ ...scheduleData, dates: newDates })
              }}
            />
            <div className="text-muted-foreground">or</div>
            <DateSelect
              mode={DaySelectMode.DaysOfWeek}
              dates={scheduleData.dates}
              setDates={newDates => {
                setScheduleData({ ...scheduleData, dates: newDates })
              }}
            />
          </div>

          <div className="flex flex-col gap-y-2 mr-4">
            <div className="flex flex-row items-center justify-end gap-x-4 ">
              <Label className="ml-2 text-sm font-medium text-muted-foreground">
                From
              </Label>
              <div className="flex flex-row gap-x-2">
                <Input
                  className="w-12 text-center"
                  onChange={e => {
                    handleTimeInput(e.target.value, true)
                  }}
                  value={timeInputs.from}
                />
                <Button
                  className="w-12"
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
                  {scheduleData.timeRange.from.isAM ? 'am' : 'pm'}
                </Button>
              </div>
            </div>

            <div className="flex flex-row items-center justify-end gap-x-4 ">
              <Label className="ml-2 text-sm font-medium text-muted-foreground">
                To
              </Label>
              <div className="flex flex-row gap-x-2">
                <Input
                  className="w-12 text-center"
                  onChange={e => {
                    handleTimeInput(e.target.value, false)
                  }}
                  value={timeInputs.to}
                />
                <Button
                  className="w-12"
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
                  {scheduleData.timeRange.to.isAM ? 'am' : 'pm'}
                </Button>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-y-2">
            <Label
              htmlFor="slot-length"
              className="ml-2 text-sm font-medium text-muted-foreground"
            >
              Granularity
            </Label>
            <ToggleGroup
              id="slot-length"
              type="single"
              onValueChange={e =>
                setScheduleData({
                  ...scheduleData,
                  userSchedule: [...scheduleData.userSchedule].map(day =>
                    day.map(_ => false)
                  ),
                  slotLength: Math.max(15, Math.min(60, Number(e)))
                })
              }
              value={String(scheduleData.slotLength)}
              className=""
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
      </div>
    </div>
  )
}

const Create = () => {
  const [scheduleData, setScheduleData] = useState<ScheduleData>({
    eventName: storedCreateState?.eventName ?? 'My Event',
    dates: {
      mode: storedCreateState?.dates?.mode ?? DaySelectMode.Dates,
      dates:
        storedCreateState?.dates?.dates ??
        Array.from({ length: 7 }).map((_, i) =>
          addDays(startOfDay(new Date()), i).toDateString()
        )
    },
    timeRange: storedCreateState?.timeRange ?? {
      from: { hour: '9', isAM: true },
      to: { hour: '5', isAM: false }
    },
    slotLength: storedCreateState?.slotLength ?? 30,
    userSchedule: storedCreateState?.userSchedule ?? [],
    othersSchedule: [],
    others: []
  })

  useEffect(() => {
    localStorage.setItem('storedCreateState', JSON.stringify(scheduleData))
  }, [
    scheduleData.eventName,
    scheduleData.dates,
    scheduleData.timeRange,
    scheduleData.slotLength,
    scheduleData.userSchedule
  ])

  return (
    <main className="gap-x-8 w-full max-w-3xl mx-auto">
      <Tabs defaultValue="time">
        {/* <TabsList className="mb-4">
          <TabsTrigger value="time">
            <FontAwesomeIcon icon={faHandshake} />
            Time
          </TabsTrigger>
          <TabsTrigger value="days">
            <FontAwesomeIcon icon={faPlaneDeparture} />
            Days
          </TabsTrigger>
        </TabsList>
      */}
        <TabsContent value="time" className="rounded-md">
          <div className="flex flex-col gap-4">
            <CreateOptions
              scheduleData={scheduleData}
              setScheduleData={setScheduleData}
              shareRoom={shareRoom}
            />

            {scheduleData.dates.dates.length > 0 ? (
              <Schedule
                data={scheduleData}
                isCreate={true}
                hoveringUser={null}
                setHoveredSlotUsers={() => {}}
                othersColors={[]}
                editSchedule={newSchedule => setScheduleData(newSchedule)}
              />
            ) : (
              <div className="flex mt-6 justify-center ">
                You haven't selected any days!
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="days">
          <div className="w-full mt-12 flex flex-col justify-center items-center">
            <span>I'm working on this one...</span>
            <span className="mt-4 text-4xl">🫣</span>
          </div>
        </TabsContent>
      </Tabs>
    </main>
  )
}

export default Create
