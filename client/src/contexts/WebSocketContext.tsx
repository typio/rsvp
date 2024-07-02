import React, { createContext, useContext, useState } from 'react'
import useWebSocket, { ReadyState } from 'react-use-websocket'

type WebSocketContextType = {
  sendMessage: (message: string) => void
  lastMessage: MessageEvent<any> | null
  readyState: ReadyState
  roomUid: string | null
  setRoomUid: (uid: string | null) => void
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
  const socketUrl = roomUid ? `ws://localhost:3632/api/ws/${roomUid}` : null

  const { sendMessage, lastMessage, readyState } = useWebSocket(socketUrl, {
    shouldReconnect: () => !!roomUid
  })

  return (
    <WebSocketContext.Provider
      value={{ sendMessage, lastMessage, readyState, roomUid, setRoomUid }}
    >
      {children}
    </WebSocketContext.Provider>
  )
}
