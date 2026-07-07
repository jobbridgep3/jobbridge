import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/** Strips everything but digits — used to enforce "numbers only" on contact-number
 * inputs in real time (not just on submit).
 */
export function sanitizeDigits(value) {
  return value.replace(/\D/g, '')
}

function flattenValidationErrors(obj, prefix = '') {
  const out = []
  if (Array.isArray(obj)) {
    obj.forEach((msg) => out.push(prefix ? `${prefix}: ${msg}` : String(msg)))
  } else if (obj && typeof obj === 'object') {
    Object.entries(obj).forEach(([key, value]) => {
      out.push(...flattenValidationErrors(value, prefix ? `${prefix}.${key}` : key))
    })
  }
  return out
}

/** Backend validation failures (fail(message, 400, err.messages)) put the generic
 * message in `.message` and the actual per-field marshmallow messages in `.data` —
 * the latter was previously discarded, showing a dead-end "Invalid profile data"
 * toast with no clue which field failed. Surfaces the real field-level message when
 * present, falling back to the generic message/fallback otherwise.
 */
export function formatApiError(err, fallback) {
  const data = err?.response?.data
  const details = flattenValidationErrors(data?.data)
  if (details.length) return details.slice(0, 2).join('; ')
  return data?.message || fallback
}
