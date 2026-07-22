import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

import { useSocket } from '../../../hooks/useSocket'

const SECTION_QUERY_KEYS = {
  jobs: ['public', 'jobs', 'home'],
  jobfairs: ['public', 'jobfairs', 'home'],
  announcements: ['announcements', 'public'],
  stats: ['public', 'homepage-stats'],
}

/** Wires one anonymous-friendly socket listener for the homepage's 4 live
 * sections — the backend emits `public:homepage_update` with a `sections`
 * array (see backend/sockets/events.py callers) whenever a vacancy/job fair/
 * announcement is published/closed/cancelled/deleted, or a stat-affecting
 * record changes, so each section refetches instantly instead of on a timer. */
export function useHomepageLiveUpdates() {
  const queryClient = useQueryClient()

  const handleUpdate = useCallback(
    (payload) => {
      for (const section of payload?.sections || []) {
        const key = SECTION_QUERY_KEYS[section]
        if (key) queryClient.invalidateQueries({ queryKey: key })
      }
    },
    [queryClient]
  )

  useSocket({ 'public:homepage_update': handleUpdate }, { allowAnonymous: true })
}
