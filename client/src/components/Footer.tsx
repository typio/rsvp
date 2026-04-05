import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCopyright } from '@fortawesome/free-solid-svg-icons'
import { ReadyState } from 'react-use-websocket'
import { Link } from 'react-router-dom'
import { useWebSocketContext } from '@/contexts/WebSocketContext'

const Footer = () => {
  const { readyState, roomUid } = useWebSocketContext()

  return (
    <footer className="text-sm text-muted-foreground font-medium select-none flex flex-row justify-between items-end">
      <Link className="hover:text-primary transition-colors" to="/about">
        about
      </Link>

      {roomUid !== null && (
        <div className="flex flex-row gap-x-2 items-center">
          {readyState === ReadyState.OPEN ? (
            <>
              <svg className="w-4 h-4" viewBox="0 0 10 10">
                <circle cx={5} cy={5} r={4} className="animate-pulse fill-primary opacity-40" style={{ transformOrigin: '5px 5px' }} />
                <circle cx={5} cy={5} r={2} className="fill-primary" />
              </svg>
              live
            </>
          ) : (
            <>
              <svg className="w-3 h-3" viewBox="0 0 10 10">
                <circle cx={5} cy={5} r={4} className="fill-destructive opacity-40" />
                <circle cx={5} cy={5} r={3} className="fill-destructive" />
              </svg>
              disconnected
            </>
          )}
        </div>
      )}

      <span className="flex flex-row gap-1.5 items-center">
        <FontAwesomeIcon icon={faCopyright} />
        {new Date().getFullYear()}
      </span>
    </footer>
  )
}

export default Footer
