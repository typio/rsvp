import { useEffect, useState } from 'react'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuestion, faSquareUpRight } from '@fortawesome/free-solid-svg-icons'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import Schedule from '.././components/Schedule'
import { ScheduleData } from '@/types'
import { NavigateFunction, useLoaderData, useNavigate } from 'react-router-dom'
import tinycolor from 'tinycolor2'
import { Colors } from '@/colors'
import { useWebSocketContext } from '@/contexts/WebSocketContext'
import { toast } from 'sonner'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'

import { Textarea } from '@/components/ui/textarea'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { API_URL, SITE_URL, getOtherUserColor, useDebounce } from '@/utils'

export type JoinRouteData = {
  scheduleData: ScheduleData
  isOwner: boolean
  roomUid: string
}

export const useWebSocketUpdates = (
  setScheduleData: React.Dispatch<React.SetStateAction<ScheduleData>>,
  setIsSettingAbsentReason: React.Dispatch<React.SetStateAction<boolean>>,
  navigate: NavigateFunction
) => {
  const { addMessageHandler, removeMessageHandler } = useWebSocketContext()

  useEffect(() => {
    const handlers = {
      editSchedule: ({
        userName,
        others,
        othersSchedule,
        absentReasons
      }: {
        userName: string
        others: string[]
        othersSchedule: number[][][]
        absentReasons: (string | null)[]
      }) => {
        setScheduleData(prev => ({
          ...prev,
          userName,
          others,
          othersSchedule,
          absentReasons
        }))
      },

      editUserName: ({ others }: { others: string[] }) => {
        setScheduleData(prev => ({ ...prev, others }))
      },

      otherSetAbsentReason: ({
        absentReasons,
        others,
        othersSchedule
      }: {
        absentReasons: (string | null)[]
        others: string[]
        othersSchedule: number[][][]
      }) => {
        setScheduleData(prev => ({
          ...prev,
          others,
          othersSchedule,
          absentReasons
        }))
      },

      userSetAbsentReason: ({
        absentReasons
      }: {
        absentReasons: (string | null)[]
      }) => {
        setIsSettingAbsentReason(false)

        // If the user wasn't absent it just make it so they are, doing it all the time overwrites the input
        setScheduleData(prev => ({
          ...prev,
          absentReasons: [
            absentReasons[0] === null ? null : prev.absentReasons[0],
            ...absentReasons.slice(1)
          ]
        }))
      },

      editEventName: ({ eventName }: { eventName: string }) => {
        setScheduleData(prev => ({ ...prev, eventName }))
      },

      roomDeleted: () => {
        toast.warning('Room was deleted by owner!', {
          duration: Infinity,
          cancel: { label: 'Dismiss', onClick: () => {} }
        })
        navigate('/')
      }
    }

    Object.entries(handlers).forEach(([type, handler]) => {
      addMessageHandler(type, handler)
    })

    return () => {
      Object.keys(handlers).forEach(type => {
        removeMessageHandler(type)
      })
    }
  }, [
    addMessageHandler,
    removeMessageHandler,
    setScheduleData,
    setIsSettingAbsentReason,
    navigate
  ])
}

const excuses = [
  "I'm not available during these times.",
  'I no longer plan on attending this.'
]

const expandReason = (reason: string | number | null) =>
  typeof reason === 'number' ? excuses[reason] : reason
const expandReasons = (reasons: (string | number | null)[]) =>
  reasons.map(reason => expandReason(reason))

const indexReasons = (reasons: (string | null)[]) =>
  reasons.map(reason => {
    if (reason === null) return null
    let eI = excuses.indexOf(reason)
    if (eI === -1) return reason
    else return eI
  })

const Join = () => {
  const { sendMessage, setRoomUid } = useWebSocketContext()
  const navigate = useNavigate()

  const loadData = useLoaderData() as JoinRouteData
  const { roomUid, isOwner } = loadData

  const [scheduleData, setScheduleData] = useState<ScheduleData>(
    loadData.scheduleData
  )

  const [hoveredSlotUsers, setHoveredSlotUsers] = useState<null | boolean[]>(
    null
  )

  const [hoveringUser, setHoveringUser] = useState<null | number>(null)
  const [hasHoveredUser, setHasHoveredUser] = useState(false)

  const [isSettingAbsentReason, setIsSettingAbsentReason] = useState(false)

  useEffect(() => {
    const blurHandler = () => {
      setHoveredSlotUsers(null)
      setHoveringUser(null)
      setHasHoveredUser(false)
    }

    window.addEventListener('blur', blurHandler)
    return () => window.removeEventListener('blur', blurHandler)
  }, [])

  useEffect(() => {
    setRoomUid(roomUid)
    return () => setRoomUid(null)
  }, [roomUid, setRoomUid])

  useWebSocketUpdates(setScheduleData, setIsSettingAbsentReason, navigate)

  const editSchedule = (newSchedule: ScheduleData) => {
    setScheduleData(newSchedule)
    sendMessage(
      JSON.stringify({
        message_type: 'editSchedule',
        payload: {
          user_name: scheduleData.userName,
          user_schedule: newSchedule?.userSchedule
        }
      })
    )
  }

  const deleteRoom = async () => {
    await fetch(`${API_URL}/api/rooms/${roomUid}`, {
      method: 'DELETE',
      credentials: 'include'
    })
      .then(res => {
        if (res.status === 200) {
          toast.success('Deleted room!')
          navigate('/')
        } else {
          throw new Error(`Error ${res.status}: ${res.statusText}`)
        }
      })
      .catch((e: TypeError) => {
        toast.error('Error deleting room.', {
          description: e.message,
          cancel: {
            label: 'Dismiss',
            onClick: () => {}
          }
        })
      })
  }

  const shareRoom = () => {
    const shareURL = `${SITE_URL}/${roomUid}`
    navigator.clipboard.writeText(shareURL)
    toast.success(shareURL, {
      description: 'Copied link to clipboard.',
      position: 'top-right'
    })
  }

  if (scheduleData === undefined) return null

  return (
    <main className="gap-x-8">
      <div className="flex flex-col gap-2">
        <EventDetails
          isOwner={isOwner}
          scheduleData={scheduleData}
          setScheduleData={setScheduleData}
          sendMessage={sendMessage}
          shareRoom={shareRoom}
        />

        <UserList
          others={scheduleData.others}
          hoveringUser={hoveringUser}
          setHoveringUser={setHoveringUser}
          hasHoveredUser={hasHoveredUser}
          setHasHoveredUser={setHasHoveredUser}
          hoveredSlotUsers={hoveredSlotUsers}
          absentReasons={expandReasons(scheduleData.absentReasons)}
        />

        <div>
          {scheduleData && scheduleData.dates.dates.length > 0 && (
            <Schedule
              data={scheduleData}
              isCreate={false}
              hoveringUser={hoveringUser}
              setHoveredSlotUsers={setHoveredSlotUsers}
              editSchedule={editSchedule}
            />
          )}
        </div>

        <div className="mt-4 flex justify-center">
          {isOwner ? (
            <Button variant={'destructive'} onClick={deleteRoom}>
              Delete Event
            </Button>
          ) : (
            <AbsentButton
              scheduleData={scheduleData}
              setScheduleData={setScheduleData}
              editSchedule={editSchedule}
              isSettingAbsentReason={isSettingAbsentReason}
              setIsSettingAbsentReason={setIsSettingAbsentReason}
              sendMessage={sendMessage}
            />
          )}
        </div>
      </div>
    </main>
  )
}

// TODO: Remove setScheduleData and do whole update in sendMessage, with promise to finish isSettingAbsentReason
const AbsentButton = ({
  scheduleData,
  setScheduleData,
  editSchedule,
  isSettingAbsentReason,
  setIsSettingAbsentReason,
  sendMessage
}: {
  scheduleData: ScheduleData
  setScheduleData: React.Dispatch<React.SetStateAction<ScheduleData>>
  editSchedule: (data: ScheduleData) => void
  isSettingAbsentReason: boolean
  setIsSettingAbsentReason: React.Dispatch<React.SetStateAction<boolean>>
  sendMessage: (message: string) => void
}) => {
  const userIsAbsent = scheduleData.absentReasons[0] !== null
  const indexedAbsentReasons = indexReasons(scheduleData.absentReasons)

  const [customAbsentText, setCustomAbsentText] = useState<string | undefined>(
    undefined
  )

  const sendAbsentChange = (absentReason: string | number | null) => {
    setIsSettingAbsentReason(true)

    let absentReasonString = expandReason(absentReason)

    sendMessage(
      JSON.stringify({
        message_type: 'editIsAbsent',
        payload: {
          user_name: scheduleData.userName,
          absent_reason: absentReasonString
        }
      })
    )
  }

  useEffect(() => {
    if (customAbsentText !== undefined) sendAbsentChange(customAbsentText)
  }, [useDebounce(customAbsentText, 500)])

  return (
    <div className="flex flex-row gap-x-2 relative">
      <Button
        className={`rounded-md border border-b-[3px] border-blue-950 h-10 text-destructive active:bg-destructive active:text-destructive-foreground active:border-red-800 ${userIsAbsent ? 'text-destructive-foreground bg-destructive border-b h-[38px] mt-[2px] border-red-800' : ''}`}
        onClick={() => {
          const newAbsentReason = userIsAbsent ? null : ''
          setScheduleData(prev => ({
            ...prev,
            absentReasons: [
              newAbsentReason,
              ...scheduleData.absentReasons.slice(1)
            ]
          }))
          sendAbsentChange(newAbsentReason)

          if (!userIsAbsent) {
            // clear schedule
            editSchedule({
              ...scheduleData,
              userSchedule: [...scheduleData.userSchedule].map(day =>
                day.map(_ => false)
              )
            })
          }
        }}
      >
        I can't make it.
      </Button>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            className={`bg-background duration-200 mt-[2px] h-[38px] transition-all absolute left-[100%] active:bg-background active:text-primary active:ring-2 active:ring-offset-0 active:ring-primary disabled:opacity-0 ${userIsAbsent ? 'opacity-100 ml-3' : 'opacity-0 ml-0'}`}
            disabled={!userIsAbsent}
          >
            <FontAwesomeIcon icon={faQuestion} />
          </Button>
        </PopoverTrigger>
        <PopoverContent>
          <div className="text-sm flex flex-col gap-y-2">
            <div className="mb-2 text-sm font-medium text-muted-foreground">
              Reason for absense (optional)
            </div>
            {excuses.map((excuse, i) => (
              <Button
                key={i}
                variant="ghost"
                className={`flex flex-wrap text-wrap h-fit ${indexedAbsentReasons[0] === i ? 'text-foreground/95' : 'active:text-foreground/90'}`}
                onClick={() => {
                  if (typeof indexedAbsentReasons[0] === 'string')
                    setCustomAbsentText('')

                  // Toggle set button value
                  let newAbsentReason =
                    indexedAbsentReasons[0] !== i ? excuses[i] : ''

                  setScheduleData(prev => ({
                    ...prev,
                    absentReasons: [
                      newAbsentReason,
                      ...scheduleData.absentReasons.slice(1)
                    ]
                  }))
                  sendAbsentChange(newAbsentReason)
                }}
              >
                {excuse}
              </Button>
            ))}
            <div className="flex flex-col">
              <div className="flex flex-row mb-1 mx-2 items-center justify-between">
                <label className="text-sm mt-2 font-medium text-muted-foreground">
                  Custom reason
                </label>

                <svg
                  className="w-4 h-4 animate-spin"
                  viewBox="0 0 10 10"
                  style={{ opacity: isSettingAbsentReason ? 1 : 0 }}
                >
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
              <Textarea
                className="max-h-[50vh]"
                value={customAbsentText ?? ''}
                onChange={e => {
                  setCustomAbsentText(e.currentTarget.value)
                  setIsSettingAbsentReason(true)
                  setScheduleData(prev => ({
                    ...prev,
                    absentReasons: [
                      customAbsentText ?? '',
                      ...scheduleData.absentReasons.slice(1)
                    ]
                  }))
                }}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

const EventDetails = ({
  isOwner,
  scheduleData,
  setScheduleData,
  sendMessage,
  shareRoom
}: {
  isOwner: boolean
  scheduleData: ScheduleData
  setScheduleData: React.Dispatch<React.SetStateAction<ScheduleData>>
  sendMessage: (arg0: string) => void
  shareRoom: () => void
}) => (
  <div className="flex flex-row gap-x-2 mb-4 bg-card shadow-xl p-4 rounded-md">
    <div className="flex flex-1 flex-col gap-y-2 ">
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
                setScheduleData(prev => ({ ...prev, eventName: value }))
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
      </div>

      <div className="flex flex-col gap-y-1">
        <label className="text-sm font-medium text-muted-foreground">
          Your name
        </label>
        <Input
          value={scheduleData.userName}
          onChange={e => {
            const value = e.target.value
            setScheduleData(prev => ({ ...prev, userName: value }))
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

    <Button
      onClick={shareRoom}
      className={`group ${isOwner ? 'mt-6' : ''} flex flex-col h-28 ml-auto justify-around rounded-lg text-primary bg-background active:bg-background shadow-md active:shadow-none border-2 border-secondary/45 active:border-primary/90`}
    >
      <div className="flex flex-row h-10 px-4 py-2 rounded-md gap-x-2 items-center bg-muted text-primary group-active:bg-primary group-active:text-card">
        <FontAwesomeIcon icon={faSquareUpRight} />
        Share
      </div>
      <div className="text-muted-foreground">
        Room ID:
        <span className="ml-2 text-foreground">
          {(window.location.toString().match(/.*\/(.*)/) ?? ['']).at(-1)}
        </span>
      </div>
    </Button>
  </div>
)

const UserList = ({
  others,
  hoveringUser,
  setHoveringUser,
  hasHoveredUser,
  setHasHoveredUser,
  hoveredSlotUsers,
  absentReasons
}: {
  others: string[]
  hoveringUser: number | null
  setHoveringUser: React.Dispatch<React.SetStateAction<number | null>>
  hasHoveredUser: boolean
  setHasHoveredUser: React.Dispatch<React.SetStateAction<boolean>>
  hoveredSlotUsers: boolean[] | null
  absentReasons: (string | null)[]
}) => (
  <div className="flex flex-row justify-between items-end gap-x-16">
    <UserItem
      user="You"
      index={0}
      hoveringUser={hoveringUser}
      setHoveringUser={setHoveringUser}
      hasHoveredUser={hasHoveredUser}
      setHasHoveredUser={setHasHoveredUser}
      hoveredSlotUsers={hoveredSlotUsers}
      isCurrentUser={true}
      absentReason={absentReasons[0]}
    />

    <div className="flex flex-row gap-x-4 gap-y-4 items-center justify-end flex-wrap-reverse">
      {others?.map((user: string, i) => (
        <UserItem
          key={i}
          user={user}
          index={i + 1}
          othersCount={others.length}
          hoveringUser={hoveringUser}
          setHoveringUser={setHoveringUser}
          hasHoveredUser={hasHoveredUser}
          setHasHoveredUser={setHasHoveredUser}
          hoveredSlotUsers={hoveredSlotUsers}
          isCurrentUser={false}
          absentReason={absentReasons[i + 1]}
        />
      ))}
    </div>
  </div>
)

const UserItem = ({
  user,
  index,
  othersCount,
  hoveringUser,
  setHoveringUser,
  hasHoveredUser,
  setHasHoveredUser,
  hoveredSlotUsers,
  isCurrentUser,
  absentReason
}: {
  user: string
  index: number
  othersCount?: number
  hoveringUser: number | null
  setHoveringUser: React.Dispatch<React.SetStateAction<number | null>>
  hasHoveredUser: boolean
  setHasHoveredUser: React.Dispatch<React.SetStateAction<boolean>>
  hoveredSlotUsers: boolean[] | null
  isCurrentUser: boolean
  absentReason: string | null
}) => {
  const isAbsent = absentReason !== null

  const color = isCurrentUser
    ? tinycolor(Colors.userColor)
    : getOtherUserColor(
        index - 1,
        othersCount ?? 1,
        tinycolor(Colors.othersColors[0])
      )
  const colorBrighter = color.brighten(20).toRgbString()

  return (
    <TooltipProvider>
      <Tooltip delayDuration={0} open={isAbsent ? undefined : false}>
        <TooltipTrigger className="min-w-max ">
          <div
            className={`flex flex-row justify-center items-center gap-x-2 duration-300 ${isCurrentUser ? 'select-none' : ''}`}
            style={{
              opacity:
                (hoveringUser != null && hoveringUser != index) ||
                (hoveredSlotUsers !== null && !hoveredSlotUsers[index])
                  ? 0.1
                  : 1,
              // @ts-ignore
              '--user-color': color.toString(),
              '--bright-user-color': colorBrighter,
              animation:
                (hoveringUser === index ||
                  (hoveredSlotUsers !== null && hoveredSlotUsers[index])) &&
                !isAbsent
                  ? 'glowAnimation 0.3s forwards, flameFlicker 1.75s ease-in-out infinite 0.3s, flamePulse 3s ease-in-out infinite 0.3s'
                  : hasHoveredUser
                    ? 'glowFadeOut 0.3s forwards'
                    : ''
            }}
            onMouseEnter={() => {
              if (!isAbsent) {
                setHoveringUser(index)
                setHasHoveredUser(true)
              }
            }}
            onMouseLeave={() => setHoveringUser(null)}
          >
            <div className={`${isAbsent ? 'line-through' : ''}`}>
              {isCurrentUser ? user : user?.length > 0 ? user : `User ${index}`}
            </div>

            {!isAbsent && (
              <div
                className={`w-3 h-3 ${isCurrentUser ? 'rounded bg-secondary' : 'rounded-full'} `}
                style={
                  !isCurrentUser ? { backgroundColor: color.toString() } : {}
                }
              />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent className="py-3 px-4">
          {(absentReason?.trim() ?? '').length > 0 ? (
            <p>{absentReason?.trim()}</p>
          ) : (
            <p className=" text-muted-foreground">This user can't make it.</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default Join
