'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { ChevronRight, Home, Menu, X } from 'lucide-react'
import {
  canAccessMenu,
  canAccessSettingsPage,
  getDivisionFromRole,
  getMenuHref,
} from '@/lib/access'
import { MOBILE_PRIMARY_ORDER, mobileMenuEntries } from '@/lib/mobile-nav'

type Props = {
  role: string
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

export function MobileNavigation({ role }: Props) {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const roleDivision = getDivisionFromRole(role)

  useEffect(() => {
    if (!isMenuOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isMenuOpen])

  const primaryLinks = MOBILE_PRIMARY_ORDER
    .filter((key) => canAccessMenu(role, key))
    .slice(0, 4)
    .map((key) => mobileMenuEntries.find((item) => item.key === key))
    .filter((item): item is (typeof mobileMenuEntries)[number] => Boolean(item))

  const menuGroups = (['Operasional', 'Digital'] as const)
    .map((label) => ({
      label,
      links: mobileMenuEntries.filter((item) => item.group === label && canAccessMenu(role, item.key)),
    }))
    .filter((group) => group.links.length > 0)

  const accessibleSettings = settingsLinks.filter((item) => canAccessSettingsPage(role, item.key))

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
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Semua Menu</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Modul yang dapat Anda akses</p>
              </div>
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
              {menuGroups.map((group) => (
                <section key={group.label}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {group.label}
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {group.links.map((item) => {
                      const Icon = item.icon
                      const active = pathname === item.activePath
                      return (
                        <Link
                          key={item.key}
                          href={getMenuHref(item.key, roleDivision)}
                          prefetch={false}
                          onClick={() => setIsMenuOpen(false)}
                          className={`flex min-h-14 items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium ${
                            active
                              ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300'
                              : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="min-w-0 flex-1 leading-tight">{item.label}</span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                        </Link>
                      )
                    })}
                  </div>
                </section>
              ))}

              {accessibleSettings.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Pengaturan
                  </h3>
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
                </section>
              )}
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
          <Link
            href="/"
            prefetch={false}
            aria-current={pathname === '/' ? 'page' : undefined}
            className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium ${
              pathname === '/' ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Home className="h-5 w-5" />
            Beranda
          </Link>
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
                {link.label}
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
