import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'

import { cn } from '../../lib/utils'

const ROLES = [
  { value: 'public', label: 'Public Visitors' },
  { value: 'jobseeker', label: 'Jobseekers' },
  { value: 'employer', label: 'Employers' },
  { value: 'staff', label: 'PESO Staff' },
  { value: 'admin', label: 'Admin' },
]

/** Controlled multi-role picker for announcement audience targeting.
 * `value` is an array of role strings (a subset of ROLES' values). */
export function RoleCheckboxGroup({ value = [], onChange, disabled }) {
  const toggle = (role) => {
    onChange(value.includes(role) ? value.filter((r) => r !== role) : [...value, role])
  }

  return (
    <div className="flex flex-wrap gap-3">
      {ROLES.map(({ value: role, label }) => (
        <label
          key={role}
          className={cn(
            'flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-text-secondary',
            value.includes(role) && 'border-primary-300 bg-primary-50 text-primary-800 dark:border-primary-700 dark:bg-primary-900/30 dark:text-primary-200'
          )}
        >
          <CheckboxPrimitive.Root
            checked={value.includes(role)}
            onCheckedChange={() => toggle(role)}
            disabled={disabled}
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border-hover bg-surface data-[state=checked]:border-primary-700 data-[state=checked]:bg-primary-700"
          >
            <CheckboxPrimitive.Indicator>
              <Check className="h-3 w-3 text-white" />
            </CheckboxPrimitive.Indicator>
          </CheckboxPrimitive.Root>
          {label}
        </label>
      ))}
    </div>
  )
}
