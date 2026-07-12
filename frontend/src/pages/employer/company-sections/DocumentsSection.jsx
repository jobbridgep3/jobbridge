import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { DocumentUploadSlot } from '../../../components/ui/DocumentUploadSlot'
import { COMPANY_DOCUMENT_TYPES } from './options'

export function DocumentsSection({ form, onUploadDocument, onDeleteDocument, uploadingDocType }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Required Documents</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          Business Permit, SEC/DTI/CDA Certificate, and BIR Registration are mandatory before your company can be
          submitted for PESO/Admin accreditation. Company Logo is uploaded in Basic Information above.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {COMPANY_DOCUMENT_TYPES.map(({ type, label, required }) => {
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
      </CardContent>
    </Card>
  )
}
