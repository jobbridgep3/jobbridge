import { useCallback } from 'react'

export function useSpeechAnnouncement() {
  return useCallback((text) => {
    if (!text || !('speechSynthesis' in window)) return
    try {
      window.speechSynthesis.cancel() // stop any in-progress/queued utterance so voices never overlap
      const utterance = new SpeechSynthesisUtterance(text)
      window.speechSynthesis.speak(utterance)
    } catch {
      // Speech is a nice-to-have — never let it break the attendance flow.
    }
  }, [])
}
