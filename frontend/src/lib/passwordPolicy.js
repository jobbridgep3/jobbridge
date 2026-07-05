// Mirrors backend/schemas/auth_schemas.py's validate_strong_password — keep both in sync.
export const PASSWORD_RULES = [
  { key: 'length', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { key: 'upper', label: 'One uppercase letter (A-Z)', test: (v) => /[A-Z]/.test(v) },
  { key: 'lower', label: 'One lowercase letter (a-z)', test: (v) => /[a-z]/.test(v) },
  { key: 'digit', label: 'One number (0-9)', test: (v) => /[0-9]/.test(v) },
  {
    key: 'special',
    label: 'One special character (e.g. !@#$%^&*)',
    test: (v) => /[!@#$%^&*()_+\-=[\]{}|;:'",.<>?/]/.test(v),
  },
]

export function isStrongPassword(value) {
  const v = value || ''
  return PASSWORD_RULES.every((rule) => rule.test(v))
}

export function getUnmetPasswordRules(value) {
  const v = value || ''
  return PASSWORD_RULES.filter((rule) => !rule.test(v))
}
