import { motion } from 'framer-motion'

import { cn } from '../../lib/utils'

export function Card({ className, hover = false, ...props }) {
  const Comp = hover ? motion.div : 'div'
  const hoverProps = hover
    ? { whileHover: { y: -2, boxShadow: '0 4px 12px 0 rgb(15 23 42 / 0.08), 0 2px 4px 0 rgb(15 23 42 / 0.06)' }, transition: { duration: 0.15 } }
    : {}
  return (
    <Comp
      className={cn('rounded-xl border border-slate-200 bg-white shadow-[var(--shadow-card)]', className)}
      {...hoverProps}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4', className)} {...props} />
}

export function CardTitle({ className, ...props }) {
  return <h3 className={cn('text-sm font-semibold text-slate-900', className)} {...props} />
}

export function CardContent({ className, ...props }) {
  return <div className={cn('p-5', className)} {...props} />
}
