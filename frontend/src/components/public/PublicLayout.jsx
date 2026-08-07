import { Outlet } from 'react-router-dom'

import { ChatbotWidget } from '../ChatbotWidget'
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
      <ChatbotWidget greeting="Kumusta! I'm Job Bot, your PESO Pila Front Desk Assistant. Ask me about registering, job fairs, the Citizen Charter, or how JobBridge works." />
    </div>
  )
}
