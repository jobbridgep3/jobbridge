import { Plus, Trash2 } from 'lucide-react'

import { Button } from '../../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { Input, Select } from '../../../components/ui/Input'
import { RequiredLabel } from '../../../components/ui/RequiredLabel'
import { ATTAINMENT_LEVELS } from './options'

export function EducationSection({ form, setForm, missingKeys = new Set() }) {
  const addEducation = () =>
    setForm((f) => ({
      ...f,
      educations: [...(f.educations || []), { school: '', degree: '', graduation_year: '', attainment_level: '', honors: '' }],
    }))
  const updateEducation = (idx, field, value) =>
    setForm((f) => ({ ...f, educations: f.educations.map((e, i) => (i === idx ? { ...e, [field]: value } : e)) }))
  const removeEducation = (idx) => setForm((f) => ({ ...f, educations: f.educations.filter((_, i) => i !== idx) }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <RequiredLabel label="Educational Background" missing={missingKeys.has('educations')} />
        </CardTitle>
        <Button variant="secondary" size="sm" onClick={addEducation}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {missingKeys.has('educations') && (
          <p className="text-xs text-red-600">Add at least one entry with a School Name and Highest Attainment selected.</p>
        )}
        {(form.educations || []).map((e, idx) => (
          <div key={idx} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-100 p-3 sm:grid-cols-2 lg:grid-cols-5">
            <Input placeholder="School Name" value={e.school} onChange={(ev) => updateEducation(idx, 'school', ev.target.value)} />
            <Select value={e.attainment_level || ''} onChange={(ev) => updateEducation(idx, 'attainment_level', ev.target.value)}>
              <option value="">Highest Attainment…</option>
              {ATTAINMENT_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>{lvl}</option>
              ))}
            </Select>
            <Input
              placeholder="Course/Program (N/A if not applicable)"
              value={e.degree || ''}
              onChange={(ev) => updateEducation(idx, 'degree', ev.target.value)}
            />
            <Input
              placeholder="Year Graduated"
              value={e.graduation_year || ''}
              onChange={(ev) => updateEducation(idx, 'graduation_year', ev.target.value)}
            />
            <div className="flex gap-2">
              <Input placeholder="Honors (optional)" value={e.honors || ''} onChange={(ev) => updateEducation(idx, 'honors', ev.target.value)} />
              <Button variant="ghost" size="icon" onClick={() => removeEducation(idx)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          </div>
        ))}
        {!form.educations?.length && <p className="text-sm text-slate-400">No education added yet.</p>}
      </CardContent>
    </Card>
  )
}
