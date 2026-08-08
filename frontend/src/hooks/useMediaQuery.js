import { useEffect, useState } from 'react'

/** Tracks whether a CSS media query currently matches. Mirrors the matchMedia
 * pattern already used ad hoc for theme detection in store/uiStore.js, generalized
 * for reuse — chart geometry (Recharts width/height/tick props) is read at render
 * time from JS, not CSS, so it can't be adjusted with Tailwind classes alone. */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false))

  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (e) => setMatches(e.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return matches
}

export const useIsMobile = () => useMediaQuery('(max-width: 639px)')
