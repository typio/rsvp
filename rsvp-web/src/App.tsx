import {
  ChangeEventHandler,
  HTMLInputAutoCompleteAttribute,
  useState
} from 'react'

import { addDays, startOfDay } from 'date-fns'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faShare } from '@fortawesome/free-solid-svg-icons'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { DatePickerMultiple } from '@/components/datepicker'

import Header from './Header'
import Footer from './Footer'
import Schedule from './components/schedule'
import { ToggleGroup, ToggleGroupItem } from './components/ui/toggle-group'

function App() {
  const [dates, setDates] = useState<Date[]>(
    Array.from({ length: 7 }).map((_, i) => addDays(startOfDay(new Date()), i))
  )

  const [timeRange, setTimeRange] = useState({
    from: { hour: '9', isAM: true },
    to: { hour: '5', isAM: false }
  })

  const [slotLength, setSlotLength] = useState(30)

  const handeTimeInput = (e: InputEvent, isFrom: boolean) => {
    const newValue = Number(e.target.value)
    let newHour = 0

    if (isNaN(newValue) || newValue > 24) {
      return
    } else if (Number(newValue) == 24) {
      newHour = 12
    } else if (Number(newValue) > 12) {
      newHour = newValue % 12
    } else {
      newHour = newValue
    }

    setTimeRange({
      ...timeRange,
      [isFrom ? 'from' : 'to']: {
        hour: newHour.toString(),
        isAM: timeRange.from.isAM
      }
    })
  }

  return (
    <>
      <div className="py-8 px-8 min-h-[100vh] grid grid-rows-[auto_1fr_auto] gap-y-8">
        <Header />
        <main className="grid grid-cols-2 gap-x-8">
          <div className="flex flex-col gap-2">
            <DatePickerMultiple dates={dates} setDates={setDates} />
            <div className="flex flex-row gap-x-8">
              <div className="flex flex-row flex-1 gap-x-2">
                <Input
                  placeholder="9"
                  type="number"
                  min={1}
                  max={12}
                  onChange={e => {
                    handeTimeInput(e, true)
                  }}
                  value={timeRange.from.hour}
                />
                <Button
                  onClick={() =>
                    setTimeRange({
                      ...timeRange,
                      from: {
                        hour: timeRange.from.hour,
                        isAM: !timeRange.from.isAM
                      }
                    })
                  }
                >
                  {timeRange.from.isAM ? 'AM' : 'PM'}
                </Button>
              </div>
              <div className="flex flex-row flex-1 gap-x-2">
                <Input
                  min={1}
                  max={12}
                  placeholder="5"
                  onChange={e => {
                    handeTimeInput(e, false)
                  }}
                  value={timeRange.to.hour}
                />
                <Button
                  onClick={() =>
                    setTimeRange({
                      ...timeRange,
                      to: {
                        hour: timeRange.to.hour,
                        isAM: !timeRange.to.isAM
                      }
                    })
                  }
                >
                  {timeRange.to.isAM ? 'AM' : 'PM'}
                </Button>
              </div>
            </div>
            <div className="flex flex-row items-center justify-between">
              <Label htmlFor="slot-length" className="min-w-24">
                {' '}
                Slot Length
              </Label>
              <ToggleGroup
                id="slot-length"
                type="single"
                onValueChange={e => setSlotLength(Number(e))}
                value={String(slotLength)}
              >
                <ToggleGroupItem value={'15'}>15 min</ToggleGroupItem>
                <ToggleGroupItem value={'20'}>20 min</ToggleGroupItem>
                <ToggleGroupItem value={'30'}>30 min</ToggleGroupItem>
                <ToggleGroupItem value={'60'}>1 hour</ToggleGroupItem>
              </ToggleGroup>
            </div>
            {dates.length > 0 && (
              <Schedule
                dates={dates}
                timeRange={timeRange}
                slotLength={slotLength}
              />
            )}
          </div>
          <div className="flex flex-col">
            <div className="flex flex-row gap-x-4 ">
              <Input placeholder="Event Name" />
              <Button>
                <FontAwesomeIcon icon={faShare} />
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
