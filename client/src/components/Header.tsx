import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCalendarCheck } from '@fortawesome/free-solid-svg-icons'
import { Link } from 'react-router-dom'

const Header = () => (
  <header className="flex flex-row justify-center sm:justify-start mt-4 sm:mt-2">
    <Link
      to="/"
      className="flex flex-col gap-y-1.5 justify-center text-primary active:text-primary/80 ring-offset-8"
    >
      <div className="flex flex-row items-center ">
        <FontAwesomeIcon icon={faCalendarCheck} size="2xl" />
        <h1 className="text-3xl sm:text-3xl pl-4 pb-0.5 rotate-[-1.5deg] font-semibold font-[Satisfy]">
          C'mon RSVP!
        </h1>
      </div>
      <h2 className="font-medium text-sm hidden sm:inline">
        Find a time that's convenient for everyone
      </h2>
    </Link>
  </header>
)

export default Header
