import { Download } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { Button } from '../../../components/ui/Button'
import { downloadFile, parseBlobError } from '../../../lib/download'
import { toLmiParams } from './lmiFilters'

/** Exports the exact same filters currently applied on screen — both routes
 * call the identical backend aggregation functions the dashboard uses, so
 * the downloaded report can never disagree with what's displayed. */
export function LmiExportDialog({ filters }) {
  const [exporting, setExporting] = useState(null)

  const handleExport = async (format) => {
    setExporting(format)
    try {
      await downloadFile(`/api/staff/lmi/export/${format}`, {
        params: toLmiParams(filters),
        filename: `lmi_report.${format === 'excel' ? 'xlsx' : 'pdf'}`,
      })
      toast.success('Export downloaded.')
    } catch (err) {
      toast.error(await parseBlobError(err))
    } finally {
      setExporting(null)
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => handleExport('excel')} disabled={exporting !== null}>
        <Download className="h-4 w-4" /> {exporting === 'excel' ? 'Exporting…' : 'Excel'}
      </Button>
      <Button variant="secondary" size="sm" onClick={() => handleExport('pdf')} disabled={exporting !== null}>
        <Download className="h-4 w-4" /> {exporting === 'pdf' ? 'Exporting…' : 'PDF'}
      </Button>
    </>
  )
}
