'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { ChevronRight, Home, Menu, X } from 'lucide-react'
import {
  canAccessSettingsPage,
  getDivisionFromRole,
  getMenuHref,
  isReadOnlyRole,
} from '@/lib/access'
import {
  canAccessMobileHome,
  getMobileHomeHref,
  getMobilePrimaryLinks,
} from '@/lib/mobile-nav'

type Props = {
  role: string
  position?: string | null
  subdivision?: string | null
}

const settingsLinks = [
  { key: 'users', href: '/settings/users', label: 'Manajemen Pengguna' },
  { key: 'areas', href: '/settings/areas', label: 'Master Area' },
  { key: 'packages', href: '/settings/packages', label: 'Master Paket' },
  { key: 'templates', href: '/settings/templates', label: 'Template WA' },
  { key: 'trouble-ticket', href: '/settings/trouble-ticket', label: 'Pengaturan Trouble Ticket' },
  { key: 'priorities', href: '/settings/priorities', label: 'Prioritas' },
  { key: 'role-audit', href: '/settings/role-audit', label: 'Audit Role' },
  { key: 'security-logs', href: '/settings/security-logs', label: 'Log Aktivitas' },
] as const

export function MobileNavigation({ role, position, subdivision }: Props) {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const [zoomLevel, setZoomLevel] = useState(() => {
    if (typeof window === 'undefined') return 100
    const savedZoom = Number(window.localStorage.getItem('zoomLevel'))
    return Number.isFinite(savedZoom) && savedZoom > 0 ? savedZoom : 100
  })
  useEffect(() => {
    document.documentElement.style.fontSize = `${zoomLevel}%`
    localStorage.setItem('zoomLevel', String(zoomLevel))
  }, [zoomLevel])

  useEffect(() => {
    if (!isMenuOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isMenuOpen])

  const roleDivision = getDivisionFromRole(role)
  const homeHref = getMobileHomeHref(role)
  const primaryLinks = getMobilePrimaryLinks(role, position, subdivision)

  // GM/Direktur (role PRIORITY) hanya mendapat kontrol personalisasi UI
  // (Ukuran teks & Tema) pada menu Pengaturan, tanpa tautan menu operasional.
  const accessibleSettings = isReadOnlyRole(role)
    ? []
    : settingsLinks.filter((item) => canAccessSettingsPage(role, item.key))
  const isHomeActive = pathname === homeHref

  const menuSheet = isMenuOpen && typeof document !== 'undefined'
    ? createPortal(
        <div
          className="fixed inset-0 z-[90] bg-slate-950/45"
          onClick={() => setIsMenuOpen(false)}
          role="presentation"
        >
          <section
            className="absolute inset-x-0 bottom-0 max-h-[84dvh] overflow-y-auto rounded-t-3xl border-t border-slate-200 bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
            aria-label="Menu aplikasi"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Pengaturan</h2>
              <button
                type="button"
                aria-label="Tutup menu"
                onClick={() => setIsMenuOpen(false)}
                className="rounded-full bg-slate-100 p-2 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5">
              <section>
                {accessibleSettings.length > 0 && (
                  <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                    {accessibleSettings.map((item) => (
                      <Link
                        key={item.key}
                        href={item.href}
                        prefetch={false}
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center justify-between border-b border-slate-100 px-3 py-3 text-sm text-slate-700 last:border-b-0 dark:border-slate-800 dark:text-slate-200"
                      >
                        <span>{item.label}</span>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </Link>
                    ))}
                  </div>
                )}
                <div
                  className={`grid gap-2 sm:grid-cols-2 ${
                    accessibleSettings.length > 0 ? 'mt-2' : ''
                  }`}
                >
                  <label className="rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700">
                    <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Ukuran teks</span>
                    <select
                      value={zoomLevel}
                      onChange={(event) => setZoomLevel(Number(event.target.value))}
                      className="w-full bg-transparent text-sm text-slate-800 outline-none dark:text-slate-100"
                    >
                      <option value={100}>100%</option>
                      <option value={90}>90%</option>
                      <option value={80}>80%</option>
                      <option value={75}>75%</option>
                      <option value={60}>60%</option>
                      <option value={50}>50%</option>
                    </select>
                  </label>
                  <label className="rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700">
                    <span className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Tema</span>
                    <select
                      value={theme ?? 'system'}
                      onChange={(event) => setTheme(event.target.value)}
                      className="w-full bg-transparent text-sm text-slate-800 outline-none dark:text-slate-100"
                      suppressHydrationWarning
                    >
                      <option value="light">Terang</option>
                      <option value="dark">Gelap</option>
                      <option value="system">Ikuti sistem</option>
                    </select>
                  </label>
                </div>
              </section>
            </div>
          </section>
        </div>,
        document.body
      )
    : null

  return (
    <>
      <nav
        aria-label="Navigasi utama mobile"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-1 pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 md:hidden"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto flex max-w-lg">
          {canAccessMobileHome(role) && (
            <Link
              href={homeHref}
              prefetch={false}
              aria-current={isHomeActive ? 'page' : undefined}
              className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium ${
                isHomeActive ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Home className="h-5 w-5" />
              Beranda
            </Link>
          )}
          {primaryLinks.map((link) => {
            const Icon = link.icon
            const active = pathname.startsWith(link.activePath)
            return (
              <Link
                key={link.key}
                href={getMenuHref(link.key, roleDivision)}
                prefetch={false}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium ${
                  active ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon className="h-5 w-5" />
                {link.shortLabel ?? link.label}
              </Link>
            )
          })}
          <button
            type="button"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen(true)}
            className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium ${
              isMenuOpen ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Menu className="h-5 w-5" />
            Menu
          </button>
        </div>
      </nav>
      {menuSheet}
    </>
  )
}
