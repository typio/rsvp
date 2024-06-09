import { createContext, useState } from 'react'
import Header from './Header'
import Footer from './Footer'
import Create from './screens/Create'
import Join from './screens/Join'

const pathname = window.location
console.log(pathname)

const IsCreateContext = createContext<any>(null)

const App = () => {
  const [isCreate, setIsCreate] = useState(window.location.pathname === '/')

  window.addEventListener('pushState', () => {
    if (window.location.pathname === '/') setIsCreate(true)
    else setIsCreate(false)
  })

  return (
    <>
      <div className="py-8 px-8 min-h-[100vh] grid grid-rows-[auto_1fr_auto] gap-y-8">
        <Header />
        <IsCreateContext.Provider value={isCreate}>
          {isCreate ? <Create /> : <Join />}
        </IsCreateContext.Provider>
        <Footer />
      </div>
    </>
  )
}
export default App
