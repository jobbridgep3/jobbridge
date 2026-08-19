import { disconnectSocket } from '../hooks/useSocket'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'
import { queryClient } from './queryClient'

/** Every logout path (Header's Log Out button, account deactivation, the axios
 * 401 interceptor) must call this instead of the bare authStore logout() —
 * otherwise the next user to log in on the same tab can inherit the previous
 * user's cached API data (React Query), stale notification count, or a socket
 * connection still authenticated as the old user. Kept out of authStore.js
 * itself to avoid a circular import (uiStore.js already imports authStore). */
export function performLogout() {
  useAuthStore.getState().logout()
  useUiStore.getState().resetSession()
  queryClient.clear()
  disconnectSocket()
}
