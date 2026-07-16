import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import api from '../lib/axios'

// Source of truth for the *choice* ('light'/'dark'/'system') is the raw
// 'jobbridge-theme' localStorage key — not zustand's own persist blob —
// because index.html's no-flash bootstrap script (which runs before React/
// zustand even loads) reads that exact key synchronously on every page load.
// Keeping one key avoids the store's initial render disagreeing with what
// the bootstrap script already applied to <html>.
function readStoredTheme() {
  if (typeof window === 'undefined') return 'system'
  const stored = localStorage.getItem('jobbridge-theme')
  return stored === 'dark' || stored === 'light' ? stored : 'system'
}

function resolveTheme(theme) {
  if (theme === 'system') {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

function applyTheme(resolved) {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', resolved === 'dark')
  }
}

const initialTheme = readStoredTheme()

export const useUiStore = create(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      unreadCount: 0,
      theme: initialTheme,
      resolvedTheme: resolveTheme(initialTheme),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setUnreadCount: (count) => set({ unreadCount: count }),
      incrementUnread: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
      decrementUnread: () => set((state) => ({ unreadCount: Math.max(0, state.unreadCount - 1) })),
      /** Sets the user's theme choice, applies it immediately (no page refresh),
       * persists to localStorage for the next load's bootstrap script, and
       * fire-and-forgets the DB save so it survives logout/device changes. */
      setTheme: (theme, { persistToServer = true } = {}) => {
        const resolvedTheme = resolveTheme(theme)
        localStorage.setItem('jobbridge-theme', theme)
        applyTheme(resolvedTheme)
        set({ theme, resolvedTheme })
        if (persistToServer) {
          api.put('/api/settings/theme', { theme }).catch(() => {})
        }
      },
      /** Re-resolves 'system' against the current OS preference (called on
       * prefers-color-scheme change events) without touching the stored choice. */
      refreshResolvedTheme: () =>
        set((state) => {
          const resolvedTheme = resolveTheme(state.theme)
          applyTheme(resolvedTheme)
          return { resolvedTheme }
        }),
    }),
    { name: 'jobbridge-ui' }
  )
)
