import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCopyright,
  faEnvelope,
  faHeart,
  faQuestion
} from '@fortawesome/free-solid-svg-icons'
import { faGithubAlt } from '@fortawesome/free-brands-svg-icons'
import { ReadyState } from 'react-use-websocket'
import { Link } from 'react-router-dom'
import { useWebSocketContext } from '@/contexts/WebSocketContext'

const Footer = () => {
  const { readyState, roomUid } = useWebSocketContext()

  return (
    <footer
      className={`text-sm text-primary font-medium justify-between items-end select-none flex flex-row flex-wrap `}
    >
      <div className="flex flex-row flex-wrap gap-x-4 gap-y-4 sm:gap-y-2 basis-1/3">
        <Link
          className="flex flex-row gap-2 items-center hover:text-primary/90 px-2"
          to="/about"
        >
          <FontAwesomeIcon icon={faQuestion} className="min-w-4 text-center" />
          <div>about</div>
        </Link>
        <a
          className="flex flex-row gap-2 items-center hover:text-primary/90 px-2"
          href="mailto:tom@tominomi.com"
        >
          <FontAwesomeIcon icon={faEnvelope} className="min-w-4 text-center" />
          <div>contact</div>
        </a>
        <a
          className="flex flex-row gap-2 items-center hover:text-primary/90 px-2"
          href="https://github.com/typio/rsvp"
        >
          <FontAwesomeIcon icon={faGithubAlt} className="min-w-4 text-center" />
          <div>github</div>
        </a>
        <a
          className="flex flex-row col-span-2 gap-2 items-center hover:text-primary/90 px-2"
          href="https://tominomi.com"
        >
          <FontAwesomeIcon icon={faHeart} className="min-w-4 text-center" />
          <div>thomas</div>
        </a>
      </div>

      {roomUid !== null && (
        <div className="basis-1/3 flex flex-row justify-center">
          {readyState === ReadyState.OPEN ? (
            <div className="flex flex-row gap-x-2 items-center">
              <svg className="w-4 h-4" viewBox="0 0 10 10">
                <circle
                  cx={5}
                  cy={5}
                  r={4}
                  className="animate-pulse duration-1000 fill-primary opacity-40 "
                  transform-origin="50% 50%"
                />
                <circle cx={5} cy={5} r={2} className="fill-primary " />
              </svg>
              live changes
            </div>
          ) : (
            <div className="flex flex-row gap-x-2 items-center">
              <svg className="w-4 h-4" viewBox="0 0 10 10">
                <circle
                  cx={5}
                  cy={5}
                  r={4}
                  className="fill-destructive opacity-40 "
                  transform-origin="50% 50%"
                />
                <circle cx={5} cy={5} r={3} className="fill-destructive " />
              </svg>
              disconnected
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-y-2 basis-1/3 items-end">
        <span className="grid grid-flow-col w-max gap-2 items-center">
          <FontAwesomeIcon icon={faCopyright} />
          <div>2024</div>
        </span>
      </div>
    </footer>
  )
}

export default Footer
