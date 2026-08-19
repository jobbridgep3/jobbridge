import axios from 'axios'

import { useAuthStore } from '../store/authStore'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // A hard reload follows immediately below, which on its own already
      // discards every piece of in-memory state (React Query cache, socket,
      // zustand stores) that performLogout() in lib/sessionReset.js otherwise
      // has to clear explicitly for the SPA-navigation logout paths (Header,
      // account deactivation). Only the *persisted* auth token needs clearing
      // here so the reloaded page doesn't rehydrate as the expired user.
      useAuthStore.getState().logout()
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
