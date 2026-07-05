'use client'

import { User, LogOut, ChevronDown, LayoutDashboard, FileInput, List, Settings, Ban, Wifi, ClipboardList, Wrench, Calendar, Target, Users, TrendingUp } from 'lucide-react'
import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { clsx } from 'clsx'
import { useTheme } from 'next-themes'
import type { SessionUser } from '@/lib/auth'
import { canAccessMenu, getDivisionFromRole, getMenuHref } from '@/lib/access'

function formatDivisionLabel(division?: string | null) {
  switch ((division || '').toUpperCase()) {
    case 'PENJUALAN':
      return 'Penjualan'
    case 'CS_ADMIN':
      return 'CS'
    case 'NOC_TROUBLESHOOTS':
      return 'NOC'
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
        buttonActive: 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-white',
        badge: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200',
        panel: 'border-gray-200 dark:border-gray-700',
      }
    case 'cs-admin':
      return {
        buttonActive: 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-white',
        badge: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200',
        panel: 'border-gray-200 dark:border-gray-700',
      }
    case 'noc-troubleshoots':
      return {
        buttonActive: 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-white',
        badge: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200',
        panel: 'border-gray-200 dark:border-gray-700',
      }
    case 'creator-digital':
      return {
        buttonActive: 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-white',
        badge: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200',
        panel: 'border-gray-200 dark:border-gray-700',
      }
    default:
      return {
        buttonActive: 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-white',
        badge: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200',
        panel: 'border-gray-200 dark:border-gray-700',
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
  const isDismantle = roleUpper === 'DISMANTLE'
  const roleDivision = getDivisionFromRole(user?.role)
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
    : isDismantle
      ? [
          { href: '/dismantle?division=CS_ADMIN&status=OPEN', label: 'Dismantle Open', icon: Wrench },
          { href: '/dismantle?division=CS_ADMIN&status=CLOSED', label: 'Dismantle Close', icon: ClipboardList },
        ]
      : [
        { href: '/', label: 'Dashboard', icon: LayoutDashboard },
        ...(canAccessMenu(user?.role, 'input') ? [{ href: getMenuHref('input', roleDivision), label: 'Input PSB', icon: FileInput }] : []),
        ...(canAccessMenu(user?.role, 'list') ? [{ href: getMenuHref('list', roleDivision), label: 'List Data', icon: List }] : []),
        ...(canAccessMenu(user?.role, 'marketing-activities') ? [{ href: getMenuHref('marketing-activities', roleDivision), label: 'Aktivitas Marketing', icon: ClipboardList }] : []),
        ...(canAccessMenu(user?.role, 'isolir') ? [{ href: getMenuHref('isolir', roleDivision), label: 'Isolir', icon: Ban }] : []),
        ...(canAccessMenu(user?.role, 'dismantle') ? [{ href: getMenuHref('dismantle', roleDivision), label: 'Dismantle', icon: Wrench }] : []),
        ...(canAccessMenu(user?.role, 'odp') ? [{ href: getMenuHref('odp', roleDivision), label: 'PORT ODP', icon: Wifi }] : []),
        ...(canAccessMenu(user?.role, 'trouble-ticket') ? [{ href: getMenuHref('trouble-ticket', roleDivision), label: 'Trouble Ticket', icon: Wrench }] : []),
        ...(canAccessMenu(user?.role, 'content-calendar') ? [{ href: getMenuHref('content-calendar', roleDivision), label: 'Content Calendar', icon: Calendar }] : []),
        ...(canAccessMenu(user?.role, 'campaigns') ? [{ href: getMenuHref('campaigns', roleDivision), label: 'Campaign', icon: Target }] : []),
        ...(canAccessMenu(user?.role, 'digital-leads') ? [{ href: getMenuHref('digital-leads', roleDivision), label: 'Digital Leads', icon: Users }] : []),
        ...(canAccessMenu(user?.role, 'analytics') ? [{ href: getMenuHref('analytics', roleDivision), label: 'Analytics', icon: TrendingUp }] : []),
      ]

  const adminDivisionGroups: HeaderNavGroup[] = isAdmin && !isTroubleshoots
    ? [
        {
          key: 'penjualan',
          label: 'Penjualan',
          icon: FileInput,
          description: 'PSB baru dan aktivitas marketing.',
          items: [
            { href: '/division-performance?division=PENJUALAN', label: 'Ringkasan Divisi', icon: LayoutDashboard, matchDivision: 'PENJUALAN' },
            { href: getMenuHref('input', 'PENJUALAN'), label: 'Input PSB', icon: FileInput },
            { href: getMenuHref('list', 'PENJUALAN'), label: 'List Data', icon: List },
            { href: getMenuHref('marketing-activities', 'PENJUALAN'), label: 'Aktivitas Marketing', icon: ClipboardList },
            { href: getMenuHref('isolir', 'PENJUALAN'), label: 'Isolir', icon: Ban },
            { href: getMenuHref('dismantle', 'PENJUALAN'), label: 'Dismantle', icon: Wrench },
            { href: getMenuHref('odp', 'PENJUALAN'), label: 'PORT ODP', icon: Wifi },
          ],
        },
        {
          key: 'cs-admin',
          label: 'CS',
          icon: Ban,
          description: 'Follow up pelanggan, isolir, dan administrasi layanan.',
          items: [
            { href: '/division-performance?division=CS_ADMIN', label: 'Ringkasan Divisi', icon: LayoutDashboard, matchDivision: 'CS_ADMIN' },
            { href: getMenuHref('input', 'CS_ADMIN'), label: 'Input PSB', icon: FileInput },
            { href: getMenuHref('list', 'CS_ADMIN'), label: 'List Data', icon: List },
            { href: getMenuHref('isolir', 'CS_ADMIN'), label: 'Isolir', icon: Ban },
            { href: getMenuHref('dismantle', 'CS_ADMIN'), label: 'Dismantle Perangkat', icon: Wrench },
            { href: getMenuHref('odp', 'CS_ADMIN'), label: 'PORT ODP', icon: Wifi },
            { href: getMenuHref('trouble-ticket', 'CS_ADMIN'), label: 'Trouble Ticket', icon: ClipboardList },
          ],
        },
        {
          key: 'noc-troubleshoots',
          label: 'NOC',
          icon: Wrench,
          description: 'Aset jaringan dan tindak lanjut teknis.',
          items: [
            { href: '/division-performance?division=NOC_TROUBLESHOOTS', label: 'Ringkasan Divisi', icon: LayoutDashboard, matchDivision: 'NOC_TROUBLESHOOTS' },
            { href: getMenuHref('list', 'NOC_TROUBLESHOOTS'), label: 'List Data', icon: List },
            { href: getMenuHref('odp', 'NOC_TROUBLESHOOTS'), label: 'PORT ODP', icon: Wifi },
            { href: getMenuHref('trouble-ticket', 'NOC_TROUBLESHOOTS'), label: 'Trouble Ticket', icon: Wrench },
          ],
        },
        {
          key: 'creator-digital',
          label: 'Creator Digital',
          icon: TrendingUp,
          description: 'Konten, campaign, leads, dan analytics digital.',
          items: [
            { href: '/division-performance?division=CREATOR_DIGITAL', label: 'Ringkasan Divisi', icon: LayoutDashboard, matchDivision: 'CREATOR_DIGITAL' },
            { href: getMenuHref('input', 'CREATOR_DIGITAL'), label: 'Input PSB', icon: FileInput },
            { href: getMenuHref('list', 'CREATOR_DIGITAL'), label: 'List Data', icon: List },
            { href: getMenuHref('isolir', 'CREATOR_DIGITAL'), label: 'Isolir', icon: Ban },
            { href: getMenuHref('dismantle', 'CREATOR_DIGITAL'), label: 'Dismantle', icon: Wrench },
            { href: getMenuHref('odp', 'CREATOR_DIGITAL'), label: 'PORT ODP', icon: Wifi },
            { href: getMenuHref('content-calendar', 'CREATOR_DIGITAL'), label: 'Content Calendar', icon: Calendar },
            { href: getMenuHref('campaigns', 'CREATOR_DIGITAL'), label: 'Campaign', icon: Target },
            { href: getMenuHref('digital-leads', 'CREATOR_DIGITAL'), label: 'Digital Leads', icon: Users },
            { href: getMenuHref('analytics', 'CREATOR_DIGITAL'), label: 'Analytics', icon: TrendingUp },
          ],
        },
      ]
    : []

  const creatorDigitalGroups: HeaderNavGroup[] =
    roleUpper === 'CREATOR_DIGITAL' && !isTroubleshoots && !isDismantle
      ? [
          {
            key: 'creator-marketing',
            label: 'Pemasaran',
            icon: FileInput,
            description: 'Akses operasional PSB dan tindak lanjut pelanggan.',
            items: [
              { href: getMenuHref('input', roleDivision), label: 'Input PSB', icon: FileInput },
              { href: getMenuHref('list', roleDivision), label: 'List Data', icon: List },
              { href: getMenuHref('isolir', roleDivision), label: 'Isolir', icon: Ban },
              { href: getMenuHref('dismantle', roleDivision), label: 'Dismantle', icon: Wrench },
              { href: getMenuHref('odp', roleDivision), label: 'PORT ODP', icon: Wifi },
            ],
          },
          {
            key: 'creator-digital-menu',
            label: 'Digital',
            icon: TrendingUp,
            description: 'Perencanaan konten, campaign, leads, dan analytics digital.',
            items: [
              { href: getMenuHref('content-calendar', roleDivision), label: 'Content Calendar', icon: Calendar },
              { href: getMenuHref('campaigns', roleDivision), label: 'Campaign', icon: Target },
              { href: getMenuHref('digital-leads', roleDivision), label: 'Digital Leads', icon: Users },
              { href: getMenuHref('analytics', roleDivision), label: 'Analytics', icon: TrendingUp },
            ],
          },
        ]
      : []

  const navGroups = isAdmin ? adminDivisionGroups : creatorDigitalGroups
  const usesGroupedNavigation = navGroups.length > 0

  const hasSettingsAccess = !!user?.role && canAccessMenu(user.role, 'settings')

  const settingsGroups: HeaderSettingsGroup[] = hasSettingsAccess ? [
    {
      key: 'sales-master',
      label: 'Penjualan',
      description: 'Master data PSB dan komunikasi marketing.',
      items: [
        { href: '/settings/areas', label: 'Master Area' },
        { href: '/settings/packages', label: 'Master Paket' },
        { href: '/settings/templates', label: 'Template WA' },
      ],
    },
    {
      key: 'admin-system',
      label: 'Admin & Sistem',
      description: 'Pengguna dan pengaturan akses.',
      items: [
        { href: '/settings/users', label: 'Manajemen Pengguna' },
      ],
    },
    {
      key: 'noc-ticketing',
      label: 'NOC',
      description: 'Konfigurasi trouble ticket dan operasional teknis.',
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
    <header className={clsx("border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 relative z-20 pt-[env(safe-area-inset-top)]", !isMarketing && "transition-colors")}>
      <div className="mx-auto w-full max-w-7xl md:max-w-none">
        <div className="flex h-16 items-center justify-between px-3 sm:px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-2 md:gap-8">
            <div className="flex items-center gap-3">
              <div className={clsx(
                "flex items-center justify-center bg-white rounded-lg shadow-sm border border-white overflow-hidden",
                isTroubleshoots || isDismantle ? "h-11 w-11" : "h-10 w-10 sm:h-11 sm:w-11"
              )}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src="/logo.png" 
              alt="Ticketing Perkasa Networls" 
              className="h-full w-full object-contain"
            />
            </div>
            {(isTroubleshoots || isDismantle) && (
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                {isDismantle ? 'Dismantle Perkasa Networks' : 'Ticketing Perkasa Networks'}
              </div>
            )}
          </div>

          {!isTroubleshoots && !isDismantle && isMobilePortrait && (
            <nav className="flex min-w-0 items-center gap-2">
              <div className="relative" ref={navRefMobile}>
                <button
                  onClick={() => {
                    setIsNavOpen(!isNavOpen)
                    setIsSettingsOpen(false)
                  }}
                  className={clsx(
                    'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium whitespace-nowrap',
                    pathname === '/'
                      ? 'border-gray-300 bg-gray-100 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white'
                      : 'border-gray-200 text-gray-600 bg-white hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700'
                  )}
                >
                  Dashboard
                  <ChevronDown className={clsx("h-3 w-3 transition-transform", isNavOpen && "rotate-180")} />
                </button>

                {isNavOpen && (
                  <div ref={navOverlayRef} className="fixed top-[calc(4rem+env(safe-area-inset-top))] left-2 z-[60] w-72">
                    <div className="max-h-[60vh] overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-md dark:border-gray-700 dark:bg-gray-800">
                      {usesGroupedNavigation ? (
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
                                ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                                : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700'
                            )}
                          >
                            Dashboard
                          </Link>
                          {navGroups.map((group) => (
                            <div key={group.key} className="border-t border-gray-100 dark:border-gray-700">
                              <div className="px-3 pb-2 pt-2">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                  {group.label}
                                </div>
                                <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
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
                                      ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
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
                                  ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
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
                    'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium whitespace-nowrap',
                    pathname.startsWith('/settings')
                      ? 'border-gray-300 bg-gray-100 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white'
                      : 'border-gray-200 text-gray-600 bg-white hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700'
                  )}
                >
                  Pengaturan
                  <ChevronDown className={clsx("h-3 w-3 transition-transform", isSettingsOpen && "rotate-180")} />
                </button>

                {isSettingsOpen && (
                  <div ref={settingsOverlayRef} className="fixed top-[calc(4rem+env(safe-area-inset-top))] right-2 z-[60] w-72">
                    <div className="max-h-[60vh] overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-md dark:border-gray-700 dark:bg-gray-800">
                      {settingsGroups.map((group) => (
                        <div key={group.key} className="border-b border-gray-100 px-3 py-2 last:border-b-0 dark:border-gray-700">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {group.label}
                          </div>
                          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
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
                                    ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
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
                          className="w-full rounded bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs py-1 px-2 focus:outline-none focus:ring-1 focus:ring-gray-400"
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
                          className="w-full rounded bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs py-1 px-2 focus:outline-none focus:ring-1 focus:ring-gray-400"
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

          {!isTroubleshoots && !isDismantle && (
          <nav className="hidden md:flex items-center space-x-1">
            {usesGroupedNavigation ? (
              <>
                <Link
                  href="/"
                  prefetch={false}
                  className={clsx(
                    'flex items-center rounded-md border border-transparent px-3 py-2 text-sm font-medium transition-colors',
                    pathname === '/'
                      ? 'border-gray-200 bg-gray-100 text-gray-900 dark:border-gray-700 dark:bg-gray-700 dark:text-white'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                  )}
                >
                  Dashboard
                </Link>

                <div className="flex items-center space-x-1" ref={divisionNavRef}>
                  {navGroups.map((group) => {
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
                            'flex items-center rounded-md border border-transparent px-3 py-2 text-sm font-medium transition-colors',
                            isActive || isOpenGroup
                              ? tone.buttonActive
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                          )}
                        >
                          {group.label}
                          <ChevronDown className={clsx("ml-1 h-3 w-3 transition-transform", isOpenGroup && "rotate-180")} />
                        </button>

                        {isOpenGroup && (
                          <div className={clsx('absolute left-0 z-50 mt-2 w-72 overflow-hidden rounded-md border bg-white py-1 shadow-md dark:bg-gray-800', tone.panel)}>
                            <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-700">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">{group.label}</span>
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                {group.description}
                              </p>
                            </div>
                            {group.items.map((link) => {
                              return (
                                <Link
                                  key={link.href}
                                  href={link.href}
                                  prefetch={false}
                                  onClick={() => setOpenDivisionMenu(null)}
                                  className={clsx(
                                    'block px-4 py-2.5 text-sm transition-colors',
                                    matchesLink(link)
                                      ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                                      : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700'
                                  )}
                                >
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
                        ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
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
                    ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
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
                                ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
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
                      className="w-full rounded bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs py-1 px-2 focus:outline-none focus:ring-1 focus:ring-gray-400"
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
                      className="w-full rounded bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs py-1 px-2 focus:outline-none focus:ring-1 focus:ring-gray-400"
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
              <p className="mt-0.5 text-xs font-medium text-gray-600 dark:text-gray-300">
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
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 font-bold text-sm">
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
                      <p className="mt-1 text-xs font-medium text-gray-600 dark:text-gray-300">{divisionLabel}</p>
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
                    className="flex w-full items-center px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                 >
                   <LogOut className="mr-2 h-4 w-4" />
                   Logout
                 </button>
              </div>
            )}
          </div>
        </div>
      </div>

        {!isTroubleshoots && !isDismantle && !isMobilePortrait && (
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
                  ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                  : 'text-gray-600 bg-gray-50 hover:bg-gray-100 dark:text-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700'
              )}
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
              <ChevronDown className={clsx("h-3 w-3 transition-transform", isNavOpen && "rotate-180")} />
            </button>

            {isNavOpen && (
              <div ref={navOverlayRef} className="fixed top-[calc(4rem+env(safe-area-inset-top))] left-2 z-[60] w-72">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg ring-1 ring-gray-300 dark:ring-gray-700 py-1 max-h-[60vh] overflow-y-auto">
                  {usesGroupedNavigation ? (
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
                            ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                            : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700'
                        )}
                      >
                        Dashboard
                      </Link>
                      {navGroups.map((group) => (
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
                                  ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
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
                              ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
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
                    ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                    : 'text-gray-600 bg-gray-50 hover:bg-gray-100 dark:text-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700'
                )}
              >
                <Settings className="h-4 w-4" />
                Pengaturan
                <ChevronDown className={clsx("h-3 w-3 transition-transform", isSettingsOpen && "rotate-180")} />
              </button>

              {isSettingsOpen && (
                <div ref={settingsOverlayRef} className="fixed top-[calc(4rem+env(safe-area-inset-top))] right-2 z-[60] w-72">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg ring-1 ring-gray-300 dark:ring-gray-700 py-1 max-h-[60vh] overflow-y-auto">
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
                                  ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
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
                        className="w-full rounded bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs py-1 px-2 focus:outline-none focus:ring-1 focus:ring-gray-400"
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
                        className="w-full rounded bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs py-1 px-2 focus:outline-none focus:ring-1 focus:ring-gray-400"
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
