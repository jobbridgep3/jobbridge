import { motion } from 'framer-motion'
import { ChevronsLeft, ChevronsRight } from 'lucide-react'
import { NavLink } from 'react-router-dom'

import jobbridgeLogo from '../../assets/logo.svg'
import { NAV_BY_ROLE, ROLE_LABELS } from '../../config/navigation'
import { sidebarWidth } from '../../lib/motion'
import { cn } from '../../lib/utils'
import { useUiStore } from '../../store/uiStore'

export function Sidebar({ role }) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const items = NAV_BY_ROLE[role] || []

  return (
    <motion.aside
      custom={collapsed}
      variants={sidebarWidth}
      animate="animate"
      className="sticky top-0 z-30 flex h-screen shrink-0 flex-col border-r border-slate-200 bg-primary-950 text-slate-200"
    >
      <div className="flex h-16 items-center gap-2 border-b border-white/10 px-4">
        <img src={jobbridgeLogo} alt="JobBridge" className="h-7 w-7 shrink-0" />
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">JobBridge</p>
            <p className="truncate text-[11px] text-slate-400">{ROLE_LABELS[role]}</p>
          </div>
        )}
      </div>

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-0.5">
          {items.map((item) => (
            <li key={item.href}>
              <NavLink
                to={item.href}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive ? 'bg-primary-800 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  )
                }
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <button
        onClick={toggleSidebar}
        className="flex h-12 items-center justify-center gap-2 border-t border-white/10 text-slate-400 hover:bg-white/5 hover:text-white"
      >
        {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        {!collapsed && <span className="text-xs">Collapse</span>}
      </button>
    </motion.aside>
  )
}
