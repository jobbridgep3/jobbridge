import { Download } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { Button } from '../../../components/ui/Button'
import { Dialog, DialogContent } from '../../../components/ui/Dialog'
import { Input, Label, Select } from '../../../components/ui/Input'
import { downloadFile, parseBlobError } from '../../../lib/download'

const EMPTY_FILTERS = { date_from: '', date_to: '', scope: 'both' }

/** Shared Admin/Staff dashboard export dialog — entire dashboard, a filtered
 * subset (scope), or a selected date range, exported as Excel or PDF. */
export function DashboardExportDialog({ apiBase = '/api/admin' }) {
  const [open, setOpen] = useState(false)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [exporting, setExporting] = useState(null)

  const setFilter = (field) => (e) => setFilters((f) => ({ ...f, [field]: e.target.value }))

  const handleExport = async (format) => {
    setExporting(format)
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''))
      await downloadFile(`${apiBase}/dashboard/export/${format}`, {
        params,
        filename: `dashboard_report.${format === 'excel' ? 'xlsx' : 'pdf'}`,
      })
      toast.success('Export downloaded.')
      setOpen(false)
    } catch (err) {
      toast.error(await parseBlobError(err))
    } finally {
      setExporting(null)
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Download className="h-4 w-4" /> Export Dashboard
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Export Dashboard" description="Optionally scope and date-filter the export. Leave blank for the entire dashboard.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Date From</Label>
              <Input type="date" value={filters.date_from} onChange={setFilter('date_from')} />
            </div>
            <div>
              <Label>Date To</Label>
              <Input type="date" value={filters.date_to} onChange={setFilter('date_to')} />
            </div>
            <div className="sm:col-span-2">
              <Label>Scope</Label>
              <Select value={filters.scope} onChange={setFilter('scope')}>
                <option value="both">Entire Dashboard (Summary + Analytics)</option>
                <option value="summary">Summary Only</option>
                <option value="analytics">Analytics Only</option>
              </Select>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setFilters(EMPTY_FILTERS)} disabled={exporting !== null}>
              Clear Filters
            </Button>
            <Button variant="secondary" size="sm" onClick={() => handleExport('excel')} disabled={exporting !== null}>
              {exporting === 'excel' ? 'Exporting…' : 'Export to Excel'}
            </Button>
            <Button size="sm" onClick={() => handleExport('pdf')} disabled={exporting !== null}>
              {exporting === 'pdf' ? 'Exporting…' : 'Export to PDF'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
