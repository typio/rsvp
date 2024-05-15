import { useState } from 'react'

import { DateRange } from 'react-day-picker'
import { addDays, format, startOfWeek } from 'date-fns'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faShare } from '@fortawesome/free-solid-svg-icons'

import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
// import { useToast } from '@/components/ui/use-toast'
// import { ToastAction } from '@/components/ui/toast'

import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { DatePickerWithRange } from '@/components/datepicker'

import Header from './Header'
import Footer from './Footer'
import Schedule from './components/schedule'

function App() {
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(),
    to: addDays(new Date(), 6)
  })

  const days = Array.from(Array(7)).map((_, i) =>
    format(addDays(startOfWeek(0), i), 'EEEEEEE')
  )

  const [daysEnabled, setDaysEnabled] = useState(days.slice(1, 5))

  // const { toast } = useToast()

  return (
    <>
      <div className="py-8 px-8 min-h-[100vh] grid grid-rows-[auto_1fr_auto] gap-y-8">
        <Header />
        <main className="grid grid-cols-2 gap-x-8">
          <div className="flex flex-col">
            <div className="flex flex-row">
              <DatePickerWithRange date={date} setDate={setDate} />
            </div>
            <div className="flex flex-row gap-x-2 my-2">
              <ToggleGroup
                type="multiple"
                value={daysEnabled}
                onValueChange={setDaysEnabled}
              >
                {days.map((day, i) => {
                  return (
                    <ToggleGroupItem
                      key={i}
                      className={`w-12 h-12`}
                      value={day}
                    >
                      {day
                        .slice(0, 3)
                        .split('')
                        .map((l: string, i: number) =>
                          i === 0 ? l.toUpperCase() : l
                        )}
                    </ToggleGroupItem>
                  )
                })}
              </ToggleGroup>
            </div>
            <Schedule daysEnabled={daysEnabled} dateRange={date} />
          </div>
          <div className="flex flex-col">
            <div className="flex flex-row gap-x-4 ">
              <Input placeholder="Event " />
              <Button>
                <FontAwesomeIcon icon={faShare} />
              </Button>
              <Button
                onClick={() => {
                  toast.error(
                    'You must become a Pro member to select 2+ weeks!',
                    {
                      description: 'Pro subscriptions are not available.',
                      action: {
                        label: 'Ok, sorry.',
                        onClick: () => {}
                      }
                    }
                  )
                }}
              >
                Show Toast
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </>
  )
}
export default App
