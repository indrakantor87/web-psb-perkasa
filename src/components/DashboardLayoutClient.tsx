'use client'

import { Header } from '@/components/Header'
import type { SessionUser } from '@/lib/auth'

interface DashboardLayoutClientProps {
  children: React.ReactNode
  user: SessionUser
}

export function DashboardLayoutClient({ children, user }: DashboardLayoutClientProps) {
  return (
    <div className="flex h-screen flex-col bg-gray-100 dark:bg-gray-900">
      <Header user={user} />
      
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
