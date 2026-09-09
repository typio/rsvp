import {
  createBrowserRouter,
  isRouteErrorResponse,
  Outlet,
  redirect,
  RouterProvider,
  useNavigate,
  useRouteError
} from 'react-router-dom'
import Room, { RoomRouteData } from './screens/Room'
import { addDays, startOfDay } from 'date-fns'
import { h24ToTimeRange, API_URL } from './utils'
import { parseFake, withFake } from './utils/devFake'
import { WebSocketProvider } from './contexts/WebSocketContext'
import { DaySelectMode, SelectedDates } from './components/DateSelect'
import { Button } from './components/ui/button'

import { lazy, Suspense } from 'react'

const StateHarness = import.meta.env.DEV
  ? lazy(() => import('./screens/StateHarness'))
  : () => null

const App = () => {
  const router = createBrowserRouter([
    {
      element: <Layout />,
      children: [
        {
          path: '/:room_uid?',
          element: <Room />,

          loader: async ({
            params,
            request
          }): Promise<RoomRouteData | Response> => {
            if (params.room_uid === undefined) {
              const storedDraftRoomState = ((storedStr: string | null) =>
                typeof storedStr === 'string' ? JSON.parse(storedStr) : null)(
                localStorage.getItem('storedDraftRoomState')
              )
              return {
                mode: 'draft',
                scheduleData: {
                  userName: '',
                  eventName: storedDraftRoomState?.eventName ?? 'My Event',
                  dates: ((stored?: SelectedDates): SelectedDates => {
                    const today = startOfDay(new Date())
                    const nextWeek = Array.from({ length: 7 }).map((_, i) =>
                      addDays(today, i).toDateString()
                    )
                    if (!stored) return { mode: DaySelectMode.Dates, dates: nextWeek }
                    if (stored.mode !== DaySelectMode.Dates) return stored
                    const live = stored.dates.filter(d => new Date(d) >= today)
                    return {
                      mode: DaySelectMode.Dates,
                      dates: live.length ? live : nextWeek
                    }
                  })(storedDraftRoomState?.dates),
                  timeRange: storedDraftRoomState?.timeRange ?? {
                    from: { hour: '9', isAM: true },
                    to: { hour: '5', isAM: false }
                  },
                  slotLength: storedDraftRoomState?.slotLength ?? 30,
                  userSchedule: storedDraftRoomState?.userSchedule ?? [],
                  othersSchedule: [],
                  others: [],
                  absentReasons: [null],
                  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
                }
              }
            } else if (!/^[a-zA-Z0-9]{4}$/.test(params?.room_uid)) {
              throw new Response(null, { status: 404 })
            } else {
              const roomUid = params.room_uid
              if (roomUid !== roomUid.toUpperCase())
                return redirect(`/${roomUid.toUpperCase()}`)

              const auth_res = await fetch(`${API_URL}/api/auth`, {
                method: 'POST',
                credentials: 'include'
              })

              if (auth_res.ok) {
                const room_res = await fetch(
                  `${API_URL}/api/rooms/${roomUid}`,
                  {
                    method: 'GET',
                    credentials: 'include'
                  }
                )

                if (room_res.status === 404)
                  throw new Response(null, { status: 410 })
                if (room_res.status !== 200)
                  throw new Response(null, { status: 500 })

                const roomJSON = await room_res.json()

                const scheduleData = {
                  eventName: roomJSON.event_name,
                  userName: roomJSON.user_name,
                  dates: {
                    mode: roomJSON.schedule_type,
                    dates:
                      roomJSON.schedule_type === DaySelectMode.Dates
                        ? roomJSON.dates
                        : roomJSON.days_of_week
                  },
                  timeRange: h24ToTimeRange(roomJSON.time_range),
                  slotLength: roomJSON.slot_length,
                  userSchedule: roomJSON.user_schedule,
                  othersSchedule: roomJSON.others_schedule,
                  others: roomJSON.others_names,
                  absentReasons: roomJSON.absent_reasons,
                  timezone: roomJSON.timezone
                }

                const isOwner: boolean = roomJSON.is_owner
                const fake = import.meta.env.DEV ? parseFake(request.url) : null

                return {
                  mode: 'live',
                  scheduleData:
                    import.meta.env.DEV && fake
                      ? withFake(scheduleData, fake)
                      : scheduleData,
                  isOwner: fake?.owner ?? isOwner,
                  roomUid,
                  fake
                }
              } else {
                throw new Response(null, { status: 500 })
              }
            }
          }
        },
        ...(import.meta.env.DEV
          ? [
              {
                path: '/dev/states',
                element: (
                  <Suspense fallback={<div>Loading states...</div>}>
                    <StateHarness />
                  </Suspense>
                )
              }
            ]
          : [])
      ],

      errorElement: <ErrorBoundary />
    }
  ])

  return (
    <WebSocketProvider>
      <RouterProvider
        router={router}
        fallbackElement={
          <div className="flex flex-row h-screen justify-center items-center">
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
        }
      />
    </WebSocketProvider>
  )
}

const ErrorBoundary = () => {
  let err: any = useRouteError()
  const navigate = useNavigate()

  const is404 = err?.status === 404
  const isRoomGone = err?.status === 410

  return (
    <div className="flex flex-col gap-6 grow justify-center items-center max-w-sm mx-auto text-center">
      <span className="text-6xl lg:text-8xl 2xl:text-9xl font-bold text-primary font-display">
        {is404 ? '404' : isRoomGone ? 'Gone' : 'Oops'}
      </span>
      <p className="text-muted-foreground">
        {isRouteErrorResponse(err)
          ? is404
            ? "This page doesn't exist."
            : 'This room was deleted or has expired.'
          : err instanceof Error
            ? err.message
            : 'Something went wrong.'}
      </p>
      <Button
        onClick={() => navigate('/')}
        className="mt-2 text-foreground bg-card"
      >
        Create a new room
      </Button>
    </div>
  )
}

const Layout = () => {
  return (
    <div className="min-h-screen flex flex-col w-full">
      <div className={'flex-1 w-full overflow-x-clip'}>
        <Outlet />
      </div>
    </div>
  )
}

export default App
