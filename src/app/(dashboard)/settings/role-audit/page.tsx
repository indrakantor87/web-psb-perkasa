import { getSession } from '@/lib/auth'
import { canAccessMenu, canMutateMenu, type AppMenuKey } from '@/lib/access'
import { redirect } from 'next/navigation'
import { clsx } from 'clsx'

const roles = ['ADMIN', 'MARKETING', 'CS', 'ADMIN_CS', 'NOC', 'TEKNISI', 'TROUBLESHOOTS', 'DISMANTLE'] as const
const menus: AppMenuKey[] = [
  'dashboard',
  'input',
  'list',
  'marketing-activities',
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
  if (!canAccessMenu(session.user.role, 'settings')) redirect('/')

  const matrix = roles.map((role) => {
    const menuStates = menus.map((menu) => {
      const canAccess = canAccessMenu(role, menu)
      if (!canAccess) return { menu, mode: 'NONE' as AccessMode }
      const canMutate = canMutateMenu(role, menu)
      return { menu, mode: (canMutate ? 'MUTATE' : 'READ') as AccessMode }
    })
    return { role, menuStates }
  })

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
    </div>
  )
}
