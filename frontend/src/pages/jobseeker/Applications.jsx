import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ClipboardList, Download, X } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'

import { Button } from '../../components/ui/Button'
import { Card, CardContent } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useSocket } from '../../hooks/useSocket'
import api from '../../lib/axios'
import { fadeIn, staggerContainer, staggerItem } from '../../lib/motion'

export default function JobseekerApplications() {
  const queryClient = useQueryClient()
  const [cancelTarget, setCancelTarget] = useState(null)

  const { data: applications, isLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: async () => (await api.get('/api/applications')).data.data,
  })

  useSocket({
    'application:status_update': () => queryClient.invalidateQueries({ queryKey: ['applications'] }),
    'referral:ready': () => queryClient.invalidateQueries({ queryKey: ['applications'] }),
  })

  const cancelApplication = async () => {
    try {
      await api.delete(`/api/applications/${cancelTarget}`)
      toast.success('Application cancelled.')
      queryClient.invalidateQueries({ queryKey: ['applications'] })
    } catch {
      toast.error('Could not cancel application.')
    } finally {
      setCancelTarget(null)
    }
  }

  return (
    <motion.div {...fadeIn} className="space-y-4">
      <PageHeader title="My Applications" description="Track the status of every job you've applied to, updated in real time." />

      {isLoading ? (
        <CardSkeleton />
      ) : !applications?.length ? (
        <EmptyState
          icon={ClipboardList}
          title="No applications yet"
          description="Browse jobs and apply to start tracking your applications here."
          actionLabel="Search Jobs"
          onAction={() => (window.location.href = '/jobseeker/jobs')}
        />
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-3">
          {applications.map((app) => (
            <motion.div key={app.id} variants={staggerItem}>
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{app.job_title}</p>
                    <p className="text-xs text-slate-500">{app.company_name}</p>
                    {app.feedback_note && <p className="mt-1 text-xs text-slate-500 italic">"{app.feedback_note}"</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={app.status} />
                    {app.status === 'interview_scheduled' && (
                      <Button size="sm" variant="secondary" asChild>
                        <Link to="/jobseeker/interviews">View Interview</Link>
                      </Button>
                    )}
                    {app.has_referral_letter && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          const res = await api.get(`/api/referral-letter/${app.id}`)
                          window.open(res.data.data.pdf_url, '_blank')
                        }}
                      >
                        <Download className="h-3.5 w-3.5" /> Referral Letter
                      </Button>
                    )}
                    {(app.status === 'applied' || app.status === 'under_review') && (
                      <Button size="sm" variant="ghost" onClick={() => setCancelTarget(app.id)}>
                        <X className="h-3.5 w-3.5" /> Cancel
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title="Cancel this application?"
        description="This action cannot be undone."
        confirmLabel="Cancel Application"
        danger
        onConfirm={cancelApplication}
      />
    </motion.div>
  )
}
