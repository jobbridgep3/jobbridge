import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { slideDown } from '../../lib/motion'
import { cn } from '../../lib/utils'

/** One accordion section in the sidebar: a toggle header (icon + label +
 * chevron) and its collapsible submenu panel. Fully controlled by the
 * parent Sidebar, which owns which single group is open at a time. */
export function SidebarAccordionGroup({ group, open, isActive, onToggle, onNavigate, groupId }) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={groupId}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          isActive ? 'bg-primary-900/60 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
        )}
      >
        <group.icon className="h-[18px] w-[18px] shrink-0" />
        <span className="flex-1 truncate text-left">{group.label}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.15 }} className="shrink-0">
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={groupId} {...slideDown} className="overflow-hidden">
            <ul className="space-y-0.5 py-1 pl-[13px]">
              {group.items.map((item) => (
                <li key={item.href}>
                  <NavLink
                    to={item.href}
                    onClick={onNavigate}
                    className={({ isActive: linkActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-lg border-l-2 py-2 pl-[19px] pr-3 text-sm font-medium transition-colors',
                        linkActive
                          ? 'border-primary-500 bg-primary-800 text-white'
                          : 'border-transparent text-slate-300 hover:bg-white/5 hover:text-white'
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
