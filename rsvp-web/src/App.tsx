import { createContext, useEffect, useState } from 'react'
import Header from './Header'
import Footer from './Footer'
import Create from './screens/Create'
import Join from './screens/Join'
import About from './screens/About'

const ScreenContext = createContext<any>(null)

const App = () => {
  const [screen, setScreen] = useState<'create' | 'join' | 'about'>()
  const [WSMode, setWSMode] = useState(null)

  useEffect(() => {
    if (window.location.pathname === '/') setScreen('create')
    else if (window.location.pathname === '/about') setScreen('about')
    else setScreen('join')
  }, [])

  window.addEventListener('pushState', () => {
    if (window.location.pathname === '/') setScreen('create')
    else if (window.location.pathname === '/about') setScreen('about')
    else setScreen('join')
  })

  return (
    <>
      <div className="py-8 px-8 min-h-[100vh] grid grid-rows-[auto_1fr_auto] gap-y-8">
        <Header />
        <ScreenContext.Provider value={screen}>
          <Main screen={screen} setScreen={setScreen} setWSMode={setWSMode} />
        </ScreenContext.Provider>
        <Footer screen={screen} WSMode={WSMode} />
      </div>
    </>
  )
}

const Main = ({ screen, setScreen, setWSMode }) => {
  switch (screen) {
    case 'create':
      return <Create setScreen={setScreen} />
    case 'join':
      return <Join setScreen={setScreen} setWSMode={setWSMode} />
    case 'about':
      return <About />
  }
}

export default App
