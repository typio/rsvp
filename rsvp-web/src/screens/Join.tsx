import { useCallback, useEffect, useState } from 'react'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faShare } from '@fortawesome/free-solid-svg-icons'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import Schedule from '.././components/schedule'
import { h24ToTimeRange, useDebounce } from '@/utils'
import { ScheduleData } from '@/types'

const Join = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<null | string>(null)
  const [isInitialRender, setIsInitialRender] = useState(true)

  useEffect(() => {
    if (isInitialRender) {
      getRoom()
      setIsInitialRender(false)
      return
    }
  }, [])

  const [scheduleData, setScheduleData] = useState<ScheduleData>()
  const [others, setOthers] = useState([])
  const [isOwner, setIsOwner] = useState(false)

  const getRoom = useCallback(() => {
    try {
      fetch(
        `http://localhost:3632/api/rooms/${window.location.pathname.slice(1)}`,
        {
          method: 'GET',
          credentials: 'include'
        }
      ).then(res => {
        res.json().then(resJSON => {
          setScheduleData({
            event_name: resJSON.event_name,
            dates: resJSON.dates.map((d: string) => new Date(d)),
            timeRange: h24ToTimeRange(resJSON.time_range),
            slotLength: resJSON.slot_length,
            userSchedule: resJSON.user_schedule,
            othersSchedule: resJSON.others_schedule
          })
          setOthers(resJSON.others_names)
          setIsOwner(resJSON.is_owner)

          console.log('get room', resJSON)
          setError(null)
        })
      })
    } catch (e) {
      setError(String(e))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (loading) return

    let req = JSON.stringify({
      user_schedule: scheduleData?.userSchedule
    })

    fetch(
      `http://localhost:3632/api/rooms/${window.location.pathname.slice(1)}`,
      {
        method: 'PATCH',
        body: req,
        credentials: 'include'
      }
    ).then(res => {
      res.json().then(resJSON => {
        console.log('edit room', resJSON)
      })
    })
  }, [scheduleData?.userSchedule])

  const shareRoom = () => {
    alert(window.location)
  }

  if (loading)
    return (
      <div className="w-full h-full flex flex-row justify-center items-center animate-[delayedFadeIn_2s_ease-in-out]">
        <svg className="w-7 h-7 animate-spin" viewBox="0 0 10 10">
          <circle
            cx={5}
            cy={5}
            r={4}
            fill="none"
            className="stroke-primary"
            strokeWidth={1.4}
          />
          <circle
            cx={5}
            cy={5}
            r={4}
            fill="none"
            className="stroke-secondary"
            strokeWidth={1.4}
            strokeDasharray={4 * 2 * Math.PI * 0.666}
          />
        </svg>
      </div>
    )

  if (error)
    return (
      <div className="w-full h-full flex flex-row justify-center items-center">
        Error "{error}"
      </div>
    )

  return (
    <main className="gap-x-8">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-y-2 mb-4 bg-card p-4 rounded-md">
          <div className="flex flex-row gap-x-4 items-end ">
            {isOwner ? (
              <div className="flex flex-col gap-y-1 flex-1">
                <label className="text-sm font-medium text-muted-foreground">
                  Event name
                </label>
                <DebouncedInputComponent
                  initialValue={scheduleData?.event_name}
                  onDebouncedChange={value => {
                    fetch(
                      `http://localhost:3632/api/rooms/${window.location.pathname.slice(1)}/eventNameChange`,
                      {
                        method: 'PATCH',
                        body: JSON.stringify({ name: value }),
                        credentials: 'include'
                      }
                    ).then(res => {
                      res.json().then(resJSON => {
                        console.log('edit room', resJSON)
                      })
                    })
                  }}
                />
              </div>
            ) : (
              <div className="mb-2 text-lg">{scheduleData?.event_name}</div>
            )}

            <Button onClick={shareRoom} className="ml-auto">
              <FontAwesomeIcon icon={faShare} />
            </Button>
          </div>

          <div className="flex flex-col gap-y-1">
            <label className="text-sm font-medium text-muted-foreground">
              Your name
            </label>
            <DebouncedInputComponent
              initialValue="Jeff"
              onDebouncedChange={value => {
                fetch(
                  `http://localhost:3632/api/rooms/${window.location.pathname.slice(1)}/userNameChange`,
                  {
                    method: 'PATCH',
                    body: JSON.stringify({ name: value }),
                    credentials: 'include'
                  }
                ).then(res => {
                  res.json().then(resJSON => {
                    console.log('edit room', resJSON)
                  })
                })
              }}
            />
          </div>
        </div>

        <div className="flex flex-row justify-between">
          <div className="flex flex-row gap-x-2 items-center">
            You <div className="w-3 h-3 rounded bg-secondary" />
          </div>

          <div className="flex flex-row gap-x-4">
            {others?.map((user: string, i) => (
              <div key={i}>{user.slice(0, 5)}</div>
            ))}
          </div>
        </div>

        {scheduleData && scheduleData.dates.length > 0 && (
          <Schedule
            data={scheduleData}
            setData={setScheduleData}
            isCreate={false}
          />
        )}

        {/* TODO: Show drop down asking reason (e.g. No times work, I'm not coming, Custom, etc...) */}
        <Button className="bg-destructive hover:bg-black">
          <span className="text-destructive-foreground">I can't make it.</span>
        </Button>
      </div>
    </main>
  )
}

const DebouncedInputComponent = ({
  initialValue = '',
  onChange,
  onDebouncedChange,
  debounceInterval = 500
}: {
  initialValue?: string
  onChange?: (value: string) => any
  onDebouncedChange?: (value: string) => any
  debounceInterval?: number
}) => {
  const [value, setValue] = useState(initialValue)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    if (onChange) onChange(newValue)

    setValue(newValue)
  }

  if (onDebouncedChange)
    useEffect(
      () => onDebouncedChange(value),
      [useDebounce(value, debounceInterval)]
    )

  return <Input value={value} onChange={handleChange} />
}

export default Join
