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
