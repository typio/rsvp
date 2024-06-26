import { useCallback, useEffect, useState } from 'react'
import useWebSocket, { ReadyState } from 'react-use-websocket'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSquareUpRight } from '@fortawesome/free-solid-svg-icons'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import Schedule from '.././components/schedule'
import { h24ToTimeRange } from '@/utils'
import { ScheduleData } from '@/types'
import tinycolor from 'tinycolor2'
import { Screen } from '@/App'

const Join = ({
  setScreen,
  setWSMode
}: {
  setScreen: React.Dispatch<Screen>
  setWSMode: React.Dispatch<ReadyState>
}) => {
  const room_uid = window.location.pathname.slice(1)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<null | string>(null)
  const [isInitialRender, setIsInitialRender] = useState(true)

  const [socketUrl, setSocketUrl] = useState<null | string>(null)
  const { sendMessage, lastMessage, readyState } = useWebSocket(socketUrl, {
    shouldReconnect: () => true
  })

  const [slotUsers, setSlotUsers] = useState<null | boolean[]>(null)

  const [scheduleData, setScheduleData] = useState<ScheduleData>()
  const [userName, setUserName] = useState<String>('')
  const [isOwner, setIsOwner] = useState(false)
  const [hoveringUser, setHoveringUser] = useState<null | number>(null)

  useEffect(() => {
    if (lastMessage !== null) {
      let message = JSON.parse(lastMessage.data)

      switch (message.message_type) {
        case 'editEventName':
          setScheduleData({
            ...scheduleData,
            eventName: message.payload
          })
          break
        case 'editUserName':
          setScheduleData({
            ...scheduleData,
            others: message.payload
          })
          break
        case 'editSchedule':
          setScheduleData({
            ...scheduleData,
            othersSchedule: message.payload
          })
          break
        default:
          console.log('Unknown WebSocket message:', message)
      }
    }
  }, [lastMessage])

  useEffect(() => {
    setWSMode(readyState)
  }, [readyState])

  useEffect(() => {
    if (isInitialRender) {
      authenticate().then(auth_success => {
        if (auth_success) {
          setSocketUrl(`ws://localhost:3632/api/ws/${room_uid}`)
        } else return
      })

      getRoom()
      setIsInitialRender(false)
    }
  }, [])
  useEffect(() => {
    // if (loading || !socket || socket.readyState != socket.OPEN) return

    sendMessage(
      // socket.send(
      JSON.stringify({
        message_type: 'editSchedule',
        payload: {
          user_name: userName,
          user_schedule: scheduleData?.userSchedule
        }
      })
    )
  }, [scheduleData?.userSchedule])

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
            othersSchedule: resJSON.others_schedule,
            others: resJSON.others_names
          })
          setUserName(resJSON.user_name ?? '')
          setIsOwner(resJSON.is_owner ?? false)
          setError(null)
        })
      })
    } catch (e) {
      setError(String(e))
    }
    setLoading(false)
  }, [])

  const deleteRoom = () => {
    try {
      fetch(`http://localhost:3632/api/rooms/${room_uid}`, {
        method: 'DELETE',
        credentials: 'include'
      }).then(res => {
        if (res.ok) {
          history.pushState({ page: 1 }, 'room', '/')
          setScreen(Screen.CREATE)
        }
      })
    } catch (e) {
      setError(String(e))
    }
  }

  const shareRoom = () => {
    alert(window.location)
  }

  if (scheduleData === undefined) return

  const hues = [0, 110, 185, 245, 300]
  const othersColors = Array.from({ length: scheduleData.others.length }).map(
    (_, i) => `hsl(${hues[i]}, 100%, 65%)`
  )

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
        <div className="flex flex-col gap-y-2 mb-4 bg-card shadow-xl p-4 rounded-md">
          <div className="flex flex-row gap-x-4 items-end">
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
                    sendMessage(
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

            <Button
              onClick={shareRoom}
              className="flex flex-row ml-auto gap-x-2 items-center bg-muted text-primary hover:bg-primary hover:text-card"
            >
              <FontAwesomeIcon icon={faSquareUpRight} />
              Share
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

                sendMessage(
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

        <div className="flex flex-row justify-between ">
          <div
            className="flex flex-row gap-x-2 items-center duration-75"
            style={{
              opacity:
                (hoveringUser != null && hoveringUser != 0) ||
                (slotUsers !== null && !slotUsers[0])
                  ? 0
                  : 1
            }}
          >
            <div
              onMouseEnter={() => setHoveringUser(0)}
              onMouseLeave={() => setHoveringUser(null)}
            >
              You
            </div>
            <div className={`w-3 h-3 rounded bg-secondary`} />
          </div>

          <div className="flex flex-row gap-x-4 items-center">
            {scheduleData?.others?.map((user: string, i) => (
              <div
                key={i}
                className={`flex flex-row gap-x-2 items-center duration-75`}
                style={{
                  opacity:
                    (hoveringUser != null && hoveringUser != i + 1) ||
                    (slotUsers !== null && !slotUsers[i + 1])
                      ? 0
                      : 1
                }}
                onMouseEnter={() => setHoveringUser(i + 1)}
                onMouseLeave={() => setHoveringUser(null)}
              >
                <div>{user?.length > 0 ? user : `User ${i}`}</div>

                <div
                  className={`w-3 h-3 rounded-full`}
                  style={{
                    backgroundColor: othersColors[i]
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {scheduleData && scheduleData.dates.length > 0 && (
          <Schedule
            data={scheduleData}
            setData={setScheduleData}
            isCreate={false}
            hoveringUser={hoveringUser}
            setSlotUsers={setSlotUsers}
            othersColors={othersColors}
          />
        )}

        {/* TODO: Show drop down asking to confirm delete and one for asking reason (e.g. No times work, I'm not coming, Custom, etc...) */}
        {isOwner ? (
          <Button variant={'destructive'} className="mt-4" onClick={deleteRoom}>
            Delete Event
          </Button>
        ) : (
          <Button variant={'destructive'} className="mt-4">
            I can't make it.
          </Button>
        )}
      </div>
    </main>
  )
}

export default Join
