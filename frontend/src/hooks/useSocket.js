import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

import { useAuthStore } from '../store/authStore'

let socketInstance = null

export function getSocket() {
  return socketInstance
}

/** Connects once per authenticated session; disconnects on logout/unmount of the root shell. */
export function useSocket(eventHandlers = {}) {
  const token = useAuthStore((s) => s.token)
  const handlersRef = useRef(eventHandlers)
  handlersRef.current = eventHandlers

  useEffect(() => {
    if (!token) return undefined

    const url = import.meta.env.VITE_API_URL || 'http://localhost:5000'
    socketInstance = io(url, { query: { token }, transports: ['websocket', 'polling'] })

    const boundHandlers = handlersRef.current
    Object.entries(boundHandlers).forEach(([event, handler]) => {
      socketInstance.on(event, handler)
    })

    return () => {
      Object.entries(boundHandlers).forEach(([event, handler]) => {
        socketInstance?.off(event, handler)
      })
      socketInstance?.disconnect()
      socketInstance = null
    }
  }, [token])

  return socketInstance
}
