import { CheckCircle2, Circle } from 'lucide-react'
import { useState } from 'react'

import { SECTION_LABELS as JOBSEEKER_SECTION_LABELS } from '../../pages/jobseeker/profile-sections/requiredFields'
import { CollapsibleCard } from './CollapsibleCard'
import { cn } from '../../lib/utils'

/** Groups every required-field check by section, checked or not, and scrolls to the
 * corresponding section (via `id="section-<key>"` on each Card in the page) when an
 * unchecked item is clicked. `sectionLabels` defaults to the jobseeker map so the
 * existing jobseeker Profile page needs no changes; Company/HR Profile pass their
 * own (companySections/requiredFields.js, hr-sections/requiredFields.js).
 *
 * `onNavigate(item)` optionally overrides the default scroll-to-`item.section`
 * behavior — used by the jobseeker Profile page (collapsible sections) to expand a
 * collapsed section and/or redirect a field to a differently-located section (e.g.
 * resume_url, tagged section "documents" for grouping purposes but physically
 * rendered in its own section at the top of the page) before scrolling to it. Omit
 * it to keep the plain default behavior. */
export function CompletionChecklist({ completion, sectionLabels = JOBSEEKER_SECTION_LABELS, onNavigate }) {
  // Self-contained open/closed state — this one component is reused as-is by all
  // three profile pages (jobseeker/HR/Company), so making it collapsible here
  // converts "Remaining Requirements" into an accordion everywhere at once with no
  // changes needed at any of its call sites. Defaults open so nothing is hidden
  // by default, matching every other collapsible section's convention.
  const [open, setOpen] = useState(true)
  const { results, completedCount, totalCount } = completion

  const bySection = results.reduce((acc, item) => {
    ;(acc[item.section] ||= []).push(item)
    return acc
  }, {})

  const scrollToSection = (key) => {
    document.getElementById(`section-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleClick = (item) => (onNavigate ? onNavigate(item) : scrollToSection(item.section))

  return (
    <CollapsibleCard
      title="Remaining Requirements"
      open={open}
      onToggle={() => setOpen((o) => !o)}
      actions={<span className="text-xs font-medium text-slate-500">{completedCount} of {totalCount} complete</span>}
      contentClassName="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2"
    >
        {Object.entries(bySection).map(([section, items]) => (
          <div key={section}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {sectionLabels[section] || section}
            </p>
            <ul className="space-y-1.5">
              {items.map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    disabled={item.ok}
                    onClick={() => handleClick(item)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm transition-colors',
                      item.ok ? 'text-slate-400 line-through' : 'text-slate-700 hover:bg-slate-50',
                    )}
                  >
                    {item.ok ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-slate-300" />
                    )}
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
    </CollapsibleCard>
  )
}
