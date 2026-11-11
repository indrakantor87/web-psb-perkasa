'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'

const TABS = [
  { href: '/hr', label: 'Absensi' },
  { href: '/hr/employees', label: 'Daftar Karyawan' },
]

export function HrTabs({ canViewEmployees = true }: { canViewEmployees?: boolean }) {
  const pathname = usePathname()

  // Tab "Daftar Karyawan" hanya untuk role yang boleh melihat semua karyawan.
  if (!canViewEmployees) return null

  return (
    <div className="flex gap-1 rounded-xl border border-line bg-surface p-1">
      {TABS.map((tab) => {
        const active = tab.href === '/hr' ? pathname === '/hr' : pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={clsx(
              'flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium transition',
              active ? 'bg-brand text-white' : 'text-ink-muted hover:bg-surface-muted'
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
