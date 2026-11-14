import {
  Activity,
  Ban,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  FileInput,
  Fingerprint,
  List,
  MapPinned,
  Megaphone,
  ShieldCheck,
  Users,
  Wifi,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { canAccessMenu, isMarketingServiceManager, isTechnicianRole, normalizeRole, type AppMenuKey } from '@/lib/access'

export type MobileMenuKey = Exclude<AppMenuKey, 'dashboard' | 'settings'>

export type MobileMenuEntry = {
  key: MobileMenuKey
  label: string
  shortLabel?: string
  detail: string
  group: 'Operasional' | 'Digital' | 'HR'
  activePath: string
  icon: LucideIcon
  tone: string
}

export const mobileMenuEntries: MobileMenuEntry[] = [
  { key: 'input', label: 'Input PSB', detail: 'Daftarkan pelanggan baru', group: 'Operasional', activePath: '/input', icon: FileInput, tone: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' },
  { key: 'list', label: 'List Data PSB', shortLabel: 'List PSB', detail: 'Cari dan kelola tiket PSB', group: 'Operasional', activePath: '/list', icon: List, tone: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300' },
  { key: 'marketing-activities', label: 'Aktivitas Marketing', detail: 'Pantau aktivitas marketing', group: 'Operasional', activePath: '/marketing-activities', icon: Activity, tone: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300' },
  { key: 'daily-activity', label: 'Daily Activity', shortLabel: 'Daily', detail: 'Rencana & laporan aktivitas harian', group: 'Operasional', activePath: '/daily-activity', icon: ClipboardList, tone: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' },
  { key: 'isolir', label: 'Isolir', detail: 'Kelola isolasi layanan', group: 'Operasional', activePath: '/isolir', icon: Ban, tone: 'bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300' },
  { key: 'dismantle', label: 'Dismantle', detail: 'Proses perangkat pelanggan', group: 'Operasional', activePath: '/dismantle', icon: Wrench, tone: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' },
  { key: 'odp', label: 'Port ODP', detail: 'Cek kapasitas dan pelanggan', group: 'Operasional', activePath: '/odp', icon: Wifi, tone: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300' },
  { key: 'jalur', label: 'Jalur Jaringan', shortLabel: 'Jalur', detail: 'Peta jalur kabel & titik splice', group: 'Operasional', activePath: '/jalur', icon: MapPinned, tone: 'bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300' },
  { key: 'trouble-ticket', label: 'Trouble Ticket', shortLabel: 'TT', detail: 'Pantau gangguan jaringan', group: 'Operasional', activePath: '/trouble-ticket', icon: ShieldCheck, tone: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' },
  { key: 'content-calendar', label: 'Calendar', detail: 'Jadwal konten', group: 'Digital', activePath: '/content-calendar', icon: CalendarDays, tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' },
  { key: 'campaigns', label: 'Campaign', detail: 'Kelola campaign', group: 'Digital', activePath: '/campaigns', icon: Megaphone, tone: 'bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300' },
  { key: 'digital-leads', label: 'Digital Leads', detail: 'Pantau leads digital', group: 'Digital', activePath: '/digital-leads', icon: Users, tone: 'bg-pink-50 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300' },
  { key: 'analytics', label: 'Analytics', detail: 'Lihat performa digital', group: 'Digital', activePath: '/analytics', icon: ChartNoAxesCombined, tone: 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300' },
  { key: 'hr', label: 'Absensi Karyawan', shortLabel: 'Absen', detail: 'Data absensi dari mesin fingerprint', group: 'HR', activePath: '/hr', icon: Fingerprint, tone: 'bg-lime-50 text-lime-700 dark:bg-lime-950/60 dark:text-lime-300' },
]

export const MOBILE_PRIMARY_ORDER: MobileMenuKey[] = [
  'list',
  'trouble-ticket',
  'odp',
  'jalur',
  'input',
  'content-calendar',
  'digital-leads',
  'isolir',
  'dismantle',
  'campaigns',
  'analytics',
  'marketing-activities',
  'daily-activity',
  'hr',
]

export function canAccessMobileHome(role?: string | null) {
  return Boolean(normalizeRole(role))
}

export function isMobileTechnicianRole(role?: string | null) {
  return isTechnicianRole(role) || normalizeRole(role) === 'NOC'
}

export function getMobileHomeHref(
  role?: string | null,
  position?: string | null,
  subdivision?: string | null,
  division?: string | null
) {
  if (isMarketingServiceManager(role, position, division)) return '/'
  return isMobileTechnicianRole(role) || !canAccessMenu(role, 'dashboard', position, subdivision, division) ? '/beranda' : '/'
}

export function canShowMobilePsbSummary(role?: string | null) {
  return canAccessMenu(role, 'list') && !isMobileTechnicianRole(role)
}

export function getMobileShortcuts(
  role?: string | null,
  position?: string | null,
  subdivision?: string | null,
) {
  return mobileMenuEntries.filter((item) => canAccessMenu(role, item.key, position, subdivision))
}

export function getMobilePrimaryLinks(
  role?: string | null,
  position?: string | null,
  subdivision?: string | null,
) {
  return MOBILE_PRIMARY_ORDER
    .filter((key) => canAccessMenu(role, key, position, subdivision))
    .slice(0, 4)
    .map((key) => mobileMenuEntries.find((item) => item.key === key))
    .filter((item): item is MobileMenuEntry => Boolean(item))
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  DEVELOPER: 'Developer',
  MARKETING: 'Marketing',
  CS: 'CS',
  ADMIN_CS: 'Admin CS',
  NOC: 'NOC',
  TEKNISI: 'Teknisi',
  TROUBLESHOOTS: 'Troubleshoots',
  DISMANTLE: 'Dismantle',
  CREATOR_DIGITAL: 'Creator Digital',
  HR: 'HR',
  FINANCE: 'Finance & HR',
}

export function getRoleLabel(role?: string | null) {
  return ROLE_LABELS[normalizeRole(role)] ?? 'Pengguna'
}
