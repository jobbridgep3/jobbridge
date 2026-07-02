/** Shared Framer Motion presets — kept subtle and consistent across the whole app. */

export const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2, ease: 'easeOut' },
}

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.25 },
}

export const cardHover = {
  whileHover: { y: -2, boxShadow: '0 4px 12px 0 rgb(15 23 42 / 0.08), 0 2px 4px 0 rgb(15 23 42 / 0.06)' },
  transition: { duration: 0.15 },
}

export const staggerContainer = {
  animate: { transition: { staggerChildren: 0.04 } },
}

export const staggerItem = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.18 },
}

export const modalOverlay = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15 },
}

export const modalContent = {
  initial: { opacity: 0, scale: 0.97, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, y: 8 },
  transition: { duration: 0.18, ease: 'easeOut' },
}

export const dropdownMenu = {
  initial: { opacity: 0, scale: 0.96, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.96, y: -4 },
  transition: { duration: 0.12 },
}

export const sidebarWidth = {
  animate: (collapsed) => ({ width: collapsed ? 76 : 264 }),
  transition: { duration: 0.2, ease: 'easeInOut' },
}

export const slideDown = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto' },
  exit: { opacity: 0, height: 0 },
  transition: { duration: 0.2 },
}
