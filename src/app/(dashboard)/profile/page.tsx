import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ChangePasswordForm from '@/components/ChangePasswordForm'
import { prisma } from '@/lib/prisma'
import { ProfileAvatarForm } from '@/components/ProfileAvatarForm'

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
      return '-'
  }
}

export default async function ProfilePage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const user = session.user
  let avatar: string | null = null
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { avatar: true },
    })
    avatar = dbUser?.avatar ?? null
  } catch {
    avatar = null
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">Profil Saya</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Kelola foto, informasi akun, dan keamanan login.</p>
      </div>
      
      <div className="max-w-2xl overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="px-4 py-4 sm:px-6 sm:py-5">
          <h3 className="text-lg font-semibold leading-6 text-gray-900 dark:text-white">Foto Profil</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            Upload foto profil (JPG/PNG/WEBP, maks 2MB).
          </p>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-4 sm:px-6 sm:py-5">
          <ProfileAvatarForm initialAvatar={avatar} userInitial={user?.name?.charAt(0) ?? 'U'} />
        </div>
      </div>

      <div className="max-w-2xl overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="px-4 py-4 sm:px-6 sm:py-5">
          <h3 className="text-lg font-semibold leading-6 text-gray-900 dark:text-white">Informasi Akun</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">Data akun yang sedang dipakai untuk login.</p>
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700">
          <dl>
            <div className="bg-gray-50 dark:bg-gray-700 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Nama Lengkap</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">{user.name}</dd>
            </div>
            <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Username</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">{user.username}</dd>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Password</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2 flex items-center justify-between">
                <span>********</span>
                <a href="#change-password-form" className="text-xs font-medium text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white">
                  Ganti
                </a>
              </dd>
            </div>
            <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Role</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">{user.role}</dd>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Divisi</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">{formatDivisionLabel(user.division)}</dd>
            </div>
          </dl>
        </div>
      </div>
      
      <ChangePasswordForm />
    </div>
  )
}
