import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faEnvelope, faHeart } from '@fortawesome/free-solid-svg-icons'
import { faGithubAlt } from '@fortawesome/free-brands-svg-icons'

const Footer = () => (
  <footer className="text-sm text-primary font-semibold text-gold flex flex-row justify-between items-end select-none">
    <div className="grid grid-flow-row gap-2 ">
      <a
        className="grid grid-flow-col w-max gap-2 items-center hover:text-primary/90 "
        href="https://github.com/typio/rsvp"
      >
        <FontAwesomeIcon icon={faGithubAlt} />
        <div>github</div>
      </a>
      <a
        className="grid grid-flow-col w-max gap-2 items-center hover:text-primary/90 "
        href="mailto:me@tohuber.com"
      >
        <FontAwesomeIcon icon={faEnvelope} />
        <div>contact</div>
      </a>
      <a
        className="grid grid-flow-col w-max gap-2 items-center hover:text-primary/90 "
        href="https://tohuber.com"
      >
        <FontAwesomeIcon icon={faHeart} />
        <div>by thomas huber</div>
      </a>
    </div>
    <div>© 2024</div>
  </footer>
)

export default Footer
