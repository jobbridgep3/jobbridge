import api from './axios'

/** Downloads a file from an authenticated API endpoint. JWT auth in this app is
 * header-only (see backend config.py's JWT_TOKEN_LOCATION), so a plain window.open()/
 * anchor navigation can't carry the token — this fetches via axios (whose interceptor
 * attaches the bearer token regardless of responseType) as a blob, then triggers a
 * save via a temporary object URL.
 */
export async function downloadFile(url, { params, filename } = {}) {
  const res = await api.get(url, { params, responseType: 'blob' })
  const blobUrl = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename || 'download'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(blobUrl)
}

/** Extracts a readable message from a failed blob-typed request — a JSON error body
 * arrives as a Blob (not parsed JSON) when responseType was 'blob', so the usual
 * `err.response?.data?.message` pattern doesn't work here.
 */
export async function parseBlobError(err) {
  const blob = err?.response?.data
  if (blob instanceof Blob) {
    try {
      const parsed = JSON.parse(await blob.text())
      return parsed.message || 'Download failed.'
    } catch {
      return 'Download failed.'
    }
  }
  return err?.response?.data?.message || 'Download failed.'
}
