'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, FileInput, List, Settings, ChevronDown, ChevronRight, Ban, Wifi, ClipboardList, Wrench } from 'lucide-react'
import { clsx } from 'clsx'
import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { canAccessMenu, canAccessSettingsPage, getDivisionFromRole, getMenuHref, hasAnySettingsAccess } from '@/lib/access'

export function Sidebar({ mobile, onClose, collapsed, user, onExpand }: { mobile?: boolean; onClose?: () => void; collapsed?: boolean; user?: { role: string }; onExpand?: () => void }) {
  const pathname = usePathname()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(() => {
    if (typeof window === 'undefined') return 100
    const savedZoom = window.localStorage.getItem('zoomLevel')
    const n = Number(savedZoom)
    return Number.isFinite(n) && n > 0 ? n : 100
  })
  const { theme, setTheme } = useTheme()
  const isMarketing = user?.role === 'MARKETING'
  const roleDivision = getDivisionFromRole(user?.role)

  useEffect(() => {
    document.documentElement.style.fontSize = `${zoomLevel}%`
    localStorage.setItem('zoomLevel', String(zoomLevel))
  }, [zoomLevel])

  const links = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    ...(canAccessMenu(user?.role, 'input') ? [{ href: getMenuHref('input', roleDivision), label: 'Input PSB', icon: FileInput }] : []),
    ...(canAccessMenu(user?.role, 'list') ? [{ href: getMenuHref('list', roleDivision), label: 'List Data', icon: List }] : []),
    ...(canAccessMenu(user?.role, 'marketing-activities') ? [{ href: getMenuHref('marketing-activities', roleDivision), label: 'Aktivitas Marketing', icon: ClipboardList }] : []),
    ...(canAccessMenu(user?.role, 'isolir') ? [{ href: getMenuHref('isolir', roleDivision), label: 'Isolir', icon: Ban }] : []),
    ...(canAccessMenu(user?.role, 'dismantle') ? [{ href: getMenuHref('dismantle', roleDivision), label: 'Dismantle Perangkat', icon: Wrench }] : []),
    ...(canAccessMenu(user?.role, 'odp') ? [{ href: getMenuHref('odp', roleDivision), label: 'PORT ODP', icon: Wifi }] : []),
    ...(canAccessMenu(user?.role, 'trouble-ticket') ? [{ href: getMenuHref('trouble-ticket', roleDivision), label: 'Trouble Ticket', icon: Wrench }] : []),
  ]

  const hasSettingsAccess = hasAnySettingsAccess(user?.role)

  const settingsLinks = [
    ...(canAccessSettingsPage(user?.role, 'areas') ? [{ href: '/settings/areas', label: 'Master Area' }] : []),
    ...(canAccessSettingsPage(user?.role, 'packages') ? [{ href: '/settings/packages', label: 'Master Paket' }] : []),
    ...(canAccessSettingsPage(user?.role, 'users') ? [{ href: '/settings/users', label: 'Manajemen Pengguna' }] : []),
    ...(canAccessSettingsPage(user?.role, 'templates') ? [{ href: '/settings/templates', label: 'Template WA' }] : []),
    ...(canAccessSettingsPage(user?.role, 'trouble-ticket') ? [{ href: '/settings/trouble-ticket', label: 'Trouble Ticket' }] : []),
    ...(canAccessSettingsPage(user?.role, 'role-audit') ? [{ href: '/settings/role-audit', label: 'Audit Role' }] : []),
    ...(canAccessSettingsPage(user?.role, 'security-logs') ? [{ href: '/settings/security-logs', label: 'Log Aktivitas' }] : []),
  ]

  const handleLinkClick = () => {
    if (mobile && onClose) {
      onClose()
    }
  }

  return (
    <div className={clsx("flex h-full flex-col bg-gray-900 text-white transition-all duration-300", mobile ? "w-full" : (collapsed ? "w-12" : "w-56"))}>
      <nav className={clsx("flex-1 space-y-1 overflow-y-auto pt-20", collapsed ? "px-0 pb-1" : "px-3 pb-3")}>
        {links.map((link) => {
          const Icon = link.icon
          const isActive = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={handleLinkClick}
              prefetch={false}
              className={clsx(
                'flex items-center rounded-lg',
                !isMarketing && 'transition-colors',
                collapsed ? 'justify-center p-1.5' : 'space-x-3 px-3 py-2.5',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
              title={collapsed ? link.label : undefined}
            >
              <Icon className={clsx(collapsed ? "h-5 w-5" : "h-5 w-5")} />
              {!collapsed && <span className="text-sm">{link.label}</span>}
            </Link>
          )
        })}

        {/* Settings Menu */}
        {hasSettingsAccess ? (
        <div className="space-y-1">
          <button
            onClick={() => {
              if (collapsed && onExpand) {
                onExpand()
                setIsSettingsOpen(true)
              } else {
                setIsSettingsOpen(!isSettingsOpen)
              }
            }}
            className={clsx(
              'flex w-full items-center rounded-lg',
              !isMarketing && 'transition-colors',
              collapsed ? 'justify-center p-1.5' : 'justify-between px-3 py-2.5',
              pathname.startsWith('/settings')
                ? 'text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            )}
            title={collapsed ? "Pengaturan" : undefined}
          >
            <div className={clsx("flex items-center", collapsed ? "justify-center" : "space-x-3")}>
              <Settings className={clsx(collapsed ? "h-5 w-5" : "h-5 w-5")} />
              {!collapsed && <span className="text-sm">Pengaturan</span>}
            </div>
            {!collapsed && (
              isSettingsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
            )}
          </button>
          
          {/* Submenu */}
          {!collapsed && isSettingsOpen && (
            <div className="pl-11 space-y-1">
              {settingsLinks.map((link) => {
                const isActive = pathname === link.href
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={handleLinkClick}
                    prefetch={false}
                    className={clsx(
                      'block rounded-lg py-2 px-3 text-sm',
                      !isMarketing && 'transition-colors',
                      isActive
                        ? 'text-blue-400'
                        : 'text-gray-400 hover:text-white'
                    )}
                  >
                    {link.label}
                  </Link>
                )
              })}
              
              <div className="block rounded-lg py-2 px-3 text-sm text-gray-400">
                <div className="mb-1 text-xs">Text Size</div>
                <select
                  value={zoomLevel}
                  onChange={(e) => setZoomLevel(Number(e.target.value))}
                  className="w-full rounded bg-gray-800 border border-gray-700 text-white text-xs py-1 focus:outline-none focus:border-blue-500"
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

              <div className="block rounded-lg py-2 px-3 text-sm text-gray-400">
                <div className="mb-1 text-xs">Theme</div>
                <select
                  value={theme ?? 'system'}
                  onChange={(e) => setTheme(e.target.value)}
                  className="w-full rounded bg-gray-800 border border-gray-700 text-white text-xs py-1 focus:outline-none focus:border-blue-500"
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
        ) : null}

      </nav>
      <div className="border-t border-gray-800 p-2 text-center">
        <span className="text-[10px] font-medium text-white">v1.0.0</span>
      </div>
    </div>
  )
}
