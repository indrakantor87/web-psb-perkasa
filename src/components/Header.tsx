'use client'

import { User, LogOut, ChevronDown, LayoutDashboard, FileInput, List, Settings, Ban, Wifi, ClipboardList, Wrench } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { clsx } from 'clsx'
import { useTheme } from 'next-themes'
import type { SessionUser } from '@/lib/auth'

function formatDivisionLabel(division?: string | null) {
  switch ((division || '').toUpperCase()) {
    case 'PENJUALAN':
      return 'Penjualan'
    case 'CS_ADMIN':
      return 'CS & Admin CS'
    case 'NOC_TROUBLESHOOTS':
      return 'NOC & Troubleshoots'
    case 'CREATOR_DIGITAL':
      return 'Creator Digital'
    default:
      return null
  }
}

type HeaderNavLink = {
  href: string
  label: string
  icon: typeof LayoutDashboard
  matchDivision?: string
}

type HeaderNavGroup = {
  key: string
  label: string
  icon: typeof LayoutDashboard
  description: string
  items: HeaderNavLink[]
}

type HeaderSettingsLink = {
  href: string
  label: string
}

type HeaderSettingsGroup = {
  key: string
  label: string
  description: string
  items: HeaderSettingsLink[]
}

function getDivisionGroupTone(key: string) {
  switch (key) {
    case 'penjualan':
      return {
        buttonActive: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
        badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
        panel: 'border-emerald-100 dark:border-emerald-900/40',
      }
    case 'cs-admin':
      return {
        buttonActive: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
        badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
        panel: 'border-amber-100 dark:border-amber-900/40',
      }
    case 'noc-troubleshoots':
      return {
        buttonActive: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
        badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
        panel: 'border-blue-100 dark:border-blue-900/40',
      }
    case 'creator-digital':
      return {
        buttonActive: 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-900/20 dark:text-fuchsia-300',
        badge: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300',
        panel: 'border-fuchsia-100 dark:border-fuchsia-900/40',
      }
    default:
      return {
        buttonActive: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
        badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
        panel: 'border-gray-100 dark:border-gray-700',
      }
  }
}

export function Header({ user }: { user: SessionUser }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isNavOpen, setIsNavOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [openDivisionMenu, setOpenDivisionMenu] = useState<string | null>(null)
  const [isMobilePortrait, setIsMobilePortrait] = useState(false)
  const [avatar, setAvatar] = useState<string | null>(null)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { theme, setTheme } = useTheme()
  const [zoomLevel, setZoomLevel] = useState(() => {
    if (typeof window === 'undefined') return 100
    const savedZoom = window.localStorage.getItem('zoomLevel')
    const n = Number(savedZoom)
    return Number.isFinite(n) && n > 0 ? n : 100
  })
  const isMarketing = user?.role === 'MARKETING'
  const roleUpper = (user?.role || '').toUpperCase()
  const isAdmin = roleUpper === 'ADMIN'
  const isTroubleshoots = (user?.role || '').toUpperCase() === 'TROUBLESHOOTS'
  const divisionLabel = formatDivisionLabel(user?.division)
  const currentDivisionParam = (searchParams.get('division') || '').trim().toUpperCase()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navRefMobile = useRef<HTMLDivElement>(null)
  const divisionNavRef = useRef<HTMLDivElement>(null)
  const settingsRefDesktop = useRef<HTMLDivElement>(null)
  const settingsRefMobile = useRef<HTMLDivElement>(null)
  const navOverlayRef = useRef<HTMLDivElement>(null)
  const settingsOverlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.style.fontSize = `${zoomLevel}%`
    localStorage.setItem('zoomLevel', String(zoomLevel))
  }, [zoomLevel])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px) and (orientation: portrait)')
    const update = () => setIsMobilePortrait(mq.matches)
    update()

    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update)
      return () => mq.removeEventListener('change', update)
    }

    mq.addListener(update)
    return () => mq.removeListener(update)
  }, [])

  const refreshAvatar = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as { user?: { avatar?: string | null } | null }
      setAvatar(data?.user?.avatar ?? null)
    } catch {
      setAvatar(null)
    }
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => {
      refreshAvatar()
    }, 0)
    return () => window.clearTimeout(id)
  }, [refreshAvatar])

  useEffect(() => {
    const handler = () => {
      refreshAvatar()
    }
    window.addEventListener('app:refresh', handler as EventListener)
    return () => window.removeEventListener('app:refresh', handler as EventListener)
  }, [refreshAvatar])

  // Close click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
      const inNavMobile = navRefMobile.current?.contains(event.target as Node) ?? false
      const inNavOverlay = navOverlayRef.current?.contains(event.target as Node) ?? false
      if (!inNavMobile && !inNavOverlay) {
        setIsNavOpen(false)
      }
      const inDivisionNav = divisionNavRef.current?.contains(event.target as Node) ?? false
      if (!inDivisionNav) {
        setOpenDivisionMenu(null)
      }
      const inDesktop = settingsRefDesktop.current?.contains(event.target as Node) ?? false
      const inMobile = settingsRefMobile.current?.contains(event.target as Node) ?? false
      const inOverlay = settingsOverlayRef.current?.contains(event.target as Node) ?? false
      if (!inDesktop && !inMobile && !inOverlay) {
        setIsSettingsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const matchesLink = useCallback((link: HeaderNavLink) => {
    const [linkPath, queryString = ''] = link.href.split('?')
    if (queryString) {
      const params = new URLSearchParams(queryString)
      const linkDivision = (params.get('division') || '').trim().toUpperCase()
      if (linkDivision) {
        return pathname === linkPath && currentDivisionParam === linkDivision
      }
    }
    if (link.matchDivision) {
      return pathname === linkPath && currentDivisionParam === link.matchDivision
    }
    return pathname === linkPath || (linkPath !== '/' && pathname.startsWith(linkPath))
  }, [currentDivisionParam, pathname])

  const flatLinks: HeaderNavLink[] = isTroubleshoots
    ? [{ href: '/trouble-ticket', label: 'Trouble Ticket', icon: Wrench }]
    : [
        { href: '/', label: 'Dashboard', icon: LayoutDashboard },
        ...(user?.role !== 'TEKNISI' ? [{ href: '/input', label: 'Input PSB', icon: FileInput }] : []),
        { href: '/list', label: 'List Data', icon: List },
        ...(!['TEKNISI', 'NOC'].includes(user?.role || '') ? [{ href: '/marketing-activities', label: 'Aktivitas Marketing', icon: ClipboardList }] : []),
        ...(user?.role !== 'TEKNISI' ? [{ href: '/isolir', label: 'Isolir', icon: Ban }] : []),
        { href: '/odp', label: 'PORT ODP', icon: Wifi },
        ...(user?.role !== 'MARKETING' ? [{ href: '/trouble-ticket', label: 'Trouble Ticket', icon: Wrench }] : []),
      ]

  const adminDivisionGroups: HeaderNavGroup[] = isAdmin && !isTroubleshoots
    ? [
        {
          key: 'penjualan',
          label: 'Penjualan',
          icon: FileInput,
          description: 'Operasional akuisisi pelanggan baru dan aktivitas marketing.',
          items: [
            { href: '/division?division=PENJUALAN', label: 'Ringkasan Divisi', icon: LayoutDashboard, matchDivision: 'PENJUALAN' },
            { href: '/input?division=PENJUALAN', label: 'Input PSB', icon: FileInput },
            { href: '/list?division=PENJUALAN', label: 'List Data', icon: List },
            { href: '/marketing-activities?division=PENJUALAN', label: 'Aktivitas Marketing', icon: ClipboardList },
          ],
        },
        {
          key: 'cs-admin',
          label: 'CS & Admin CS',
          icon: Ban,
          description: 'Fokus follow up pelanggan, isolir, dan proses administratif CS.',
          items: [
            { href: '/division?division=CS_ADMIN', label: 'Ringkasan Divisi', icon: LayoutDashboard, matchDivision: 'CS_ADMIN' },
            { href: '/isolir?division=CS_ADMIN', label: 'Isolir', icon: Ban },
            { href: '/odp?division=CS_ADMIN', label: 'PORT ODP', icon: Wifi },
          ],
        },
        {
          key: 'noc-troubleshoots',
          label: 'NOC & Troubleshoots',
          icon: Wrench,
          description: 'Monitoring aset jaringan dan tindak lanjut teknis lapangan.',
          items: [
            { href: '/division?division=NOC_TROUBLESHOOTS', label: 'Ringkasan Divisi', icon: LayoutDashboard, matchDivision: 'NOC_TROUBLESHOOTS' },
            { href: '/trouble-ticket?division=NOC_TROUBLESHOOTS', label: 'Trouble Ticket', icon: Wrench },
          ],
        },
        {
          key: 'creator-digital',
          label: 'Creator Digital',
          icon: ClipboardList,
          description: 'Ruang ringkasan untuk kebutuhan KPI dan pengembangan modul digital.',
          items: [
            { href: '/division?division=CREATOR_DIGITAL', label: 'Ringkasan Divisi', icon: LayoutDashboard, matchDivision: 'CREATOR_DIGITAL' },
          ],
        },
      ]
    : []

  const hasSettingsAccess = user?.role && ['ADMIN', 'CS', 'NOC'].includes(user.role)

  const settingsGroups: HeaderSettingsGroup[] = hasSettingsAccess ? [
    {
      key: 'sales-master',
      label: 'Penjualan',
      description: 'Master data untuk operasional PSB dan komunikasi marketing.',
      items: [
        { href: '/settings/areas', label: 'Master Area' },
        { href: '/settings/packages', label: 'Master Paket' },
        { href: '/settings/templates', label: 'Template WA' },
      ],
    },
    {
      key: 'admin-system',
      label: 'Admin & Sistem',
      description: 'Pengelolaan user dan fondasi akses dashboard.',
      items: [
        { href: '/settings/users', label: 'Manajemen Pengguna' },
      ],
    },
    {
      key: 'noc-ticketing',
      label: 'NOC & Ticketing',
      description: 'Konfigurasi yang berkaitan dengan trouble ticket dan operasional teknis.',
      items: [
        { href: '/settings/trouble-ticket', label: 'Trouble Ticket' },
      ],
    },
  ] : []

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      window.location.href = '/login'
    } catch (error) {
      console.error('Logout failed', error)
    }
  }

  return (
    <header className={clsx("bg-white dark:bg-gray-800 shadow-sm relative z-20 pt-[env(safe-area-inset-top)]", !isMarketing && "transition-colors")}>
      <div className="mx-auto w-full max-w-7xl md:max-w-none">
        <div className="flex h-16 items-center justify-between px-3 sm:px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-2 md:gap-8">
            <div className="flex items-center gap-3">
              <div className={clsx(
                "flex items-center justify-center bg-white rounded-lg shadow-sm border border-white overflow-hidden",
                isTroubleshoots ? "h-11 w-11" : "h-10 w-10 sm:h-11 sm:w-11"
              )}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src="/logo.png" 
              alt="Ticketing Perkasa Networls" 
              className="h-full w-full object-contain"
            />
            </div>
            {isTroubleshoots && (
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                Ticketing Perkasa Networks
              </div>
            )}
          </div>

          {!isTroubleshoots && isMobilePortrait && (
            <nav className="flex min-w-0 items-center gap-2">
              <div className="relative" ref={navRefMobile}>
                <button
                  onClick={() => {
                    setIsNavOpen(!isNavOpen)
                    setIsSettingsOpen(false)
                  }}
                  className={clsx(
                    'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap',
                    pathname === '/'
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                      : 'text-gray-600 bg-gray-50 hover:bg-gray-100 dark:text-gray-200 dark:bg-gray-800/40 dark:hover:bg-gray-700/50'
                  )}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                  <ChevronDown className={clsx("h-3 w-3 transition-transform", isNavOpen && "rotate-180")} />
                </button>

                {isNavOpen && (
                  <div ref={navOverlayRef} className="fixed top-[calc(4rem+env(safe-area-inset-top))] left-2 z-[60] w-72">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg ring-1 ring-black/5 dark:ring-gray-700 py-1 max-h-[60vh] overflow-y-auto">
                      {isAdmin && adminDivisionGroups.length > 0 ? (
                        <>
                          <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Umum
                          </div>
                          <Link
                            href="/"
                            prefetch={false}
                            onClick={() => setIsNavOpen(false)}
                            className={clsx(
                              'block px-3 py-2 text-sm transition-colors',
                              pathname === '/'
                                ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                                : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700'
                            )}
                          >
                            Dashboard
                          </Link>
                          {adminDivisionGroups.map((group) => (
                            <div key={group.key} className="border-t border-gray-100 dark:border-gray-700">
                              <div className="px-3 pb-2 pt-2">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                    {group.label}
                                  </div>
                                  <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-semibold', getDivisionGroupTone(group.key).badge)}>
                                    Divisi
                                  </span>
                                </div>
                                <p className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                                  {group.description}
                                </p>
                              </div>
                              {group.items.map((link) => (
                                <Link
                                  key={link.href}
                                  href={link.href}
                                  prefetch={false}
                                  onClick={() => setIsNavOpen(false)}
                                  className={clsx(
                                    'block px-3 py-2 text-sm transition-colors',
                                    matchesLink(link)
                                      ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                                      : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700'
                                  )}
                                >
                                  {link.label}
                                </Link>
                              ))}
                            </div>
                          ))}
                        </>
                      ) : (
                        flatLinks.map((link) => {
                          const isActive = matchesLink(link)
                          return (
                            <Link
                              key={link.href}
                              href={link.href}
                              prefetch={false}
                              onClick={() => setIsNavOpen(false)}
                              className={clsx(
                                'block px-3 py-2 text-sm transition-colors',
                                isActive
                                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                                  : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700'
                              )}
                            >
                              {link.label}
                            </Link>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative" ref={settingsRefMobile}>
                <button
                  onClick={() => {
                    setIsSettingsOpen(!isSettingsOpen)
                    setIsNavOpen(false)
                  }}
                  className={clsx(
                    'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap',
                    pathname.startsWith('/settings')
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                      : 'text-gray-600 bg-gray-50 hover:bg-gray-100 dark:text-gray-200 dark:bg-gray-800/40 dark:hover:bg-gray-700/50'
                  )}
                >
                  <Settings className="h-4 w-4" />
                  Pengaturan
                  <ChevronDown className={clsx("h-3 w-3 transition-transform", isSettingsOpen && "rotate-180")} />
                </button>

                {isSettingsOpen && (
                  <div ref={settingsOverlayRef} className="fixed top-[calc(4rem+env(safe-area-inset-top))] right-2 z-[60] w-72">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg ring-1 ring-black/5 dark:ring-gray-700 py-1 max-h-[60vh] overflow-y-auto">
                      {settingsGroups.map((group) => (
                        <div key={group.key} className="border-b border-gray-100 px-3 py-2 last:border-b-0 dark:border-gray-700">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {group.label}
                          </div>
                          <p className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                            {group.description}
                          </p>
                          <div className="mt-2 space-y-1">
                            {group.items.map((link) => (
                              <Link
                                key={link.href}
                                href={link.href}
                                prefetch={false}
                                onClick={() => setIsSettingsOpen(false)}
                                className={clsx(
                                  'block rounded-lg px-3 py-2 text-sm transition-colors',
                                  pathname === link.href
                                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700'
                                )}
                              >
                                {link.label}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                      {settingsGroups.length > 0 && <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>}
                      <div className="px-3 py-2">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Text Size</div>
                        <select
                          value={zoomLevel}
                          onChange={(e) => setZoomLevel(Number(e.target.value))}
                          className="w-full rounded bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs py-1 px-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value={100}>100%</option>
                          <option value={90}>90%</option>
                          <option value={80}>80%</option>
                          <option value={75}>75%</option>
                          <option value={60}>60%</option>
                          <option value={50}>50%</option>
                        </select>
                      </div>
                      <div className="px-3 py-2">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Theme</div>
                        <select
                          value={theme ?? 'system'}
                          onChange={(e) => setTheme(e.target.value)}
                          className="w-full rounded bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs py-1 px-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          suppressHydrationWarning
                        >
                          <option value="light">Light</option>
                          <option value="dark">Dark</option>
                          <option value="system">System</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </nav>
          )}

          {!isTroubleshoots && (
          <nav className="hidden md:flex items-center space-x-1">
            {isAdmin && adminDivisionGroups.length > 0 ? (
              <>
                <Link
                  href="/"
                  prefetch={false}
                  className={clsx(
                    'flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    pathname === '/'
                      ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700/50 dark:hover:text-white'
                  )}
                >
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  Dashboard
                </Link>

                <div className="flex items-center space-x-1" ref={divisionNavRef}>
                  {adminDivisionGroups.map((group) => {
                    const GroupIcon = group.icon
                    const isActive = group.items.some((item) => matchesLink(item))
                    const isOpenGroup = openDivisionMenu === group.key
                    const tone = getDivisionGroupTone(group.key)
                    return (
                      <div key={group.key} className="relative">
                        <button
                          onClick={() => {
                            setOpenDivisionMenu((current) => current === group.key ? null : group.key)
                            setIsSettingsOpen(false)
                          }}
                          className={clsx(
                            'flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                            isActive || isOpenGroup
                              ? tone.buttonActive
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700/50 dark:hover:text-white'
                          )}
                        >
                          <GroupIcon className="h-4 w-4 mr-2" />
                          {group.label}
                          <ChevronDown className={clsx("ml-1 h-3 w-3 transition-transform", isOpenGroup && "rotate-180")} />
                        </button>

                        {isOpenGroup && (
                          <div className={clsx('absolute left-0 mt-2 w-72 overflow-hidden rounded-xl border bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-gray-800 dark:ring-gray-700 z-50', tone.panel)}>
                            <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-700">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <GroupIcon className="h-4 w-4" />
                                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{group.label}</span>
                                </div>
                                <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-semibold', tone.badge)}>
                                  Divisi
                                </span>
                              </div>
                              <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                                {group.description}
                              </p>
                            </div>
                            {group.items.map((link) => {
                              const Icon = link.icon
                              return (
                                <Link
                                  key={link.href}
                                  href={link.href}
                                  prefetch={false}
                                  onClick={() => setOpenDivisionMenu(null)}
                                  className={clsx(
                                    'flex items-center px-4 py-2.5 text-sm transition-colors',
                                    matchesLink(link)
                                      ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                                      : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700'
                                  )}
                                >
                                  <Icon className="mr-2 h-4 w-4" />
                                  {link.label}
                                </Link>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              flatLinks.map((link) => {
                const Icon = link.icon
                const isActive = matchesLink(link)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    prefetch={false}
                    className={clsx(
                      'flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700/50 dark:hover:text-white'
                    )}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {link.label}
                  </Link>
                )
              })
            )}

            <div className="relative" ref={settingsRefDesktop}>
              <button
                onClick={() => {
                  setIsSettingsOpen(!isSettingsOpen)
                  setOpenDivisionMenu(null)
                }}
                className={clsx(
                  'flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  pathname.startsWith('/settings')
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700/50 dark:hover:text-white'
                )}
              >
                <Settings className="h-4 w-4 mr-2" />
                Pengaturan
                <ChevronDown className={clsx("ml-1 h-3 w-3 transition-transform", isSettingsOpen && "rotate-180")} />
              </button>

              {isSettingsOpen && (
                <div className="absolute left-0 mt-2 w-80 overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-gray-800 dark:ring-gray-700 z-50">
                  {settingsGroups.map((group) => (
                    <div key={group.key} className="border-b border-gray-100 px-4 py-3 last:border-b-0 dark:border-gray-700">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {group.label}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                        {group.description}
                      </p>
                      <div className="mt-2 space-y-1">
                        {group.items.map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            prefetch={false}
                            onClick={() => setIsSettingsOpen(false)}
                            className={clsx(
                              'block rounded-lg px-3 py-2 text-sm transition-colors',
                              pathname === link.href
                                ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                                : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700'
                            )}
                          >
                            {link.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}

                  {settingsGroups.length > 0 && (
                    <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                  )}
                  
                  <div className="px-4 py-2">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Text Size</div>
                    <select
                      value={zoomLevel}
                      onChange={(e) => setZoomLevel(Number(e.target.value))}
                      className="w-full rounded bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs py-1 px-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value={100}>100%</option>
                      <option value={90}>90%</option>
                      <option value={80}>80%</option>
                      <option value={75}>75%</option>
                      <option value={60}>60%</option>
                      <option value={50}>50%</option>
                    </select>
                  </div>

                  <div className="px-4 py-2">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Theme</div>
                    <select
                      value={theme ?? 'system'}
                      onChange={(e) => setTheme(e.target.value)}
                      className="w-full rounded bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs py-1 px-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      onClick={(e) => e.stopPropagation()}
                      suppressHydrationWarning
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                      <option value="system">System</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </nav>
          )}
        </div>
        
          <div className="flex items-center space-x-3 sm:space-x-4">
          <div className="hidden md:block text-right">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Hello, {user?.name}
            </h2>
            {divisionLabel && (
              <p className="mt-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                {divisionLabel}
              </p>
            )}
          </div>
        
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setIsOpen(!isOpen)}
              className={clsx("flex items-center space-x-2 focus:outline-none hover:bg-gray-50 dark:hover:bg-gray-700 p-1.5 rounded-lg transition-colors")}
            >
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatar}
                  alt="Foto profil"
                  className="h-8 w-8 rounded-full object-cover ring-1 ring-gray-200 dark:ring-gray-700"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 font-bold text-sm">
                  {user?.name?.charAt(0)}
                </div>
              )}
              <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </button>

            {isOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg py-1 ring-1 ring-black ring-opacity-5 dark:ring-gray-700 z-50">
                 <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{user?.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{user?.role}</p>
                    {divisionLabel && (
                      <p className="mt-1 text-xs font-medium text-blue-600 dark:text-blue-400">{divisionLabel}</p>
                    )}
                 </div>
                 <Link 
                   href="/profile"
                   prefetch={false}
                   className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                   onClick={() => setIsOpen(false)}
                 >
                   <User className="mr-2 h-4 w-4" />
                   View Profile
                 </Link>
                 <button
                    onClick={handleLogout}
                    className="flex w-full items-center px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                 >
                   <LogOut className="mr-2 h-4 w-4" />
                   Logout
                 </button>
              </div>
            )}
          </div>
        </div>
      </div>

        {!isTroubleshoots && !isMobilePortrait && (
        <div className="md:hidden border-t border-gray-100 dark:border-gray-700">
          <nav className="flex items-center gap-2 overflow-x-auto px-3 py-2">
          <div className="relative" ref={navRefMobile}>
            <button
              onClick={() => {
                setIsNavOpen(!isNavOpen)
                setIsSettingsOpen(false)
              }}
              className={clsx(
                'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap',
                pathname === '/'
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                  : 'text-gray-600 bg-gray-50 hover:bg-gray-100 dark:text-gray-200 dark:bg-gray-800/40 dark:hover:bg-gray-700/50'
              )}
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
              <ChevronDown className={clsx("h-3 w-3 transition-transform", isNavOpen && "rotate-180")} />
            </button>

            {isNavOpen && (
              <div ref={navOverlayRef} className="fixed top-[calc(4rem+env(safe-area-inset-top))] left-2 z-[60] w-72">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg ring-1 ring-black/5 dark:ring-gray-700 py-1 max-h-[60vh] overflow-y-auto">
                  {isAdmin && adminDivisionGroups.length > 0 ? (
                    <>
                      <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Umum
                      </div>
                      <Link
                        href="/"
                        prefetch={false}
                        onClick={() => setIsNavOpen(false)}
                        className={clsx(
                          'block px-3 py-2 text-sm transition-colors',
                          pathname === '/'
                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                            : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700'
                        )}
                      >
                        Dashboard
                      </Link>
                      {adminDivisionGroups.map((group) => (
                        <div key={group.key} className="border-t border-gray-100 dark:border-gray-700">
                          <div className="px-3 pb-2 pt-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                {group.label}
                              </div>
                              <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-semibold', getDivisionGroupTone(group.key).badge)}>
                                Divisi
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                              {group.description}
                            </p>
                          </div>
                          {group.items.map((link) => (
                            <Link
                              key={link.href}
                              href={link.href}
                              prefetch={false}
                              onClick={() => setIsNavOpen(false)}
                              className={clsx(
                                'block px-3 py-2 text-sm transition-colors',
                                matchesLink(link)
                                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                                  : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700'
                              )}
                            >
                              {link.label}
                            </Link>
                          ))}
                        </div>
                      ))}
                    </>
                  ) : (
                    flatLinks.map((link) => {
                      const isActive = matchesLink(link)
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          prefetch={false}
                          onClick={() => setIsNavOpen(false)}
                          className={clsx(
                            'block px-3 py-2 text-sm transition-colors',
                            isActive
                              ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                              : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700'
                          )}
                        >
                          {link.label}
                        </Link>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={settingsRefMobile}>
              <button
                onClick={() => {
                  setIsSettingsOpen(!isSettingsOpen)
                  setIsNavOpen(false)
                }}
                className={clsx(
                  'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap',
                  pathname.startsWith('/settings')
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                    : 'text-gray-600 bg-gray-50 hover:bg-gray-100 dark:text-gray-200 dark:bg-gray-800/40 dark:hover:bg-gray-700/50'
                )}
              >
                <Settings className="h-4 w-4" />
                Pengaturan
                <ChevronDown className={clsx("h-3 w-3 transition-transform", isSettingsOpen && "rotate-180")} />
              </button>

              {isSettingsOpen && (
                <div ref={settingsOverlayRef} className="fixed top-[calc(4rem+env(safe-area-inset-top))] right-2 z-[60] w-72">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg ring-1 ring-black/5 dark:ring-gray-700 py-1 max-h-[60vh] overflow-y-auto">
                    {settingsGroups.map((group) => (
                      <div key={group.key} className="border-b border-gray-100 px-3 py-2 last:border-b-0 dark:border-gray-700">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          {group.label}
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                          {group.description}
                        </p>
                        <div className="mt-2 space-y-1">
                          {group.items.map((link) => (
                            <Link
                              key={link.href}
                              href={link.href}
                              prefetch={false}
                              onClick={() => setIsSettingsOpen(false)}
                              className={clsx(
                                'block rounded-lg px-3 py-2 text-sm transition-colors',
                                pathname === link.href
                                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                                  : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700'
                              )}
                            >
                              {link.label}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                    {settingsGroups.length > 0 && <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>}
                    <div className="px-3 py-2">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Text Size</div>
                      <select
                        value={zoomLevel}
                        onChange={(e) => setZoomLevel(Number(e.target.value))}
                        className="w-full rounded bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs py-1 px-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value={100}>100%</option>
                        <option value={90}>90%</option>
                        <option value={80}>80%</option>
                        <option value={75}>75%</option>
                        <option value={60}>60%</option>
                        <option value={50}>50%</option>
                      </select>
                    </div>
                    <div className="px-3 py-2">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Theme</div>
                      <select
                        value={theme ?? 'system'}
                        onChange={(e) => setTheme(e.target.value)}
                        className="w-full rounded bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs py-1 px-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        suppressHydrationWarning
                      >
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                        <option value="system">System</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
          </div>
        </nav>
      </div>
      )}
      </div>
    </header>
  )
}
