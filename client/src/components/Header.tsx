import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCalendarCheck } from '@fortawesome/free-solid-svg-icons'
import { Link } from 'react-router-dom'

const Header = () => (
  <header className="flex flex-row items-center text-primary ">
    <Link
      to="/"
      className="flex flex-row gap-x-4 items-center hover:text-primary/80 "
    >
      <FontAwesomeIcon icon={faCalendarCheck} size="2xl" />
      <div className="flex flex-col">
        <h1 className="text-xl font-semibold">C'mon rsvp!</h1>
        <h2 className="font-medium text-sm mt-[-4px]">
          Find a time that's convenient for everyone
        </h2>
      </div>
    </Link>
  </header>
)

export default Header
