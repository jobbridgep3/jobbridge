import { useEffect, useState } from 'react'

/**
 * Counts down to an absolute deadline (ms since epoch), not a fixed duration.
 *
 * Using an absolute deadline instead of "start a fresh N-second timer on this screen"
 * matters here because the OTP flow spans multiple pages (e.g. verify-otp -> reset-password
 * for password resets) — restarting the countdown on each page would let the displayed
 * timer drift past the code's real server-side expiry.
 */
export function useCountdown(deadlineMs) {
  const [secondsLeft, setSecondsLeft] = useState(() => computeSecondsLeft(deadlineMs))

  useEffect(() => {
    setSecondsLeft(computeSecondsLeft(deadlineMs))
    if (!deadlineMs) return undefined

    const id = setInterval(() => {
      setSecondsLeft(computeSecondsLeft(deadlineMs))
    }, 250)
    return () => clearInterval(id)
  }, [deadlineMs])

  return secondsLeft
}

function computeSecondsLeft(deadlineMs) {
  if (!deadlineMs) return 0
  return Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000))
}

export function formatCountdown(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
