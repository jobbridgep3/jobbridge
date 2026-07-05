import { Check, X } from 'lucide-react'

import { PASSWORD_RULES } from '../../lib/passwordPolicy'

/** Live checklist shown while the user types a new password. */
export function PasswordRequirements({ password }) {
  const value = password || ''
  return (
    <ul className="mt-1.5 space-y-0.5">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(value)
        return (
          <li key={rule.key} className={`flex items-center gap-1.5 text-xs ${met ? 'text-green-600' : 'text-slate-400'}`}>
            {met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            {rule.label}
          </li>
        )
      })}
    </ul>
  )
}
