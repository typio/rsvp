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
          element: <Create />,
          errorElement: <ErrorBoundary />
        },
        {
          path: '/:room_uid',
          element: <Join />,
          errorElement: <ErrorBoundary />,

          loader: ({ params }): Promise<JoinRouteData> => {
            const roomUid = params.room_uid

            // NOTE: Slight issue where if Create successfully creates a room but this fails to load it, then that room is essentially lost and wasting resources
            return new Promise((resolve, reject) => {
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
                      res.json().then(resJSON => {
                        console.log(resJSON)
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
                          others: resJSON.others_names
                        }
                        const userName = resJSON.user_name ?? ''
                        const isOwner = resJSON.is_owner ?? false

                        resolve({
                          scheduleData,
                          userName,
                          isOwner,
                          roomUid: roomUid ?? ''
                        })
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
      ]
    }
  ])

  return (
    <WebSocketProvider>
      <RouterProvider
        router={router}
        fallbackElement={
          <div className="flex flex-row h-[100vh] justify-center items-center">
            <p>Loading...</p>
          </div>
        }
      />
    </WebSocketProvider>
  )
}

const ErrorBoundary = () => {
  let error = useRouteError()
  console.error(error)
  return (
    <div className="flex flex-col gap-4 flex-grow justify-center items-center">
      <div className="text-lg">Dang an error!</div>
      <div>{String(error)}</div>
    </div>
  )
}

const Layout = () => (
  <div className="py-8 px-8 min-h-[100vh] grid grid-rows-[auto_1fr_auto] gap-y-8">
    <Header />
    <Outlet />
    <Footer />
  </div>
)

export default App
