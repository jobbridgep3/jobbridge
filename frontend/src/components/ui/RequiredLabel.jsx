import { AlertCircle } from 'lucide-react'

/** Wraps a field/section label with a red "Required" cue when the field is still
 * missing — extends the same required/optional convention DocumentUploadSlot
 * already uses for documents, to the rest of the profile form. */
export function RequiredLabel({ label, missing }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {label}
      {missing && (
        <span className="inline-flex items-center gap-0.5 text-xs font-medium text-red-600">
          <AlertCircle className="h-3 w-3" /> Required
        </span>
      )}
    </span>
  )
}
