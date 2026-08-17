import { CollapsibleCard } from '../../../components/ui/CollapsibleCard'
import { DocumentUploadSlot } from '../../../components/ui/DocumentUploadSlot'
import { HR_DOCUMENT_TYPES } from './options'

export function DocumentsSection({ form, onUploadDocument, onDeleteDocument, uploadingDocType, open, onToggle }) {
  return (
    <CollapsibleCard title="Documents" open={open} onToggle={onToggle} contentClassName="space-y-4">
        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          Government ID, Company ID, and Authorization Letter are mandatory.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {HR_DOCUMENT_TYPES.map(({ type, label, required }) => {
            const doc = (form.documents || []).find((d) => d.document_type === type)
            return (
              <DocumentUploadSlot
                key={type}
                label={label}
                required={required}
                documents={doc ? [doc] : []}
                uploading={uploadingDocType === type}
                status={doc?.status}
                rejectionReason={doc?.rejection_reason}
                onUpload={(file) => onUploadDocument(type, file)}
                onReplace={(file) => onUploadDocument(type, file)}
                onDelete={() => onDeleteDocument(doc.id)}
              />
            )
          })}
        </div>
    </CollapsibleCard>
  )
}
