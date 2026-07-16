import { FileText, ImagePlus, Upload, X } from 'lucide-react'
import { useMemo, useRef } from 'react'

import { Button } from '../ui/Button'
import { DatePicker } from '../ui/DatePicker'
import { Input, Label, Select } from '../ui/Input'
import { RichTextEditor } from '../ui/RichTextEditor'
import { RoleCheckboxGroup } from '../ui/RoleCheckboxGroup'
import { TimePicker } from '../ui/TimePicker'
import { CATEGORIES, PRIORITIES } from '../../config/announcementMeta'

/** Create/edit form body for an announcement — title, rich body, category,
 * priority, audience, publish timing, and banner/gallery/PDF media, all in
 * one place. Media files are staged locally (not uploaded yet) via
 * `staged`/`setStaged` — the parent uploads them once the announcement is
 * actually saved (as a draft or published), so nothing is committed to
 * storage until the user consciously saves. `existingMedia` (edit mode only)
 * holds already-uploaded banner_url/gallery_images/pdf_url; `onRemoveImage`
 * removes an already-uploaded gallery image immediately (a real delete, not
 * staged, since the announcement already exists in edit mode). */
export function AnnouncementForm({ form, setForm, staged, setStaged, existingMedia, onRemoveImage }) {
  const bannerRef = useRef(null)
  const imagesRef = useRef(null)
  const pdfRef = useRef(null)

  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }))

  const bannerPreviewUrl = useMemo(
    () => (staged.banner ? URL.createObjectURL(staged.banner) : existingMedia?.banner_url),
    [staged.banner, existingMedia?.banner_url]
  )
  const stagedImageUrls = useMemo(() => staged.images.map((f) => URL.createObjectURL(f)), [staged.images])

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

      <div className="space-y-3 rounded-lg border border-border p-3">
        <Label>Media</Label>

        <div>
          <p className="mb-1.5 text-xs text-text-muted">Banner — displayed at full width, aspect preserved (not cropped)</p>
          {bannerPreviewUrl ? (
            <div className="relative">
              <img src={bannerPreviewUrl} alt="" className="aspect-[16/9] w-full rounded-lg border border-border bg-surface-secondary object-contain" />
              <Button
                size="icon" variant="secondary" className="absolute right-2 top-2 h-7 w-7"
                onClick={() => { setStaged((s) => ({ ...s, banner: null })); bannerRef.current.value = '' }}
                title="Remove staged banner"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => bannerRef.current?.click()}>
              <ImagePlus className="h-3.5 w-3.5" /> Upload Banner
            </Button>
          )}
          <input
            ref={bannerRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => setStaged((s) => ({ ...s, banner: e.target.files?.[0] || null }))}
          />
        </div>

        <div>
          <p className="mb-1.5 text-xs text-text-muted">Additional images (optional)</p>
          <div className="flex flex-wrap gap-2">
            {(existingMedia?.gallery_images || []).map((img) => (
              <div key={img.url} className="relative">
                <img src={img.url} alt="" className="h-16 w-16 rounded-lg border border-border object-cover" />
                <button
                  type="button" onClick={() => onRemoveImage(img.url)}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white"
                  title="Remove image"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {stagedImageUrls.map((url, i) => (
              <div key={url} className="relative">
                <img src={url} alt="" className="h-16 w-16 rounded-lg border border-border object-cover" />
                <button
                  type="button"
                  onClick={() => setStaged((s) => ({ ...s, images: s.images.filter((_, idx) => idx !== i) }))}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white"
                  title="Remove staged image"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button
              type="button" onClick={() => imagesRef.current?.click()}
              className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-border-hover text-text-muted hover:bg-surface-hover"
            >
              <Upload className="h-4 w-4" />
            </button>
          </div>
          <input
            ref={imagesRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) setStaged((s) => ({ ...s, images: [...s.images, file] }))
              e.target.value = ''
            }}
          />
        </div>

        <div>
          <p className="mb-1.5 text-xs text-text-muted">PDF attachment (optional)</p>
          {staged.pdf || existingMedia?.pdf_url ? (
            <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-text-secondary">
              <FileText className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{staged.pdf ? staged.pdf.name : 'Attached PDF'}</span>
              <button
                type="button"
                onClick={() => { setStaged((s) => ({ ...s, pdf: null })); pdfRef.current.value = '' }}
                className="text-text-muted hover:text-red-600"
                title="Remove"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => pdfRef.current?.click()}>
              <FileText className="h-3.5 w-3.5" /> Attach PDF
            </Button>
          )}
          <input
            ref={pdfRef} type="file" accept="application/pdf" className="hidden"
            onChange={(e) => setStaged((s) => ({ ...s, pdf: e.target.files?.[0] || null }))}
          />
        </div>
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
