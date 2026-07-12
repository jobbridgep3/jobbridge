import { FileText, RefreshCw, Trash2, Upload } from 'lucide-react'
import { useDropzone } from 'react-dropzone'

import { Badge } from './Badge'
import { StatusBadge } from './StatusBadge'

/** Generic document slot used by jobseeker docs, and (status/onReplace/rejectionReason
 * added on top) by Company/HR document review workflows. Existing jobseeker call
 * sites never pass status/onReplace/rejectionReason, so their rendering is unchanged. */
export function DocumentUploadSlot({
  label, required, documents = [], multiple = false, onUpload, onDelete, onReplace, uploading,
  status, rejectionReason,
}) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': [], 'application/pdf': [] },
    maxFiles: 1,
    disabled: uploading,
    onDrop: (accepted) => {
      if (accepted.length) onUpload(accepted[0])
    },
  })

  const canAddMore = multiple || documents.length === 0

  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-800">{label}</span>
        <div className="flex items-center gap-2">
          {status && <StatusBadge status={status} />}
          <Badge variant={required ? 'danger' : 'default'}>{required ? 'Required' : 'Optional'}</Badge>
        </div>
      </div>

      {status === 'rejected' && rejectionReason && (
        <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">Rejected: {rejectionReason}</p>
      )}

      {documents.map((doc) => (
        <div key={doc.id} className="mb-2 flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
          <a href={doc.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-primary-700 hover:underline">
            <FileText className="h-4 w-4" />
            {doc.original_filename || 'View file'}
          </a>
          <div className="flex items-center gap-2">
            {onReplace && (
              <label className="cursor-pointer text-slate-400 hover:text-primary-600" aria-label={`Replace ${label}`}>
                <RefreshCw className="h-4 w-4" />
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) onReplace(file)
                    e.target.value = ''
                  }}
                />
              </label>
            )}
            {onDelete && (
              <button onClick={() => onDelete(doc.id)} aria-label={`Remove ${label}`}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </button>
            )}
          </div>
        </div>
      ))}

      {canAddMore && (
        <div
          {...getRootProps()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
            isDragActive ? 'border-primary-400 bg-primary-50' : 'border-slate-200 hover:border-primary-300'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="mb-1 h-5 w-5 text-slate-400" />
          <p className="text-xs text-slate-500">
            {uploading ? 'Uploading…' : documents.length ? 'Add another file' : 'Drag & drop, or click to browse'}
          </p>
        </div>
      )}
    </div>
  )
}
