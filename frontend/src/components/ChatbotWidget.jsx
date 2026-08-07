import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, Camera, FileText, Mic, Paperclip, RotateCcw, Send, Square, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'

import api from '../lib/axios'
import { cn } from '../lib/utils'
import { JobBotIcon } from './icons/JobBotIcon'

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024 // 5MB — matches the server-side limit; this is a UX
// pre-check only, not the real boundary, which stays server-side (see document_extraction.py)
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024 // matches image_validation.py's server-side limit

const MAX_RECORDING_MS = 60 * 1000 // auto-stop so nobody can record indefinitely
const RECORDER_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']

// Total reveal duration is bounded regardless of reply length (~60 ticks), so a long
// reply doesn't take forever to finish animating — purely cosmetic, not a real stream
// (see the Phase 6 plan: this app's single-eventlet-worker architecture can't safely
// forward token-by-token streaming without a real restructure, so this is the stand-in).
const REVEAL_TICKS = 60
const REVEAL_INTERVAL_MS = 16

function pickSupportedMimeType() {
  return RECORDER_MIME_TYPES.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || ''
}

const DEFAULT_GREETING = "Kumusta! I'm Job Bot, your JobBridge assistant. Ask me about jobs, applications, and PESO Pila services."

// "Near the bottom" tolerance in px — auto-scroll only kicks in within this distance,
// so a user who's scrolled up to read earlier messages never gets yanked back down.
const NEAR_BOTTOM_THRESHOLD_PX = 100

export function ChatbotWidget({ title = 'Job Bot', greeting = DEFAULT_GREETING }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([{ from: 'bot', text: greeting }])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  // { file, kind: 'document' | 'image', previewUrl? } | null — staged, not sent, until
  // the user submits. previewUrl (image only) is an object URL, revoked on removal/send.
  const [attachment, setAttachment] = useState(null)
  const [showJumpButton, setShowJumpButton] = useState(false)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const recordingTimeoutRef = useRef(null)
  const revealTimerRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const isNearBottomRef = useRef(true) // read inside effects to avoid a stale closure

  useEffect(() => () => clearInterval(revealTimerRef.current), [])

  const scrollToBottom = (behavior = 'smooth') => {
    messagesContainerRef.current?.scrollTo({ top: messagesContainerRef.current.scrollHeight, behavior })
  }

  const handleScroll = () => {
    const el = messagesContainerRef.current
    if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_THRESHOLD_PX
    isNearBottomRef.current = near
    if (near) setShowJumpButton(false)
  }

  // Auto-scroll on every new message (user's own AND Job Bot's reply, including the
  // typewriter reveal's incremental updates, which also flow through `messages`) — but
  // only when the user is already near the bottom. Otherwise leave their scroll
  // position alone and surface the jump-to-bottom pill instead of yanking them down.
  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollToBottom()
    } else {
      setShowJumpButton(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, sending])

  useEffect(() => {
    if (open) scrollToBottom('auto') // instant, not animated, when the panel first opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const jumpToBottom = () => {
    scrollToBottom()
    isNearBottomRef.current = true
    setShowJumpButton(false)
  }

  const historyFromMessages = () =>
    messages.map((m) => ({ role: m.from === 'bot' ? 'assistant' : 'user', content: m.text }))

  const revealReply = (fullText, index) => {
    clearInterval(revealTimerRef.current)
    const step = Math.max(1, Math.ceil(fullText.length / REVEAL_TICKS))
    let shown = 0
    revealTimerRef.current = setInterval(() => {
      shown = Math.min(fullText.length, shown + step)
      setMessages((m) => {
        const next = [...m]
        if (next[index]) next[index] = { ...next[index], visibleText: fullText.slice(0, shown) }
        return next
      })
      if (shown >= fullText.length) clearInterval(revealTimerRef.current)
    }, REVEAL_INTERVAL_MS)
  }

  const appendReply = (res) => {
    setSessionId(res.data.data.session_id)
    const text = res.data.data.reply
    setMessages((m) => {
      const next = [...m, { from: 'bot', text, visibleText: '' }]
      revealReply(text, next.length - 1)
      return next
    })
  }

  const appendError = (err) => {
    // The backend explains why it couldn't answer (not configured, upstream timeout,
    // rate limited, invalid file) — show that rather than a generic string that hides the cause.
    const reason = err.response?.data?.message
    setMessages((m) => [...m, { from: 'bot', text: reason || 'Sorry, I had trouble responding. Please try again.' }])
  }

  // Selecting a file only STAGES it — no network call here. It's only sent when the
  // user explicitly submits (Send/Enter), same as typed text, and can be removed
  // before that via the chip's ✕ without anything ever being sent.
  const handleFileSelected = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      setMessages((m) => [...m, { from: 'bot', text: 'That file is too large. Maximum size is 5MB.' }])
      return
    }
    setAttachment({ file, kind: 'document' })
  }

  // Same staging pattern as document attach — this is what "capture=environment" opens
  // the native camera for on mobile, and gracefully falls back to a plain file picker
  // on desktop (no capture-hint support), with zero extra fallback code needed.
  const handleImageSelected = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setMessages((m) => [...m, { from: 'bot', text: 'That image is too large. Maximum size is 5MB.' }])
      return
    }
    setAttachment((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl)
      return { file, kind: 'image', previewUrl: URL.createObjectURL(file) }
    })
  }

  const removeAttachment = () => {
    if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl)
    setAttachment(null)
  }

  const sendMessage = async () => {
    const text = input.trim()
    if ((!text && !attachment) || sending) return
    // Captured before appending the new turn — the server trims/validates this
    // regardless, but only what's already been said belongs in "history".
    const history = historyFromMessages()
    const staged = attachment
    const label = staged?.kind === 'image' ? '📷 photo' : staged ? `📎 ${staged.file.name}` : null
    setMessages((m) => [...m, { from: 'user', text: label ? `${label}${text ? ` — ${text}` : ''}` : text }])
    setInput('')
    if (staged?.previewUrl) URL.revokeObjectURL(staged.previewUrl)
    setAttachment(null)
    setSending(true)
    try {
      if (staged?.kind === 'image') {
        const form = new FormData()
        form.append('image', staged.file)
        form.append('message', text)
        if (sessionId) form.append('session_id', sessionId)
        form.append('history', JSON.stringify(history))
        appendReply(await api.post('/api/assistant/chat-with-image', form))
      } else if (staged) {
        const form = new FormData()
        form.append('file', staged.file)
        form.append('message', text)
        if (sessionId) form.append('session_id', sessionId)
        form.append('history', JSON.stringify(history))
        appendReply(await api.post('/api/assistant/upload-document', form))
      } else {
        appendReply(await api.post('/api/assistant/chat', { message: text, session_id: sessionId, history }))
      }
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

  const clearConversation = () => {
    clearInterval(revealTimerRef.current)
    setMessages([{ from: 'bot', text: greeting }])
    setSessionId(null)
    if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl)
    setAttachment(null)
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
            className="mb-3 flex h-[min(70vh,480px)] w-[min(92vw,360px)] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
          >
            <div className="flex items-center justify-between bg-primary-900 px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <JobBotIcon className="h-6 w-6 shrink-0" />
                <p className="text-sm font-semibold">{title}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={clearConversation}
                  disabled={sending}
                  aria-label="Clear conversation"
                  title="Clear conversation"
                  className="rounded p-1 hover:bg-white/10 disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button onClick={() => setOpen(false)} aria-label="Close chat" className="rounded p-1 hover:bg-white/10">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="relative flex-1 overflow-hidden">
              <div ref={messagesContainerRef} onScroll={handleScroll} className="h-full space-y-3 overflow-y-auto p-3">
                {messages.map((msg, i) => (
                  <div key={i} className={cn('flex items-end gap-2', msg.from === 'user' && 'flex-row-reverse')}>
                    {msg.from === 'bot' && <JobBotIcon className="mb-1 h-5 w-5 shrink-0" />}
                    <div
                      className={cn(
                        'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                        msg.from === 'bot' ? 'bg-surface-hover text-text-secondary' : 'bg-primary-800 text-white'
                      )}
                    >
                      {msg.from === 'bot' ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-headings:my-1">
                          <ReactMarkdown>{msg.visibleText ?? msg.text}</ReactMarkdown>
                        </div>
                      ) : (
                        <span className="whitespace-pre-wrap">{msg.text}</span>
                      )}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex items-end gap-2">
                    <JobBotIcon className="mb-1 h-5 w-5 shrink-0" />
                    <div className="flex items-center gap-2 rounded-lg bg-surface-hover px-3 py-2">
                      <span className="flex gap-1">
                        {[0, 0.15, 0.3].map((delay) => (
                          <motion.span
                            key={delay}
                            className="h-1.5 w-1.5 rounded-full bg-text-muted"
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1, repeat: Infinity, delay }}
                          />
                        ))}
                      </span>
                      <span className="text-xs text-text-muted">Job Bot is typing…</span>
                    </div>
                  </div>
                )}
              </div>
              <AnimatePresence>
                {showJumpButton && (
                  <motion.button
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    onClick={jumpToBottom}
                    className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary-800 px-3 py-1.5 text-xs text-white shadow-md hover:bg-primary-900"
                  >
                    <ArrowDown className="h-3 w-3" />
                    New message
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
            {(recording || transcribing) && (
              <div className="flex items-center gap-2 border-t border-border-subtle px-3 py-1.5 text-xs text-text-muted">
                <span className={cn('h-2 w-2 rounded-full', recording ? 'animate-pulse bg-red-500' : 'bg-text-muted')} />
                {recording ? 'Recording… tap the mic again to stop' : 'Transcribing…'}
              </div>
            )}
            {attachment && (
              <div className="flex items-center gap-2 border-t border-border-subtle px-3 py-1.5">
                <span className="flex max-w-full items-center gap-1.5 rounded-full bg-surface-hover py-1 pl-1 pr-2.5 text-xs text-text-secondary">
                  {attachment.kind === 'image' ? (
                    <img src={attachment.previewUrl} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
                  ) : (
                    <FileText className="ml-1 h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="truncate">{attachment.kind === 'image' ? 'Photo' : attachment.file.name}</span>
                  <button onClick={removeAttachment} aria-label="Remove attachment" className="shrink-0 rounded-full p-0.5 hover:bg-surface">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 border-t border-border-subtle p-2">
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
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-surface-hover disabled:opacity-50"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={handleImageSelected}
              />
              <button
                onClick={() => cameraInputRef.current?.click()}
                disabled={sending || recording || transcribing}
                aria-label="Take or attach a photo"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-surface-hover disabled:opacity-50"
              >
                <Camera className="h-4 w-4" />
              </button>
              <button
                onClick={recording ? stopRecording : startRecording}
                disabled={sending || transcribing}
                aria-label={recording ? 'Stop recording' : 'Record a voice message'}
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg disabled:opacity-50',
                  recording ? 'bg-red-500 text-white hover:bg-red-600' : 'text-text-muted hover:bg-surface-hover'
                )}
              >
                {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message…"
                className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus-visible:outline-2 focus-visible:outline-primary-500"
              />
              <button
                onClick={sendMessage}
                disabled={sending || recording || transcribing || (!input.trim() && !attachment)}
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
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-800 shadow-lg hover:bg-primary-900"
        aria-label="Open chat assistant"
      >
        <JobBotIcon className="h-9 w-9" />
      </motion.button>
    </div>
  )
}
