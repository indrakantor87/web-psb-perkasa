'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

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

  const threshold = 80
  const maxPull = 140

  const label = useMemo(() => {
    if (refreshing) return 'Memuat...'
    if (pull >= threshold) return 'Lepas untuk refresh'
    return 'Tarik untuk refresh'
  }, [pull, refreshing])

  useEffect(() => {
    if (!enabled) return
    if (!scrollEl) return

    let disposed = false

    const onTouchStart = (e: TouchEvent) => {
      if (disposed) return
      if (refreshing) return
      if (e.touches.length !== 1) return
      startScrollTopRef.current = scrollEl.scrollTop
      startYRef.current = e.touches[0]?.clientY ?? null
      activeRef.current = false
      setPull(0)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (disposed) return
      if (refreshing) return
      if (startYRef.current == null) return
      const currentY = e.touches[0]?.clientY ?? 0
      const delta = currentY - startYRef.current
      if (startScrollTopRef.current > 0) return
      if (delta <= 0) return

      activeRef.current = true
      const next = Math.min(maxPull, Math.max(0, delta))
      pullRef.current = next
      setPull(next)
      e.preventDefault()
    }

    const end = async () => {
      if (disposed) return
      if (!activeRef.current) {
        startYRef.current = null
        pullRef.current = 0
        setPull(0)
        return
      }
      const shouldRefresh = pullRef.current >= threshold
      startYRef.current = null
      activeRef.current = false
      pullRef.current = 0
      setPull(0)
      if (!shouldRefresh) return
      setRefreshing(true)
      try {
        await onRefresh()
      } finally {
        if (!disposed) setRefreshing(false)
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
  }, [enabled, onRefresh, refreshing, scrollEl])

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-0 right-0 top-0 z-10 flex items-center justify-center"
      style={{
        height: 44,
        transform: `translateY(${Math.min(44, Math.max(0, pull)) - 44}px)`,
        transition: pull === 0 ? 'transform 160ms ease' : undefined,
      }}
    >
      <div className="rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white">
        {label}
      </div>
    </div>
  )
}
