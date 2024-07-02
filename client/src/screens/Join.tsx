import { useEffect, useState } from 'react'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSquareUpRight } from '@fortawesome/free-solid-svg-icons'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import Schedule from '.././components/Schedule'
import { ScheduleData } from '@/types'
import { useLoaderData, useNavigate } from 'react-router-dom'
import tinycolor from 'tinycolor2'
import { Colors } from '@/colors'
import { useWebSocketContext } from '@/contexts/WebSocketContext'

export type JoinRouteData = {
  scheduleData: ScheduleData
  userName: string
  isOwner: boolean
  roomUid: string
}

export const useWebSocketUpdates = (
  setScheduleData: React.Dispatch<React.SetStateAction<ScheduleData>>
) => {
  const { lastMessage } = useWebSocketContext()

  useEffect(() => {
    if (lastMessage !== null) {
      const message = JSON.parse(lastMessage.data)

      switch (message.message_type) {
        case 'editEventName':
          setScheduleData(prev => ({ ...prev, eventName: message.payload }))
          break
        case 'editUserName':
          setScheduleData(prev => ({ ...prev, others: message.payload }))
          break
        case 'editSchedule':
          setScheduleData(prev => ({
            ...prev,
            othersSchedule: message.payload
          }))
          break
        default:
          console.log('Unknown WebSocket message:', message)
      }
    }
  }, [lastMessage, setScheduleData])
}

const Join = () => {
  const { sendMessage, setRoomUid } = useWebSocketContext()
  const navigate = useNavigate()

  const loadData = useLoaderData() as JoinRouteData
  const { roomUid, isOwner } = loadData

  const [scheduleData, setScheduleData] = useState<ScheduleData>(
    loadData.scheduleData
  )
  const [userName, setUserName] = useState<string>(loadData.userName)

  const [hoveredSlotUsers, setHoveredSlotUsers] = useState<null | boolean[]>(
    null
  )
  const [hoveringUser, setHoveringUser] = useState<null | number>(null)
  const [hasHoveredUser, setHasHoveredUser] = useState(false)

  useEffect(() => {
    setRoomUid(roomUid)
    return () => setRoomUid(null)
  }, [roomUid, setRoomUid])

  useWebSocketUpdates(setScheduleData)

  const editSchedule = (newSchedule: ScheduleData) => {
    setScheduleData(newSchedule)
    sendMessage(
      JSON.stringify({
        message_type: 'editSchedule',
        payload: {
          user_name: userName,
          user_schedule: newSchedule?.userSchedule
        }
      })
    )
  }

  const deleteRoom = async () => {
    try {
      const res = await fetch(`http://localhost:3632/api/rooms/${roomUid}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (res.ok) {
        navigate('/')
      }
    } catch (e) {
      throw e
    }
  }

  const reserveAbsent = async () => {
    try {
      const res = await fetch(`http://localhost:3632/api/rooms/${roomUid}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (res.ok) {
        navigate('/')
      }
    } catch (e) {
      throw e
    }
  }

  const shareRoom = () => {
    alert(window.location)
  }

  if (scheduleData === undefined) return null

  return (
    <main className="gap-x-8">
      <div className="flex flex-col gap-2">
        <EventDetails
          isOwner={isOwner}
          scheduleData={scheduleData}
          setScheduleData={setScheduleData}
          userName={userName}
          setUserName={setUserName}
          sendMessage={sendMessage}
          shareRoom={shareRoom}
        />

        <UserList
          scheduleData={scheduleData}
          hoveringUser={hoveringUser}
          setHoveringUser={setHoveringUser}
          hasHoveredUser={hasHoveredUser}
          setHasHoveredUser={setHasHoveredUser}
          hoveredSlotUsers={hoveredSlotUsers}
        />

        {scheduleData && scheduleData.dates.length > 0 && (
          <Schedule
            data={scheduleData}
            isCreate={false}
            hoveringUser={hoveringUser}
            setHoveredSlotUsers={setHoveredSlotUsers}
            editSchedule={editSchedule}
          />
        )}

        <Button
          variant={'destructive'}
          className="mt-4"
          onClick={isOwner ? deleteRoom : reserveAbsent}
        >
          {isOwner ? 'Delete Event' : "I can't make it."}
        </Button>
      </div>
    </main>
  )
}

const EventDetails = ({
  isOwner,
  scheduleData,
  setScheduleData,
  userName,
  setUserName,
  sendMessage,
  shareRoom
}: {
  isOwner: boolean
  scheduleData: ScheduleData
  setScheduleData: (arg0: any) => void
  userName: string
  setUserName: (arg0: any) => void
  sendMessage: (arg0: string) => void
  shareRoom: () => void
}) => (
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
              setScheduleData((p: ScheduleData) => ({ ...p, eventName: value }))
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
)

const UserList = ({
  scheduleData,
  hoveringUser,
  setHoveringUser,
  hasHoveredUser,
  setHasHoveredUser,
  hoveredSlotUsers
}: {
  scheduleData: ScheduleData
  hoveringUser: number | null
  setHoveringUser: (arg0: any) => void
  hasHoveredUser: boolean
  setHasHoveredUser: (arg0: any) => void
  hoveredSlotUsers: boolean[] | null
}) => (
  <div className="flex flex-row justify-between">
    <UserItem
      user="You"
      index={0}
      hoveringUser={hoveringUser}
      setHoveringUser={setHoveringUser}
      hasHoveredUser={hasHoveredUser}
      setHasHoveredUser={setHasHoveredUser}
      hoveredSlotUsers={hoveredSlotUsers}
      isCurrentUser={true}
    />

    <div className="flex flex-row gap-x-4 items-center">
      {scheduleData?.others?.map((user: string, i) => (
        <UserItem
          key={i}
          user={user}
          index={i + 1}
          hoveringUser={hoveringUser}
          setHoveringUser={setHoveringUser}
          hasHoveredUser={hasHoveredUser}
          setHasHoveredUser={setHasHoveredUser}
          hoveredSlotUsers={hoveredSlotUsers}
          isCurrentUser={false}
        />
      ))}
    </div>
  </div>
)

const UserItem = ({
  user,
  index,
  hoveringUser,
  setHoveringUser,
  hasHoveredUser,
  setHasHoveredUser,
  hoveredSlotUsers,
  isCurrentUser
}: {
  user: string
  index: number
  hoveringUser: number | null
  setHoveringUser: (arg0: any) => void
  hasHoveredUser: boolean
  setHasHoveredUser: (arg0: any) => void
  hoveredSlotUsers: boolean[] | null
  isCurrentUser: boolean
}) => (
  <div
    className={`flex flex-row gap-x-2 items-center duration-75 ${isCurrentUser ? 'select-none' : ''}`}
    style={{
      opacity:
        (hoveringUser != null && hoveringUser != index) ||
        (hoveredSlotUsers !== null && !hoveredSlotUsers[index])
          ? 0
          : 1,
      '--user-color': isCurrentUser
        ? Colors.userColor
        : Colors.othersColors[index - 1],
      '--bright-user-color': tinycolor(
        isCurrentUser ? Colors.userColor : Colors.othersColors[index - 1]
      )
        .brighten(20)
        .toRgbString(),
      animation:
        hoveringUser === index
          ? 'glowAnimation 0.3s forwards, flameFlicker 1.75s ease-in-out infinite 0.3s, flamePulse 3s ease-in-out infinite 0.3s'
          : hasHoveredUser
            ? 'glowFadeOut 0.3s forwards'
            : ''
    }}
    onMouseEnter={() => {
      setHoveringUser(index)
      setHasHoveredUser(true)
    }}
    onMouseLeave={() => setHoveringUser(null)}
  >
    <div>
      {isCurrentUser ? user : user?.length > 0 ? user : `User ${index}`}
    </div>
    <div
      className={`w-3 h-3 ${isCurrentUser ? 'rounded bg-secondary' : 'rounded-full'}`}
      style={
        !isCurrentUser
          ? { backgroundColor: Colors.othersColors[index - 1] }
          : {}
      }
    />
  </div>
)

export default Join
