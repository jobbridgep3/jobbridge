import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

import { slideDown } from '../../lib/motion'
import { Card, CardContent, CardHeader, CardTitle } from './Card'

/** Header+chevron collapsible wrapper around the Card primitives, matching the same
 * rotating-chevron/AnimatePresence interaction as Accordion.jsx and
 * SidebarAccordionGroup.jsx. Controlled: the parent owns open/closed state so it can
 * coordinate multiple sections (e.g. auto-expanding a section when a completion
 * checklist item scrolls to it). `actions` renders outside the toggle button (e.g. an
 * "Add" button) so it stays clickable without also toggling the section. */
export function CollapsibleCard({ title, actions, open, onToggle, contentClassName, children }) {
  return (
    <Card>
      <CardHeader>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="-m-1 flex flex-1 items-center gap-2 rounded-md p-1 text-left hover:bg-surface-hover"
        >
          <CardTitle className="flex-1">{title}</CardTitle>
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.15 }} className="shrink-0 text-text-muted">
            <ChevronDown className="h-4 w-4" />
          </motion.span>
        </button>
        {actions}
      </CardHeader>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div {...slideDown} className="overflow-hidden">
            <CardContent className={contentClassName}>{children}</CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
