import { useCallback, useEffect, useState } from 'react'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faShare } from '@fortawesome/free-solid-svg-icons'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import Schedule from '.././components/schedule'
import { h24ToTimeRange } from '@/utils'
import { ScheduleData } from '@/types'

const Join = () => {
  const room_uid = window.location.pathname.slice(1)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<null | string>(null)
  const [isInitialRender, setIsInitialRender] = useState(true)

  const [socket, setSocket] = useState<WebSocket | null>(null)

  const handleWebSocketMessage = (message: {
    message_type: string
    payload: any
  }) => {
    switch (message.message_type) {
      case 'editEventName':
        setScheduleData(p => ({
          ...p,
          eventName: message.payload
        }))
        break
      case 'editUserName':
        setOthers(message.payload)
        break
      case 'editSchedule':
        setScheduleData(p => ({
          ...p,
          othersSchedule: message.payload
        }))
        break
      default:
        console.log('Unknown WebSocket message:', message)
    }
  }

  useEffect(() => {
    if (isInitialRender) {
      authenticate().then(auth_success => {
        if (auth_success) {
          const newSocket = new WebSocket(
            `ws://localhost:3632/api/ws/${room_uid}`
          )
          setSocket(newSocket)

          newSocket.onopen = () => {
            console.log('WebSocket connection established')
          }

          newSocket.onmessage = event => {
            const message = JSON.parse(event.data)
            handleWebSocketMessage(message)
          }

          newSocket.onclose = () => {
            console.log('WebSocket connection closed')
          }
        } else return
      })

      getRoom()
      setIsInitialRender(false)
      return
    }

    return () => {
      socket?.close()
    }
  }, [])

  const [scheduleData, setScheduleData] = useState<ScheduleData>()
  const [userName, setUserName] = useState<String>('')
  const [others, setOthers] = useState<String[]>([])
  const [isOwner, setIsOwner] = useState(false)
  const [hoveringUser, setHoveringUser] = useState<null | number>(null)

  const authenticate = async (): Promise<boolean> => {
    let result = await fetch(`http://localhost:3632/api/auth`, {
      method: 'POST',
      credentials: 'include'
    })

    if (result.status === 200) return true
    else return false
  }

  const getRoom = useCallback(() => {
    try {
      fetch(`http://localhost:3632/api/rooms/${room_uid}`, {
        method: 'GET',
        credentials: 'include'
      }).then(res => {
        res.json().then(resJSON => {
          setScheduleData({
            eventName: resJSON.event_name,
            dates: resJSON.dates.map((d: string) => new Date(d)),
            timeRange: h24ToTimeRange(resJSON.time_range),
            slotLength: resJSON.slot_length,
            userSchedule: resJSON.user_schedule,
            othersSchedule: resJSON.others_schedule
          })
          setUserName(resJSON.user_name ?? '')
          setOthers(resJSON.others_names ?? [])
          setIsOwner(resJSON.is_owner ?? false)
          setError(null)
        })
      })
    } catch (e) {
      setError(String(e))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (loading || !socket || socket.readyState != socket.OPEN) return

    socket.send(
      JSON.stringify({
        message_type: 'editSchedule',
        payload: {
          user_name: userName,
          user_schedule: scheduleData?.userSchedule
        }
      })
    )
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
                <Input
                  value={scheduleData?.eventName}
                  onChange={e => {
                    const value = e.target.value
                    setScheduleData(p => ({ ...p, eventName: value }))
                    if (socket && socket.readyState == socket.OPEN)
                      socket.send(
                        JSON.stringify({
                          message_type: 'editEventName',
                          payload: {
                            name: value
                          }
                        })
                      )
                  }}
                />
              </div>
            ) : (
              <div className="mb-2 text-lg">{scheduleData?.eventName}</div>
            )}

            <Button onClick={shareRoom} className="ml-auto">
              <FontAwesomeIcon icon={faShare} />
            </Button>
          </div>

          <div className="flex flex-col gap-y-1">
            <label className="text-sm font-medium text-muted-foreground">
              Your name
            </label>
            <Input
              value={userName}
              onChange={e => {
                const value = e.target.value
                setUserName(value)
                if (socket && socket.readyState == socket.OPEN)
                  socket.send(
                    JSON.stringify({
                      message_type: 'editUserName',
                      payload: {
                        name: value
                      }
                    })
                  )
              }}
            />
          </div>
        </div>

        <div className="flex flex-row justify-between">
          <div className="flex flex-row gap-x-2 items-center">
            <div
              className={`opacity-${hoveringUser != null && hoveringUser != 0 ? '50' : '100'}`}
              onMouseEnter={() => setHoveringUser(0)}
              onMouseLeave={() => setHoveringUser(null)}
            >
              You
            </div>
            <div
              className={`w-3 h-3 rounded bg-primary opacity-${hoveringUser != null && hoveringUser != 0 ? '50' : '100'}`}
            />
          </div>

          {others?.length > 0 && (
            <div className="flex flex-row gap-x-2 items-center">
              <div className="flex flex-row gap-x-4 items-center">
                {others?.map((user: string, i) => (
                  <div
                    key={i}
                    className={`opacity-${hoveringUser != null && hoveringUser != i + 1 ? '50' : '100'}`}
                    onMouseEnter={() => setHoveringUser(i + 1)}
                    onMouseLeave={() => setHoveringUser(null)}
                  >
                    {user?.length > 0 ? user : `User ${i}`}
                  </div>
                ))}
              </div>
              <div
                className={`w-3 h-3 rounded bg-secondary opacity-${hoveringUser != null && hoveringUser == 0 ? '50' : '100'}`}
              />
            </div>
          )}
        </div>

        {scheduleData && scheduleData.dates.length > 0 && (
          <Schedule
            data={scheduleData}
            setData={setScheduleData}
            isCreate={false}
            hoveringUser={hoveringUser}
          />
        )}

        {/* TODO: Show drop down asking to confirm delete and one for asking reason (e.g. No times work, I'm not coming, Custom, etc...) */}
        {isOwner ? (
          <Button className="bg-red-600 hover:bg-red-700 mt-4">
            <span className="text-destructive-foreground">Delete Event</span>
          </Button>
        ) : (
          <Button className="bg-red-600 hover:bg-red-700 mt-4">
            <span className="text-destructive-foreground">
              I can't make it.
            </span>
          </Button>
        )}
      </div>
    </main>
  )
}

export default Join
