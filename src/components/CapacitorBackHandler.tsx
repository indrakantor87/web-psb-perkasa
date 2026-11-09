'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getDefaultPathForRole } from '@/lib/access'

export function CapacitorBackHandler({ userRole }: { userRole: string }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    let remove: (() => void) | null = null

    ;(async () => {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (!Capacitor.isNativePlatform()) return

        const { App } = await import('@capacitor/app')
        const homePath = getDefaultPathForRole(userRole)

        const handler = await App.addListener('backButton', (data: { canGoBack?: boolean }) => {
          if (data?.canGoBack) {
            window.history.back()
            return
          }
          if (pathname && pathname !== homePath) {
            router.replace(homePath)
            return
          }
          void App.exitApp()
        })

        remove = () => {
          handler.remove().catch(() => {})
        }
      } catch {}
    })()

    return () => {
      if (remove) remove()
    }
  }, [pathname, router, userRole])

  return null
}
