import { useEffect, useRef } from 'react'

import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'

/** Reconciles the DB-persisted theme_preference (available once the user is
 * logged in) with the localStorage-driven choice the index.html bootstrap
 * script already applied, and keeps 'system' live against OS changes.
 * Renders nothing — pure side-effect component mounted once near the root. */
export function ThemeInitializer() {
  const user = useAuthStore((s) => s.user)
  const setTheme = useUiStore((s) => s.setTheme)
  const refreshResolvedTheme = useUiStore((s) => s.refreshResolvedTheme)
  const reconciledForUserId = useRef(null)

  useEffect(() => {
    if (!user || reconciledForUserId.current === user.id) return
    reconciledForUserId.current = user.id
    if (user.theme_preference && user.theme_preference !== localStorage.getItem('jobbridge-theme')) {
      // DB is the source of truth on login (e.g. a different device set it) —
      // apply without re-PUTting straight back to the server.
      setTheme(user.theme_preference, { persistToServer: false })
    }
  }, [user, setTheme])

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => refreshResolvedTheme()
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [refreshResolvedTheme])

  return null
}
