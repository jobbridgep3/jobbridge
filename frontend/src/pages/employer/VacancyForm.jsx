import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useNavigate, useParams } from 'react-router-dom'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Input, Label, Select, Textarea } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

const EMPTY_FORM = {
  title: '', description: '', requirements: '', skills_required: '',
  salary_min: '', salary_max: '', job_type: 'full-time', industry: '', num_slots: 1, work_location: '',
}

export default function EmployerVacancyForm() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const { data: vacancy, isLoading } = useQuery({
    queryKey: ['vacancies', id],
    queryFn: async () => (await api.get(`/api/vacancies/my`)).data.data.find((v) => v.id === id),
    enabled: isEdit,
  })
  const { data: matches } = useQuery({
    queryKey: ['vacancies', id, 'matches'],
    queryFn: async () => (await api.get(`/api/vacancies/${id}/matched-jobseekers`)).data.data,
    enabled: isEdit && vacancy?.status === 'active',
  })

  useEffect(() => {
    if (vacancy) setForm(vacancy)
  }, [vacancy])

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (isEdit) {
        await api.put(`/api/vacancies/${id}`, form)
        toast.success('Vacancy updated.')
      } else {
        await api.post('/api/vacancies', form)
        toast.success('Vacancy submitted for PESO Staff approval.')
      }
      queryClient.invalidateQueries({ queryKey: ['vacancies', 'my'] })
      navigate('/employer/vacancies')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save vacancy.')
    } finally {
      setSaving(false)
    }
  }

  if (isEdit && isLoading) return <CardSkeleton />

  return (
    <motion.div {...fadeIn} className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={isEdit ? 'Edit Vacancy' : 'Post New Vacancy'} />
      <Card>
        <CardContent>
          <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Job Title</Label>
              <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Job Description</Label>
              <Textarea rows={4} required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Requirements</Label>
              <Textarea rows={3} value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Required Skills (comma-separated — used for AI matching)</Label>
              <Input value={form.skills_required || ''} onChange={(e) => setForm({ ...form, skills_required: e.target.value })} />
            </div>
            <div>
              <Label>Salary Min</Label>
              <Input type="number" value={form.salary_min || ''} onChange={(e) => setForm({ ...form, salary_min: e.target.value })} />
            </div>
            <div>
              <Label>Salary Max</Label>
              <Input type="number" value={form.salary_max || ''} onChange={(e) => setForm({ ...form, salary_max: e.target.value })} />
            </div>
            <div>
              <Label>Job Type</Label>
              <Select value={form.job_type} onChange={(e) => setForm({ ...form, job_type: e.target.value })}>
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contractual">Contractual</option>
              </Select>
            </div>
            <div>
              <Label>Industry</Label>
              <Input value={form.industry || ''} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
            </div>
            <div>
              <Label>Number of Slots</Label>
              <Input type="number" min={1} value={form.num_slots} onChange={(e) => setForm({ ...form, num_slots: e.target.value })} />
            </div>
            <div>
              <Label>Work Location</Label>
              <Input value={form.work_location || ''} onChange={(e) => setForm({ ...form, work_location: e.target.value })} />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button type="button" variant="secondary" onClick={() => navigate('/employer/vacancies')}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Submit for Approval'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {isEdit && matches?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary-600" /> AI-Suggested Matched Jobseekers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {matches.map((m) => (
              <div key={m.profile.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                <span className="text-sm text-slate-800">{m.profile.full_name}</span>
                <Badge variant="primary">{m.match_score}% Match</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </motion.div>
  )
}
