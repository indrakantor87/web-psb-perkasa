import { getSession } from '@/lib/auth'
import {
  canAccessMenu,
  canManageHrRecords,
  canMutateMenu,
  canReadFingerprintMachine,
  canRunAttendanceOperations,
  canViewAllDataRole,
  hasAnySettingsAccess,
  isDeveloperRole,
  type AppMenuKey,
} from '@/lib/access'
import { redirect } from 'next/navigation'
import { clsx } from 'clsx'

const roles = [
  'DEVELOPER',
  'ADMIN',
  'PRIORITY',
  'HR',
  'MARKETING',
  'CS',
  'ADMIN_CS',
  'NOC',
  'TEKNISI',
  'TROUBLESHOOTS',
  'DISMANTLE',
  'CREATOR_DIGITAL',
] as const
const menus: AppMenuKey[] = [
  'dashboard',
  'input',
  'list',
  'marketing-activities',
  'daily-activity',
  'isolir',
  'dismantle',
  'odp',
  'trouble-ticket',
  'content-calendar',
  'campaigns',
  'digital-leads',
  'analytics',
  'settings',
]

type AccessMode = 'NONE' | 'READ' | 'MUTATE'

function badgeTone(mode: 'NONE' | 'READ' | 'MUTATE') {
  if (mode === 'MUTATE') return 'bg-green-600 text-white dark:bg-green-500'
  if (mode === 'READ') return 'bg-orange-500 text-white dark:bg-orange-500'
  return 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
}

function modeLabel(mode: 'NONE' | 'READ' | 'MUTATE') {
  if (mode === 'MUTATE') return 'Aktif'
  if (mode === 'READ') return 'Read'
  return '-'
}

export default async function RoleAuditPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!isDeveloperRole(session.user.role)) redirect('/')

  const matrix = roles.map((role) => {
    const menuStates = menus.map((menu) => {
      const canAccess = menu === 'settings' ? hasAnySettingsAccess(role) : canAccessMenu(role, menu)
      if (!canAccess) return { menu, mode: 'NONE' as AccessMode }
      const canMutate = canMutateMenu(role, menu)
      return { menu, mode: (canMutate ? 'MUTATE' : 'READ') as AccessMode }
    })
    return { role, menuStates }
  })
  const controls = roles.map((role) => ({
    role,
    dataScope:
      canViewAllDataRole(role)
        ? (role === 'PRIORITY' ? 'Semua data; baca-saja' : 'Semua data')
        : role === 'MARKETING'
          ? 'Data milik sendiri; owner harus terverifikasi'
          : 'Sesuai menu dan pembatasan divisi',
    employeeManagement: canManageHrRecords(role) ? 'Kelola' : canAccessMenu(role, 'hr') ? 'Baca' : '-',
    attendanceOperations: canRunAttendanceOperations(role) ? 'Sinkronisasi dan impor' : '-',
    fingerprintMachine: canReadFingerprintMachine(role) ? 'Lihat dan konfigurasi' : '-',
    dbUpdate: isDeveloperRole(role) ? 'Khusus Developer; DB_UPDATE_KEY tetap wajib' : '-',
  }))

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">Audit Role</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Ringkasan akses menu per role. Aktif = bisa akses + bisa melakukan perubahan. Read = hanya lihat.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="whitespace-nowrap border-b border-gray-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-300">
                  Role
                </th>
                {menus.map((menu) => (
                  <th
                    key={menu}
                    className="whitespace-nowrap border-b border-gray-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-300"
                  >
                    {menu}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => (
                <tr key={row.role} className="border-b border-gray-200 last:border-b-0 dark:border-gray-700">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                    {row.role}
                  </td>
                  {row.menuStates.map((cell) => (
                    <td key={`${row.role}-${cell.menu}`} className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                      <span className={clsx('inline-flex rounded-full px-2 py-1 text-[11px] font-semibold', badgeTone(cell.mode))}>
                        {modeLabel(cell.mode)}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Cakupan Data dan Kontrol Khusus</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Developer menjadi satu-satunya role untuk konfigurasi mesin fingerprint dan endpoint db-update.
          </p>
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  {['Role', 'Cakupan Data', 'Karyawan', 'Operasi Absensi', 'Mesin Fingerprint', 'db-update'].map((label) => (
                    <th
                      key={label}
                      className="whitespace-nowrap border-b border-gray-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-300"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {controls.map((row) => (
                  <tr key={row.role} className="border-b border-gray-200 last:border-b-0 dark:border-gray-700">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">{row.role}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{row.dataScope}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{row.employeeManagement}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{row.attendanceOperations}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{row.fingerprintMachine}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{row.dbUpdate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
