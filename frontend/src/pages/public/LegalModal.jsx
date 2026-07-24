import { useState } from 'react'

import { Dialog, DialogContent } from '../../components/ui/Dialog'
import { PRIVACY_SECTIONS, TERMS_SECTIONS } from '../../config/legalContent'

const SECTIONS = {
  terms: 'Terms and Conditions',
  privacy: 'Privacy Policy',
}

/** Modal showing both legal documents; `initialSection` decides which tab opens first. */
export function LegalModal({ open, onOpenChange, initialSection = 'terms' }) {
  const [section, setSection] = useState(initialSection)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setSection(initialSection)
        onOpenChange(next)
      }}
    >
      <DialogContent title="JobBridge — PESO Pila, Laguna" className="max-w-2xl">
        <div className="mb-4 flex gap-2 border-b border-slate-200">
          {Object.entries(SECTIONS).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSection(key)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                section === key ? 'border-primary-700 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1 text-sm leading-relaxed text-slate-700">
          {section === 'terms' ? <TermsContent /> : <PrivacyContent />}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TermsContent() {
  return (
    <>
      {TERMS_SECTIONS.map((s) => (
        <div key={s.heading}>
          <h3 className="font-semibold text-slate-900">{s.heading}</h3>
          <p>{s.body}</p>
        </div>
      ))}
    </>
  )
}

function PrivacyContent() {
  return (
    <>
      {PRIVACY_SECTIONS.map((s) => (
        <div key={s.heading}>
          <h3 className="font-semibold text-slate-900">{s.heading}</h3>
          <p>{s.body}</p>
        </div>
      ))}
    </>
  )
}
