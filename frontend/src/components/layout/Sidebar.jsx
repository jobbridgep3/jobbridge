import { AnimatePresence, motion } from 'framer-motion'
import { ChevronsLeft, ChevronsRight, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

import jobbridgeLogo from '../../assets/peso-logo.png'
import { NAV_BY_ROLE, ROLE_LABELS, SIDEBAR_NAV_BY_ROLE } from '../../config/navigation'
import { modalOverlay, sidebarWidth } from '../../lib/motion'
import { cn } from '../../lib/utils'
import { useUiStore } from '../../store/uiStore'
import { SidebarAccordionGroup } from './SidebarAccordionGroup'

function slugify(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function isItemActive(pathname, href) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function findActiveGroupLabel(entries, pathname) {
  return entries.find((entry) => entry.items?.some((item) => isItemActive(pathname, item.href)))?.label ?? null
}

/** Renders a mix of flat leaf links and accordion groups. The same list
 * serves the desktop expanded sidebar, the desktop icon-only collapsed rail
 * (fed a fully-flat entries array, so the group branch never fires), and the
 * mobile drawer. */
function SidebarNavList({ entries, collapsed, openGroup, activeGroupLabel, onToggleGroup, onNavigate }) {
  return (
    <ul className="space-y-0.5">
      {entries.map((entry) =>
        entry.items ? (
          <li key={entry.label}>
            <SidebarAccordionGroup
              group={entry}
              open={openGroup === entry.label}
              isActive={activeGroupLabel === entry.label}
              onToggle={() => onToggleGroup(entry.label)}
              onNavigate={onNavigate}
              groupId={`sidebar-group-${slugify(entry.label)}`}
            />
          </li>
        ) : (
          <li key={entry.href}>
            <NavLink
              to={entry.href}
              onClick={onNavigate}
              title={collapsed ? entry.label : undefined}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-primary-800 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                )
              }
            >
              <entry.icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span className="truncate">{entry.label}</span>}
            </NavLink>
          </li>
        )
      )}
    </ul>
  )
}

export function Sidebar({ role }) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const location = useLocation()

  const groupedItems = SIDEBAR_NAV_BY_ROLE[role] || []
  const flatItems = NAV_BY_ROLE[role] || []
  const activeGroupLabel = findActiveGroupLabel(groupedItems, location.pathname)

  const [openGroup, setOpenGroup] = useState(() => findActiveGroupLabel(groupedItems, location.pathname))
  useEffect(() => {
    if (activeGroupLabel) setOpenGroup(activeGroupLabel)
    // If the active route is a flat item (e.g. Dashboard, which belongs to
    // no group), leave whichever group is currently open as-is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupLabel])
  const toggleGroup = (label) => setOpenGroup((current) => (current === label ? null : label))

  const [mobileOpen, setMobileOpen] = useState(false)
  const closeMobile = () => setMobileOpen(false)

  return (
    <>
      {!mobileOpen && (
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
          className="fixed bottom-4 left-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary-800 text-white shadow-lg hover:bg-primary-900 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="backdrop"
              {...modalOverlay}
              onClick={closeMobile}
              className="fixed inset-0 z-40 bg-surface-overlay lg:hidden"
            />
            <motion.aside
              key="drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Sidebar navigation"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col bg-primary-950 text-slate-200 shadow-xl lg:hidden"
            >
              <div className="flex h-16 items-center gap-2 border-b border-white/10 px-4">
                <img src={jobbridgeLogo} alt="JobBridge" className="h-7 w-7 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">JobBridge</p>
                  <p className="truncate text-[11px] text-slate-400">{ROLE_LABELS[role]}</p>
                </div>
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={closeMobile}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="scrollbar-thin flex-1 overflow-y-auto px-2 py-3">
                <SidebarNavList
                  entries={groupedItems}
                  collapsed={false}
                  openGroup={openGroup}
                  activeGroupLabel={activeGroupLabel}
                  onToggleGroup={toggleGroup}
                  onNavigate={closeMobile}
                />
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <motion.aside
        custom={collapsed}
        variants={sidebarWidth}
        animate="animate"
        className="sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-slate-200 bg-primary-950 text-slate-200 lg:flex"
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
          <SidebarNavList
            entries={collapsed ? flatItems : groupedItems}
            collapsed={collapsed}
            openGroup={openGroup}
            activeGroupLabel={activeGroupLabel}
            onToggleGroup={toggleGroup}
          />
        </nav>

        <button
          onClick={toggleSidebar}
          className="flex h-12 items-center justify-center gap-2 border-t border-white/10 text-slate-400 hover:bg-white/5 hover:text-white"
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          {!collapsed && <span className="text-xs">Collapse</span>}
        </button>
      </motion.aside>
    </>
  )
}
