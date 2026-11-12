'use client'

import { User, LogOut, ChevronDown, LayoutDashboard, FileInput, List, Settings, Ban, Wifi, MapPinned, ClipboardList, Wrench, Calendar, Target, Users, TrendingUp, Fingerprint } from 'lucide-react'
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useSearchParams } from 'next/navigation'
import { clsx } from 'clsx'
import { useTheme } from 'next-themes'
import type { SessionUser } from '@/lib/auth'
import { canAccessMenu, canAccessSettingsPage, getDivisionFromRole, getMenuHref, isReadOnlyRole, isTechnicianRole } from '@/lib/access'
import { SecurityAlertsListener } from '@/components/SecurityAlertsListener'
import { normalizeUserDivision } from '@/lib/user-division'

function formatDivisionLabel(division?: string | null) {
  return normalizeUserDivision(division)
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

export function Header({ user }: { user: SessionUser }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [openDivisionMenu, setOpenDivisionMenu] = useState<string | null>(null)
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
  const isDeveloper = roleUpper === 'DEVELOPER'
  const isTechnician = isTechnicianRole(roleUpper)
  const roleDivision = getDivisionFromRole(user?.role)
  const divisionLabel = formatDivisionLabel(user?.division)
  const currentDivisionParam = (searchParams.get('division') || '').trim().toUpperCase()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const divisionNavRef = useRef<HTMLDivElement>(null)
  const settingsRefDesktop = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.style.fontSize = `${zoomLevel}%`
    localStorage.setItem('zoomLevel', String(zoomLevel))
  }, [zoomLevel])

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
      const inDivisionNav = divisionNavRef.current?.contains(event.target as Node) ?? false
      if (!inDivisionNav) {
        setOpenDivisionMenu(null)
      }
      const inDesktop = settingsRefDesktop.current?.contains(event.target as Node) ?? false
      if (!inDesktop) {
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

  const flatLinks: HeaderNavLink[] = [
        ...(canAccessMenu(user?.role, 'dashboard') ? [{ href: '/', label: 'Dashboard', icon: LayoutDashboard }] : []),
        ...(canAccessMenu(user?.role, 'input') ? [{ href: getMenuHref('input', roleDivision), label: 'Input PSB', icon: FileInput }] : []),
        ...(canAccessMenu(user?.role, 'list') ? [{ href: getMenuHref('list', roleDivision), label: 'List Data', icon: List }] : []),
        ...(canAccessMenu(user?.role, 'marketing-activities') ? [{ href: getMenuHref('marketing-activities', roleDivision), label: 'Aktivitas Marketing', icon: ClipboardList }] : []),
        ...(canAccessMenu(user?.role, 'daily-activity', user?.position, user?.subdivision) ? [{ href: '/daily-activity', label: 'Daily Activity', icon: ClipboardList }] : []),
        ...(canAccessMenu(user?.role, 'isolir')
          ? [{ href: isAdmin || isDeveloper ? '/isolir?division=ALL' : getMenuHref('isolir', roleDivision), label: 'Isolir', icon: Ban }]
          : []),
        ...(canAccessMenu(user?.role, 'dismantle') ? [{ href: getMenuHref('dismantle', roleDivision), label: 'Dismantle', icon: Wrench }] : []),
        ...(canAccessMenu(user?.role, 'odp') ? [{ href: getMenuHref('odp', roleDivision), label: 'PORT ODP', icon: Wifi }] : []),
        ...(canAccessMenu(user?.role, 'jalur') ? [{ href: getMenuHref('jalur', roleDivision), label: 'Jalur', icon: MapPinned }] : []),
        ...(canAccessMenu(user?.role, 'trouble-ticket') ? [{ href: getMenuHref('trouble-ticket', roleDivision), label: 'Trouble Ticket', icon: Wrench }] : []),
        ...(canAccessMenu(user?.role, 'content-calendar') ? [{ href: getMenuHref('content-calendar', roleDivision), label: 'Calendar', icon: Calendar }] : []),
        ...(canAccessMenu(user?.role, 'campaigns') ? [{ href: getMenuHref('campaigns', roleDivision), label: 'Campaign', icon: Target }] : []),
        ...(canAccessMenu(user?.role, 'digital-leads') ? [{ href: getMenuHref('digital-leads', roleDivision), label: 'Digital Leads', icon: Users }] : []),
        ...(canAccessMenu(user?.role, 'analytics') ? [{ href: getMenuHref('analytics', roleDivision), label: 'Analytics', icon: TrendingUp }] : []),
        ...(canAccessMenu(user?.role, 'hr') ? [{ href: getMenuHref('hr', roleDivision), label: 'Absensi', icon: Fingerprint }] : []),
      ]

  const ticketingLinks: HeaderNavLink[] = [
          ...(canAccessMenu(user?.role, 'list')
            ? [{ href: isAdmin || isDeveloper ? '/list?division=ALL' : getMenuHref('list', roleDivision), label: 'Data PSB', icon: List }]
            : []),
          ...(canAccessMenu(user?.role, 'trouble-ticket')
            ? [{ href: getMenuHref('trouble-ticket', roleDivision), label: 'Trouble Ticket', icon: ClipboardList }]
            : []),
          ...(canAccessMenu(user?.role, 'dismantle')
            ? [{ href: getMenuHref('dismantle', roleDivision), label: 'Dismantle', icon: Wrench }]
            : []),
        ]

  const ticketingGroup: HeaderNavGroup | null =
    ticketingLinks.length > 1
      ? {
          key: 'ticketing',
          label: 'Ticketing',
          icon: ClipboardList,
          description: 'Data PSB, Trouble Ticket, dan Dismantle dalam satu menu.',
          items: ticketingLinks,
        }
      : null

  const digitalGroup: HeaderNavGroup | null = isAdmin || isDeveloper
    ? {
        key: 'digital',
        label: 'Digital',
        icon: TrendingUp,
        description: 'Konten, campaign, leads, dan analytics digital.',
        items: [
          ...(canAccessMenu(user?.role, 'content-calendar')
            ? [{ href: getMenuHref('content-calendar', 'CREATOR_DIGITAL'), label: 'Calendar', icon: Calendar }]
            : []),
          ...(canAccessMenu(user?.role, 'campaigns')
            ? [{ href: getMenuHref('campaigns', 'CREATOR_DIGITAL'), label: 'Campaign', icon: Target }]
            : []),
          ...(canAccessMenu(user?.role, 'digital-leads')
            ? [{ href: getMenuHref('digital-leads', 'CREATOR_DIGITAL'), label: 'Digital Leads', icon: Users }]
            : []),
          ...(canAccessMenu(user?.role, 'analytics')
            ? [{ href: getMenuHref('analytics', 'CREATOR_DIGITAL'), label: 'Analytics', icon: TrendingUp }]
            : []),
        ],
      }
    : null

  const matchesGroupPath = (link: HeaderNavLink, group: HeaderNavGroup | null) =>
    group?.items.some((item) => item.href.split('?')[0] === link.href.split('?')[0]) ?? false
  const desktopFlatLinks = flatLinks.filter(
    (link) => !matchesGroupPath(link, ticketingGroup) && !matchesGroupPath(link, digitalGroup),
  )

  // Label menu yang berjalan (marquee) hanya untuk teks yang overflow.
  // Icon tetap statis. Hanya dipakai pada menu yang punya logo (flat links).
  function MarqueeLabel({ children }: { children: ReactNode }) {
    const ref = useRef<HTMLSpanElement>(null)
    const [overflow, setOverflow] = useState(false)

    const measure = useCallback(() => {
      const el = ref.current
      if (!el || el.clientWidth === 0) return
      setOverflow(el.scrollWidth > el.clientWidth + 1)
    }, [])

    useLayoutEffect(() => {
      measure()
    }, [children, measure])

    useEffect(() => {
      // Ukur ulang setelah font selesai dimuat (ukuran teks bisa berubah)
      if (typeof document !== 'undefined' && 'fonts' in document) {
        document.fonts.ready.then(measure).catch(() => {})
      }
      // Ukur ulang saat window di-resize (nav bisa bertambah/sempit)
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }, [measure])

    return (
      <span ref={ref} className={clsx('nav-label', overflow && 'is-overflow')}>
        <span className="nav-label-track">
          <span className="nav-label-text">{children}</span>
          {overflow && <span className="nav-label-text" aria-hidden="true">{children}</span>}
        </span>
      </span>
    )
  }

  const renderFlatNavLink = (link: HeaderNavLink) => {
    const Icon = link.icon
    const isActive = matchesLink(link)
    return (
      <Link
        key={link.href}
        href={link.href}
        prefetch={false}
        onClick={() => setOpenDivisionMenu(null)}
        className={clsx(
          'flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
          isActive
            ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
        )}
      >
        <Icon className="h-4 w-4 mr-2 shrink-0" />
        <MarqueeLabel>{link.label}</MarqueeLabel>
      </Link>
    )
  }

  const renderNavGroup = (group: HeaderNavGroup) => {
    const isOpenGroup = openDivisionMenu === group.key
    const isActive = group.items.some((item) => matchesLink(item))

    return (
      <div key={group.key} className="relative">
        <button
          onClick={() => {
            setOpenDivisionMenu((current) => (current === group.key ? null : group.key))
            setIsSettingsOpen(false)
          }}
          className={clsx(
            'flex items-center rounded-md border border-transparent px-3 py-2 text-sm font-medium transition-colors',
            isActive || isOpenGroup
              ? 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-white'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white',
          )}
        >
          {group.label}
          <ChevronDown className={clsx('ml-1 h-3 w-3 transition-transform', isOpenGroup && 'rotate-180')} />
        </button>

        {isOpenGroup && (
          <div className="absolute left-0 z-50 mt-2 w-72 overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-md dark:border-gray-700 dark:bg-gray-800">
            <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-700">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{group.label}</span>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{group.description}</p>
            </div>
            {group.items.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                prefetch={false}
                onClick={() => setOpenDivisionMenu(null)}
                className={clsx(
                  'block px-4 py-2.5 text-sm transition-colors',
                  matchesLink(link)
                    ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700',
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  // GM/Direktur (role PRIORITY) hanya mendapat kontrol personalisasi UI
  // (Text Size & Theme) pada menu Pengaturan, tanpa tautan menu operasional.
  const settingsGroups: HeaderSettingsGroup[] = isReadOnlyRole(user?.role)
    ? []
    : [
        {
          key: 'sales-master',
          label: 'Penjualan',
          description: 'Master data PSB dan komunikasi marketing.',
          items: [
            ...(canAccessSettingsPage(user?.role, 'areas') ? [{ href: '/settings/areas', label: 'Master Area' }] : []),
            ...(canAccessSettingsPage(user?.role, 'packages') ? [{ href: '/settings/packages', label: 'Master Paket' }] : []),
            ...(canAccessSettingsPage(user?.role, 'templates') ? [{ href: '/settings/templates', label: 'Template WA' }] : []),
          ],
        },
        {
          key: 'admin-system',
          label: 'Admin & Sistem',
          description: 'Pengguna dan pengaturan akses.',
          items: [
            ...(canAccessSettingsPage(user?.role, 'users') ? [{ href: '/settings/users', label: 'Manajemen Pengguna' }] : []),
            ...(canAccessSettingsPage(user?.role, 'role-audit') ? [{ href: '/settings/role-audit', label: 'Audit Role' }] : []),
            ...(canAccessSettingsPage(user?.role, 'security-logs') ? [{ href: '/settings/security-logs', label: 'Log Aktivitas' }] : []),
          ],
        },
        {
          key: 'noc-ticketing',
          label: 'NOC',
          description: 'Konfigurasi trouble ticket dan operasional teknis.',
          items: [
            ...(canAccessSettingsPage(user?.role, 'trouble-ticket')
              ? [{ href: '/settings/trouble-ticket', label: 'Trouble Ticket' }]
              : []),
          ],
        },
      ].filter((group) => group.items.length > 0)

  const settingsPanelClass =
    'overflow-hidden rounded-2xl border border-gray-200 bg-white/95 py-1 shadow-xl backdrop-blur dark:border-gray-700 dark:bg-gray-800/95'
  const settingsControlCardClass =
    'mx-3 my-2 rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/70'
  const settingsSelectClass =
    'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition focus:border-gray-400 focus:outline-none focus:ring-0 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'

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
      {isDeveloper && <SecurityAlertsListener />}
      <div className="mx-auto w-full max-w-7xl md:max-w-none">
        <div className="relative flex h-16 items-center justify-between px-3 sm:px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-2 md:gap-8">
            <div className="flex min-w-0 items-center gap-2 md:gap-3">
              <div className={clsx(
                "flex items-center justify-center bg-white rounded-lg shadow-sm border border-white overflow-hidden",
                isTechnician ? "h-11 w-11" : "h-10 w-10 sm:h-11 sm:w-11"
              )}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src="/logo.png" 
              alt="Ticketing Perkasa Networks" 
              className="h-full w-full object-contain"
            />
            </div>
            {isTechnician && (
                <div className="hidden text-sm font-semibold text-gray-800 dark:text-gray-100 md:block">
                  Operasional Perkasa Networks
                </div>
            )}
          </div>

          <nav ref={divisionNavRef} className="hidden md:flex items-center space-x-1">
            {desktopFlatLinks.slice(0, 1).map(renderFlatNavLink)}
            {ticketingGroup && renderNavGroup(ticketingGroup)}
            {desktopFlatLinks.slice(1).map(renderFlatNavLink)}
            {digitalGroup && renderNavGroup(digitalGroup)}

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
                <div className={clsx('absolute left-0 z-50 mt-2 w-80', settingsPanelClass)}>
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
                  
                  <div className={settingsControlCardClass}>
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Text Size</div>
                    <select
                      value={zoomLevel}
                      onChange={(e) => setZoomLevel(Number(e.target.value))}
                      className={settingsSelectClass}
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

                  <div className={settingsControlCardClass}>
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Theme</div>
                    <select
                      value={theme ?? 'system'}
                      onChange={(e) => setTheme(e.target.value)}
                      className={settingsSelectClass}
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
        </div>
          <Image
            src="/hdr-mble.png"
            alt="Perkasa Networks"
            width={2048}
            height={1152}
            sizes="(max-width: 768px) 38vw, 0px"
            className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-8 w-[clamp(7rem,38vw,9rem)] -translate-x-1/2 -translate-y-1/2 object-cover object-center md:hidden"
          />
        
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

      </div>
    </header>
  )
}
