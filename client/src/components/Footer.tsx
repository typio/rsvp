import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCopyright, faMailBulk } from '@fortawesome/free-solid-svg-icons'
import { faGithub } from '@fortawesome/free-brands-svg-icons'

const Footer = () => {
  return (
    <footer className="w-full h-(--footer-h) px-6 pt-4 lg:pt-0 text-sm text-muted-foreground font-medium select-none flex flex-row justify-between items-start">
      <a
        className="flex gap-1.5 items-center  hover:text-primary focus-visible:outline-solid outline-primary transition-colors"
        target="_blank"
        rel="noopener noreferrer"
        href="https://tomon.om"
      >
        <FontAwesomeIcon icon={faMailBulk} />
        contact
      </a>

      <a
        className="flex gap-1.5 items-center hover:text-primary focus-visible:outline-solid outline-primary transition-colors"
        target="_blank"
        rel="noopener noreferrer"
        href="https://github.com/typio/rsvp"
      >
        <FontAwesomeIcon icon={faGithub} />
        source code
      </a>

      <span className="flex flex-row gap-1.5 items-center">
        <FontAwesomeIcon icon={faCopyright} />
        {new Date().getFullYear()}
      </span>
    </footer>
  )
}

export default Footer
