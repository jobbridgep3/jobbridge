import { X } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '../../../components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { RequiredLabel } from '../../../components/ui/RequiredLabel'

const GROUPS = [
  { field: 'technical_skills', label: 'Technical Skills', requiredKey: 'technical_skills' },
  { field: 'soft_skills', label: 'Soft Skills', requiredKey: 'soft_skills' },
  { field: 'languages_spoken', label: 'Languages Spoken' },
  { field: 'certifications', label: 'Certifications (TESDA, NC II, etc.)' },
]

export function SkillsSection({ form, setForm, missingKeys = new Set() }) {
  const addItem = (field, value) => {
    if (!value.trim()) return
    setForm((f) => ({ ...f, [field]: [...new Set([...(f[field] || []), value.trim()])] }))
  }
  const removeItem = (field, value) => setForm((f) => ({ ...f, [field]: f[field].filter((s) => s !== value) }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Skills</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {GROUPS.map(({ field, label, requiredKey }) => (
          <div key={field}>
            <p className="mb-2 text-sm font-medium text-slate-700">
              <RequiredLabel label={label} missing={requiredKey ? missingKeys.has(requiredKey) : false} />
            </p>
            <div className="mb-3 flex flex-wrap gap-2">
              {(form[field] || []).map((item) => (
                <Badge key={item} variant="primary" className="gap-1">
                  {item}
                  <button onClick={() => removeItem(field, item)} aria-label={`Remove ${item}`}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {!form[field]?.length && <p className="text-sm text-slate-400">None added yet.</p>}
            </div>
            <ChipInput onAdd={(value) => addItem(field, value)} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ChipInput({ onAdd }) {
  const [value, setValue] = useState('')
  const submit = () => {
    onAdd(value)
    setValue('')
  }
  return (
    <div className="flex gap-2">
      <Input
        placeholder="Type and press Enter"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            submit()
          }
        }}
      />
      <Button variant="secondary" onClick={submit}>
        Add
      </Button>
    </div>
  )
}
