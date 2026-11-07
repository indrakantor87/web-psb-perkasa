'use client'

import Link from 'next/link'
import {
  Ban,
  CalendarDays,
  ChartNoAxesCombined,
  FileInput,
  List,
  Megaphone,
  Users,
  Wifi,
  Wrench,
} from 'lucide-react'

type Props = {
  userName: string
  statusCounts: { total: number; open: number; close: number; on_progress: number }
}

const shortcuts = [
  { href: '/input?division=ALL', label: 'Input PSB', detail: 'Daftarkan pelanggan baru', icon: FileInput, tone: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' },
  { href: '/list?division=ALL', label: 'List Data', detail: 'Cari dan kelola tiket PSB', icon: List, tone: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300' },
  { href: '/trouble-ticket?division=ALL', label: 'Trouble Ticket', detail: 'Pantau gangguan jaringan', icon: Wrench, tone: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' },
  { href: '/odp?division=ALL', label: 'Port ODP', detail: 'Cek kapasitas dan pelanggan', icon: Wifi, tone: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300' },
  { href: '/dismantle?division=ALL&status=OPEN', label: 'Dismantle', detail: 'Proses perangkat pelanggan', icon: Wrench, tone: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' },
  { href: '/isolir?division=ALL', label: 'Isolir', detail: 'Kelola isolasi layanan', icon: Ban, tone: 'bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300' },
  { href: '/content-calendar?division=CREATOR_DIGITAL', label: 'Content Calendar', detail: 'Jadwal konten', icon: CalendarDays, tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' },
  { href: '/campaigns?division=CREATOR_DIGITAL', label: 'Campaign', detail: 'Kelola campaign', icon: Megaphone, tone: 'bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300' },
  { href: '/digital-leads?division=CREATOR_DIGITAL', label: 'Digital Leads', detail: 'Pantau leads digital', icon: Users, tone: 'bg-pink-50 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300' },
  { href: '/analytics?division=CREATOR_DIGITAL', label: 'Analytics', detail: 'Lihat performa digital', icon: ChartNoAxesCombined, tone: 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300' },
]

export function DeveloperMobileDashboard({ userName, statusCounts }: Props) {
  const firstName = userName.trim().split(/\s+/)[0] || 'Developer'
  const stats = [
    { label: 'Total PSB', value: statusCounts.total, tone: 'text-slate-900 dark:text-white' },
    { label: 'Open', value: statusCounts.open, tone: 'text-amber-700 dark:text-amber-300' },
    { label: 'Proses', value: statusCounts.on_progress, tone: 'text-blue-700 dark:text-blue-300' },
    { label: 'Close', value: statusCounts.close, tone: 'text-emerald-700 dark:text-emerald-300' },
  ]

  return (
    <section className="space-y-5 md:hidden">
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 px-5 py-5 text-white shadow-sm">
        <p className="text-sm text-blue-100">Ruang kerja Developer</p>
        <h1 className="mt-1 text-2xl font-bold">Halo, {firstName}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-200">
          Akses cepat ke modul operasional dan monitoring Perkasa.
        </p>
      </div>

      <section aria-label="Ringkasan PSB">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Ringkasan PSB</h2>
          <Link href="/list?division=ALL" className="text-xs font-medium text-blue-700 dark:text-blue-300">
            Buka data
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">{stat.label}</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${stat.tone}`}>{stat.value.toLocaleString('id-ID')}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Akses Cepat</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">Modul utama</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {shortcuts.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className="min-h-28 rounded-xl border border-slate-200 bg-white p-3 transition active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900"
              >
                <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl ${item.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold leading-tight text-slate-900 dark:text-white">{item.label}</p>
                <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{item.detail}</p>
              </Link>
            )
          })}
        </div>
      </section>
    </section>
  )
}
