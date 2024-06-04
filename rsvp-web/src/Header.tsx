import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCalendarCheck } from '@fortawesome/free-solid-svg-icons'

const Header = () => (
  <header>
    <a
      href="/"
      className="flex flex-row gap-4 items-center text-primary font-bold hover:text-primary/90 "
    >
      <FontAwesomeIcon icon={faCalendarCheck} size="xl" />
      <h1 className="text-xl">C'mon, RSVP!</h1>
    </a>
  </header>
)

export default Header
