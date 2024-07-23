import {
  createBrowserRouter,
  Outlet,
  RouterProvider,
  useRouteError
} from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import Create from './screens/Create'
import Join, { JoinRouteData } from './screens/Join'
import About from './screens/About'
import { h24ToTimeRange } from './utils'
import { WebSocketProvider } from './contexts/WebSocketContext'
import { DaySelectMode } from './components/DateSelect'

const App = () => {
  const router = createBrowserRouter([
    {
      element: <Layout />,
      children: [
        {
          path: '/',
          element: <Create />
        },
        {
          path: '/:room_uid',
          element: <Join />,

          loader: ({ params }): Promise<JoinRouteData> => {
            const roomUid = params.room_uid

            // NOTE: Slight issue where if Create successfully creates a room but this fails to load it, then that room is essentially lost and wasting resources
            return new Promise((resolve, reject) => {
              if (roomUid === undefined) {
                reject(`Missing room id.`)
                return
              }

              fetch(`http://localhost:3632/api/auth`, {
                method: 'POST',
                credentials: 'include'
              })
                .then(res => {
                  if (res.ok) {
                    fetch(`http://localhost:3632/api/rooms/${roomUid}`, {
                      method: 'GET',
                      credentials: 'include'
                    }).then(res => {
                      if (res.status === 404)
                        reject(`This room does not exist.`)
                      if (res.status !== 200)
                        reject(`${res.status}: ${res.statusText}`)
                      res.json().then(resJSON => {
                        const scheduleData = {
                          eventName: resJSON.event_name,
                          dates: {
                            mode: resJSON.schedule_type,
                            dates:
                              resJSON.schedule_type === DaySelectMode.Dates
                                ? resJSON.dates
                                : resJSON.days_of_week
                          },
                          timeRange: h24ToTimeRange(resJSON.time_range),
                          slotLength: resJSON.slot_length,
                          userSchedule: resJSON.user_schedule,
                          othersSchedule: resJSON.others_schedule,
                          others: resJSON.others_names,
                          absentReasons: resJSON.absent_reasons
                        }

                        const userName: string = resJSON.user_name
                        const isOwner: boolean = resJSON.is_owner

                        const joinData = {
                          scheduleData,
                          userName,
                          isOwner,
                          roomUid
                        }

                        resolve(joinData)
                      })
                    })
                  } else {
                    reject('Not authenticated.')
                  }
                })
                .catch(e => reject(`Couldn't fetch: ${e}`))
            })
          }
        },
        {
          path: '/about',
          element: <About />
        }
      ],

      errorElement: <ErrorBoundary />
    }
  ])

  return (
    <WebSocketProvider>
      <RouterProvider
        router={router}
        fallbackElement={
          <div className="flex flex-row h-[100vh] justify-center items-center">
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
  let rawError: any = useRouteError()

  return (
    <div className="flex flex-col gap-4 flex-grow justify-center items-center">
      <div className="text-lg">Dang an error!</div>
      <div>{rawError?.status === 404 ? '404: Page not found.' : rawError}</div>
    </div>
  )
}

const Layout = () => (
  <div className="flex-1 grid grid-rows-[auto_1fr_auto] gap-y-8">
    <Header />
    <Outlet />
    <Footer />
  </div>
)

export default App
