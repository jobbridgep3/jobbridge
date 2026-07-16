import { DatePicker } from '../ui/DatePicker'
import { Input, Label, Select } from '../ui/Input'
import { RichTextEditor } from '../ui/RichTextEditor'
import { RoleCheckboxGroup } from '../ui/RoleCheckboxGroup'
import { TimePicker } from '../ui/TimePicker'
import { CATEGORIES, PRIORITIES } from '../../config/announcementMeta'

/** Create/edit form body for an announcement — title, rich body, category,
 * priority, audience, and publish timing. Banner/gallery/PDF uploads happen
 * separately per-row once the announcement exists (mirrors the JobFair
 * banner-upload pattern), not inside this form. */
export function AnnouncementForm({ form, setForm }) {
  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }))

  return (
    <div className="space-y-4">
      <div>
        <Label>Title</Label>
        <Input value={form.title} onChange={(e) => set('title')(e.target.value)} />
      </div>
      <div>
        <Label>Content</Label>
        <RichTextEditor value={form.body} onChange={set('body')} placeholder="Write the announcement…" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Category</Label>
          <Select value={form.category} onChange={(e) => set('category')(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Priority</Label>
          <Select value={form.priority} onChange={(e) => set('priority')(e.target.value)}>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <Label>Audience</Label>
        <RoleCheckboxGroup value={form.target_roles} onChange={set('target_roles')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Schedule Publish Date (optional)</Label>
          <DatePicker
            value={form.scheduled_date}
            onChange={(date) => setForm((f) => ({ ...f, scheduled_date: date }))}
            minDate={new Date().toISOString().slice(0, 10)}
          />
        </div>
        <div>
          <Label>Schedule Publish Time</Label>
          <TimePicker
            value={form.scheduled_time}
            onChange={(time) => setForm((f) => ({ ...f, scheduled_time: time }))}
            disabled={!form.scheduled_date}
          />
        </div>
      </div>
      <div>
        <Label>Expiration Date (optional)</Label>
        <DatePicker
          value={form.expires_date}
          onChange={(date) => set('expires_date')(date)}
          minDate={new Date().toISOString().slice(0, 10)}
        />
      </div>
    </div>
  )
}
