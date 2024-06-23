import { createContext, useState } from 'react'
import Header from './Header'
import Footer from './Footer'
import Create from './screens/Create'
import Join from './screens/Join'

const IsCreateContext = createContext<any>(null)

const App = () => {
  const [isCreate, setIsCreate] = useState(window.location.pathname === '/')
  const [WSMode, setWSMode] = useState(null)

  window.addEventListener('pushState', () => {
    if (window.location.pathname === '/') setIsCreate(true)
    else setIsCreate(false)
  })

  return (
    <>
      <div className="py-8 px-8 min-h-[100vh] grid grid-rows-[auto_1fr_auto] gap-y-8">
        <Header />
        <IsCreateContext.Provider value={isCreate}>
          {isCreate ? (
            <Create setIsCreate={setIsCreate} />
          ) : (
            <Join setIsCreate={setIsCreate} setWSMode={setWSMode} />
          )}
        </IsCreateContext.Provider>
        <Footer isCreate={isCreate} WSMode={WSMode} />
      </div>
    </>
  )
}
export default App
