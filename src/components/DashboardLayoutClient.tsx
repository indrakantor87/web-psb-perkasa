'use client'

import { Header } from '@/components/Header'
import type { SessionUser } from '@/lib/auth'

interface DashboardLayoutClientProps {
  children: React.ReactNode
  user: SessionUser
}

export function DashboardLayoutClient({ children, user }: DashboardLayoutClientProps) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-gray-100 dark:bg-gray-900">
      <Header user={user} />
      
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:p-6 md:pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {children}
        </main>
      </div>
    </div>
  )
}
