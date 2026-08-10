import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { DocumentUploadSlot } from '../../../components/ui/DocumentUploadSlot'
import { DOCUMENT_TYPES } from './options'

export function DocumentsSection({ form, onUploadDocument, onDeleteDocument, uploadingDocType }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          Please upload clear, readable, and high-quality PDF or image files. Blurry, cropped, or unreadable documents may
          delay or prevent account verification.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {DOCUMENT_TYPES.map(({ type, label, required, multiple }) => (
            <DocumentUploadSlot
              key={type}
              label={label}
              required={required}
              multiple={multiple}
              documents={(form.documents || []).filter((d) => d.document_type === type)}
              uploading={uploadingDocType === type}
              onUpload={(file) => onUploadDocument(type, file)}
              onDelete={(id) => onDeleteDocument(id)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
