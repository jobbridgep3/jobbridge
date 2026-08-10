import { AlertCircle, CheckCircle2, FileText, ListChecks, ScanLine, UserCheck } from 'lucide-react'

import { Dialog, DialogContent } from '../../../components/ui/Dialog'

const STEPS = [
  { label: 'Reading document', icon: ScanLine },
  { label: 'Extracting details', icon: ListChecks },
  { label: 'Filling your profile', icon: UserCheck },
]

const RING_COLOR = { scanning: '#2563eb', done: '#10b981', error: '#e11d48' }

/** Adapted from the reference ocr-scan-refined-preview.jsx: same ring/step-indicator
 * visuals, but every phase/step transition below is driven by the real upload +
 * extraction lifecycle (see Profile.jsx's uploadResume) — no setInterval/setTimeout
 * fake progression, and no error phase existed in the reference (added here). Mounted
 * on the app's existing Dialog/DialogContent primitive (focus trap, ESC, portal) rather
 * than the reference's own bespoke modal markup, so it behaves like every other modal
 * in this app; onInteractOutside/onEscapeKeyDown reproduce the reference's own rule
 * that only the X button dismisses mid-scan, while backdrop/ESC also work once
 * done/error. */
export function ResumeScanModal({ open, phase, stepIndex, extractedAt, errorDetail, onClose }) {
  const progressPct = phase === 'done' ? 100 : ((stepIndex + 1) / STEPS.length) * 100
  const ringColor = RING_COLOR[phase]
  const blockDismiss = (e) => {
    if (phase === 'scanning') e.preventDefault()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md" onInteractOutside={blockDismiss} onEscapeKeyDown={blockDismiss}>
        <div className="flex flex-col items-center px-2 pb-1 pt-1 text-center">
          <h3 className="text-base font-semibold text-slate-800">
            {phase === 'scanning' ? 'Scanning your resume...' : phase === 'done' ? 'Extraction completed' : 'Extraction failed'}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {phase === 'scanning'
              ? 'Please wait while we extract information from your document.'
              : phase === 'done'
                ? 'Review the highlighted fields below.'
                : "We couldn't automatically read this document. Please fill in your details manually."}
          </p>

          <div className="relative my-6 h-36 w-36">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="#e2e8f5" strokeWidth="4" />
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="none"
                stroke={ringColor}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 44}
                strokeDashoffset={2 * Math.PI * 44 * (1 - progressPct / 100)}
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              {phase === 'scanning' && (
                <div className="flex h-20 w-16 flex-col items-center justify-center gap-1 rounded-md border border-blue-200 bg-blue-50">
                  <FileText size={20} className="text-blue-600" strokeWidth={1.5} />
                  <span className="text-[9px] font-semibold text-blue-600">CV</span>
                </div>
              )}
              {phase === 'done' && <CheckCircle2 size={44} className="text-emerald-500" strokeWidth={1.5} />}
              {phase === 'error' && <AlertCircle size={44} className="text-rose-500" strokeWidth={1.5} />}
            </div>
          </div>

          {phase === 'scanning' && <p className="mb-5 text-sm font-medium text-slate-700">{STEPS[stepIndex].label}...</p>}

          <div className="mb-2 flex w-full max-w-[280px] items-center">
            {STEPS.map((step, i) => {
              const Icon = step.icon
              const state = phase === 'done' || (phase === 'scanning' && i < stepIndex) ? 'done' : phase === 'scanning' && i === stepIndex ? 'active' : 'pending'
              return (
                <div key={step.label} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                        state === 'pending' ? 'bg-slate-100 text-slate-400' : state === 'active' ? 'bg-blue-600 text-white' : 'bg-emerald-500 text-white'
                      }`}
                    >
                      <Icon size={16} />
                    </div>
                    <span className={`w-16 text-center text-[10px] leading-tight ${state === 'pending' ? 'text-slate-400' : 'text-slate-600'}`}>
                      {step.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && <div className={`mx-1 mb-4 h-px flex-1 ${state === 'done' ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
                </div>
              )
            })}
          </div>

          {phase === 'scanning' && (
            <p className="mt-4 text-center text-[11px] text-slate-400">This may take a few moments depending on the length of your resume.</p>
          )}
          {phase === 'done' && extractedAt && <p className="mt-4 text-[11px] text-slate-400">Extracted on {new Date(extractedAt).toLocaleString()}</p>}
          {phase === 'error' && errorDetail && <p className="mt-4 text-center text-[11px] text-rose-500">{errorDetail}</p>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
