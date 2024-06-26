import { createContext, useEffect, useState } from 'react'
import Header from './Header'
import Footer from './Footer'
import Create from './screens/Create'
import Join from './screens/Join'
import About from './screens/About'
import { ReadyState } from 'react-use-websocket'

export enum Screen {
  CREATE,
  JOIN,
  ABOUT
}

const ScreenContext = createContext<Screen>(Screen.CREATE)

const App = () => {
  const [screen, setScreen] = useState<Screen>()
  const [WSMode, setWSMode] = useState<null | ReadyState>(null)

  useEffect(() => navigateToScreen(window.location.pathname), [])

  window?.addEventListener('pushState', (event: any) =>
    navigateToScreen(new URL(event.destination.url).pathname)
  )

  const navigateToScreen = (path: string) => {
    if (path === '/') setScreen(Screen.CREATE)
    else if (path === '/about') setScreen(Screen.ABOUT)
    else setScreen(Screen.JOIN)
  }

  return (
    screen != undefined && (
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
  )
}

const Main = ({
  screen,
  setScreen,
  setWSMode
}: {
  screen: Screen
  setScreen: React.Dispatch<Screen>
  setWSMode: React.Dispatch<null | ReadyState>
}) => {
  switch (screen) {
    case Screen.CREATE:
      return <Create setScreen={setScreen} />
    case Screen.JOIN:
      return <Join setScreen={setScreen} setWSMode={setWSMode} />
    case Screen.ABOUT:
      return <About />
  }
}

export default App
