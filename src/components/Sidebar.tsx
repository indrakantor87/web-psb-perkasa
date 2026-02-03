'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, FileInput, List, Settings, ChevronDown, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'

export function Sidebar({ mobile, onClose, collapsed, user }: { mobile?: boolean; onClose?: () => void; collapsed?: boolean; user?: { role: string } }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(100)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const isMarketing = user?.role === 'MARKETING'

  useEffect(() => {
    setMounted(true)
    const savedZoom = localStorage.getItem('zoomLevel')
    if (savedZoom) {
      setZoomLevel(Number(savedZoom))
    }
  }, [])

  useEffect(() => {
    document.documentElement.style.fontSize = `${zoomLevel}%`
    localStorage.setItem('zoomLevel', String(zoomLevel))
  }, [zoomLevel])

  const links = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    ...(user?.role !== 'TEKNISI' ? [{ href: '/input', label: 'Input PSB', icon: FileInput }] : []),
    { href: '/list', label: 'List Data', icon: List },
  ]

  const hasSettingsAccess = user?.role && ['ADMIN', 'CS', 'NOC'].includes(user.role)

  const settingsLinks = hasSettingsAccess ? [
    { href: '/settings/priorities', label: 'Edit Prioritas' },
    { href: '/settings/users', label: 'Manajemen User' },
  ] : []

  const handleLinkClick = () => {
    if (mobile && onClose) {
      onClose()
    }
  }

  return (
    <div className={clsx("flex h-full flex-col bg-gray-900 text-white transition-all duration-300", mobile ? "w-full" : (collapsed ? "w-12" : "w-56"))}>
      <div className={clsx("flex items-center justify-center border-b border-gray-800 bg-gradient-to-b from-blue-950/30 to-gray-900", collapsed ? "h-12 p-1" : "h-28 p-2")}>
        <div className="relative h-auto w-auto max-w-full flex items-center justify-center bg-gradient-to-br from-white to-blue-50 rounded-xl p-1 shadow-md border border-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src="/logo.png" 
            alt="PERKASA NETWORKS" 
            className={clsx("object-contain", collapsed ? "h-6 w-6" : "h-20 w-auto")}
          />
        </div>
      </div>
      <nav className={clsx("flex-1 space-y-1 overflow-y-auto", collapsed ? "px-0 py-1" : "p-3")}>
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
        <div className="space-y-1">
          <button
            onClick={() => !collapsed && setIsSettingsOpen(!isSettingsOpen)}
            className={clsx(
              'flex w-full items-center rounded-lg',
              !isMarketing && 'transition-colors',
              collapsed ? 'justify-center p-1.5' : 'justify-between px-3 py-2.5',
              pathname.startsWith('/settings')
                ? 'text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            )}
            title={collapsed ? "Settings" : undefined}
          >
            <div className={clsx("flex items-center", collapsed ? "justify-center" : "space-x-3")}>
              <Settings className={clsx(collapsed ? "h-5 w-5" : "h-5 w-5")} />
              {!collapsed && <span className="text-sm">Settings</span>}
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
                <div className="mb-1 text-xs">Ukuran Teks</div>
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

              {mounted && (
                <div className="block rounded-lg py-2 px-3 text-sm text-gray-400">
                  <div className="mb-1 text-xs">Tema</div>
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    className="w-full rounded bg-gray-800 border border-gray-700 text-white text-xs py-1 focus:outline-none focus:border-blue-500"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="light">Terang</option>
                    <option value="dark">Gelap</option>
                    <option value="system">Sistem</option>
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

      </nav>
      <div className="border-t border-gray-800 p-2 text-center">
        <span className="text-[10px] font-medium text-white">v1.0.0</span>
      </div>
    </div>
  )
}
