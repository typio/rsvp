import { API_URL } from '@/utils'
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState
} from 'react'
import useWebSocket, { ReadyState } from 'react-use-websocket'

type MessageHandler = (payload: any) => void
type MessageHandlers = {
  [key: string]: MessageHandler
}

type WebSocketContextType = {
  sendMessage: (message: string) => void
  readyState: ReadyState
  roomUid: string | null
  setRoomUid: (uid: string | null) => void
  addMessageHandler: (type: string, handler: (payload: any) => void) => void
  removeMessageHandler: (type: string) => void
}

const WebSocketContext = createContext<WebSocketContextType | null>(null)

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error(
      'useWebSocketContext must be used within a WebSocketProvider'
    )
  }
  return context
}

export const WebSocketProvider: React.FC<React.PropsWithChildren<{}>> = ({
  children
}) => {
  const [roomUid, setRoomUid] = useState<string | null>(null)
  const socketUrl = useMemo(
    () =>
      roomUid ? `${API_URL.replace('http', 'ws')}/api/ws/${roomUid}` : null,
    [roomUid]
  )
  const [handlers, setHandlers] = useState<MessageHandlers>({})

  const handleMessage = useCallback(
    (event: any) => {
      const data = event.data.trim()
      if (data === 'ping') {
        sendMessage('pong')
        return
      } else if (data === 'pong') return
      else {
        try {
          const message: { messageType: string; payload: any } =
            JSON.parse(data)
          const handler: MessageHandler | undefined =
            handlers[message.messageType]

          if (handler) {
            handler(message.payload)
          } else {
            console.warn('No handler for message type:', message.messageType)
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e)
        }
      }
    },
    [handlers]
  )

  const { sendMessage, readyState } = useWebSocket(socketUrl, {
    shouldReconnect: () => roomUid !== null,
    heartbeat: true,
    onMessage: handleMessage
  })

  const addMessageHandler = useCallback(
    (type: string, handler: (payload: any) => void) => {
      setHandlers(prev => ({ ...prev, [type]: handler }))
    },
    []
  )

  const removeMessageHandler = useCallback((type: string) => {
    setHandlers(prev => {
      const newHandlers = { ...prev }
      delete newHandlers[type]
      return newHandlers
    })
  }, [])

  const contextValue = useMemo(
    () => ({
      sendMessage,
      readyState,
      roomUid,
      setRoomUid,
      addMessageHandler,
      removeMessageHandler
    }),
    [
      sendMessage,
      readyState,
      roomUid,
      setRoomUid,
      addMessageHandler,
      removeMessageHandler
    ]
  )

  const stableContextValue = useCustomComparison(contextValue, (prev, next) => {
    return (
      prev.sendMessage === next.sendMessage &&
      prev.readyState === next.readyState &&
      prev.roomUid === next.roomUid &&
      prev.setRoomUid === next.setRoomUid &&
      prev.addMessageHandler === next.addMessageHandler &&
      prev.removeMessageHandler === next.removeMessageHandler
    )
  })

  return (
    <WebSocketContext.Provider value={stableContextValue}>
      {children}
    </WebSocketContext.Provider>
  )
}

function useCustomComparison<T>(
  value: T,
  compare: (prev: T, next: T) => boolean
): T {
  const ref = useRef<T>(value)

  return useMemo(() => {
    if (compare(ref.current, value)) {
      return ref.current
    }
    ref.current = value
    return value
  }, [value, compare])
}
