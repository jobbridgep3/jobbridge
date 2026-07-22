import { motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import logo from '../../assets/peso-logo.png'
import { openCitizenCharter } from '../../config/siteInfo'
import { slideDown } from '../../lib/motion'
import { Button } from '../ui/Button'

// "Services"/"About Us"/"Contact" have no dedicated pages yet — they route home
// per plan (restyled per the mockup, not dead links) until real content exists.
const NAV_ITEMS = [
  { label: 'Home', to: '/', activeMatch: true },
  { label: 'Find Jobs', to: '/jobs', activeMatch: true },
  { label: 'Job Fair', to: '/job-fair', activeMatch: true },
  { label: 'Citizen Charter', onClick: openCitizenCharter },
  { label: 'Services', to: '/' },
  { label: 'About Us', to: '/' },
  { label: 'Contact', to: '/' },
]

function NavLink({ item, onNavigate, className = '' }) {
  const location = useLocation()
  const isActive = item.activeMatch && item.to === location.pathname
  const base = `text-sm font-medium transition-colors ${
    isActive ? 'text-primary-700 dark:text-primary-400' : 'text-text-secondary hover:text-primary-700 dark:hover:text-primary-400'
  }`
  if (item.onClick) {
    return (
      <button
        type="button"
        onClick={() => {
          item.onClick()
          onNavigate?.()
        }}
        className={`text-left ${base} ${className}`}
      >
        {item.label}
      </button>
    )
  }
  return (
    <Link to={item.to} onClick={onNavigate} className={`relative ${base} ${className}`}>
      {item.label}
      {isActive && <span className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full bg-primary-700 dark:bg-primary-400" />}
    </Link>
  )
}

export function PublicHeader() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="JobBridge" className="h-9 w-9" />
          <div className="leading-tight">
            <p className="text-base font-semibold text-primary-900 dark:text-primary-300">JobBridge</p>
            <p className="text-[11px] text-text-muted">PESO Pila, Laguna</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.label} item={item} />
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button variant="secondary" asChild>
            <Link to="/login">Log In</Link>
          </Button>
          <Button asChild>
            <Link to="/register/choose">Register</Link>
          </Button>
        </div>

        <button
          type="button"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMobileOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-hover md:hidden"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <motion.div {...slideDown} className="overflow-hidden border-t border-border bg-surface md:hidden">
          <nav className="flex flex-col gap-1 px-4 py-3">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.label} item={item} onNavigate={() => setMobileOpen(false)} className="block rounded-lg px-2 py-2.5" />
            ))}
          </nav>
          <div className="flex gap-2 border-t border-border px-4 py-3">
            <Button variant="secondary" className="flex-1" asChild>
              <Link to="/login" onClick={() => setMobileOpen(false)}>Log In</Link>
            </Button>
            <Button className="flex-1" asChild>
              <Link to="/register/choose" onClick={() => setMobileOpen(false)}>Register</Link>
            </Button>
          </div>
        </motion.div>
      )}
    </header>
  )
}
