import { useState } from 'react'

import { AddressCascadeSelect } from './AddressCascadeSelect'
import { CollapsibleCard } from './CollapsibleCard'

/** Thin collapsible-Card wrapper around AddressCascadeSelect, shared by Company
 * Profile, HR Profile, and (Phase 6) Vacancy Location — avoids each page
 * re-declaring the same Card scaffolding around the picker. `open`/`onToggle` are
 * optional: pass them to let a parent page coordinate this section alongside its
 * other collapsible sections (e.g. HR/Company Profile); omit them and it manages
 * its own open state, defaulting to expanded (existing call sites like jobseeker
 * Profile / VacancyForm need no changes to keep rendering exactly as before). */
export function AddressCard({ title = 'Address', form, setForm, missingKeys = new Set(), open, onToggle }) {
  const [localOpen, setLocalOpen] = useState(true)
  const isControlled = open !== undefined && onToggle !== undefined

  return (
    <CollapsibleCard
      title={title}
      open={isControlled ? open : localOpen}
      onToggle={isControlled ? onToggle : () => setLocalOpen((o) => !o)}
    >
      <AddressCascadeSelect value={form} onChange={(next) => setForm((f) => ({ ...f, ...next }))} missingKeys={missingKeys} />
    </CollapsibleCard>
  )
}
