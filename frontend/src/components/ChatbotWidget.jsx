import { AnimatePresence, motion } from 'framer-motion'
import { MessageCircle, Send, X } from 'lucide-react'
import { useState } from 'react'

import api from '../lib/axios'
import { cn } from '../lib/utils'

export function ChatbotWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    { from: 'bot', text: "Kumusta! I'm the JobBridge assistant. Ask me about job searching, SPES, DILP, OWWA, or job fairs." },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sessionId, setSessionId] = useState(null)

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || sending) return
    setMessages((m) => [...m, { from: 'user', text }])
    setInput('')
    setSending(true)
    try {
      const res = await api.post('/api/chatbot/message', { message: text, session_id: sessionId })
      setSessionId(res.data.data.session_id)
      setMessages((m) => [...m, { from: 'bot', text: res.data.data.reply }])
    } catch {
      setMessages((m) => [...m, { from: 'bot', text: 'Sorry, I had trouble responding. Please try again.' }])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.15 }}
            className="mb-3 flex h-[420px] w-[340px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between bg-primary-900 px-4 py-3 text-white">
              <p className="text-sm font-semibold">JobBridge Assistant</p>
              <button onClick={() => setOpen(false)} aria-label="Close chat">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                    msg.from === 'bot' ? 'bg-slate-100 text-slate-700' : 'ml-auto bg-primary-800 text-white'
                  )}
                >
                  {msg.text}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 border-t border-slate-100 p-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message…"
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus-visible:outline-2 focus-visible:outline-primary-500"
              />
              <button
                onClick={sendMessage}
                disabled={sending}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-800 text-white hover:bg-primary-900 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen((o) => !o)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-800 text-white shadow-lg hover:bg-primary-900"
        aria-label="Open chat assistant"
      >
        <MessageCircle className="h-6 w-6" />
      </motion.button>
    </div>
  )
}
