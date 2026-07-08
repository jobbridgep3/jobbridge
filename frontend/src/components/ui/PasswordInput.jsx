import { Eye, EyeOff } from 'lucide-react'
import { forwardRef, useState } from 'react'

import { Input } from './Input'
import { cn } from '../../lib/utils'

/** A password <Input> with a show/hide eye-icon toggle. Drop-in replacement for
 * `<Input type="password" .../>` — forwards refs/props so it works transparently
 * with both react-hook-form's register() and plain useState-controlled forms. */
export const PasswordInput = forwardRef(({ className, ...props }, ref) => {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input ref={ref} type={visible ? 'text' : 'password'} className={cn('pr-10', className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        tabIndex={0}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-500"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
})
PasswordInput.displayName = 'PasswordInput'
