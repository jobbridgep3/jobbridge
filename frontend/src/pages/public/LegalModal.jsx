import { useState } from 'react'

import { Dialog, DialogContent } from '../../components/ui/Dialog'

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
      <h3 className="font-semibold text-slate-900">1. Acceptance of Terms</h3>
      <p>
        By creating a JobBridge account, you agree to use this platform only for its intended purpose: connecting
        jobseekers, employers, and the Public Employment Service Office (PESO) of Pila, Laguna, in accordance with
        applicable Philippine labor and data privacy laws.
      </p>
      <h3 className="font-semibold text-slate-900">2. Account Responsibility</h3>
      <p>
        You are responsible for the accuracy of the information you submit and for keeping your account credentials
        confidential. PESO Pila staff may verify submitted information and may deactivate accounts found to contain
        false or fraudulent details.
      </p>
      <h3 className="font-semibold text-slate-900">3. Acceptable Use</h3>
      <p>
        Jobseekers and employers agree not to use JobBridge to post misleading job listings, discriminate unlawfully
        in hiring, harvest other users' contact details for unrelated purposes, or otherwise misuse the platform.
      </p>
      <h3 className="font-semibold text-slate-900">4. Service Availability</h3>
      <p>
        JobBridge is provided as a public employment-facilitation service. PESO Pila may modify, suspend, or
        discontinue features at any time to maintain service quality or comply with government policy.
      </p>
      <h3 className="font-semibold text-slate-900">5. Changes to These Terms</h3>
      <p>
        These Terms may be updated periodically. Continued use of JobBridge after an update constitutes acceptance of
        the revised Terms.
      </p>
    </>
  )
}

function PrivacyContent() {
  return (
    <>
      <h3 className="font-semibold text-slate-900">1. Information We Collect</h3>
      <p>
        We collect the information you provide during registration and profile completion — such as your name,
        contact details, resume, and employment history — to operate the JobBridge matching service.
      </p>
      <h3 className="font-semibold text-slate-900">2. How We Use Your Information</h3>
      <p>
        Your information is used to create and verify your account, match jobseekers with relevant job postings,
        facilitate communication between jobseekers and employers, and generate anonymized labor market statistics
        for PESO Pila.
      </p>
      <h3 className="font-semibold text-slate-900">3. Data Sharing</h3>
      <p>
        Your profile is shared with employers only as necessary to facilitate job applications and interviews. We do
        not sell your personal information to third parties.
      </p>
      <h3 className="font-semibold text-slate-900">4. Data Protection</h3>
      <p>
        We apply reasonable technical and organizational safeguards to protect your data, consistent with the Data
        Privacy Act of 2012 (Republic Act No. 10173).
      </p>
      <h3 className="font-semibold text-slate-900">5. Your Rights</h3>
      <p>
        You may request access to, correction of, or deletion of your personal data by contacting PESO Pila directly.
        You may also deactivate your account at any time from your account settings.
      </p>
    </>
  )
}
