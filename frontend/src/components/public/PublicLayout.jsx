import { Outlet } from 'react-router-dom'

import { PublicFooter } from './PublicFooter'
import { PublicHeader } from './PublicHeader'

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <PublicHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  )
}
