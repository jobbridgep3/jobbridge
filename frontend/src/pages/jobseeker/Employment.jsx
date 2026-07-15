import { useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { Briefcase, ChevronDown, FileDown } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { downloadFile, parseBlobError } from '../../lib/download'
import { fadeIn, staggerContainer, staggerItem } from '../../lib/motion'
import { cn } from '../../lib/utils'

function InfoCell({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value}</p>
    </div>
  )
}

function EmploymentTimeline({ events }) {
  if (!events?.length) return null
  return (
    <ol className="relative ml-2 mt-3 space-y-3 border-l border-slate-200 pl-5">
      {events.map((event, i) => {
        const isLast = i === events.length - 1
        return (
          <li key={event.id || i} className="relative">
            <span
              className={`absolute -left-[26.5px] top-1 h-3 w-3 rounded-full border-2 ${
                isLast ? 'border-primary-600 bg-primary-600' : 'border-slate-300 bg-white'
              }`}
            />
            <p className={`text-sm font-medium ${isLast ? 'text-primary-700' : 'text-slate-700'}`}>{event.to_status_label}</p>
            <p className="text-xs text-slate-500">{event.created_at ? dayjs(event.created_at).format('MMM D, YYYY h:mm A') : ''}</p>
            {event.note && <p className="mt-0.5 text-xs italic text-slate-500">"{event.note}"</p>}
          </li>
        )
      })}
    </ol>
  )
}

export default function JobseekerEmployment() {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(null)
  const [exporting, setExporting] = useState(false)

  const { data: records, isLoading } = useQuery({
    queryKey: ['employment', 'my'],
    queryFn: async () => (await api.get('/api/employment/my')).data.data,
  })

  useSocket({ 'employment:updated': () => queryClient.invalidateQueries({ queryKey: ['employment', 'my'] }) })

  const exportPdf = async () => {
    setExporting(true)
    try {
      await downloadFile('/api/employment/my/export/pdf', { filename: 'employment-history.pdf' })
    } catch (err) {
      toast.error(await parseBlobError(err))
    } finally {
      setExporting(false)
    }
  }

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader
        title="Employment Monitoring"
        description="Your current and past employment records — updated by your employer and PESO Staff."
        actions={
          records?.length ? (
            <Button variant="secondary" size="sm" onClick={exportPdf} disabled={exporting}>
              <FileDown className="h-4 w-4" /> {exporting ? 'Exporting…' : 'Export PDF'}
            </Button>
          ) : null
        }
      />

      {isLoading ? (
        <CardSkeleton />
      ) : !records?.length ? (
        <EmptyState icon={Briefcase} title="No employment records yet" description="Once you're hired for a job, your employment record will appear here." />
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-3">
          {records.map((r) => (
            <motion.div key={r.id} variants={staggerItem}>
              <Card>
                <CardContent>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{r.position}</p>
                      <p className="text-xs text-slate-500">{r.employer_name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={r.status} label={r.status_label} />
                      <button
                        type="button"
                        onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                        className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
                        aria-label="Toggle details"
                      >
                        <ChevronDown className={cn('h-4 w-4 transition-transform', expanded === r.id && 'rotate-180')} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-3 lg:grid-cols-6">
                    <InfoCell label="Employment Type" value={(r.employment_type || '—').replace(/_/g, ' ')} />
                    <InfoCell label="Work Arrangement" value={(r.work_arrangement || '—').replace(/_/g, ' ')} />
                    <InfoCell label="Salary" value={r.salary != null ? `PHP ${Number(r.salary).toLocaleString()}` : '—'} />
                    <InfoCell label="Start Date" value={r.start_date ? dayjs(r.start_date).format('MMM D, YYYY') : '—'} />
                    <InfoCell label="End Date" value={r.end_date ? dayjs(r.end_date).format('MMM D, YYYY') : 'Present'} />
                    <InfoCell label="Source" value={r.is_walk_in ? 'Walk-in placement' : 'JobBridge application'} />
                  </div>

                  {expanded === r.id && (
                    <div className="mt-2">
                      <h4 className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Employment Timeline</h4>
                      <EmploymentTimeline events={r.timeline} />
                      {r.termination_reason && (
                        <p className="mt-2 text-xs text-red-600">
                          <b>Reason:</b> {r.termination_reason}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  )
}
