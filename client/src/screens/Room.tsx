import { useEffect, useState, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useWebSocketContext } from '@/contexts/WebSocketContext'
import { ReadyState } from 'react-use-websocket'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faChevronDown,
  faQuestion,
  faSquareUpRight
} from '@fortawesome/free-solid-svg-icons'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import Schedule, { Selection } from '../components/Schedule'
import { ScheduleData } from '@/types'
import { NavigateFunction, useLoaderData, useNavigate } from 'react-router-dom'
import tinycolor from 'tinycolor2'
import { Colors } from '@/colors'

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
import { API_URL, SITE_URL, useDebounce } from '@/utils'

import { useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

import { Label } from '@/components/ui/label'

import { createRoom, stripeStops, youStripe } from '@/components/Schedule'
import {
  DateSelect,
  DaySelectMode,
  DAYS_OF_WEEK
} from '@/components/DateSelect'
import { bestTimes, windowLabel } from '@/utils/bestTimes'
import { FakeSpec, withFake } from '@/utils/devFake'
import Footer from '@/components/Footer'
import { format } from 'date-fns'
import { useDemoSim } from '@/presence/useDemoSim'
import { useLivePresence } from '@/presence/useLivePresence'
import { useOwnCursor } from '@/presence/useOwnCursor'
import PresenceCursors from '@/presence/PresenceCursors'

let lastTouchTap = 0

const DraftRoomOptions = ({
  scheduleData,
  setScheduleData,
  createRoom
}: {
  scheduleData: ScheduleData
  setScheduleData: React.Dispatch<ScheduleData>
  createRoom: (scheduleData: ScheduleData, navigate: NavigateFunction) => any
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
      <div
        data-top-card
        className="flex flex-col bg-card shadow-2xl rounded-md p-4 gap-y-3"
      >
        <div className="flex flex-row gap-x-4 items-end">
          <div className="flex flex-col gap-y-1 flex-1">
            <Input
              placeholder="Event name"
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
            onClick={() => createRoom(scheduleData, navigate)}
            className="flex flex-row gap-x-2 items-center bg-muted text-primary active:bg-primary active:text-card"
          >
            Share
            <FontAwesomeIcon icon={faSquareUpRight} />
          </Button>
        </div>
        <div className="flex flex-row flex-wrap justify-between gap-4 items-center">
          <div className="">
            <div className="flex flex-row gap-y-1 gap-x-4 items-center">
              <DateSelect
                mode={DaySelectMode.Dates}
                dates={scheduleData.dates}
                setDates={newDates => {
                  setScheduleData({ ...scheduleData, dates: newDates })
                }}
              />
              <div className="text-muted-foreground text-sm">or</div>
              <DateSelect
                mode={DaySelectMode.DaysOfWeek}
                dates={scheduleData.dates}
                setDates={newDates => {
                  setScheduleData({ ...scheduleData, dates: newDates })
                }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-y-2 mr-4">
            <div>
              <div className="flex flex-row items-center justify-end gap-x-4 ">
                <div className="flex flex-row">
                  <Input
                    className={`w-12 rounded-r-none text-center ${timeInputs.from !== scheduleData.timeRange.from.hour ? 'border-destructive focus-visible:border-destructive' : ''}`}
                    onChange={e => {
                      handleTimeInput(e.target.value, true)
                    }}
                    value={timeInputs.from}
                  />
                  <Button
                    className="w-12 rounded-l-none"
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

                <Label className="text-sm font-medium text-muted-foreground">
                  to
                </Label>

                <div className="flex flex-row ">
                  <Input
                    className={`w-12 rounded-r-none text-center ${timeInputs.to !== scheduleData.timeRange.to.hour ? 'border-destructive focus-visible:border-destructive' : ''}`}
                    onChange={e => {
                      handleTimeInput(e.target.value, false)
                    }}
                    value={timeInputs.to}
                  />
                  <Button
                    className="w-12 rounded-l-none"
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
          </div>
        </div>
      </div>
    </div>
  )
}

// board sits fixed under the cards (phase 1), pans once they clear (phase 2)
const useBoardScroll = (gridRef: RefObject<HTMLElement>) => {
  const boardRef = useRef<HTMLDivElement>(null)
  const noteRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<HTMLDivElement>(null)
  const stepsRef = useRef<HTMLDivElement>(null)
  const brandRef = useRef<HTMLAnchorElement>(null)
  const [runway, setRunway] = useState(0)
  const m = useRef({ fgH: 0, overflow: 0 })

  useLayoutEffect(() => {
    const onScroll = () => {
      const { fgH, overflow } = m.current
      const shift = clamp(window.scrollY - fgH, 0, overflow)
      if (boardRef.current)
        boardRef.current.style.transform = `translateY(${-shift}px)`
      // mask edge = the cards' bottom
      if (stepsRef.current)
        stepsRef.current.style.setProperty(
          '--reveal',
          `${Math.max(0, fgH - window.scrollY)}px`
        )
      // hide the brand once the top card covers it, so it can't peek through the card gap
      const brand = brandRef.current
      const card = fgRef.current?.querySelector('[data-top-card]')
      if (brand && card) {
        const b = brand.getBoundingClientRect()
        const bTop = (brand.firstElementChild ?? brand).getBoundingClientRect()
          .top
        const c = card.getBoundingClientRect()
        const covered =
          c.top <= bTop && c.left <= b.left + 2 && c.right >= b.right - 2
        brand.style.visibility = covered ? 'hidden' : ''
      }
      const note = noteRef.current
      const grid = gridRef.current
      if (note && grid)
        note.style.opacity =
          grid.getBoundingClientRect().bottom <
          note.getBoundingClientRect().bottom
            ? '0'
            : ''
    }
    const measure = () => {
      const vh = window.innerHeight
      const fgH = fgRef.current?.offsetHeight ?? 0
      const boardH = boardRef.current?.scrollHeight ?? 0
      const overflow = Math.max(0, boardH - vh)
      m.current = { fgH, overflow }
      setRunway(overflow ? overflow + vh : 0)
      onScroll()
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (fgRef.current) ro.observe(fgRef.current)
    if (boardRef.current) ro.observe(boardRef.current)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', measure)
    }
  }, [])

  return { boardRef, fgRef, stepsRef, brandRef, noteRef, runway }
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v))

const LiveDot = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 10 10">
    <circle
      cx={5}
      cy={5}
      r={4}
      className="animate-pulse fill-primary opacity-60"
      style={{ transformOrigin: '5px 5px' }}
    />
    <circle cx={5} cy={5} r={2} className="fill-primary" />
  </svg>
)

const Swatch = ({
  bg,
  dim = false,
  slot = false,
  band
}: {
  bg: string
  dim?: boolean
  slot?: boolean
  band?: string
}) => (
  // 88px + 18px phase = two whole bands
  <span
    className={`relative inline-block shrink-0 overflow-hidden ${slot ? (band ? 'w-22 h-5' : 'w-16 h-5') : 'w-4 h-4 rounded-xs'} ${dim ? 'opacity-40' : ''}`}
    style={{ background: bg }}
  >
    {band && (
      <span
        className="absolute inset-0"
        style={{ backgroundImage: youStripe(band, '18px') }}
      />
    )}
  </span>
)

const LiveBoard = ({ data }: { data: ScheduleData }) => {
  const lanes = data.others.length <= Colors.othersColors.length
  const present = data.absentReasons
    .slice(1)
    .flatMap((r, i) => (r === null ? [i] : []))
  const youPresent = data.absentReasons[0] === null
  const headcount = present.length + (youPresent ? 1 : 0)
  const stripes = `repeating-linear-gradient(45deg, ${stripeStops([
    Colors.userColor,
    ...present.slice(0, 2).map(i => Colors.othersColors[i])
  ])})`
  const densitySteps = present.length + 1
  const ramp = `linear-gradient(to right, ${Array.from(
    { length: densitySteps },
    (_, k) => {
      const a = Math.round(((k + 1) / densitySteps) * 255)
        .toString(16)
        .padStart(2, '0')
      return `${Colors.userColor}${a} ${(k / densitySteps) * 100}% ${((k + 1) / densitySteps) * 100}%`
    }
  ).join(', ')})`
  const windows = bestTimes(data)
  const dayLabel = (d: number) =>
    data.dates.mode === DaySelectMode.Dates
      ? format(new Date(data.dates.dates[d] as string), 'EEE MMM d')
      : DAYS_OF_WEEK.three_letter_abbrv[data.dates.dates[d] as number]
  const absentees = data.others.flatMap((name, i) =>
    data.absentReasons[i + 1] !== null
      ? [
          {
            name: name || `User ${i + 1}`,
            reason: expandReason(data.absentReasons[i + 1])
          }
        ]
      : []
  )
  return (
    <>
      <div className="flex flex-col gap-3 w-full max-w-md px-4">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="flex items-center gap-2">
            <Swatch bg={Colors.userColor} dim={!youPresent} />
            <span className={youPresent ? '' : 'line-through opacity-50'}>
              me
            </span>
          </span>
          {data.others.map((name, i) => {
            const absent = data.absentReasons[i + 1] !== null
            return (
              <span key={i} className="flex items-center gap-2">
                <Swatch
                  bg={lanes ? Colors.othersColors[i] : `${Colors.userColor}55`}
                  dim={absent}
                />
                <span className={absent ? 'line-through opacity-50' : ''}>
                  {name || `User ${i + 1}`}
                </span>
              </span>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {present.length > 0 && (
            <span className="flex items-center gap-2">
              <Swatch bg={lanes ? stripes : ramp} slot />
              some of you
            </span>
          )}
          {!lanes && (
            <span className="flex items-center gap-2">
              <Swatch bg={`${Colors.bgColor}`} band={Colors.userColor} slot />
              my slots
            </span>
          )}
          <span className="flex items-center gap-2">
            <Swatch bg={Colors.allColor} slot />
            everyone
          </span>
        </div>
        {absentees.map(({ name, reason }) => (
          <p key={name} className="text-sm text-muted-foreground">
            <span className="text-foreground">{name}</span>
            {reason ? `: ${reason}` : " can't make it."}
          </p>
        ))}
      </div>

      <div
        data-best-times
        className="flex flex-col flex-1 justify-center gap-4 px-4"
      >
        <h2 className="text-4xl font-display font-bold text-primary lowercase">
          best times
        </h2>
        {windows.length === 0 ? (
          <p className="text-muted-foreground lowercase">
            {headcount < 2
              ? 'waiting on the group'
              : 'no overlap yet — keep painting'}
          </p>
        ) : (
          <ol className="flex flex-col gap-4">
            {windows.map((w, i) => (
              <li key={i} className="flex flex-row gap-5">
                <span aria-hidden className="text-4xl text-primary font-bold">
                  {i + 1}.
                </span>
                <div className="flex flex-col">
                  <span>
                    {dayLabel(w.dateIndex)},&emsp;{windowLabel(data, w)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {w.count === w.total ? (
                      <span className="text-primary">everyone</span>
                    ) : w.missing.length === 1 ? (
                      `everyone but ${w.missing[0]}`
                    ) : (
                      `${w.count} of ${w.total} · without ${w.missing
                        .slice(0, 3)
                        .join(
                          ', '
                        )}${w.missing.length > 3 ? ` +${w.missing.length - 3} more` : ''}`
                    )}
                    {w.withYou && w.count !== w.total && (
                      <span
                        className="ml-2 font-semibold"
                        style={{ color: Colors.userColor }}
                      >
                        with me
                      </span>
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  )
}

const ConnectionBadge = ({ open }: { open: boolean }) => (
  <div
    role="status"
    aria-live="polite"
    className="absolute -top-7 right-0 z-20 pointer-events-none flex flex-row gap-x-2 items-center text-sm text-muted-foreground"
  >
    {open ? (
      <>
        <LiveDot />
        live
      </>
    ) : (
      <>
        <svg className="w-3 h-3" viewBox="0 0 10 10">
          <circle cx={5} cy={5} r={4} className="fill-destructive opacity-40" />
          <circle cx={5} cy={5} r={3} className="fill-destructive" />
        </svg>
        disconnected
      </>
    )}
  </div>
)

const DemoNote = ({ fadeRef }: { fadeRef?: RefObject<HTMLDivElement> }) => {
  return (
    <div className="w-full -rotate-6 select-none pointer-events-none">
      <p className="font-hand psst text-3xl leading-none text-primary/90">
        <span className="text-[1.4rem]">p</span>
        <span className="text-[1.6rem]">s</span>
        <span className="text-[1.9rem]">s</span>t, this is how it works
      </p>
      <div ref={fadeRef} className="relative transition-opacity duration-300">
        <p className="font-hand text-2xl leading-tight text-muted-foreground mt-2">
          the group is putting in their times. drag the grid to add yours
        </p>
      </div>
      <svg
        width={48}
        height={48}
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute fill-primary bottom-6 right-[-44px] rotate-[-20deg]"
      >
        <path d="m79.2 75c-.5 0-.9 0-1.3-.1-4.1-4.7-7.6-9.8-10.3-15.5-1.4-2.9-5.9-.8-4.5 2.1 2.2 4.5 4.8 8.7 7.7 12.6-28.9-5.3-44.6-34.4-48.7-62.1-.5-3.2-5.4-2.3-4.9.8 4.2 28.5 20.5 58.1 49 65.4-6 1.1-11.8 2.9-17.4 5.4-1.4.6-1.9 2.7-.8 3.9 2 2.1 3.6 2.7 6.5 2.5 2.2-.1 2.5-2.4 1.4-3.8 7-2.5 14.3-3.9 21.8-4.1.2.2.4.4.6.5 2.3 2.2 6.1-1 3.8-3.2 0 0-.1-.1-.1-.1 0-.6-.2-1.2-.6-1.6.1-1.4-.6-2.7-2.2-2.7z"></path>
      </svg>
    </div>
  )
}

type DraftRoomRouteData = {
  mode: 'draft'
  scheduleData: ScheduleData
}

type LiveRoomRouteData = {
  mode: 'live'
  scheduleData: ScheduleData
  isOwner: boolean
  roomUid: string
  fake: FakeSpec | null
}

export type RoomRouteData = DraftRoomRouteData | LiveRoomRouteData

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

        // keep local text: the echo would clobber the input
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

      removedFromRoom: () => {
        toast.warning('You were removed from this room by the owner.', {
          duration: Infinity,
          cancel: { label: 'Dismiss', onClick: () => {} }
        })
        navigate('/')
      },

      roomDeleted: () => {
        toast.warning('Room was deleted by owner!', {
          duration: Infinity,
          cancel: { label: 'Dismiss', onClick: () => {} }
        })
        navigate('/')
      },

      roomFull: ({ max }: { max: number }) => {
        toast.error(`This room is full (${max} people).`, {
          id: 'roomFull',
          description: "You can look around, but your times won't be saved.",
          duration: Infinity,
          cancel: { label: 'Dismiss', onClick: () => {} }
        })
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
        variant="destructive"
        className={
          userIsAbsent ? 'bg-destructive text-destructive-foreground' : ''
        }
        onClick={() => {
          const newAbsentReason = userIsAbsent ? null : ''
          // one write: else the grid clear reverts the flag
          const next = {
            ...scheduleData,
            absentReasons: [
              newAbsentReason,
              ...scheduleData.absentReasons.slice(1)
            ],
            userSchedule: userIsAbsent
              ? scheduleData.userSchedule
              : scheduleData.userSchedule.map(day => day.map(() => false))
          }
          if (userIsAbsent) setScheduleData(next)
          else editSchedule(next)
          sendAbsentChange(newAbsentReason)
        }}
      >
        I can't make it.
      </Button>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            className={`bg-background transition-none absolute left-full -translate-x-full -translate-y-[calc(100%+8px)] active:bg-background active:text-primary active:ring-2 active:ring-offset-0 active:ring-primary disabled:opacity-0 ${userIsAbsent ? 'opacity-100' : 'opacity-0'}`}
            disabled={!userIsAbsent}
            aria-label="Reason for absence"
          >
            <FontAwesomeIcon icon={faQuestion} />
          </Button>
        </PopoverTrigger>
        <PopoverContent>
          <div className="text-sm flex flex-col gap-y-2">
            <div className="text-sm font-medium text-muted-foreground">
              Reason (optional)
            </div>
            {excuses.map((excuse, i) => (
              <Button
                key={i}
                variant="ghost"
                className={`flex flex-wrap px-2 text-wrap h-fit transition-none ${indexedAbsentReasons[0] === i ? 'bg-primary text-background active:text-background active:bg-primary/80' : 'active:text-primary '}`}
                onClick={() => {
                  if (typeof indexedAbsentReasons[0] === 'string')
                    setCustomAbsentText('')

                  let newAbsentReason =
                    indexedAbsentReasons[0] !== i ? excuses[i] : ''

                  setScheduleData(prev => ({
                    ...prev,
                    absentReasons: [
                      newAbsentReason,
                      ...prev.absentReasons.slice(1)
                    ]
                  }))
                  sendAbsentChange(newAbsentReason)
                }}
              >
                {excuse}
              </Button>
            ))}
            <div className="relative">
              <svg
                className="absolute top-2 right-2 w-4 h-4 animate-spin"
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
              <Textarea
                placeholder="Enter custom"
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
  shareRoom,
  roomUid
}: {
  isOwner: boolean
  scheduleData: ScheduleData
  setScheduleData: React.Dispatch<React.SetStateAction<ScheduleData>>
  sendMessage: (arg0: string) => void
  shareRoom: () => void
  roomUid: string
}) => {
  const [pendingEvent, setPendingEvent] = useState<string>()
  const [pendingUser, setPendingUser] = useState<string>()
  useEffect(() => {
    if (pendingEvent === undefined) return
    sendMessage(
      JSON.stringify({
        message_type: 'editEventName',
        payload: { name: pendingEvent }
      })
    )
  }, [useDebounce(pendingEvent, 400)])
  useEffect(() => {
    if (pendingUser === undefined) return
    sendMessage(
      JSON.stringify({
        message_type: 'editUserName',
        payload: { name: pendingUser }
      })
    )
  }, [useDebounce(pendingUser, 400)])

  return (
    <div
      data-top-card
      className="flex flex-row gap-x-2 bg-card shadow-2xl shadow-black  p-4 rounded-md"
    >
      <div className="flex flex-1 justify-around flex-col gap-y-2 ">
        <div className="flex flex-row gap-x-4 items-end">
          {isOwner ? (
            <div className="flex flex-col gap-y-1 flex-1">
              <Input
                placeholder="Event name"
                value={scheduleData?.eventName}
                onChange={e => {
                  const value = e.target.value
                  setScheduleData(prev => ({ ...prev, eventName: value }))
                  setPendingEvent(value)
                }}
              />
            </div>
          ) : (
            <div className="mb-2 text-lg">{scheduleData?.eventName}</div>
          )}
        </div>

        <div className="flex flex-col gap-y-1">
          <Input
            placeholder="My name"
            value={scheduleData.userName}
            onChange={e => {
              const value = e.target.value
              setScheduleData(prev => ({ ...prev, userName: value }))
              setPendingUser(value)
            }}
          />
        </div>
      </div>

      <Button
        onClick={shareRoom}
        className={`group  flex flex-col h-28 ml-auto justify-around rounded-lg text-primary bg-background active:bg-background shadow-md active:shadow-none border-2 border-secondary/45 active:border-primary/90`}
      >
        <div className="text-5xl font-display font-extrabold text-primary">
          {roomUid}
        </div>
        <div className="flex flex-row gap-x-2 items-center text-muted-foreground group-active:text-primary ">
          Share
          <FontAwesomeIcon
            icon={faSquareUpRight}
            className="transition-transform group-active:translate-y-[-4px] group-active:translate-x-[4px] "
          />
        </div>
      </Button>
    </div>
  )
}

const UserList = ({
  others,
  hoveringUser,
  setHoveringUser,
  hasHoveredUser,
  setHasHoveredUser,
  hoveredSlotUsers,
  absentReasons,
  isOwner,
  sendMessage
}: {
  others: string[]
  hoveringUser: number | null
  setHoveringUser: React.Dispatch<React.SetStateAction<number | null>>
  hasHoveredUser: boolean
  setHasHoveredUser: React.Dispatch<React.SetStateAction<boolean>>
  hoveredSlotUsers: boolean[] | null
  absentReasons: (string | null)[]
  isOwner: boolean
  sendMessage: (message: string) => void
}) => (
  // -mx-2: cancels the items' glow padding
  <div
    data-roster
    className="flex flex-row flex-wrap items-center justify-end -mx-2"
  >
    <UserItem
      user="Me"
      index={0}
      hoveringUser={hoveringUser}
      setHoveringUser={setHoveringUser}
      hasHoveredUser={hasHoveredUser}
      setHasHoveredUser={setHasHoveredUser}
      hoveredSlotUsers={hoveredSlotUsers}
      isCurrentUser={true}
      absentReason={absentReasons[0]}
    />

    {others?.map((user: string, i) => (
      <UserItem
        key={i}
        user={user}
        index={i + 1}
        othersIndex={i}
        othersCount={others.length}
        hoveringUser={hoveringUser}
        setHoveringUser={setHoveringUser}
        hasHoveredUser={hasHoveredUser}
        setHasHoveredUser={setHasHoveredUser}
        hoveredSlotUsers={hoveredSlotUsers}
        isCurrentUser={false}
        absentReason={absentReasons[i + 1]}
        isOwner={isOwner}
        sendMessage={sendMessage}
      />
    ))}
  </div>
)

const UserItem = ({
  user,
  index,
  othersIndex,
  othersCount,
  hoveringUser,
  setHoveringUser,
  hasHoveredUser,
  setHasHoveredUser,
  hoveredSlotUsers,
  isCurrentUser,
  absentReason,
  isOwner,
  sendMessage
}: {
  user: string
  index: number
  othersIndex?: number
  othersCount?: number
  hoveringUser: number | null
  setHoveringUser: React.Dispatch<React.SetStateAction<number | null>>
  hasHoveredUser: boolean
  setHasHoveredUser: React.Dispatch<React.SetStateAction<boolean>>
  hoveredSlotUsers: boolean[] | null
  isCurrentUser: boolean
  absentReason: string | null
  isOwner?: boolean
  sendMessage?: (message: string) => void
}) => {
  const isAbsent = absentReason !== null

  const color = tinycolor(
    isCurrentUser
      ? Colors.userColor
      : (othersCount ?? 0) > 5
        ? '#fff'
        : Colors.othersColors[index - 1] // index is 1-based
  )
  const colorBrighter = color.brighten(20).toRgbString()

  const removeParticipant = () => {
    if (sendMessage && othersIndex !== undefined) {
      sendMessage(
        JSON.stringify({
          message_type: 'removeParticipant',
          payload: { others_index: othersIndex }
        })
      )
    }
  }

  const spotlit = hoveringUser === index
  const userContent = (
    <button
      type="button"
      aria-pressed={spotlit}
      aria-label={
        isCurrentUser
          ? 'Me'
          : `${user?.length > 0 ? user : `User ${index}`}${isAbsent ? `, absent${absentReason ? `: ${absentReason}` : ''}` : ''}`
      }
      className={`flex flex-row justify-center items-center p-2 duration-300 ${isCurrentUser ? 'select-none' : ''} ${isOwner && !isCurrentUser ? 'cursor-pointer' : ''}`}
      style={{
        opacity:
          (hoveringUser != null && hoveringUser != index) ||
          (hoveredSlotUsers !== null && !hoveredSlotUsers[index])
            ? 0.1
            : isAbsent
              ? 0.45
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
      // tap pins; taps also synthesize mouseenter/leave, ignored for a beat
      onPointerDown={e => {
        if (e.pointerType === 'mouse' || isAbsent) return
        lastTouchTap = performance.now()
        setHoveringUser(prev => (prev === index ? null : index))
        setHasHoveredUser(true)
      }}
      onMouseEnter={() => {
        if (performance.now() - lastTouchTap < 700) return
        if (!isAbsent) {
          setHoveringUser(index)
          setHasHoveredUser(true)
        }
      }}
      onMouseLeave={() => {
        if (performance.now() - lastTouchTap < 700) return
        setHoveringUser(null)
      }}
      onFocus={() => {
        if (!isAbsent) {
          setHoveringUser(index)
          setHasHoveredUser(true)
        }
      }}
      onBlur={() => setHoveringUser(null)}
    >
      <div
        className={`${isAbsent ? 'line-through' : ''}`}
        style={!isCurrentUser && !isAbsent ? { color: color.toString() } : {}}
      >
        {isCurrentUser ? user : user?.length > 0 ? user : `User ${index}`}
      </div>

      {!isAbsent && isCurrentUser && (
        <div
          className="w-6 h-3 ml-2 shrink-0"
          style={{
            background: Colors.userColor,
            clipPath: 'polygon(0 0, 50% 0, 100% 100%, 50% 100%)'
          }}
        />
      )}
    </button>
  )

  if (isOwner && !isCurrentUser) {
    return (
      <Popover>
        <PopoverTrigger asChild>{userContent}</PopoverTrigger>
        <PopoverContent className="w-auto p-2">
          <Button variant="destructive" size="sm" onClick={removeParticipant}>
            Remove
          </Button>
        </PopoverContent>
      </Popover>
    )
  }

  if (isAbsent) {
    return (
      <TooltipProvider>
        <Tooltip delayDuration={0}>
          <TooltipTrigger className="min-w-max">{userContent}</TooltipTrigger>
          <TooltipContent className="py-3 px-4">
            {(absentReason?.trim() ?? '').length > 0 ? (
              <p>{absentReason?.trim()}</p>
            ) : (
              <p className="text-muted-foreground">This user can't make it.</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return userContent
}

const Room = () => {
  const loadData = useLoaderData() as RoomRouteData
  const isDraft = loadData.mode === 'draft'
  const roomUid = loadData.mode === 'live' ? loadData.roomUid : null
  const isOwner = loadData.mode === 'live' && loadData.isOwner
  const fake =
    import.meta.env.DEV && loadData.mode === 'live' ? loadData.fake : null

  const [scheduleData, setScheduleData] = useState<ScheduleData>(
    loadData.scheduleData
  )

  // same instance across routes: resync per loader run
  useEffect(() => {
    setScheduleData(loadData.scheduleData)
  }, [loadData])

  const scheduleWrapRef = useRef<HTMLDivElement>(null)
  const { boardRef, fgRef, stepsRef, brandRef, noteRef, runway } =
    useBoardScroll(scheduleWrapRef)

  useEffect(() => {
    if (isDraft)
      localStorage.setItem('storedDraftRoomState', JSON.stringify(scheduleData))
  }, [
    scheduleData.eventName,
    scheduleData.dates,
    scheduleData.timeRange,
    scheduleData.slotLength,
    scheduleData.userSchedule
  ])

  const navigate = useNavigate()

  const { sendMessage, setRoomUid, readyState } = useWebSocketContext()

  const sim = useDemoSim(
    scheduleData,
    setScheduleData,
    scheduleWrapRef,
    isDraft
  )
  const [ownDrag, setOwnDrag] = useState<Selection | null>(null)
  const presence = useLivePresence(
    scheduleData.others,
    scheduleWrapRef,
    !isDraft,
    ownDrag
  )
  const own = useOwnCursor(!isDraft)

  const hideCursor = isDraft ? sim.cursorHidden : true
  useEffect(() => {
    if (!hideCursor) return
    document.body.classList.add('cursor-none-all')
    return () => document.body.classList.remove('cursor-none-all')
  }, [hideCursor])

  // board is fixed: revealed once the cards' bottom (fgH − scrollY) clears it
  const scrollToBestTimes = () => {
    const block = document.querySelector('[data-best-times]')
    const fg = fgRef.current
    if (!block || !fg) return
    const top = block.getBoundingClientRect().top
    window.scrollTo({ top: fg.offsetHeight - top + 24, behavior: 'smooth' })
  }

  const [hoveredSlotUsers, setHoveredSlotUsers] = useState<null | boolean[]>(
    null
  )

  const [hoveringUser, setHoveringUser] = useState<null | number>(null)
  const [hasHoveredUser, setHasHoveredUser] = useState(false)

  // headcount diff: a rename stays silent
  const [announcement, setAnnouncement] = useState('')
  const prevOthers = useRef<string[] | null>(null)
  useEffect(() => {
    if (isDraft) return
    const prev = prevOthers.current
    prevOthers.current = scheduleData.others
    if (!prev || prev.length === scheduleData.others.length) return
    const named = (n: string) => n || 'someone'
    const grew = scheduleData.others.length > prev.length
    const diff = grew
      ? scheduleData.others.filter(n => !prev.includes(n))
      : prev.filter(n => !scheduleData.others.includes(n))
    setAnnouncement(
      `${diff.map(named).join(', ') || 'someone'} ${grew ? 'joined' : 'left'}`
    )
  }, [scheduleData.others, isDraft])

  // clears the pinned spotlight without swallowing the tap
  useEffect(() => {
    const clear = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return
      if (!(e.target as Element).closest?.('[data-roster]'))
        setHoveringUser(null)
    }
    document.addEventListener('pointerdown', clear)
    return () => document.removeEventListener('pointerdown', clear)
  }, [])

  const [isSettingAbsentReason, setIsSettingAbsentReason] = useState(false)

  useEffect(() => {
    const blurHandler = () => {
      setHoveredSlotUsers(null)
      setHoveringUser(null)
      setHasHoveredUser(false)
    }

    window.addEventListener('blur', blurHandler)
    return () => window.removeEventListener('blur-sm', blurHandler)
  }, [])

  useEffect(() => {
    setRoomUid(roomUid)
    return () => setRoomUid(null)
  }, [roomUid, setRoomUid])

  // fake cast re-applied over every ws payload
  const fakeSelfAbsent = useRef<string | null | undefined>(undefined)
  const setLiveData: typeof setScheduleData = fake
    ? u =>
        setScheduleData(prev => {
          const d = withFake(typeof u === 'function' ? u(prev) : u, fake)
          return fakeSelfAbsent.current === undefined
            ? d
            : {
                ...d,
                absentReasons: [
                  fakeSelfAbsent.current,
                  ...d.absentReasons.slice(1)
                ]
              }
        })
    : setScheduleData
  useWebSocketUpdates(setLiveData, setIsSettingAbsentReason, navigate)

  // server refuses owner absence: fake invitee toggles client-side
  const sendAsInvitee = (msg: string) => {
    const m = JSON.parse(msg)
    if (m.message_type !== 'editIsAbsent') return sendMessage(msg)
    fakeSelfAbsent.current = m.payload.absent_reason ?? null
    setLiveData(prev => prev)
    setIsSettingAbsentReason(false)
  }
  const sendSelf = fake && !isOwner ? sendAsInvitee : sendMessage

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
    <>
      <div
        ref={boardRef}
        className="fixed inset-0 z-0 will-change-transform px-2 sm:px-8"
      >
        <div className="relative h-screen flex flex-col ">
          <Link
            to="/"
            ref={brandRef}
            onClick={() => window.scrollTo(0, 0)} // Room instance survives the route swap
            className="flex flex-col items-start justify-center pl-2 h-(--header-h)"
          >
            <div className="text-5xl font-display font-extrabold text-primary">
              cmon rsvp
            </div>
            <div className="text-[0.96rem] translate-y-[-6px] translate-x-1 font-medium text-muted-foreground">
              find a time for everyone
            </div>
          </Link>

          <div className="relative flex-1">
            {isDraft && (
              <div
                aria-hidden
                className="absolute inset-0 hidden lg:flex items-center"
              >
                <div className="flex-1 flex justify-end pr-12 min-w-0">
                  <div className="w-full max-w-xs">
                    <DemoNote fadeRef={noteRef} />
                  </div>
                </div>
                <div className="w-full max-w-3xl shrink-0" aria-hidden />
                <div className="flex-1" aria-hidden />
              </div>
            )}
          </div>

          <div
            ref={stepsRef}
            className={`absolute inset-0 flex flex-col-reverse items-center pointer-events-none ${
              isDraft
                ? 'justify-around pt-32 pb-16'
                : 'justify-between gap-10 pt-32 pb-12' // col-reverse: legend hugs the bottom
            }`}
            style={{
              ['--reveal' as string]: '100vh',
              WebkitMaskImage:
                'linear-gradient(to bottom, transparent calc(var(--reveal) - 56px), #000 var(--reveal))',
              maskImage:
                'linear-gradient(to bottom, transparent calc(var(--reveal) - 56px), #000 var(--reveal))'
            }}
          >
            {isDraft ? (
              <>
                {[
                  'Pick dates and times',
                  'Share the link with the group',
                  "See who's free in real time"
                ].map((step, i) => (
                  <div
                    key={i}
                    className="flex lowercase flex-row items-center gap-12 px-5 py-4 w-full max-w-sm "
                  >
                    <span className="text-5xl text-primary font-bold">
                      {i + 1}.
                    </span>
                    <span>{step}</span>
                  </div>
                ))}

                <div className="flex flex-col items-center gap-4 text-center max-w-md px-4">
                  <h2 className="text-5xl font-display font-bold text-primary">
                    scheduling without the rigamarole
                  </h2>
                  <div className="flex flex-col lowercase justify-center gap-x-4 gap-y-2 text-muted-foreground leading-relaxed">
                    <p>Fastest Scheduling Tool Start</p>
                    <p>
                      <span className="relative">
                        <LiveDot className="absolute -left-6 top-1/2 -translate-y-1/2 w-4 h-4" />
                        Live Connections, Realtime Updates
                      </span>
                    </p>
                    <p>Automatic Timezone Conversion</p>
                    <p>Free&emsp;·&emsp;No Signup</p>
                  </div>
                </div>
              </>
            ) : (
              <LiveBoard data={scheduleData} />
            )}
          </div>
        </div>

        {(isDraft || !isOwner) && (
          <div className="flex flex-col items-center justify-center gap-8 pb-8">
            <Button
              onClick={() => {
                if (isDraft) return createRoom(scheduleData, navigate)
                window.scrollTo(0, 0) // Room instance survives the route swap
                navigate('/')
              }}
              className="flex flex-row gap-x-2 items-center bg-muted text-primary hover:bg-primary hover:text-card active:bg-primary active:text-card"
            >
              {isDraft ? 'create a room' : 'make my own room'}
              <FontAwesomeIcon icon={faSquareUpRight} />
            </Button>
          </div>
        )}

        <Footer />
      </div>

      <a
        href="#slot-parent"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[110] focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:text-primary"
      >
        Skip to schedule
      </a>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <main
        ref={fgRef}
        // pointer-events-none: the top padding would cover the brand mark's clicks
        className="relative z-10 w-full max-w-3xl mx-auto px-2 sm:px-8 pt-(--header-h)  min-h-screen flex flex-col pointer-events-none"
      >
        <div className="relative flex flex-col flex-1 gap-4 pb-10 pointer-events-auto">
          {!isDraft && (
            <ConnectionBadge
              open={!fake?.offline && readyState === ReadyState.OPEN}
            />
          )}
          {loadData.mode === 'draft' ? (
            <DraftRoomOptions
              scheduleData={scheduleData}
              setScheduleData={setScheduleData}
              createRoom={createRoom}
            />
          ) : (
            <EventDetails
              isOwner={loadData.isOwner}
              scheduleData={scheduleData}
              setScheduleData={setScheduleData}
              sendMessage={sendMessage}
              shareRoom={shareRoom}
              roomUid={loadData.roomUid}
            />
          )}

          {scheduleData.dates.dates.length > 0 ? (
            <div
              ref={scheduleWrapRef}
              onPointerDownCapture={sim.onPointerDown}
              className="relative select-none flex flex-col flex-1"
            >
              <Schedule
                className="flex-1"
                data={loadData.mode === 'draft' ? sim.shown : scheduleData}
                isDraftRoom={loadData.mode === 'draft'}
                participants={
                  isDraft ? sim.participants : presence.participants
                }
                hoveringUser={hoveringUser}
                setHoveredSlotUsers={setHoveredSlotUsers}
                editSchedule={
                  loadData.mode === 'draft' ? sim.editSchedule : editSchedule
                }
                onDragChange={setOwnDrag}
                roster={
                  loadData.mode === 'live' && (
                    <>
                      <UserList
                        others={scheduleData.others}
                        hoveringUser={hoveringUser}
                        setHoveringUser={setHoveringUser}
                        hasHoveredUser={hasHoveredUser}
                        setHasHoveredUser={setHasHoveredUser}
                        hoveredSlotUsers={hoveredSlotUsers}
                        absentReasons={expandReasons(
                          scheduleData.absentReasons
                        )}
                        isOwner={loadData.isOwner}
                        sendMessage={sendMessage}
                      />
                      {bestTimes(scheduleData).length > 0 && (
                        <div className="flex justify-end mt-2">
                          <button
                            onClick={scrollToBestTimes}
                            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-none"
                          >
                            best times
                            <FontAwesomeIcon icon={faChevronDown} size="xs" />
                          </button>
                        </div>
                      )}
                    </>
                  )
                }
                bottomContent={
                  loadData.mode === 'live' ? (
                    loadData.isOwner ? (
                      <Button variant={'destructive'} onClick={deleteRoom}>
                        Delete Room
                      </Button>
                    ) : (
                      <>
                        <AbsentButton
                          scheduleData={scheduleData}
                          setScheduleData={setScheduleData}
                          editSchedule={editSchedule}
                          isSettingAbsentReason={isSettingAbsentReason}
                          setIsSettingAbsentReason={setIsSettingAbsentReason}
                          sendMessage={sendSelf}
                        />
                        <Button
                          variant={'destructive'}
                          size="sm"
                          onClick={() => {
                            sendMessage(
                              JSON.stringify({
                                message_type: 'removeParticipant',
                                payload: { leave: true }
                              })
                            )
                            toast.success('Left the event.')
                            navigate('/')
                          }}
                        >
                          Leave Event
                        </Button>
                      </>
                    )
                  ) : undefined
                }
              />
              <PresenceCursors
                cursors={isDraft ? sim.cursors : presence.cursors}
                targetOf={isDraft ? sim.targetOf : presence.targetOf}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-4 bg-card shadow-2xl shadow-black rounded-lg">
              <h2 className="text-base text-foreground select-none ">
                You haven't selected any days!
              </h2>
            </div>
          )}
        </div>
      </main>

      <div style={{ height: runway }} aria-hidden />

      {/* portaled: stacks above popover portals */}
      {createPortal(
        <div className="fixed inset-0 z-[100] pointer-events-none">
          <PresenceCursors
            cursors={isDraft ? sim.youCursor : own.cursors}
            targetOf={isDraft ? sim.youTarget : own.targetOf}
            positions={isDraft ? sim.positions : undefined}
          />
        </div>,
        document.body
      )}
    </>
  )
}

export default Room
