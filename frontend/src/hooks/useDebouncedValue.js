import { useEffect, useState } from 'react'

/** Debounces a fast-changing value (e.g. a search box) so callers can use the
 * returned value in a query key without firing a network request per keystroke. */
export function useDebouncedValue(value, delayMs = 350) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
