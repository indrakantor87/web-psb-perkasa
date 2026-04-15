'use client'

import { User, LogOut, ChevronDown, LayoutDashboard, FileInput, List, Settings, Ban, Wifi, ClipboardList, Wrench } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import { useTheme } from 'next-themes'
import type { SessionUser } from '@/lib/auth'

export function Header({ user }: { user: SessionUser }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isNavOpen, setIsNavOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [zoomLevel, setZoomLevel] = useState(() => {
    if (typeof window === 'undefined') return 100
    const savedZoom = window.localStorage.getItem('zoomLevel')
    const n = Number(savedZoom)
    return Number.isFinite(n) && n > 0 ? n : 100
  })
  const isMarketing = user?.role === 'MARKETING'
  const isTroubleshoots = (user?.role || '').toUpperCase() === 'TROUBLESHOOTS'
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navRefMobile = useRef<HTMLDivElement>(null)
  const settingsRefDesktop = useRef<HTMLDivElement>(null)
  const settingsRefMobile = useRef<HTMLDivElement>(null)
  const navOverlayRef = useRef<HTMLDivElement>(null)
  const settingsOverlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.style.fontSize = `${zoomLevel}%`
    localStorage.setItem('zoomLevel', String(zoomLevel))
  }, [zoomLevel])

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

  const links = isTroubleshoots
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

  const hasSettingsAccess = user?.role && ['ADMIN', 'CS', 'NOC'].includes(user.role)

  const settingsLinks = hasSettingsAccess ? [
    { href: '/settings/areas', label: 'Master Area' },
    { href: '/settings/users', label: 'Manajemen Pengguna' },
    { href: '/settings/templates', label: 'Template WA' },
    { href: '/settings/trouble-ticket', label: 'Trouble Ticket' },
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
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex h-16 items-center justify-between px-3 sm:px-4 md:px-6">
          <div className="flex items-center space-x-3 md:space-x-8">
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

          {!isTroubleshoots && (
          <nav className="hidden md:flex items-center space-x-1">
            {links.map((link) => {
              const Icon = link.icon
              const isActive = pathname === link.href
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
            })}

            <div className="relative" ref={settingsRefDesktop}>
              <button
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
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
                <div className="absolute left-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg py-1 ring-1 ring-black ring-opacity-5 dark:ring-gray-700 z-50">
                  {settingsLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      prefetch={false}
                      onClick={() => setIsSettingsOpen(false)}
                      className={clsx(
                        'block px-4 py-2 text-sm transition-colors',
                        pathname === link.href
                          ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                          : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700'
                      )}
                    >
                      {link.label}
                    </Link>
                  ))}
                  
                  {settingsLinks.length > 0 && (
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
          <h2 className="hidden md:block text-sm font-medium text-gray-500 dark:text-gray-400">
            Welcome, {user?.name}
          </h2>
        
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setIsOpen(!isOpen)}
              className={clsx("flex items-center space-x-2 focus:outline-none hover:bg-gray-50 dark:hover:bg-gray-700 p-1.5 rounded-lg transition-colors")}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 font-bold text-sm">
                {user?.name?.charAt(0)}
              </div>
              <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </button>

            {isOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg py-1 ring-1 ring-black ring-opacity-5 dark:ring-gray-700 z-50">
                 <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{user?.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{user?.role}</p>
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

        {!isTroubleshoots && (
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
                  {links.map((link) => {
                    const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href))
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
                  })}
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
                    {settingsLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        prefetch={false}
                        onClick={() => setIsSettingsOpen(false)}
                        className={clsx(
                          'block px-3 py-2 text-sm transition-colors',
                          pathname === link.href
                            ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                            : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700'
                        )}
                      >
                        {link.label}
                      </Link>
                    ))}
                    {settingsLinks.length > 0 && <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>}
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
