import Header from './Header'
import Footer from './Footer'
import Create from './Create'

const pathname = window.location
console.log(pathname)

const App = () => {
  return (
    <>
      <div className="py-8 px-8 min-h-[100vh] grid grid-rows-[auto_1fr_auto] gap-y-8">
        <Header />
        <Create />
        <Footer />
      </div>
    </>
  )
}
export default App
