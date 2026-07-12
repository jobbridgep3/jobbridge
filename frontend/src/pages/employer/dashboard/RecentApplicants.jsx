import { useQuery } from '@tanstack/react-query'
import { Eye, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { EmptyState } from '../../../components/ui/EmptyState'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import api from '../../../lib/axios'

export function RecentApplicants() {
  const { data: applicants } = useQuery({
    queryKey: ['employer', 'dashboard', 'recent-applicants'],
    queryFn: async () => (await api.get('/api/employer/dashboard/recent-applicants')).data.data,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary-600" /> Recent Applicants
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {!applicants?.length ? (
          <div className="p-6"><EmptyState title="No applicants yet" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Applicant</th>
                  <th className="px-4 py-2 font-medium">Vacancy</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Applied</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applicants.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-800">{a.jobseeker_name}</td>
                    <td className="px-4 py-2 text-slate-600">{a.job_title}</td>
                    <td className="px-4 py-2"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-2 text-slate-500">{new Date(a.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2 text-right">
                      <Link to={`/employer/applicants/${a.id}`} className="inline-flex items-center gap-1 text-primary-700 hover:underline">
                        <Eye className="h-3.5 w-3.5" /> View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
