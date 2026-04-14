'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

type PullToRefreshProps = {
  scrollEl: HTMLElement | null
  enabled?: boolean
  onRefresh: () => Promise<void> | void
}

export function PullToRefresh({ scrollEl, enabled = true, onRefresh }: PullToRefreshProps) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const startYRef = useRef<number | null>(null)
  const activeRef = useRef(false)
  const startScrollTopRef = useRef(0)
  const pullRef = useRef(0)
  const refreshingRef = useRef(false)

  const threshold = 80
  const maxPull = 140

  const label = useMemo(() => {
    if (refreshing) return 'Memuat...'
    if (pull >= threshold) return 'Lepas untuk refresh'
    return 'Tarik untuk refresh'
  }, [pull, refreshing])

  useEffect(() => {
    refreshingRef.current = refreshing
  }, [refreshing])

  useEffect(() => {
    if (!enabled) return
    if (!scrollEl) return

    let disposed = false

    const onTouchStart = (e: TouchEvent) => {
      if (disposed || refreshingRef.current) return
      if (e.touches.length !== 1) return
      
      startScrollTopRef.current = scrollEl.scrollTop
      startYRef.current = e.touches[0]?.clientY ?? null
      activeRef.current = false
      pullRef.current = 0
      setPull(0)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (disposed || refreshingRef.current || startYRef.current == null) return
      if (startScrollTopRef.current > 0) return

      const currentY = e.touches[0]?.clientY ?? 0
      const delta = currentY - startYRef.current
      
      if (delta <= 0) return

      activeRef.current = true
      // Apply rubber band effect
      const next = Math.min(maxPull, Math.pow(delta, 0.85) * 2)
      pullRef.current = next
      setPull(next)
      
      if (e.cancelable) {
        e.preventDefault()
      }
    }

    const end = async () => {
      if (disposed || refreshingRef.current) return
      
      const isRefreshing = activeRef.current && pullRef.current >= threshold
      
      startYRef.current = null
      activeRef.current = false
      pullRef.current = 0
      setPull(0)

      if (isRefreshing) {
        setRefreshing(true)
        try {
          await onRefresh()
        } catch (err) {
          console.error('Refresh failed:', err)
        } finally {
          if (!disposed) setRefreshing(false)
        }
      }
    }

    const onTouchEnd = () => void end()
    const onTouchCancel = () => void end()

    scrollEl.addEventListener('touchstart', onTouchStart, { passive: true })
    scrollEl.addEventListener('touchmove', onTouchMove, { passive: false })
    scrollEl.addEventListener('touchend', onTouchEnd, { passive: true })
    scrollEl.addEventListener('touchcancel', onTouchCancel, { passive: true })

    return () => {
      disposed = true
      scrollEl.removeEventListener('touchstart', onTouchStart as unknown as EventListener)
      scrollEl.removeEventListener('touchmove', onTouchMove as unknown as EventListener)
      scrollEl.removeEventListener('touchend', onTouchEnd as unknown as EventListener)
      scrollEl.removeEventListener('touchcancel', onTouchCancel as unknown as EventListener)
    }
  }, [enabled, onRefresh, scrollEl]) // Removed refreshing from dependencies

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-0 right-0 top-0 z-[60] flex items-center justify-center overflow-hidden"
      style={{
        height: maxPull,
        transform: `translateY(${Math.min(maxPull, Math.max(0, refreshing ? 60 : pull)) - maxPull}px)`,
        transition: (pull === 0 || refreshing) ? 'transform 300ms cubic-bezier(0.23, 1, 0.32, 1)' : undefined,
      }}
    >
      <div className="flex items-center gap-2 rounded-full bg-white/90 dark:bg-gray-800/90 px-4 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 shadow-lg border border-gray-200 dark:border-gray-700">
        {refreshing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <div 
            className="h-2 w-2 rounded-full bg-blue-500" 
            style={{ 
              transform: `scale(${Math.min(1.5, pull / threshold)})`,
              opacity: Math.min(1, pull / (threshold / 2))
            }} 
          />
        )}
        <span>{label}</span>
      </div>
    </div>
  )
}
