import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { APPLICANT_DOCUMENT_TYPES } from './options'

export function RequiredDocumentsSection({ form, setForm }) {
  const toggle = (type) => {
    const current = form.required_applicant_documents || []
    setForm((f) => ({
      ...f,
      required_applicant_documents: current.includes(type) ? current.filter((t) => t !== type) : [...current, type],
    }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Required Documents</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-slate-500">Select which documents applicants must submit with their application.</p>
        <div className="flex flex-wrap gap-3">
          {APPLICANT_DOCUMENT_TYPES.map(({ type, label }) => (
            <label key={type} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:border-primary-300">
              <input
                type="checkbox" checked={(form.required_applicant_documents || []).includes(type)}
                onChange={() => toggle(type)} className="rounded border-slate-300 text-primary-600"
              />
              {label}
            </label>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
