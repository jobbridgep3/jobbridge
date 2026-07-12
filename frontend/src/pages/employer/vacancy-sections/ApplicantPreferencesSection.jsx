import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { Input, Label, Select } from '../../../components/ui/Input'
import { COMMON_LANGUAGES, PREF_CIVIL_STATUSES, PREF_GENDERS } from './options'

const CHECKBOXES = [
  { key: 'fresh_grad_friendly', label: 'Fresh Graduate Friendly' },
  { key: 'pwd_friendly', label: 'PWD Friendly' },
  { key: 'senior_citizen_friendly', label: 'Senior Citizen Friendly' },
  { key: 'ofw_friendly', label: 'OFW Friendly' },
]

export function ApplicantPreferencesSection({ form, setForm }) {
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const toggleLanguage = (lang) => {
    const current = form.pref_languages || []
    setForm((f) => ({
      ...f,
      pref_languages: current.includes(lang) ? current.filter((l) => l !== lang) : [...current, lang],
    }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Applicant Preferences (Optional)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Age Min</Label>
            <Input type="number" min={15} value={form.pref_age_min ?? ''} onChange={set('pref_age_min')} />
          </div>
          <div>
            <Label>Age Max</Label>
            <Input type="number" min={15} value={form.pref_age_max ?? ''} onChange={set('pref_age_max')} />
          </div>
          <div>
            <Label>Gender</Label>
            <Select value={form.pref_gender || ''} onChange={set('pref_gender')}>
              <option value="">No preference</option>
              {PREF_GENDERS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Civil Status</Label>
            <Select value={form.pref_civil_status || ''} onChange={set('pref_civil_status')}>
              <option value="">No preference</option>
              {PREF_CIVIL_STATUSES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label>Preferred Languages</Label>
          <div className="flex flex-wrap gap-3">
            {COMMON_LANGUAGES.map((l) => (
              <label key={l} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:border-primary-300">
                <input type="checkbox" checked={(form.pref_languages || []).includes(l)} onChange={() => toggleLanguage(l)} className="rounded border-slate-300 text-primary-600" />
                {l}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          {CHECKBOXES.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox" checked={form[key] || false}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
                className="rounded border-slate-300 text-primary-600"
              />
              {label}
            </label>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
