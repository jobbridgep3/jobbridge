import { CharacterCounter } from '../../../components/ui/CharacterCounter'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { Label } from '../../../components/ui/Input'
import { RichTextEditor } from '../../../components/ui/RichTextEditor'
import { RequiredLabel } from '../../../components/ui/RequiredLabel'

const stripHtml = (html) => (html || '').replace(/<[^>]*>/g, '')

export function DescriptionSection({ form, setForm, missingKeys = new Set() }) {
  const set = (field) => (html) => setForm((f) => ({ ...f, [field]: html }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Description</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label><RequiredLabel label="Summary" missing={missingKeys.has('summary')} /></Label>
          <RichTextEditor value={form.summary} onChange={set('summary')} placeholder="Brief overview of the role…" />
          <CharacterCounter count={stripHtml(form.summary).length} max={500} />
        </div>
        <div>
          <Label>Responsibilities</Label>
          <RichTextEditor value={form.responsibilities} onChange={set('responsibilities')} placeholder="Key responsibilities…" />
          <CharacterCounter count={stripHtml(form.responsibilities).length} max={2000} />
        </div>
        <div>
          <Label>Daily Tasks</Label>
          <RichTextEditor value={form.daily_tasks} onChange={set('daily_tasks')} placeholder="Typical day-to-day tasks…" />
          <CharacterCounter count={stripHtml(form.daily_tasks).length} max={2000} />
        </div>
      </CardContent>
    </Card>
  )
}
