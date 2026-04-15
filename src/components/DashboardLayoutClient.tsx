'use client'

import { Header } from '@/components/Header'
import { CapacitorBackHandler } from '@/components/CapacitorBackHandler'
import { PullToRefresh } from '@/components/PullToRefresh'
import type { SessionUser } from '@/lib/auth'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'

interface DashboardLayoutClientProps {
  children: React.ReactNode
  user: SessionUser
}

export function DashboardLayoutClient({ children, user }: DashboardLayoutClientProps) {
  const router = useRouter()
  const [mainElement, setMainElement] = useState<HTMLElement | null>(null)
  const [isNative, setIsNative] = useState(false)
  const isTroubleshoots = (user?.role || '').toUpperCase() === 'TROUBLESHOOTS'

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (!mounted) return
        setIsNative(Capacitor.isNativePlatform())
      } catch {
        if (!mounted) return
        setIsNative(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const onRefresh = useMemo(() => {
    return async () => {
      const promises: Promise<unknown>[] = []
      const ev = new CustomEvent('app:refresh', {
        detail: {
          register: (p: Promise<unknown> | void) => {
            if (p && typeof (p as Promise<unknown>).then === 'function') promises.push(p as Promise<unknown>)
          },
        },
      })
      window.dispatchEvent(ev)
      
      if (promises.length === 0) {
        // Fallback: refresh router if nothing else is registered
        router.refresh()
        await new Promise(resolve => setTimeout(resolve, 800))
        return
      }

      await Promise.race([
        Promise.allSettled(promises),
        new Promise<void>((resolve) => window.setTimeout(resolve, 1500)),
      ])
    }
  }, [router])

  return (
    <div className="flex min-h-screen flex-col bg-gray-100 dark:bg-gray-900">
      <CapacitorBackHandler userRole={user.role} />
      <Header user={user} />
      
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <main
          ref={setMainElement}
          className={clsx(
            'relative min-h-0 flex-1 overflow-y-auto md:p-6 md:pb-[calc(1.5rem+env(safe-area-inset-bottom))]',
            isTroubleshoots
              ? 'p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]'
              : 'p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4 sm:pb-[calc(1rem+env(safe-area-inset-bottom))]'
          )}
        >
          <PullToRefresh scrollEl={mainElement} enabled={!isNative} onRefresh={onRefresh} />
          <div className={clsx('mx-auto w-full', !isTroubleshoots && 'max-w-7xl md:max-w-none')}>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
