import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { DatePickerWithRange } from './components/datepicker'
import Header from './Header'
import Footer from './Footer'

function App() {
  const [count, setCount] = useState(0)
  const [daysEnabled, setDaysEnabled] = useState({
    sunday: false,
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false
  })

  return (
    <>
      <div className="py-8 px-8 min-h-[100vh] grid grid-rows-[auto_1fr_auto] gap-y-8">
        <Header />
        <main className="grid grid-cols-2 gap-x-8">
          <div className="flex flex-col">
            <div className="flex flex-row">
              <DatePickerWithRange />
            </div>
            <div className="flex flex-row gap-x-2 my-2">
              {Object.entries(daysEnabled).map(([day, dayEnabled], i) => {
                return (
                  <Button
                    key={i}
                    className={`${dayEnabled ? 'bg-primary text-primary-foreground hover:bg-primary/80' : 'border-2 border-primary bg-background text-foreground hover:bg-background/70'} rounded-sm w-11 h-11`}
                    onClick={() => {
                      setDaysEnabled({ ...daysEnabled, [day]: !dayEnabled })
                    }}
                  >
                    {day
                      .slice(0, 3)
                      .split('')
                      .map((l: string, i: number) =>
                        i === 0 ? l.toUpperCase() : l
                      )}
                  </Button>
                )
              })}
            </div>
          </div>
          <div className="flex flex-row">
            <Button onClick={() => setCount(count => count + 1)}>
              count is {count}
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    </>
  )
}
export default App
