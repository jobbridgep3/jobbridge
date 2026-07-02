import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Download, Plus, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'

import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Input, Label } from '../../components/ui/Input'
import { PageHeader } from '../../components/ui/PageHeader'
import { CardSkeleton } from '../../components/ui/Skeleton'
import api from '../../lib/axios'
import { fadeIn } from '../../lib/motion'

export default function JobseekerProfile() {
  const queryClient = useQueryClient()
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => (await api.get('/api/profile')).data.data,
  })

  const [form, setForm] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile) setForm(profile)
  }, [profile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': [], 'application/pdf': [] },
    maxFiles: 1,
    onDrop: async (accepted) => {
      if (!accepted.length) return
      setUploading(true)
      const fd = new FormData()
      fd.append('file', accepted[0])
      try {
        const res = await api.post('/api/profile/resume', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        toast.success('Resume processed — profile auto-filled from OCR.')
        setForm(res.data.data)
        queryClient.invalidateQueries({ queryKey: ['profile'] })
      } catch {
        toast.error('Could not process resume.')
      } finally {
        setUploading(false)
      }
    },
  })

  const save = async () => {
    setSaving(true)
    try {
      await api.put('/api/profile', form)
      toast.success('Profile updated.')
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    } catch {
      toast.error('Could not save profile.')
    } finally {
      setSaving(false)
    }
  }

  const addSkill = (skill) => {
    if (!skill.trim()) return
    setForm((f) => ({ ...f, skills: [...new Set([...(f.skills || []), skill.trim()])] }))
  }
  const removeSkill = (skill) => setForm((f) => ({ ...f, skills: f.skills.filter((s) => s !== skill) }))

  const addWorkExperience = () =>
    setForm((f) => ({ ...f, work_experiences: [...(f.work_experiences || []), { company: '', position: '', start_date: '', end_date: '' }] }))
  const updateWorkExperience = (idx, field, value) =>
    setForm((f) => ({ ...f, work_experiences: f.work_experiences.map((w, i) => (i === idx ? { ...w, [field]: value } : w)) }))
  const removeWorkExperience = (idx) => setForm((f) => ({ ...f, work_experiences: f.work_experiences.filter((_, i) => i !== idx) }))

  const addEducation = () => setForm((f) => ({ ...f, educations: [...(f.educations || []), { school: '', degree: '', graduation_year: '' }] }))
  const updateEducation = (idx, field, value) =>
    setForm((f) => ({ ...f, educations: f.educations.map((e, i) => (i === idx ? { ...e, [field]: value } : e)) }))
  const removeEducation = (idx) => setForm((f) => ({ ...f, educations: f.educations.filter((_, i) => i !== idx) }))

  if (isLoading || !form) return <CardSkeleton />

  return (
    <motion.div {...fadeIn} className="space-y-6">
      <PageHeader
        title="My Profile"
        description={`Profile completion: ${form.profile_completion}% — a complete profile improves your AI match score.`}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => window.open(`${api.defaults.baseURL}/api/profile/resume-pdf`, '_blank')}>
              <Download className="h-4 w-4" /> Download Resume PDF
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Resume Upload</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              isDragActive ? 'border-primary-400 bg-primary-50' : 'border-slate-200 hover:border-primary-300'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="mb-2 h-6 w-6 text-slate-400" />
            <p className="text-sm text-slate-600">{uploading ? 'Processing with OCR…' : 'Drag & drop your resume, or click to browse'}</p>
            <p className="mt-1 text-xs text-slate-400">PDF or image — auto-extracts skills, name, and contact info</p>
          </div>
          {form.resume_url && (
            <a href={form.resume_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-primary-700 hover:underline">
              View uploaded resume
            </a>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Full Name</Label>
            <Input value={form.full_name || ''} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <Label>Contact Number</Label>
            <Input value={form.contact_number || ''} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} />
          </div>
          <div>
            <Label>Date of Birth</Label>
            <Input type="date" value={form.date_of_birth || ''} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label>Complete Address</Label>
            <Input value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Skills</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap gap-2">
            {(form.skills || []).map((skill) => (
              <Badge key={skill} variant="primary" className="gap-1">
                {skill}
                <button onClick={() => removeSkill(skill)} aria-label={`Remove ${skill}`}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {!form.skills?.length && <p className="text-sm text-slate-400">No skills added yet.</p>}
          </div>
          <SkillInput onAdd={addSkill} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Work Experience</CardTitle>
          <Button variant="secondary" size="sm" onClick={addWorkExperience}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {(form.work_experiences || []).map((w, idx) => (
            <div key={idx} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-100 p-3 sm:grid-cols-4">
              <Input placeholder="Company" value={w.company} onChange={(e) => updateWorkExperience(idx, 'company', e.target.value)} />
              <Input placeholder="Position" value={w.position} onChange={(e) => updateWorkExperience(idx, 'position', e.target.value)} />
              <Input type="date" value={w.start_date || ''} onChange={(e) => updateWorkExperience(idx, 'start_date', e.target.value)} />
              <div className="flex gap-2">
                <Input type="date" value={w.end_date || ''} onChange={(e) => updateWorkExperience(idx, 'end_date', e.target.value)} />
                <Button variant="ghost" size="icon" onClick={() => removeWorkExperience(idx)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
          {!form.work_experiences?.length && <p className="text-sm text-slate-400">No work experience added yet.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Educational Background</CardTitle>
          <Button variant="secondary" size="sm" onClick={addEducation}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {(form.educations || []).map((e, idx) => (
            <div key={idx} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-100 p-3 sm:grid-cols-3">
              <Input placeholder="School" value={e.school} onChange={(ev) => updateEducation(idx, 'school', ev.target.value)} />
              <Input placeholder="Degree" value={e.degree} onChange={(ev) => updateEducation(idx, 'degree', ev.target.value)} />
              <div className="flex gap-2">
                <Input
                  placeholder="Graduation Year"
                  value={e.graduation_year || ''}
                  onChange={(ev) => updateEducation(idx, 'graduation_year', ev.target.value)}
                />
                <Button variant="ghost" size="icon" onClick={() => removeEducation(idx)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
          {!form.educations?.length && <p className="text-sm text-slate-400">No education added yet.</p>}
        </CardContent>
      </Card>
    </motion.div>
  )
}

function SkillInput({ onAdd }) {
  const [value, setValue] = useState('')
  return (
    <div className="flex gap-2">
      <Input
        placeholder="Add a skill and press Enter"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onAdd(value)
            setValue('')
          }
        }}
      />
      <Button
        variant="secondary"
        onClick={() => {
          onAdd(value)
          setValue('')
        }}
      >
        Add
      </Button>
    </div>
  )
}
