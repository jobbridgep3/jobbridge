import { CollapsibleCard } from '../../../components/ui/CollapsibleCard'
import { Input, Label } from '../../../components/ui/Input'

export function SocialMediaSection({ form, setForm, open, onToggle }) {
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  return (
    <CollapsibleCard title="Social Media" open={open} onToggle={onToggle} contentClassName="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label>Facebook</Label>
          <Input value={form.facebook_url || ''} onChange={set('facebook_url')} placeholder="https://facebook.com/…" />
        </div>
        <div>
          <Label>LinkedIn</Label>
          <Input value={form.linkedin_url || ''} onChange={set('linkedin_url')} placeholder="https://linkedin.com/company/…" />
        </div>
        <div>
          <Label>Instagram</Label>
          <Input value={form.instagram_url || ''} onChange={set('instagram_url')} placeholder="https://instagram.com/…" />
        </div>
        <div>
          <Label>X (Twitter)</Label>
          <Input value={form.x_url || ''} onChange={set('x_url')} placeholder="https://x.com/…" />
        </div>
    </CollapsibleCard>
  )
}
