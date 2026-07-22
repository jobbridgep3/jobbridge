import { useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

import { useAuthStore } from '../store/authStore'

let socketInstance = null
let refCount = 0

export function getSocket() {
  return socketInstance
}

function ensureConnected(token) {
  if (socketInstance) return socketInstance
  const url = import.meta.env.VITE_API_URL || 'http://localhost:5000'
  socketInstance = io(url, { query: { token }, transports: ['websocket', 'polling'] })
  return socketInstance
}

/**
 * Shares one real connection per authenticated session across every caller —
 * `useSocket` is called from many independently-mounting page components plus
 * the persistent AppShell, so each mount/unmount here only registers/removes
 * its own handlers on the shared socket. The underlying connection is only
 * torn down once the last consumer unmounts (ref count reaches zero), never
 * by an unrelated page navigating away — connecting and disconnecting on every
 * mount was accumulating orphaned server-side connections and could kill
 * another component's still-live connection.
 *
 * Pass `{ allowAnonymous: true }` for public pages (e.g. the homepage) that need
 * live updates before/without a login — the backend already accepts a tokenless
 * connection (it just skips joining any room), so such a caller only ever
 * receives broadcast-style events, never the per-user/per-role ones. Omitting
 * this option keeps every existing caller's exact current behavior.
 */
export function useSocket(eventHandlers = {}, { allowAnonymous = false } = {}) {
  const token = useAuthStore((s) => s.token)
  const handlersRef = useRef(eventHandlers)
  handlersRef.current = eventHandlers

  useEffect(() => {
    if (!token && !allowAnonymous) return undefined

    const socket = ensureConnected(token)
    refCount += 1
    const boundHandlers = handlersRef.current
    Object.entries(boundHandlers).forEach(([event, handler]) => {
      socket.on(event, handler)
    })

    return () => {
      Object.entries(boundHandlers).forEach(([event, handler]) => {
        socket.off(event, handler)
      })
      refCount -= 1
      if (refCount <= 0) {
        socketInstance?.disconnect()
        socketInstance = null
        refCount = 0
      }
    }
  }, [token, allowAnonymous])

  return socketInstance
}
