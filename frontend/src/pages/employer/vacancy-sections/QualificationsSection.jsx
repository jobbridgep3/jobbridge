import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

import { Button } from '../../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { Input, Label, Select } from '../../../components/ui/Input'
import { RequiredLabel } from '../../../components/ui/RequiredLabel'
import api from '../../../lib/axios'
import { EDUCATION_LEVELS } from './options'

function ChipInput({ label, values, onChange, placeholder }) {
  const [input, setInput] = useState('')

  const add = () => {
    const v = input.trim()
    if (!v || values.includes(v)) return
    onChange([...values, v])
    setInput('')
  }

  return (
    <div>
      <Label>{label}</Label>
      <div className="mb-2 flex flex-wrap gap-2">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="text-slate-400 hover:text-red-500">×</button>
          </span>
        ))}
      </div>
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        placeholder={placeholder}
      />
    </div>
  )
}

export function QualificationsSection({ form, setForm, missingKeys = new Set() }) {
  const [suggesting, setSuggesting] = useState(false)
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const suggestSkills = async () => {
    setSuggesting(true)
    try {
      const res = await api.post('/api/vacancies/suggest-skills', {
        description: form.description, summary: form.summary, responsibilities: form.responsibilities,
      })
      const suggested = res.data.data.suggested_skills || []
      if (!suggested.length) {
        toast('No additional skills detected from the description.', { icon: 'ℹ️' })
        return
      }
      const merged = [...new Set([...(form.required_skills || []), ...suggested])]
      setForm((f) => ({ ...f, required_skills: merged }))
      toast.success(`Added ${suggested.length} suggested skill(s).`)
    } catch {
      toast.error('Could not generate skill suggestions.')
    } finally {
      setSuggesting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Qualifications</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label>Education Level</Label>
          <Select value={form.education_level || ''} onChange={set('education_level')}>
            <option value="">Select…</option>
            {EDUCATION_LEVELS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Course</Label>
          <Input value={form.course || ''} onChange={set('course')} />
        </div>
        <div>
          <Label>Minimum Years of Experience</Label>
          <Input type="number" min={0} value={form.min_experience_years ?? ''} onChange={set('min_experience_years')} />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox" checked={form.fresh_grad_ok || false}
              onChange={(e) => setForm((f) => ({ ...f, fresh_grad_ok: e.target.checked }))}
              className="rounded border-slate-300 text-primary-600"
            />
            Fresh Graduates OK
          </label>
        </div>
        <div className="sm:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <RequiredLabel label="Skills" missing={missingKeys.has('required_skills')} />
            <Button type="button" size="sm" variant="secondary" onClick={suggestSkills} disabled={suggesting}>
              <Sparkles className="h-3.5 w-3.5" /> {suggesting ? 'Suggesting…' : 'AI Skill Suggestions'}
            </Button>
          </div>
          <ChipInput
            label="" values={form.required_skills || []}
            onChange={(v) => setForm((f) => ({ ...f, required_skills: v }))}
            placeholder="Type a skill and press Enter…"
          />
        </div>
        <div className="sm:col-span-2">
          <ChipInput
            label="Certifications" values={form.required_certifications || []}
            onChange={(v) => setForm((f) => ({ ...f, required_certifications: v }))}
            placeholder="Type a certification and press Enter…"
          />
        </div>
      </CardContent>
    </Card>
  )
}
