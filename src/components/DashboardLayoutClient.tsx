'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import { Sidebar } from '@/components/Sidebar'
import { Header } from '@/components/Header'

interface DashboardLayoutClientProps {
  children: React.ReactNode
  user: any
}

export function DashboardLayoutClient({ children, user }: DashboardLayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isMarketing = user?.role === 'MARKETING'

  return (
    <div className="flex h-screen flex-col bg-gray-100 dark:bg-gray-900">
      <Header user={user} onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Mobile Sidebar (Overlay - Left Side) */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 flex md:hidden">
            <div 
              className={clsx("fixed inset-0 bg-gray-600 bg-opacity-50", !isMarketing && "transition-opacity")}
              onClick={() => setSidebarOpen(false)}
            ></div>
            
            <div className={clsx("relative flex w-64 flex-1 flex-col bg-gray-900 pt-5 pb-4 transform translate-x-0", !isMarketing && "transition ease-in-out duration-300")}>
              <div className="absolute top-0 right-0 -mr-12 pt-2">
                <button
                  className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="sr-only">Close sidebar</span>
                  <svg className="h-6 w-6 text-white" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <Sidebar mobile onClose={() => setSidebarOpen(false)} user={user} />
            </div>
            
            <div className="w-14 flex-shrink-0">
              {/* Force sidebar to shrink to fit close icon */}
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
