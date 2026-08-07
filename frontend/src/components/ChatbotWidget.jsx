import { AnimatePresence, motion } from 'framer-motion'
import { MessageCircle, Mic, Paperclip, Send, Square, X } from 'lucide-react'
import { useRef, useState } from 'react'

import api from '../lib/axios'
import { cn } from '../lib/utils'

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024 // 5MB — matches the server-side limit; this is a UX
// pre-check only, not the real boundary, which stays server-side (see document_extraction.py)

const MAX_RECORDING_MS = 60 * 1000 // auto-stop so nobody can record indefinitely
const RECORDER_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']

function pickSupportedMimeType() {
  return RECORDER_MIME_TYPES.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || ''
}

export function ChatbotWidget({
  title = 'JobBridge Assistant',
  greeting = "Kumusta! I'm the JobBridge assistant. Ask me about jobs, applications, and PESO Pila services.",
}) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([{ from: 'bot', text: greeting }])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const fileInputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const recordingTimeoutRef = useRef(null)

  const historyFromMessages = () =>
    messages.map((m) => ({ role: m.from === 'bot' ? 'assistant' : 'user', content: m.text }))

  const appendReply = (res) => {
    setSessionId(res.data.data.session_id)
    setMessages((m) => [...m, { from: 'bot', text: res.data.data.reply }])
  }

  const appendError = (err) => {
    // The backend explains why it couldn't answer (not configured, upstream timeout,
    // rate limited, invalid file) — show that rather than a generic string that hides the cause.
    const reason = err.response?.data?.message
    setMessages((m) => [...m, { from: 'bot', text: reason || 'Sorry, I had trouble responding. Please try again.' }])
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || sending) return
    // Captured before appending the new turn — the server trims/validates this
    // regardless, but only what's already been said belongs in "history".
    const history = historyFromMessages()
    setMessages((m) => [...m, { from: 'user', text }])
    setInput('')
    setSending(true)
    try {
      appendReply(await api.post('/api/assistant/chat', { message: text, session_id: sessionId, history }))
    } catch (err) {
      appendError(err)
    } finally {
      setSending(false)
    }
  }

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file || sending) return

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      setMessages((m) => [...m, { from: 'bot', text: 'That file is too large. Maximum size is 5MB.' }])
      return
    }

    const history = historyFromMessages()
    const text = input.trim()
    setMessages((m) => [...m, { from: 'user', text: `📎 ${file.name}` }])
    setInput('')
    setSending(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('message', text)
      if (sessionId) form.append('session_id', sessionId)
      form.append('history', JSON.stringify(history))
      appendReply(await api.post('/api/assistant/upload-document', form))
    } catch (err) {
      appendError(err)
    } finally {
      setSending(false)
    }
  }

  const stopRecording = () => {
    clearTimeout(recordingTimeoutRef.current)
    mediaRecorderRef.current?.stop() // triggers the recorder's onstop handler below
    setRecording(false)
  }

  const startRecording = async () => {
    if (recording || sending || transcribing) return

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      const text =
        err.name === 'NotAllowedError'
          ? 'Microphone access was denied. Please allow microphone access to use voice input.'
          : err.name === 'NotFoundError'
            ? 'No microphone was found on this device.'
            : "Couldn't access the microphone. You can type your message instead."
      setMessages((m) => [...m, { from: 'bot', text }])
      return
    }

    const mimeType = pickSupportedMimeType()
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    const chunks = []
    recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data)
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop()) // release the mic indicator
      const blob = new Blob(chunks, { type: mimeType || 'audio/webm' })
      transcribeAudio(blob)
    }

    mediaRecorderRef.current = recorder
    recorder.start()
    setRecording(true)
    recordingTimeoutRef.current = setTimeout(stopRecording, MAX_RECORDING_MS)
  }

  const transcribeAudio = async (blob) => {
    setTranscribing(true)
    try {
      const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'
      const form = new FormData()
      form.append('file', blob, `recording.${ext}`)
      const res = await api.post('/api/assistant/transcribe', form)
      // Populates the input for the user to review/edit — NOT auto-sent. Send still
      // goes through the exact same sendMessage() a typed message already uses.
      setInput(res.data.data.transcript)
    } catch (err) {
      appendError(err)
    } finally {
      setTranscribing(false)
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
              <p className="text-sm font-semibold">{title}</p>
              <button onClick={() => setOpen(false)} aria-label="Close chat">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    'max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm',
                    msg.from === 'bot' ? 'bg-slate-100 text-slate-700' : 'ml-auto bg-primary-800 text-white'
                  )}
                >
                  {msg.text}
                </div>
              ))}
            </div>
            {(recording || transcribing) && (
              <div className="flex items-center gap-2 border-t border-slate-100 px-3 py-1.5 text-xs text-slate-500">
                <span className={cn('h-2 w-2 rounded-full', recording ? 'animate-pulse bg-red-500' : 'bg-slate-400')} />
                {recording ? 'Recording… tap the mic again to stop' : 'Transcribing…'}
              </div>
            )}
            <div className="flex items-center gap-2 border-t border-slate-100 p-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt"
                hidden
                onChange={handleFileSelected}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || recording || transcribing}
                aria-label="Attach a document"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <button
                onClick={recording ? stopRecording : startRecording}
                disabled={sending || transcribing}
                aria-label={recording ? 'Stop recording' : 'Record a voice message'}
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg disabled:opacity-50',
                  recording ? 'bg-red-500 text-white hover:bg-red-600' : 'text-slate-500 hover:bg-slate-100'
                )}
              >
                {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message…"
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus-visible:outline-2 focus-visible:outline-primary-500"
              />
              <button
                onClick={sendMessage}
                disabled={sending || recording || transcribing}
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
