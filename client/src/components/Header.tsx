import { Link } from 'react-router-dom'
import logoWord from '@/assets/cmon-rsvp-logo-word.webp'

const Header = () => (
  <header className="flex flex-row justify-center sm:justify-start mt-4 sm:mt-2">
    <Link to="/" className="active:opacity-80 transition-opacity">
      <img src={logoWord} alt="cmon.rsvp" className="h-12 " />
    </Link>
  </header>
)

export default Header
