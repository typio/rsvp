import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { DatePickerWithRange } from './components/datepicker'
import Header from './Header'
import Footer from './Footer'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div className="py-8 px-8 min-h-[100vh] grid grid-rows-[auto_1fr_auto] gap-y-8">
        <Header />
        <main className="grid grid-cols-2 gap-x-8">
          <div className="flex flex-row">
            <DatePickerWithRange />
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
