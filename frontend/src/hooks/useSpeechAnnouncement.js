import { useCallback } from 'react'

export function useSpeechAnnouncement() {
  return useCallback((text) => {
    if (!text || !('speechSynthesis' in window)) return
    try {
      const synth = window.speechSynthesis
      if (synth.speaking || synth.pending) synth.cancel()
      // Chrome/Firefox silently drop a speak() call made synchronously right
      // after cancel() (documented browser bug) — a short delay lets the
      // cancel settle first.
      setTimeout(() => {
        try {
          synth.speak(new SpeechSynthesisUtterance(text))
        } catch {
          // Speech is a nice-to-have — never let it break the attendance flow.
        }
      }, 100)
    } catch {
      // Speech is a nice-to-have — never let it break the attendance flow.
    }
  }, [])
}
